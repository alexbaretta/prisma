# Sprint 1

### [ ] Tasklet 007: Patch Model And Raw Read Materialization

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

## Validation

Run the failing read and raw-query tests from Tasklet 005. Add or update
lower-level unit tests for the materializer if the behavior can be
isolated without starting a database.
