# Sprint 0

### [ ] Tasklet 004: Map Provider And Raw-Query Boundaries

## Goal

Confirm which provider adapters and raw-query paths preserve DB JSON as
text until Prisma's runtime can parse it losslessly.

## Instructions

Trace the read path for `json` / `jsonb` / provider JSON equivalents in
every provider that Sprint 1 intends to support. Include normal model
queries, raw queries, JSON arrays, relation nesting, batches, and any
in-memory processing path that can parse DB result JSON.

Inspect at least:

- `packages/adapter-pg/src/conversion.ts`
- `packages/adapter-neon/src/conversion.ts`
- `packages/adapter-ppg/src/conversion.ts`
- `packages/adapter-mariadb/src/mariadb.ts`
- `packages/adapter-libsql/src/conversion.ts`
- `packages/adapter-better-sqlite3/src/conversion.ts`
- `packages/adapter-d1/src/conversion.ts`
- `packages/adapter-planetscale/src/conversion.ts`
- `packages/client-engine-runtime/src/interpreter/data-mapper.ts`
- `packages/client-engine-runtime/src/interpreter/serialize-sql.ts`
- `packages/client-engine-runtime/src/interpreter/in-memory-processing.ts`
- `packages/client-engine-runtime/src/json-protocol.ts`
- `packages/client/src/runtime/utils/deserializeRawResults.ts`
- `packages/query-plan-executor/src/logic/app.ts`

## Deliverable

Update this file with:

- provider support matrix;
- exact raw-query JSON materialization path;
- known provider limitations where precision is already lost before
  Prisma sees the value;
- Sprint 1 file list for every required read-path change.

## Pre-Implementation Review

This is a research tasklet. Do not change product code.

## Validation

No product code should be changed in this task. Validation is the
provider support matrix plus `git diff --check` for this task file.
