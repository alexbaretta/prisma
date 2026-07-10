# Sprint 0

### [DONE] Tasklet 004: Map Provider And Raw-Query Boundaries

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

## Provider Support Matrix

| Provider / adapter | DB JSON read shape before Prisma runtime | Sprint 1 support decision |
| --- | --- | --- |
| PostgreSQL / `js_pg` | `json`, `jsonb`, `json[]`, and `jsonb[]` use custom parsers that return JSON text. | Supported. Replace runtime parsing only. |
| CockroachDB / `js_pg_cockroachdb` | Uses the PostgreSQL adapter path and the same JSON text parsers. | Supported. Cover through PostgreSQL adapter tests. |
| Neon / `js_neon` | Mirrors PostgreSQL conversion and returns JSON text for scalar and array JSON types. | Supported. Cover with `js_neon` functional run where feasible. |
| Prisma Postgres / `adapter-ppg` | Classifies JSON as `ColumnTypeEnum.Json`; built-in parsers keep JSON text. | Supported. Patch runtime; ensure JSON args arrive as strings. |
| MariaDB / `js_mariadb` | Adapter sets `autoJsonMap: false` and `jsonStrings: true`; JSON columns map to strings. | Supported. Patch runtime parsing/stringifying. |
| PlanetScale / `js_planetscale` | `cast()` decodes JSON bytes to UTF-8 text and does not parse JSON. | Supported. Patch runtime parsing/stringifying. |
| LibSQL / `js_libsql` | Declared `JSONB` maps to `ColumnTypeEnum.Json`; row values pass through unchanged. | Supported for Prisma-written JSON text. Driver numeric storage can already be lossy. |
| Better SQLite3 / `js_better_sqlite3` | Declared `JSONB` maps to `ColumnTypeEnum.Json`; row values pass through unchanged. | Supported for Prisma-written JSON text. Driver numeric storage can already be lossy. |
| D1 / `js_d1` | The adapter documents that JSON scalar numbers can be returned as JavaScript numbers. | Partially supported. Object/array JSON text can be lossless; root numeric scalars can be lost before Prisma sees them. |
| SQL Server / `js_mssql` | Functional JSON suites opt out because SQL Server does not support Prisma `Json`. | Out of scope for this branch. |
| MongoDB | Does not use the SQL client-engine JSON text path. | Out of scope for this Sprint 1 migration. |

## Exact Model Read Path

Normal SQL model reads flow as follows:

1. adapter `queryRaw()` returns `SqlResultSet` rows and
   `ColumnTypeEnum.Json` / `JsonArray` column types;
2. `QueryInterpreter.forSql()` uses `serializeSql()` for model queries;
3. `applyDataMap()` maps result fields by query-plan field type;
4. `mapValue(..., { type: 'json' })` creates a JSON tagged value;
5. `RequestHandler.unpack()` calls `deserializeJsonObject()` for
   non-raw operations;
6. `deserializeTaggedValue({ $type: 'Json' })` currently uses
   native `JSON.parse`.

The lossy model read boundary is therefore
`packages/client-engine-runtime/src/json-protocol.ts`, with setup in
`packages/client-engine-runtime/src/interpreter/data-mapper.ts`.

`mapValue(..., { type: 'object' })` currently calls
`safeJsonStringify(value)`. That path is used for DB-generated object
payloads and must delegate to the codec when the object can contain JSON
field values.

## Relation, Batch, And In-Memory Paths

Relation and batch plans can carry DB-generated row envelopes as JSON
strings. `mapArrayOrObject()` currently parses such strings with native
`JSON.parse` before mapping typed fields. That can lose JSON field
numeric tokens before `mapValue(..., { type: 'json' })` sees them.

Sprint 1 must replace that parse with a lossless envelope parse and
then coerce non-JSON scalar fields according to their declared
`FieldScalarType`. This avoids moving all scalar fields to
`LosslessNumber` while preserving JSON field subtrees.

`processRecords()` in `in-memory-processing.ts` has the same native
`JSON.parse` boundary for in-memory pagination, distinct, reversing, and
nested processing. It must parse row envelopes losslessly and keep key
generation deterministic when `LosslessNumber` values are present.

Batch cache keys are produced before execution from parameterized query
trees. They remain deterministic if JSON inputs are parameterized to
stable JSON strings before cache-key serialization, as decided in
Tasklet 003.

