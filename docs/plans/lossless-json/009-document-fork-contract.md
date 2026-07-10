# Sprint 1

### [ ] Tasklet 009: Update JSON Types And Generators

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

## Validation

Add or update generated type tests proving:

- reading a JSON field exposes a lossless numeric type;
- writing a JSON field accepts `LosslessNumber`;
- writing a JSON field still accepts ordinary JavaScript `number`;
- non-JSON numeric scalar fields remain unchanged.

Run the focused generator and type tests used by the changed packages.
