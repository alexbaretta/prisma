# Sprint 0

### [DONE] Tasklet 002: Audit Generated JSON API Usage

## Goal

Research generated Prisma Client code and generated fixtures for uses of
native JavaScript JSON APIs that could affect DB JSON values or the
public JSON type contract.

## Instructions

Inspect generator source and generated output for JSON parse/stringify
or `toJSON()` behavior. Include at least:

- `packages/client-generator-js`
- `packages/client-generator-ts`
- generated Prisma namespace files and runtime imports
- generated test fixtures under `packages/client/tests/**/.generated`
  where they are relevant to JSON runtime or type behavior
- generated package metadata only when it can affect runtime JSON
  handling or dependency ownership

Resolve how generated clients will refer to the lossless numeric type:

- direct import from `lossless-json`;
- Prisma runtime re-export;
- generated `Prisma` namespace alias;
- structural type.

Do not leave this decision open for Sprint 1.

## Deliverable

Update this file with:

- generated-code evidence table;
- generated type contract decision;
- runtime import or re-export decision;
- any generator snapshots or fixture files that Sprint 1 must update.

## Generated-Code Evidence Table

| File | Function or Type | Evidence | Classification | Sprint 1 Action |
| ---- | ---------------- | -------- | -------------- | --------------- |
| `packages/client-generator-js/src/TSClient/common.ts:197` | generated `Prisma` utility types | `JsonObject`, `JsonArray`, `JsonValue`, `InputJsonObject`, `InputJsonArray`, and `InputJsonValue` are emitted as `runtime.*` aliases. | Public JSON type surface | Update runtime JSON types first; JS generator should continue aliasing runtime types. |
| `packages/client-generator-ts/src/TSClient/common.ts:76` | generated `Prisma` utility types | The new TS generator emits the same JSON utility types as `runtime.*` aliases. | Public JSON type surface | Update runtime JSON types first; TS generator should continue aliasing runtime types. |
| `packages/client-generator-js/src/TSClient/common.ts:18` | generated runtime destructuring | JS generator destructures runtime values such as `Decimal`, `DbNull`, `JsonNull`, and `AnyNull`, then assigns `Prisma.Decimal`. | Public runtime value surface | Add `LosslessNumber` runtime value re-export and generated `Prisma.LosslessNumber` assignment. |
| `packages/client-generator-ts/src/TSClient/common.ts:43` | generated runtime value aliases | TS generator exports `Decimal` as both value and type from runtime. | Public runtime value surface | Mirror this pattern for `LosslessNumber` so generated clients avoid direct `lossless-json` imports. |
| `packages/client-generator-js/src/utils/common.ts:20` | scalar type table | `Json` maps to `JsonValue`; `JsonValue` maps to `InputJsonValue`. | Model payload and input type generation | Preserve names but change runtime definitions to include lossless numbers. |
| `packages/client-generator-ts/src/utils/common.ts:1` | scalar type table | `Json` maps to `runtime.JsonValue`; `JsonValue` maps to `InputJsonValue`. | Model payload and input type generation | Preserve names but change runtime definitions to include lossless numbers. |
| `packages/client-generator-js/src/typedSql/mapTypes.ts:15` | Typed SQL JSON mapping | JSON input maps to `$runtime.InputJsonObject`; output maps to `$runtime.JsonValue`; JSON arrays map to arrays of those types. | Typed SQL generated type surface | Update runtime JSON types; add typed SQL tests for lossless JSON output if generated SQL fixtures cover JSON columns. |
| `packages/client-generator-ts/src/typedSql/mapTypes.ts:14` | Typed SQL JSON mapping | New TS generator uses the same `$runtime.InputJsonObject` and `$runtime.JsonValue` mapping. | Typed SQL generated type surface | Same as JS generator typed SQL. |
| `packages/client-generator-js/src/TSClient/PrismaClient.ts:83` | raw model actions | `findRaw` and `aggregateRaw` return `JsonObject`; `$runCommandRaw` accepts `Prisma.InputJsonObject` and returns `Prisma.JsonObject`. | Raw JSON public type surface | Preserve names; update runtime JSON object/value definitions and add tests for lossless raw JSON reads. |
| `packages/client-generator-ts/src/TSClient/TypeMap.ts:97` | raw model actions | New TS generator maps raw JSON actions to `JsonObject` / `Prisma.JsonObject` equivalents. | Raw JSON public type surface | Same as JS generator raw action types. |
| `packages/client-generator-js/src/utils/buildDMMF.ts:34` | generated runtime data model hydration | Emits `config.runtimeDataModel = JSON.parse(...)` after `JSON.stringify` / `escapeJson`. | Generated metadata hydration | Preserve. This parses generated schema metadata, not DB JSON values. |
| `packages/client-generator-ts/src/utils/buildDMMF.ts:25` | generated runtime data model hydration | Same generated metadata hydration pattern as JS generator. | Generated metadata hydration | Preserve. |
| `packages/client-generator-js/src/TSClient/TSClient.ts:51` | parameter graph strings | Emits `strings: JSON.parse(...)` for generated parameterization schema strings. | Generated metadata hydration | Preserve. This is generated compiler metadata, not DB JSON values. |
| `packages/client-generator-ts/src/TSClient/file-generators/ClassFile.ts:78` | parameter graph strings | Same generated parameterization schema hydration pattern as JS generator. | Generated metadata hydration | Preserve. |
| `packages/client-generator-js/src/generateClient.ts:269` | generated `package.json` | Uses `JSON.stringify(pkgJson, null, 2)` to write generated package metadata. | Generated package metadata | Preserve for Sprint 1. Revisit in Sprint 2 package rename work only. |
| `packages/client-generator-js/src/generateClient.ts:567` | package-name detection | Uses `JSON.parse(content)` to read package metadata. | Generated package metadata | Preserve. Not a DB JSON value boundary. |
| `packages/client/tests/functional/json-fields/tests.ts:39` | functional JSON test | Existing coverage asserts objects with `.toJSON()` in JSON fields serialize to returned JSON values. | Generated client runtime behavior test | Extend in Sprint 1 so `LosslessNumber` is handled before generic `.toJSON()` erases token semantics. |
| `packages/client/tests/functional/typed-sql/*/test.ts` | typed SQL JSON tests | Existing tests assert typed SQL JSON output is `PrismaNamespace.JsonValue`. | Generated typed SQL tests | Update type expectations only through runtime JSON type changes; add value assertions for lossless output where providers support it. |
| `packages/client/tests/e2e/browser-bundle/tests/main.test.ts:34` | browser bundle type smoke | Asserts browser bundles can use `Prisma.JsonValue`, `JsonObject`, `JsonArray`, and input JSON types. | Generated browser type surface | Update expected assignability: read-side `JsonValue` should no longer require plain `number` for JSON numbers, while input types still accept `number`. |
| `packages/client/tests/functional/_utils/globalSetup.js:6` | test global setup | Adds `BigInt.prototype.toJSON` for Jest serialization. | Test-only serialization | Preserve. Not generated client behavior or DB JSON. |
| `packages/client/tests/**/.generated` | generated fixture checkout | `find packages/client/tests -path '*/.generated/*' -type f` returned `0`. | Generated fixture availability | No generated fixture files are present in this checkout. Sprint 1 must regenerate or inspect generated output through generator tests when changing emitted code. |

