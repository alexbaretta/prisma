# Sprint 1

### [DONE] Tasklet 005: Add Failing Precision Tests

## Goal

Add tests that prove current native JSON behavior loses precision. These
tests must fail before production implementation and pass only after the
lossless JSON migration.

## Required Test Cases

Add focused coverage for both read and write behavior.

Read cases:

- JSON large integer token greater than `Number.MAX_SAFE_INTEGER`;
- JSON decimal token with precision that cannot be represented exactly
  as a JavaScript `number`;
- nested numeric tokens inside arrays and objects;
- JSON `null` inside the payload;
- SQL `NULL` for the entire JSON column.

Write cases:

- input object containing a `LosslessNumber` large integer;
- input object containing a `LosslessNumber` decimal;
- input object containing an ordinary JavaScript `number`, with the test
  documenting that this value is accepted but already lossy if it was
  constructed imprecisely by user code.

Raw query cases:

- `$queryRaw` returning a JSON/JSONB column should use the Prisma JSON
  materializer;
- `$queryRaw` returning `jsonb::text` should return a string.

## Candidate Test Locations

Prefer a narrowly scoped new functional test under:

- `packages/client/tests/functional/lossless-json/`

If a lower-level client-engine-runtime test can isolate the materializer
without a database, add it too, but do not replace the database-backed
functional test with a pure unit test.

## Pre-Implementation Review

Record the observed lossy behavior, the violated JSON preservation
contract, the layer that owns each assertion, and the validation command
before changing implementation code.

## Pre-Implementation Review Record

Observed problem: native JSON parsing in the client-engine runtime turns
large JSON integers and high-precision JSON decimals into JavaScript
`number` values before Prisma Client returns them.

Violated contract: Prisma `Json` DB column numeric tokens must survive
read and raw-query boundaries without client-side precision loss.

Owning layer: `@prisma/client-engine-runtime` owns the current JSON
tagged-value and raw-result materialization paths. Functional coverage
under `packages/client/tests/functional/lossless-json` owns the
end-to-end SQL column behavior.

Intended solution in this tasklet: add tests only. The tests should
fail against the current native JSON implementation and become the
proof used by Tasklets 006 through 009.

Rejected wrong-layer solution: do not add app-level test helpers that
pre-parse or stringify JSON outside Prisma. The assertions must observe
Prisma Client results and the client-engine runtime materializers.

Validation command before implementation:

```sh
pnpm --filter @prisma/client-engine-runtime test json-protocol.test.ts serialize-sql.test.ts
```

## Validation

Run the focused test command for the selected package. Record the exact
command and the failing assertion in this file before implementing the
codec.

## Validation Performed

Installed workspace dependencies with `pnpm install` because this
checkout did not have `node_modules`. Built the narrow prerequisites
required for the focused test runner:

```sh
pnpm --filter @prisma/debug build
pnpm --filter @prisma/client-runtime-utils --filter @prisma/driver-adapter-utils build
```

Then ran:

```sh
pnpm --filter @prisma/client-engine-runtime test json-protocol.test.ts serialize-sql.test.ts
```

The command failed for the intended precision-loss reason:

- `json-protocol.test.ts` expected
  `String(value.large) === '9007199254740993'`, but received
  `'9007199254740992'`.
- `serialize-sql.test.ts` expected
  `String(payload.large) === '9007199254740993'`, but received
  `'9007199254740992'`.

This proves current native JSON parsing loses precision on both the
normal Prisma JSON protocol read materializer and the raw SQL JSON
result materializer.
