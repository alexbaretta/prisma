# Lossless JSON Migration Plan

Branch: `target-7.8.0-lossless`

Status: Draft plan for implementation in the Prisma fork. Production
code must not change until Sprint 0 is complete and the implementation
scope has been approved.

## Purpose

Migrate Prisma's `Json` scalar handling away from native JavaScript
`JSON.parse` / `JSON.stringify` semantics, where JSON numeric tokens
are materialized as lossy JavaScript `number`, and toward a
`lossless-json` based implementation where JSON numeric tokens survive
Prisma read/write boundaries without precision loss.

The core product requirement for this branch is stronger than adding a
helper at an application call site: Prisma Client must not silently
convert JSON numeric tokens in `Json` fields into lossy JavaScript
numbers.

## Architectural Direction

Use a Prisma-owned JSON codec boundary inside the client runtime and
client-engine runtime. The codec must own both directions:

- read materialization: database `json` / `jsonb` text -> Prisma Client
  JSON value;
- write parameterization: Prisma Client JSON input -> database JSON
  parameter text.

Do not patch only one direction. A read-only lossless parser still
allows writes to corrupt numeric tokens before they reach the database.

The implementation may be hard-wired to lossless behavior for this
branch, but it should be structured as a codec abstraction so that it
could later become an upstreamable option. Do not spread direct
`lossless-json` calls through unrelated Prisma code. Centralize the
behavior in named runtime helpers.

Sprint 0 must resolve every open architecture and implementation
question. Sprint 1 may not start while any DB JSON boundary, generated
code boundary, provider adapter behavior, public type contract, package
ownership question, or validation path remains unresolved.

## Design Constraints

- Preserve Prisma's existing distinction between SQL `NULL` and JSON
  `null`, including `Prisma.DbNull`, `Prisma.JsonNull`, and
  `Prisma.AnyNull` filter semantics.
- Keep Prisma `Decimal` scalar behavior separate from JSON numeric
  token behavior.
- JSON numeric tokens inside Prisma `Json` fields should become
  `LosslessNumber` values on read.
- JSON inputs containing `LosslessNumber` must serialize as numeric
  JSON tokens, not strings and not objects.
- JavaScript `number` inputs may remain accepted on writes, but they
  are already lossy values. Do not claim to recover precision from a
  JavaScript `number` that was already constructed by user code.
- Do not change non-JSON scalar numeric fields as part of this work.
- Do not use driver-level PostgreSQL JSON parser overrides as the main
  solution. `@prisma/adapter-pg` already preserves JSON text and hands
  JSON handling to Prisma runtime code.

## Known Patch Surface

Primary TypeScript packages:

- `packages/client/src/runtime/core/types/exported/Json.ts`
- `packages/client/src/runtime/core/jsonProtocol/serializeJsonQuery.ts`
- `packages/client/src/runtime/getPrismaClient.ts`
- `packages/client/src/runtime/utils/validatePrismaClientOptions.ts`
- `packages/client-generator-js/src/TSClient/PrismaClient.ts`
- `packages/client-generator-ts/src/TSClient/file-generators/PrismaNamespaceFile.ts`
- `packages/client-engine-runtime/src/json-protocol.ts`
- `packages/client-engine-runtime/src/interpreter/data-mapper.ts`
- `packages/client-engine-runtime/src/parameterization/parameterize.ts`
- `packages/client-engine-runtime/src/utils.ts`
- `packages/adapter-pg/src/conversion.ts`
- `packages/adapter-pg/src/pg.ts`
- `packages/driver-adapter-utils/src/const.ts`
- `packages/driver-adapter-utils/src/types.ts`

Required audit surface before implementation:

- every `JSON.parse`, `JSON.stringify`, `safeJsonStringify`, and
  `toJSON()` path in `packages/client`, `packages/client-engine-runtime`,
  `packages/query-plan-executor`, `packages/json-protocol`, and
  `packages/adapter-*`;
- generated Prisma Client JavaScript and TypeScript output that embeds
  JSON parsing, stringifying, runtime data model hydration, raw
  parameter serialization, or public JSON utility types;
- generated client fixtures under `packages/client/tests/**/.generated`
  when they are needed to verify emitted code behavior.

Likely Rust / Wasm audit surface:

- `../prisma-engines/libs/driver-adapters/src/conversion/*`
- `../prisma-engines/libs/prisma-value/src/raw_json.rs`
- `../prisma-engines/query-compiler/*`

