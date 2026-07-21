# Sprint 5

### [DONE] Tasklet 019: Preserve Raw JSON Parameters

Branch: `target-7.8.0-lossless`

Status: complete in release `7.8.0-lossless.5`.

## Goal

Preserve `LosslessNumber` values when a JSON object is passed through
Prisma Client `$queryRaw` or `$executeRaw`. Publish the correction as a
new immutable private release without changing model JSON behavior.

The validated private release is `7.8.0-lossless.4`. Do not overwrite
it. The corrected release must use the next available immutable version.

## Consumer Evidence

GWEN's dedicated PostgreSQL integration suite passed model create,
model update, model read, interactive transaction, raw JSON result, and
raw JSON text coverage against `7.8.0-lossless.4`.

The same suite failed for this parameterized query shape:

```ts
const input = {
  nested: {
    value: new Prisma.LosslessNumber('9007199254740993'),
  },
}

await prisma.$queryRaw`SELECT ${input}::jsonb AS value`
```

The returned JSON contained the `LosslessNumber` implementation object
instead of the numeric token `9007199254740993`.

`packages/client/src/runtime/utils/serializeRawParameters.ts` still uses
native `JSON.stringify` for the raw-parameter envelope and has no
`LosslessNumber` case. Its paired deserializer also uses native JSON
parsing and stringification for object parameters.

## Violated Contract

Prisma `Json` inputs containing `LosslessNumber` must serialize those
values as unquoted JSON numeric tokens, including when an object is a
raw SQL parameter. A raw-query path may not silently change a JSON
number into an object or round its token.

This is part of the fork's existing lossless JSON contract. It is not a
new GWEN application contract and must not be hidden by pre-stringifying
objects in the consumer.

## Owning Layer

The Prisma Client raw-parameter codec owns the fix. Inspect these paired
boundaries before editing:

- `packages/client/src/runtime/utils/serializeRawParameters.ts`;
- `packages/client/src/runtime/utils/deserializeRawParameters.ts`;
- `packages/client/src/runtime/core/raw-query/rawQueryArgsMapper.ts`;
- `packages/client/src/runtime/core/engines/client/ClientEngine.ts`; and
- the JSON codec in `packages/client-runtime-utils`.

Do not move the correction into `@prisma-lossless/adapter-pg`. The
client must hand every adapter the correct JSON parameter text and type.

## Pre-Implementation Review

Observed problem: nested `LosslessNumber` values in raw object
parameters reach PostgreSQL as implementation objects rather than JSON
numeric tokens.

Violated invariant: every Prisma-owned database JSON parameter boundary
must preserve exact numeric tokens and use the shared lossless codec.

Owning layer: Prisma Client owns raw-parameter envelope encoding and
decoding. The client runtime utilities own the shared lossless JSON
codec.

Intended solution: add an explicit raw JSON parameter representation
whose payload is serialized and parsed through the shared lossless JSON
codec. Preserve the existing tagged handling for dates, decimals,
bytes, bigints, scalar parameters, and SQL array parameters. Carry the
correct `json` argument type to driver adapters.

Rejected wrong-layer solution: do not require consumers to call a
special stringify helper, pass quoted JSON manually, or patch the
PostgreSQL adapter. Those approaches bypass Prisma Client's public raw
query path and leave other adapters inconsistent.

Validation: add failing unit coverage first, then database-backed
functional coverage through the JavaScript PostgreSQL adapter. Prove
the released packages in a fresh external consumer.

## Implementation Steps

1. Add failing serializer and deserializer unit tests for a raw JSON
   object containing every required numeric token, nested objects,
   arrays, JSON null, and quoted numeric strings.
2. Add a failing PostgreSQL functional test for `$queryRaw` and
   `$executeRaw` JSON object parameters. Inspect `jsonb_typeof` and text
   output to prove numeric tokens remain unquoted.
3. Implement one raw JSON parameter codec using the shared lossless JSON
   helpers. Keep raw scalar, date, decimal, byte, bigint, and SQL array
   semantics unchanged.
4. Add failure coverage for unsupported values and malformed tagged raw
   parameters. Do not introduce a silent fallback to native JSON.
5. Run focused client, client-runtime-utils, client-engine-runtime, and
   PostgreSQL adapter tests. Run the relevant project build.
6. Record the post-implementation review and exact validation evidence
   in this plan.
7. Build and publish the next immutable private release through the
   existing guarded Verdaccio workflow. Do not publish worldwide.
8. Install the release in a clean external consumer and rerun the
   complete raw JSON parameter precision matrix.
