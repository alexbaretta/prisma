# Sprint 0

### [DONE] Tasklet 001: Inventory DB JSON API Usage

## Goal

Create a current, code-anchored inventory of every native JavaScript
JSON operation that could affect database JSON value preservation before
changing behavior.

## Instructions

Inventory every `JSON.parse`, `JSON.stringify`, `safeJsonStringify`,
and `toJSON()` boundary in at least:

- `packages/client/src/runtime`
- `packages/client-engine-runtime/src`
- `packages/query-plan-executor/src`
- `packages/json-protocol/src`
- `packages/adapter-*`

Classify each operation as one of:

- DB JSON read materialization;
- DB JSON write parameterization;
- raw query JSON materialization;
- generated client runtime behavior;
- query protocol, query cache, logging, config, build metadata, or
  test-only behavior;
- provider adapter behavior that has already preserved or already lost
  numeric token precision.

## Deliverable

Update this file with an evidence table listing:

- file path;
- function or exported type;
- native JSON operation or JSON type assumption;
- classification;
- whether Sprint 1 must replace, preserve, or explicitly ignore the
  operation;
- reason for that decision.

## Evidence Table

| File | Function or Type | Operation | Classification | Sprint 1 Action | Reason |
| ---- | ---------------- | --------- | -------------- | --------------- | ------ |
| `packages/client-engine-runtime/src/json-protocol.ts:88` | `normalizeTaggedValue` | `JSON.stringify(JSON.parse(value))` for `$type: 'Json'` | DB JSON read materialization / query-plan-executor normalization | Replace | This reparses JSON protocol JSON text into native numbers and then stringifies it again, losing precision before responses reach clients or query-plan-executor callers. |
| `packages/client-engine-runtime/src/json-protocol.ts:152` | `deserializeTaggedValue` | `JSON.parse(value)` for `$type: 'Json'` | DB JSON read materialization | Replace | This is the final Prisma Client unpacking path for normal model JSON results and currently creates lossy JavaScript numbers. |
| `packages/client-engine-runtime/src/interpreter/data-mapper.ts:68` | `mapArrayOrObject` | `JSON.parse(data)` | DB result object materialization | Replace if Sprint 0 proves DB JSON payloads can pass here | This parses string result envelopes before scalar field mapping. If the string can contain JSON field values, lossless parsing is required. |
| `packages/client-engine-runtime/src/interpreter/data-mapper.ts:103` | `mapObject` error construction | `JSON.stringify(node)` and `JSON.stringify(data)` | Error reporting | Preserve or use safe debug stringify | This is not a DB JSON value boundary; it only renders diagnostic text. |
| `packages/client-engine-runtime/src/interpreter/data-mapper.ts:249` | `mapValue` object branch | `safeJsonStringify(value)` | DB JSON read materialization | Replace | Object-typed DB JSON values are serialized into JSON protocol text here. Native stringify would encode any numeric values already materialized by the adapter. |
| `packages/client-engine-runtime/src/interpreter/data-mapper.ts:253` | `mapValue` json branch | `` `${value}` `` | DB JSON read materialization | Preserve, with provider tests | This preserves string JSON returned by adapters. SQLite/D1 scalar direct values still require provider-specific proof in Tasklet 004. |
| `packages/client-engine-runtime/src/interpreter/serialize-sql.ts:62` | `serializeRawValue` | `JSON.parse(value)` for `ColumnTypeEnum.Json` | Raw query JSON materialization | Replace | `$queryRaw` JSON columns are parsed here before `deserializeRawResult`, so precision is lost on raw JSON result paths. |
| `packages/client-engine-runtime/src/interpreter/serialize-sql.ts:70` | `serializeRawValue` | maps `JsonArray` through JSON parser | Raw query JSON array materialization | Replace | JSON arrays returned by raw SQL parse each element with the same lossy parser. |
| `packages/client-engine-runtime/src/interpreter/in-memory-processing.ts:4` | `processRecords` | `JSON.parse(value)` | DB result in-memory relation processing | Replace if string payload can contain JSON values | This parses result strings before pagination/distinct/nested processing and may affect relation-load paths containing JSON fields. |
| `packages/client-engine-runtime/src/interpreter/in-memory-processing.ts:114` | `getRecordKey` | `JSON.stringify(array)` | Cursor/distinct key construction | Preserve or make deterministic for lossless values | This is a cache/key operation, not DB JSON serialization, but Sprint 1 must ensure lossless values produce deterministic keys. |
| `packages/client-engine-runtime/src/parameterization/parameterize.ts:246` | `#handlePrimitive` | `JSON.stringify(value)` when `ScalarMask.Json` | DB JSON write parameterization | Replace | JSON scalar inputs are converted to DB JSON parameter text here. Native stringify is acceptable only for already-lossy JS numbers and must share the codec boundary. |
| `packages/client-engine-runtime/src/parameterization/parameterize.ts:275` | `#handleArray` | `safeJsonStringify(deserializeJsonObject(items))` | DB JSON write parameterization | Replace | JSON array inputs are encoded as DB JSON parameter text here and must preserve `LosslessNumber` tokens. |
| `packages/client-engine-runtime/src/parameterization/parameterize.ts:318` | `#handleObject` | `safeJsonStringify(deserializeJsonObject(obj))` | DB JSON write parameterization | Replace | JSON object inputs are encoded as DB JSON parameter text here and must preserve `LosslessNumber` tokens. |
| `packages/client-engine-runtime/src/parameterization/parameterize.ts:399` | `serializeValue` | `JSON.stringify(value)` | Query placeholder keying | Preserve or make deterministic for lossless values | This is placeholder identity logic, not DB JSON output, but Sprint 1 must ensure `LosslessNumber` does not collapse to an object-shaped or unstable key. |
| `packages/client-engine-runtime/src/utils.ts:135` | `safeJsonStringify` | `JSON.stringify` with BigInt/Uint8Array replacer | Shared DB JSON and logging helper | Split responsibilities | This helper is used both for DB JSON values and query logging. Sprint 1 should introduce a DB JSON codec and leave a non-DB logging helper where appropriate. |
| `packages/client/src/runtime/core/jsonProtocol/serializeJsonQuery.ts:335` | `serializeArgumentsValue` | `jsValue.toJSON()` | Client argument protocol serialization | Review and likely special-case `LosslessNumber` before generic `toJSON` | JSON field inputs cross this boundary before parameterization. Generic `toJSON` can erase the distinction between lossless numeric tokens and ordinary object values. |
| `packages/client/src/runtime/utils/serializeRawParameters.ts:15` | `serializeRawParametersInternal` | `JSON.stringify` over raw parameters | Raw query write parameter protocol | Replace for raw JSON parameters if supported | Raw parameters encode object values before the engine runtime maps them to DB args. JSON object parameters currently stringify with native semantics. |
| `packages/client/src/runtime/utils/serializeRawParameters.ts:30` | `encodeParameter` | `Date.toJSON()` and `Decimal.toJSON()` | Non-JSON scalar raw parameter tagging | Preserve | These are scalar protocol encodings, not DB JSON value parsing. |
| `packages/client/src/runtime/utils/serializeRawParameters.ts:90` | `preprocessObject` | generic `obj.toJSON()` | Raw query parameter object fallback | Review | If raw JSON parameters can contain `LosslessNumber`, this fallback must not convert them to object/string artifacts. |
| `packages/client/src/runtime/utils/deserializeRawParameters.ts:16` | `deserializeRawParameters` | `JSON.parse(serializedParameters)` | Raw query parameter protocol | Preserve as protocol parser, but avoid DB JSON token claims | This parses the client-to-runtime raw parameter envelope, not DB JSON returned from storage. |
| `packages/client/src/runtime/utils/deserializeRawParameters.ts:43` | `decodeParameter` | `JSON.stringify(parameter)` for raw object parameter | Raw query write parameterization | Replace for JSON object parameters if supported | This converts raw object parameters to DB argument strings, so it can be a DB JSON write boundary. |
| `packages/client/src/runtime/core/engines/client/ClientEngine.ts:165` | query event logging | `safeJsonStringify(event.params)` | Query logging | Preserve with non-DB helper | This is user-visible logging of parameters, not the DB value transport itself. |
| `packages/client/src/runtime/core/engines/client/ClientEngine.ts:292` | error transform | `JSON.parse(err.message)` | Rust error protocol | Preserve | Error payload parsing is not DB JSON value handling. |
| `packages/client/src/runtime/core/engines/client/ClientEngine.ts:475` | request error context | `JSON.stringify(query)` | Error context / query compiler request context | Preserve unless `LosslessNumber` enters unparameterized query JSON | Parameterized DB values should be extracted before compile/cache; Sprint 1 must prove lossless values are not lost here. |
| `packages/client/src/runtime/core/engines/client/ClientEngine.ts:486` | cache key | `JSON.stringify(parameterizedQuery)` | Query-plan cache key | Preserve or make deterministic for lossless values | Cache keys may include parameterized shapes. They should not encode DB JSON values after parameterization, but this must be verified with `LosslessNumber`. |
| `packages/client/src/runtime/core/engines/client/ClientEngine.ts:546` | batch request | `JSON.stringify(batchPayload)` | Query compiler protocol | Preserve with proof | This serializes query structure for the query compiler. Sprint 1 must ensure DB JSON values are parameterized before they can be lossy here. |
| `packages/client/src/runtime/core/engines/client/RemoteExecutor.ts:175` | response error parser | `JSON.parse(responseText)` | Remote error protocol | Preserve | This parses error responses, not DB JSON values. |
| `packages/client/src/runtime/core/engines/client/RemoteExecutor.ts:310` | HTTP body encoder | `JSON.stringify(body)` | Remote query protocol | Preserve or audit if Data Proxy carries DB JSON values | This is an executor protocol boundary. Lossless JSON for remote execution may require a separate contract if DB JSON values cross it unparameterized. |
| `packages/client/src/runtime/utils/deserializeRawResults.ts:10` | `deserializeValue` | no JSON parse for `json` type | Raw result final deserialization | Preserve after upstream raw materializer replacement | Raw JSON values are already parsed in `serialize-sql.ts`; this file does not currently parse JSON columns. |
| `packages/query-plan-executor/src/logic/app.ts:119` | `query` | `normalizeJsonProtocolValues(result)` | Query-plan-executor read materialization | Replace via shared codec | The executor normalizes JSON protocol output using `json-protocol.ts`, so its DB JSON response path is lossy today. |
| `packages/query-plan-executor/src/logic/app.ts:157` | `logQuery` | `safeJsonStringify(event.params)` | Query logging | Preserve with non-DB helper | Logging should not own DB JSON serialization. |
| `packages/query-plan-executor/src/log/format.ts:55` | `JsonFormatter.format` | `JSON.stringify(event)` | Log output | Preserve | Log formatting is not DB JSON value handling. |
| `packages/adapter-pg/src/conversion.ts:354` | `toJson` | returns JSON text unchanged | Provider adapter behavior | Preserve | PostgreSQL JSON handling is already delegated to Prisma runtime as text. |
| `packages/adapter-neon/src/conversion.ts:341` | `toJson` | returns JSON text unchanged | Provider adapter behavior | Preserve | Neon mirrors the PostgreSQL text-preserving JSON path. |
| `packages/adapter-ppg/src/conversion.ts:60` | `mapArg` | `JSON.stringify(arg)` for non-string JSON args | DB JSON write parameterization in adapter | Replace or eliminate by ensuring runtime passes JSON strings | This adapter can stringify JSON args itself, so Sprint 1 must prevent native adapter-level JSON serialization from owning DB JSON values. |
| `packages/adapter-ppg/src/conversion.ts:397` | `toJson` | returns JSON text unchanged | Provider adapter behavior | Preserve | Read-side PPG JSON text is preserved. |
| `packages/adapter-mariadb/src/mariadb.ts:58` | request options | `autoJsonMap: false`, `jsonStrings: true` | Provider adapter behavior | Preserve | MariaDB is explicitly configured to avoid driver JSON object parsing. |
| `packages/adapter-mariadb/src/conversion.ts:85` | column mapping | maps JSON metadata to `ColumnTypeEnum.Json` | Provider adapter behavior | Preserve | This identifies JSON columns; runtime materialization still owns parsing. |
| `packages/adapter-planetscale/src/conversion.ts:87` | column mapping | maps `JSON` to `ColumnTypeEnum.Json` | Provider adapter behavior | Audit in Tasklet 004 | The search did not show parser overrides; Tasklet 004 must prove whether the driver returns JSON text or parsed JS values. |
| `packages/adapter-libsql/src/conversion.ts:126` | `UnexpectedTypeError` | `JSON.stringify(value)` | Error reporting | Preserve | This only renders unexpected values in error messages. |
| `packages/adapter-libsql/src/conversion.ts:131` | `mapRow` | no JSON parse/stringify for `ColumnTypeEnum.Json` | Provider adapter behavior | Audit in Tasklet 004 | SQLite/libSQL may return JSON scalars directly; runtime must handle the provider-specific value shape. |
| `packages/adapter-better-sqlite3/src/conversion.ts:142` | `UnexpectedTypeError` | `JSON.stringify(value)` | Error reporting | Preserve | This only renders unexpected values in error messages. |
| `packages/adapter-better-sqlite3/src/conversion.ts:147` | `mapRow` | no JSON parse/stringify for `ColumnTypeEnum.Json` | Provider adapter behavior | Audit in Tasklet 004 | Better SQLite can return native scalar values for JSON expressions; precision guarantees require provider proof. |
| `packages/adapter-d1/src/conversion.ts:100` | `UnexpectedTypeError` | `JSON.stringify(value)` | Error reporting | Preserve | This only renders unexpected values in error messages. |
| `packages/adapter-d1/src/conversion.ts:133` | `mapRow` | `JSON.parse(value as any)` for Boolean | Non-JSON scalar adapter behavior | Preserve | This parser is for Boolean conversion, not JSON columns. |
| `packages/json-protocol/src` | package scan | no matches for native JSON APIs | No action | Ignore | `rg` found no `JSON.parse`, `JSON.stringify`, `safeJsonStringify`, or `toJSON` usage in this package. |
| Runtime `*.test.ts` files | tests and snapshots | native JSON APIs in assertions | Test-only behavior | Update only where assertions cover changed DB JSON semantics | Test serialization does not process DB JSON values, but affected snapshots and parameterization tests will need Sprint 1 updates. |

## Pre-Implementation Review

This is a research tasklet. Do not change product code.

## Validation

No product code should be changed in this task. Validation is the
completed evidence table plus `git diff --check` for this task file.

Validation performed:

- `git diff --check -- docs/plans/lossless-json/001-map-json-pipeline.md`
  passed.
- `rg -n "DB JSON|Raw query|Provider adapter|safeJsonStringify|json-protocol" docs/plans/lossless-json/001-map-json-pipeline.md`
  confirmed the inventory records DB JSON, raw query, provider adapter,
  helper, and JSON protocol classifications.