## Exact Raw-Query Path

Raw SQL queries flow as follows:

1. client raw args are serialized by
   `packages/client/src/runtime/utils/serializeRawParameters.ts`;
2. local client engine compiles raw queries with
   `deserializeRawParameters()` in `ClientEngine.ts`;
3. `QueryInterpreter.forSql()` uses `serializeRawSql()` for raw query
   results;
4. `serializeRawValue(..., ColumnTypeEnum.Json)` currently calls native
   `JSON.parse(value)`;
5. `serializeRawValue(..., ColumnTypeEnum.JsonArray)` maps the same
   parser over array elements;
6. `RequestHandler.unpack()` calls `deserializeRawResult()` for
   `queryRaw`;
7. `deserializeRawResult()` returns `json` values unchanged.

The lossy raw-query read boundary is therefore
`packages/client-engine-runtime/src/interpreter/serialize-sql.ts`.
`deserializeRawResults.ts` does not currently parse JSON, but its tests
must be updated to expect `LosslessNumber` values in JSON results.

Raw queries returning `json` or `jsonb` columns must use the same JSON
materializer as model reads. Raw queries returning `json::text`,
`jsonb::text`, or provider-equivalent text casts remain plain strings
because the adapter classifies those columns as text.

Typed SQL JSON result tests use the raw-query materialization path and
must be included in Sprint 1 validation.

## Provider Limitations

D1 can return root JSON scalar numbers as JavaScript numbers before
Prisma sees them. Those values are already lossy if they exceed safe
JavaScript number precision. Sprint 1 should document and test this
limitation rather than claiming full D1 root-scalar precision.

SQLite-family adapters preserve Prisma-written JSON values because
Prisma writes JSON parameters as strings. Existing rows written with a
numeric SQLite storage class can be returned as JavaScript numbers and
cannot be recovered losslessly by Prisma.

PostgreSQL `jsonb` and CockroachDB JSONB may canonicalize numeric token
spelling. The branch preserves the DB-returned token text, not the
original application spelling.

SQL Server remains out of scope because the current Prisma JSON
functional suites opt out for SQL Server.

MongoDB remains out of scope for Sprint 1 because it does not use the
SQL adapter `ColumnTypeEnum.Json` text boundary.

## Sprint 1 Read-Path File List

Required read-path patches:

- `packages/client-runtime-utils/src/json-codec.ts`
- `packages/client-runtime-utils/src/index.ts`
- `packages/client-engine-runtime/src/json-protocol.ts`
- `packages/client-engine-runtime/src/utils.ts`
- `packages/client-engine-runtime/src/interpreter/data-mapper.ts`
- `packages/client-engine-runtime/src/interpreter/serialize-sql.ts`
- `packages/client-engine-runtime/src/interpreter/in-memory-processing.ts`
- `packages/client/src/runtime/utils/deserializeRawResults.ts`
- `packages/query-plan-executor/src/logic/app.ts`

Required read-path tests:

- codec unit tests in `packages/client-runtime-utils`;
- JSON tagged-value tests in `client-engine-runtime`;
- data mapper tests for JSON fields inside row envelopes;
- raw serializer tests for `Json` and `JsonArray`;
- in-memory processing tests with JSON numeric payloads;
- client `deserializeRawResults` expectations for JSON values;
- functional JSON precision tests across `js_pg`, `js_neon`,
  `js_pg_cockroachdb`, `js_mariadb`, `js_planetscale`,
  `js_libsql`, `js_better_sqlite3`, and `js_d1` where feasible;
- typed SQL JSON result tests for PostgreSQL, MySQL, and SQLite paths.

## Evidence Checked

- `adapter-pg`, `adapter-neon`, and `adapter-ppg` map JSON OIDs to
  text-preserving parsers.
- `adapter-mariadb` disables automatic JSON object mapping.
- `adapter-planetscale` decodes JSON bytes to UTF-8 text.
- `adapter-libsql` and `adapter-better-sqlite3` pass declared JSONB row
  values through without parsing.
- `adapter-d1` documents the JSON scalar number limitation.
- `serializeRawSql()` is the raw-result serializer used by
  `QueryInterpreter.forSql()`.
- `RequestHandler.unpack()` deserializes non-raw JSON protocol values
  and sends raw results through `deserializeRawResult()`.
