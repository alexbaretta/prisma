# Sprint 1

### [DONE] Tasklet 007: Patch Model And Raw Read Materialization

## Goal

Use the internal lossless JSON codec when Prisma materializes database
JSON values into Prisma Client results.

## Instructions

Patch every read path identified in Sprint 0 as a DB JSON value path.
Known likely files include:

- `packages/client-engine-runtime/src/interpreter/data-mapper.ts`
- `packages/client-engine-runtime/src/interpreter/serialize-sql.ts`
- `packages/client-engine-runtime/src/interpreter/in-memory-processing.ts`
- `packages/client-engine-runtime/src/json-protocol.ts`
- `packages/client/src/runtime/utils/deserializeRawResults.ts`
- `packages/query-plan-executor/src/logic/app.ts`

Do not patch provider adapters as the primary read fix unless Sprint 0
proved the adapter is the layer that loses precision.

## Edge Cases

- SQL `NULL` remains SQL `NULL` behavior.
- JSON `null` remains JSON `null` behavior.
- JSON values containing a property named `$type` must remain valid JSON
  payloads and must not be confused with Prisma JSON protocol tags.
- Raw queries returning JSON columns use the lossless materializer.
- Raw queries returning JSON cast to text remain strings.

## Pre-Implementation Review

Capture the AGENTS-required review record before editing product code.

## Pre-Implementation Review Record

Observed problem: model JSON reads, raw JSON reads, and DB-generated
row envelopes currently use native JSON parsing before Prisma Client
returns results.

Violated contract: DB JSON column numeric tokens must materialize as
lossless values, while non-JSON scalar fields must keep their existing
Prisma scalar behavior.

Owning layer: `@prisma/client-engine-runtime` owns local SQL result
mapping, raw-result serialization, JSON protocol tagged-value
deserialization, and in-memory row-envelope processing. Provider
adapters are not the primary fix because Sprint 0 proved supported
adapters generally preserve JSON text until runtime materialization.

Intended solution: replace DB JSON and DB row-envelope native parsing
with the shared `client-runtime-utils` codec. Where row-envelope parsing
creates lossless numeric values for non-JSON scalar fields, coerce them
inside `data-mapper.ts` according to the declared `FieldScalarType`.

Rejected wrong-layer solution: do not override driver JSON parsers or
convert every parsed number in a row envelope to JavaScript `number`.
The former duplicates provider policy; the latter would preserve scalar
fields by losing JSON field precision.

Validation that proves this tasklet: the red `json-protocol.test.ts`
and `serialize-sql.test.ts` assertions from Tasklet 005 must pass, and
new lower-level tests must cover row-envelope scalar coercion plus
lossless JSON field preservation.

## Validation

Run the failing read and raw-query tests from Tasklet 005. Add or update
lower-level unit tests for the materializer if the behavior can be
isolated without starting a database.

## Validation Performed

Focused read-path tests:

```sh
pnpm --filter @prisma/client-engine-runtime test json-protocol.test.ts serialize-sql.test.ts data-mapper.test.ts in-memory-processing.test.ts
```

Result: passed. The tests cover JSON protocol materialization, raw SQL
JSON result materialization, row-envelope scalar coercion, JSON field
token preservation, and deterministic in-memory keys for lossless
numeric values.

Focused package build:

```sh
pnpm --filter @prisma/client-engine-runtime build
```

Result: passed after building required workspace package prerequisites.
