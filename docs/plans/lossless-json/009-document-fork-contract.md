# Sprint 1

### [DONE] Tasklet 009: Update JSON Types And Generators

## Goal

Update Prisma's public TypeScript JSON type surface so generated client
types match the runtime behavior.

## Instructions

Update the exported runtime JSON utility types first:

- `packages/client/src/runtime/core/types/exported/Json.ts`

Then update both generators so generated Prisma namespace types match:

- `packages/client-generator-js/src/TSClient/PrismaClient.ts`
- `packages/client-generator-ts/src/TSClient/file-generators/PrismaNamespaceFile.ts`

The read-side JSON type must include the lossless numeric type used by
`lossless-json`, not JavaScript `number`.

The write-side JSON input type may be intentionally wider than the read
side. It should accept `LosslessNumber` and ordinary JavaScript `number`
where Prisma JSON inputs currently accept numbers.

## Important Distinctions

- Do not change Prisma non-JSON scalar numeric field types.
- Do not collapse Prisma `Decimal` into JSON numeric token handling.
- Preserve existing Prisma null sentinel types and documentation.

## Pre-Implementation Review

Capture the AGENTS-required review record before editing product code.

## Pre-Implementation Review Record

Observed problem: Prisma Client will now return lossless JSON numeric
values at runtime, but the public JSON utility types and generated
namespace aliases still describe JSON numbers as JavaScript `number`
and do not expose the `LosslessNumber` constructor.

Violated contract: generated clients must type Prisma `Json` reads
accurately, must accept `LosslessNumber` writes, and must keep
non-JSON numeric scalar fields on their existing TypeScript types.

Owning layer: `packages/client/src/runtime/core/types/exported/Json.ts`
owns the runtime JSON utility contracts. `packages/client/src/runtime`
owns the runtime value export. The JS and TS generators own generated
`Prisma` namespace aliases to those runtime contracts.

Intended solution: add `LosslessNumber` to runtime JSON read/input
types and runtime exports, add it to `JsInputValue`, and update both
generator common namespace emitters so generated clients expose
`Prisma.LosslessNumber` from the Prisma runtime rather than importing
`lossless-json` directly.

Rejected wrong-layer solution: do not make generated clients import
`lossless-json` directly and do not represent JSON numbers with
`Decimal` or structural object types. Those approaches couple generated
code to third-party package layout or confuse JSON numeric tokens with
Prisma scalar decimals.

Validation that proves this tasklet: type and generator tests must show
read-side `JsonValue` uses `LosslessNumber`, write-side JSON input
accepts both `LosslessNumber` and ordinary `number`, generated Prisma
namespaces expose `LosslessNumber`, and non-JSON numeric scalar fields
remain `number`/`bigint`/`Decimal` as before.

## Validation

Add or update generated type tests proving:

- reading a JSON field exposes a lossless numeric type;
- writing a JSON field accepts `LosslessNumber`;
- writing a JSON field still accepts ordinary JavaScript `number`;
- non-JSON numeric scalar fields remain unchanged.

Run the focused generator and type tests used by the changed packages.

## Post-Implementation Review Record

Resulting code keeps the third-party dependency behind Prisma runtime
exports. Generated clients expose `Prisma.LosslessNumber` by aliasing
the runtime value/type, and browser namespace generation uses the same
runtime export. No generated code imports `lossless-json` directly.

Read-side `Prisma.JsonValue` no longer includes JavaScript `number`;
JSON numeric tokens are represented by `LosslessNumber`. Write-side
`Prisma.InputJsonValue` remains intentionally wider and accepts both
ordinary JavaScript `number` and `LosslessNumber`.

Non-JSON numeric scalar field types remain unchanged. The native-types
type fixture still asserts `Int` fields as `number` and `BigInt` fields
as `bigint`.

## Validation Performed

Focused serializer test:

```sh
pnpm --filter @prisma/client test serializeJsonQuery.test.ts
```

Result: passed. This confirms `LosslessNumber` is accepted as a client
input value without casts and still serializes through the JSON tag
path.

Generated client type fixtures:

```sh
pnpm --filter @prisma/client test types.test.ts -t "types/json|types/native-types"
```

Result: passed. The JSON fixture proves `Prisma.LosslessNumber`,
`Prisma.JsonValue`, `Prisma.JsonObject`, `Prisma.JsonArray`, and
`Prisma.InputJsonValue` align with the lossless JSON contract. The
native-types fixture proves non-JSON integer and bigint scalar fields
remain `number` and `bigint`.

Generator package builds:

```sh
pnpm --filter @prisma/client-generator-js build
pnpm --filter @prisma/client-generator-ts build
pnpm --filter @prisma/client build
```

Result: passed.

Generator test suites:

```sh
pnpm --filter @prisma/client-generator-js test
pnpm --filter @prisma/client-generator-ts test
```

Result: passed. The TS generator suite initially failed in the existing
workerd case because local Wasm assets were absent from
`packages/cli/build`; after building the CLI package prerequisites and
`pnpm --filter prisma build`, the full TS generator suite passed.
