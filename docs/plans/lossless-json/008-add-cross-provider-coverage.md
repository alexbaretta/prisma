# Sprint 1

### [DONE] Tasklet 008: Patch Write Parameterization

## Goal

Use the internal lossless JSON codec when Prisma serializes JSON field
inputs into query parameters.

## Instructions

Patch the write path where JSON values are converted into query-plan
parameters. Known files to inspect are:

- `packages/client/src/runtime/core/jsonProtocol/serializeJsonQuery.ts`
- `packages/client-engine-runtime/src/parameterization/classify.ts`
- `packages/client-engine-runtime/src/parameterization/parameterize.ts`
- `packages/client-engine-runtime/src/utils.ts`

The implementation must ensure `LosslessNumber` values inside JSON
inputs serialize as numeric JSON tokens. They must not become quoted
strings or object-shaped artifacts.

Keep Prisma `Decimal` scalar handling separate. Do not reinterpret a
Prisma `Decimal` scalar as a JSON numeric token unless it is explicitly
inside a Prisma `Json` field value and the JSON codec owns that
serialization.

## Edge Cases

- Query parameter cache keys or placeholder identity logic that uses
  stringified JSON must remain deterministic.
- Unsupported JSON input values should fail with actionable errors.
- Plain JavaScript numbers remain accepted as write-side inputs.
- Client serialization must not lose `LosslessNumber` before
  parameterization sees the JSON field value.

## Pre-Implementation Review

Capture the AGENTS-required review record before editing product code.

## Pre-Implementation Review Record

Observed problem: Prisma's write path can serialize JSON field inputs
through native `JSON.stringify`, `safeJsonStringify`, or generic
`.toJSON()` before the query-plan parameterizer turns those inputs into
database JSON parameter text.

Violated contract: `LosslessNumber` values inside Prisma `Json` inputs
must reach the database as unquoted numeric JSON tokens. They must not
be flattened into strings, object-shaped implementation details, or
ordinary lossy JavaScript numbers before DB JSON parameterization.

Owning layer: `@prisma-lossless/client` owns conversion from JavaScript arguments
to the JSON protocol tree, and `@prisma-lossless/client-engine-runtime` owns
schema-aware parameterization from that protocol tree into placeholder
values. The shared codec in `@prisma-lossless/client-runtime-utils` owns the
actual JSON field stringification policy.

Intended solution: teach the client serializer to recognize
`LosslessNumber` before generic JSON-convertible objects and emit the
existing `{ $type: 'Json', value: '<token>' }` tagged shape. Then teach
the parameterizer to use `stringifyJsonFieldValue` for JSON scalar,
array, object, and tagged-JSON placeholder values, and make placeholder
identity deterministic for lossless JSON text.

Rejected wrong-layer solution: do not rely on `LosslessNumber.toJSON()`
or adapter-level JSON argument conversion. Generic `toJSON()` lacks
field context and can make lossless numeric tokens look like strings or
objects; adapter conversion is too late and duplicates runtime JSON
policy.

Validation that proves this tasklet: serializer tests must show a
`LosslessNumber` reaches the JSON protocol as a `Json` tag before
generic `toJSON()` handling, and parameterization tests must show JSON
placeholder values contain unquoted numeric tokens for top-level and
nested lossless JSON inputs while preserving deterministic placeholder
reuse.

## Validation

Run the failing write tests from Tasklet 005. Add unit tests for the
parameterization helper showing that a `LosslessNumber` survives into
the parameter text as an unquoted JSON numeric token.

## Post-Implementation Review Record

Resulting code matches the ownership decision: `serializeJsonQuery.ts`
recognizes `LosslessNumber` before generic JSON-convertible object
handling, while `parameterize.ts` delegates JSON placeholder text to the
shared codec. Provider adapters and raw protocol envelope parsing were
not changed in this tasklet.

The implementation does not reinterpret Prisma `Decimal` scalar values
as JSON numbers. `Decimal` keeps its existing tagged scalar path unless
the value is already inside a JSON object that the JSON codec owns.

Primitive JSON scalar inputs now become `Json` placeholders before
ordinary primitive scalar matching, so string, number, and boolean
JSON field writes use database JSON parameter text instead of normal
string, numeric, or boolean placeholders.

The DB-backed functional write test from Tasklet 005 still depends on
Tasklet 009 because it uses generated `Prisma.LosslessNumber`. This
tasklet therefore validates the write path at the two boundaries it
owns and leaves the generated-client round trip to Tasklets 009 and 010.

## Validation Performed

Focused parameterization tests:

```sh
pnpm --filter @prisma-lossless/client-engine-runtime test parameterize.test.ts
```

Result: passed. The tests cover primitive JSON scalar parameterization,
nested JSON protocol `LosslessNumber` tags, top-level JSON numeric
tags, and deterministic placeholder reuse for equivalent lossless JSON
protocol values.

Focused client serializer tests:

```sh
pnpm --filter @prisma-lossless/client test serializeJsonQuery.test.ts
```

Result: passed after building missing workspace prerequisites. The
tests cover top-level and nested `LosslessNumber` arguments reaching the
JSON protocol as `{ $type: 'Json', value: '<token>' }` before generic
object handling can expose implementation fields.

Affected package builds:

```sh
pnpm --filter @prisma-lossless/client-engine-runtime build
pnpm --filter @prisma-lossless/client build
```

Result: both passed.