Do not edit the engines repo unless a task explicitly requires it and
the need has been confirmed by a failing test or type boundary.

## Sprint Summary

### Sprint 0: Research And Architecture

Sprint 0 is complete only when implementation can start without open
uncertainty.

| ID  | Tasklet                                                                      | Priority | Status | Dependencies |
| --- | ---------------------------------------------------------------------------- | -------- | ------ | ------------ |
| 001 | [Inventory DB JSON API usage](./001-map-json-pipeline.md)                    | High     | [DONE] | None         |
| 002 | [Audit generated JSON API usage](./002-add-failing-precision-tests.md)       | High     | [DONE] | 001          |
| 003 | [Define lossless JSON contract](./003-introduce-internal-json-codec.md)      | High     | [DONE] | 001, 002     |
| 004 | [Map provider and raw-query boundaries](./004-patch-read-materialization.md) | High     | [DONE] | 001, 003     |

### Sprint 1: Implementation And QA

Sprint 1 implements the migration and all available unit, integration,
functional, generated-type, and provider coverage.

| ID  | Tasklet                                                                        | Priority | Status | Dependencies  |
| --- | ------------------------------------------------------------------------------ | -------- | ------ | ------------- |
| 005 | [Add failing precision tests](./005-patch-write-parameterization.md)           | High     | [DONE] | Sprint 0      |
| 006 | [Introduce internal JSON codec](./006-update-json-types-and-generators.md)     | High     | [DONE] | 005           |
| 007 | [Patch model and raw read materialization](./007-validate-json-semantics.md)   | High     | [DONE] | 006           |
| 008 | [Patch write parameterization](./008-add-cross-provider-coverage.md)           | High     | [DONE] | 006           |
| 009 | [Update JSON types and generators](./009-document-fork-contract.md)            | High     | [ ]    | 007, 008      |
| 010 | [Validate semantics and provider coverage](./010-validate-lossless-json-qa.md) | High     | [ ]    | 007, 008, 009 |

### Sprint 2: Fork Packaging And Local Adoption

Sprint 2 packages the fork safely so local projects can install it
without conflicting with stock Prisma packages.

| ID  | Tasklet                                                                  | Priority | Status | Dependencies |
| --- | ------------------------------------------------------------------------ | -------- | ------ | ------------ |
| 011 | [Document fork behavior](./011-document-fork-contract.md)                | Medium   | [ ]    | 010          |
| 012 | [Rename npm packages for local fork](./012-rename-npm-packages.md)       | High     | [ ]    | 011          |
| 013 | [Build fork npm package artifacts](./013-build-npm-package-artifacts.md) | High     | [ ]    | 012          |
| 014 | [Install fork locally and smoke test](./014-install-local-package.md)    | High     | [ ]    | 013          |

## Execution Order

Execute tasks in numeric order. Do not skip the failing-test task. This
migration changes a central public contract, so the first implementation
proof must be a test that fails under current native JSON behavior and
passes only when Prisma preserves JSON numeric tokens losslessly.

Sprint 1 must not start until every Sprint 0 tasklet is `[DONE]`.
Sprint 2 must not start until Sprint 1 validation is complete.

Each implementation tasklet must include the AGENTS-required review
record before code changes:

- observed problem;
- violated contract or invariant;
- owning layer;
- intended solution;
- rejected wrong-layer or unsafe solution;
- validation that proves the fix.

## Acceptance Criteria

The plan is complete when:

- Prisma Client reads a large JSON integer and a decimal JSON number
  from a `Json` field as lossless numeric values;
- Prisma Client writes `LosslessNumber` values inside `Json` fields
  without stringifying them as quoted strings;
- generated TypeScript JSON types represent lossless read values;
- raw queries returning JSON columns follow the same JSON materializer;
- raw queries returning `jsonb::text` remain plain strings;
- JSON null sentinels keep existing semantics;
- no native `JSON.parse` or `JSON.stringify` remains on a DB JSON value
  path unless the Sprint 0 inventory documents why that path is
  unrelated to DB JSON value preservation;
- every remaining native JSON operation in the touched packages is
  classified as protocol/cache/config/build/test behavior or as a
  documented provider limitation;
- focused client-engine-runtime, client functional, and generator type
  tests pass;
- the fork package can be built, installed locally without conflicting
  with stock Prisma packages, and smoke-tested against a JSON payload
  containing loss-sensitive numeric tokens;
- the plan documents any behavior that remains intentionally
  incompatible with upstream Prisma defaults.