## Generated Type Contract Decision

Generated clients should not import `lossless-json` directly. The
runtime package that owns the JSON codec should import the dependency,
define or re-export the lossless numeric type and constructor, and expose
them through the existing generated runtime alias pattern.

Sprint 1 should therefore:

- update `packages/client/src/runtime/core/types/exported/Json.ts` so
  read-side JSON numeric values are represented by the runtime
  `LosslessNumber` type instead of plain `number`;
- keep write-side JSON input types wider, accepting both
  `LosslessNumber` and ordinary JavaScript `number`;
- add runtime exports for `LosslessNumber`;
- update the JS generator to destructure `LosslessNumber` from runtime
  and assign `Prisma.LosslessNumber = LosslessNumber`;
- update generated JS declarations with
  `export import LosslessNumber = runtime.LosslessNumber`;
- update the TS generator with
  `export const LosslessNumber = runtime.LosslessNumber` and
  `export type LosslessNumber = runtime.LosslessNumber`;
- keep `JsonObject`, `JsonArray`, `JsonValue`, `InputJsonObject`,
  `InputJsonArray`, and `InputJsonValue` as generated aliases to
  runtime types.

This keeps generated code coupled to Prisma runtime contracts rather
than to a third-party package layout, and it keeps browser and Node
generated clients consistent.

## Pre-Implementation Review

This is a research tasklet. Do not change product code.

## Validation

No product code should be changed in this task. Validation is the
completed generated-code evidence table plus `git diff --check` for this
task file.

Validation performed:

- `rg -n "JSON\\.(parse|stringify)|safeJsonStringify|\\.toJSON\\(|toJSON\\b|JsonValue|InputJsonValue|JsonObject|InputJsonObject|JsonArray|InputJsonArray" packages/client-generator-js packages/client-generator-ts -g '*.ts'`
  identified generator JSON API and type emission paths.
- `rg -n "JSON\\.(parse|stringify)|safeJsonStringify|\\.toJSON\\(|toJSON\\b|JsonValue|InputJsonValue|JsonObject|InputJsonObject|JsonArray|InputJsonArray" packages/client/tests -g '*.ts' -g '*.d.ts' -g '*.js'`
  identified relevant generated-client type and runtime tests.
- `find packages/client/tests -path '*/.generated/*' -type f | wc -l`
  returned `0`, confirming generated fixture files are not present in
  this checkout.