9. Update `MIGRATION_FROM_PRISMA.md` with the validated package version
   and the supported raw JSON parameter behavior.

## Required Precision Matrix

- `9007199254740993`;
- `-9007199254740993`;
- `0.12345678901234567890123456789`;
- `1.234567890123456789e+30`;
- `42`; and
- `1.25`.

## Acceptance Criteria

- Raw JSON object parameters preserve the complete precision matrix.
- Nested objects and arrays materialize as `LosslessNumber` values.
- PostgreSQL stores every numeric value as an unquoted JSON number.
- `jsonb_typeof` reports `number` for numeric tokens and `string` for
  deliberately quoted numeric strings.
- Existing special raw parameter and SQL array tests still pass.
- No consumer-side pre-stringification is required.
- Focused builds and tests pass.
- A clean consumer installs and validates the new immutable private
  release from `http://127.0.0.1:4873/`.
- The release is documented without making public npm publication a
  prerequisite.

## Post-Implementation Review

Observed result: raw SQL parameters that are root `LosslessNumber`
values or plain JSON objects containing nested `LosslessNumber` values
now use an explicit `{ prisma__type: "json" }` raw parameter tag. The
tag payload is produced by the shared lossless JSON codec, then
validated by the paired deserializer and sent to adapters as a `json`
scalar argument.

Contract review: the fix stays in Prisma Client's raw-parameter codec.
It does not require consumer pre-stringification, does not move
responsibility into `@prisma-lossless/adapter-pg`, and does not change
ordinary raw scalar, date, decimal, byte, bigint, or SQL array
semantics. Ordinary raw object parameters without `LosslessNumber`
values retain their prior `unknown` raw argument behavior.

Rejected after implementation: replacing the entire raw parameter
envelope with lossless JSON parsing/stringifying would have broadened
the change to non-JSON SQL parameters. Treating every plain object as
`json` would have changed existing raw object type inference. Both
approaches were avoided.

Validation evidence:

- Pre-fix focused unit tests failed for the expected reason: root and
  nested `LosslessNumber` raw parameters serialized as implementation
  objects and malformed tagged JSON did not fail.
- The focused raw-parameter unit tests passed: `2` suites, `31`
  tests.

  ```sh
  pnpm --filter @prisma-lossless/client test \
    serializeRawParameters.test.ts deserializeRawParameters.test.ts
  ```

- `pnpm --filter @prisma-lossless/client build` passed and refreshed
  the local runtime artifact used by generated functional clients.
- The PostgreSQL functional suite passed against local PostgreSQL:
  `1` suite, `5` executed tests, `40` skipped matrix entries.

  ```sh
  PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='go ahead' \
    pnpm --filter @prisma-lossless/client test:functional:code \
    --adapter js_pg lossless-json
  ```

- `pnpm --filter @prisma-lossless/client-runtime-utils test
src/json-codec.test.ts` passed: `1` file, `6` tests.
- The focused client-engine-runtime tests passed:
  `3` files, `39` tests.

  ```sh
  pnpm --filter @prisma-lossless/client-engine-runtime test \
    src/json-protocol.test.ts src/interpreter/data-mapper.test.ts \
    src/parameterization/parameterize.test.ts
  ```

- `pnpm --filter @prisma-lossless/adapter-pg test` passed:
  `3` files, `47` tests.
- `pnpm build` first failed in the sandbox with `tsx` IPC
  `listen EPERM`, then passed outside the sandbox:
  `44` tasks successful.
- Published `7.8.0-lossless.5` to `http://127.0.0.1:4873/`
  with source commit
  `f98f2e0f42cd7d9d9556567f9236c98eed00da16`.
- Registry metadata for `@prisma-lossless/client`,
  `@prisma-lossless/adapter-pg`, and `prisma-lossless` reports
  version `7.8.0-lossless.5` and the same source commit.
- Clean consumer
  `tmp/lossless-json-tasklet-019/consumer-7.8.0-lossless.5`
  installed exact `.5` packages, generated, typechecked, and passed
  the PostgreSQL smoke. The smoke covers model reads, model writes,
  raw JSON result reads, raw JSON text casts, and `$queryRaw` /
  `$executeRaw` JSON object parameter precision.
- GWEN backend was updated locally from `.4` to `.5`, regenerated, and
  its dedicated PostgreSQL integration suite passed: `1` file, `3`
  tests.

  ```sh
  DATABASE_URL='postgresql://alex@127.0.0.1:5432/gwe_prisma_lossless_test?schema=gwe' \
    pnpm --filter @gwe/backend test:prisma-lossless:integration
  ```
