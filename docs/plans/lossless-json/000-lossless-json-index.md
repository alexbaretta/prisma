# Lossless JSON Migration Plan

Branch: `target-7.8.0-lossless`

Status: Lossless JSON implementation, local tarball adoption, private
registry release validation, lossless package naming consistency, raw
JSON parameter handling, and prebuilt ephemeral consumption are
complete.

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
| 009 | [Update JSON types and generators](./009-document-fork-contract.md)            | High     | [DONE] | 007, 008      |
| 010 | [Validate semantics and provider coverage](./010-validate-lossless-json-qa.md) | High     | [DONE] | 007, 008, 009 |

### Sprint 2: Fork Packaging And Local Adoption

Sprint 2 packages the fork safely so local projects can install it
without conflicting with stock Prisma packages.

| ID  | Tasklet                                                                  | Priority | Status | Dependencies |
| --- | ------------------------------------------------------------------------ | -------- | ------ | ------------ |
| 011 | [Document fork behavior](./011-document-fork-contract.md)                | Medium   | [DONE] | 010          |
| 012 | [Rename npm packages for local fork](./012-rename-npm-packages.md)       | High     | [DONE] | 011          |
| 013 | [Build fork npm package artifacts](./013-build-npm-package-artifacts.md) | High     | [DONE] | 012          |
| 014 | [Install fork locally and smoke test](./014-install-local-package.md)    | High     | [DONE] | 013          |

### Sprint 3: Private First-Party Release

Sprint 3 publishes this fork to a private npm-protocol registry so a
separate first-party project can consume exact package versions without
local tarball paths, workspace links, sibling checkouts, Git
dependencies, pnpm overrides, or public npm publication.

Sprint 3 does not reopen the lossless JSON runtime migration. It is
required only for reproducible first-party consumption outside this
repository's local tarball smoke path.

| ID  | Tasklet                                                                           | Priority | Status | Dependencies |
| --- | --------------------------------------------------------------------------------- | -------- | ------ | ------------ |
| 015 | [Define private registry contract](./015-define-private-registry-contract.md)     | High     | [DONE] | 014          |
| 016 | [Build private release graph](./016-build-private-release-graph.md)               | High     | [DONE] | 015          |
| 017 | [Publish and validate private release](./017-publish-validate-private-release.md) | High     | [DONE] | 016          |

### Sprint 4: Naming Consistency

Sprint 4 removes the remaining consumer-facing `@prisma/*` package
reference from the private release adoption contract. First-party
consumers must depend on the forked names and update imports to the
new nomenclature.

| ID  | Tasklet                                                                  | Priority | Status | Dependencies |
| --- | ------------------------------------------------------------------------ | -------- | ------ | ------------ |
| 018 | [Publish consistently named private release](./018-consistent-naming.md) | High     | [DONE] | 017          |

### Sprint 5: Raw JSON Parameter Follow-Up

Sprint 5 fixes the `7.8.0-lossless.4` regression where
`LosslessNumber` values inside raw SQL JSON object parameters were
serialized as implementation objects.

| ID  | Tasklet                                                          | Priority | Status | Dependencies |
| --- | ---------------------------------------------------------------- | -------- | ------ | ------------ |
| 019 | [Preserve raw JSON parameters](./019-fix-raw-json-parameters.md) | High     | [DONE] | 018          |

### Sprint 6: Ephemeral Consumer Registry

Sprint 6 makes the existing private release artifacts available to
concurrent first-party builds without requiring a system-level registry
service or a cloud registry.

| ID  | Tasklet                                                                      | Priority | Status | Dependencies |
| --- | ---------------------------------------------------------------------------- | -------- | ------ | ------------ |
| 020 | [Run isolated ephemeral registries](./020-run-ephemeral-private-registry.md) | High     | [DONE] | 019          |

### Sprint 7: Reproducible Ephemeral Release Input

Sprint 7 lets a clean consumer builder reconstruct an approved private
release graph from pinned public source without depending on a
pre-existing registry merely to choose the release version.

| ID  | Tasklet                                                                 | Priority | Status | Dependencies |
| --- | ----------------------------------------------------------------------- | -------- | ------ | ------------ |
| 021 | [Build a pinned release offline](./021-build-pinned-release-offline.md) | High     | [DONE] | 020          |

### Sprint 8: Prebuilt Consumer Registry

Sprint 8 lets a consumer invoke the ephemeral registry directly from
an already-built prisma-lossless project. The fork owns transient
packing; the consumer does not reconstruct a pinned source release.

| ID  | Tasklet                                                        | Priority | Status | Dependencies |
| --- | -------------------------------------------------------------- | -------- | ------ | ------------ |
| 022 | [Run from prebuilt artifacts](./022-run-prebuilt-artifacts.md) | High     | [DONE] | 020          |

### Sprint 9: Immutable Ephemeral Release Identity

Sprint 9 fixes the ephemeral registry defects introduced by Tasklets
020 and 022. Existing private versions must reproduce the same package
bytes and provenance, and child tools must run from the consumer
project so Corepack selects the consumer's pinned package manager.

| ID  | Tasklet                                                                   | Priority | Status | Dependencies |
| --- | ------------------------------------------------------------------------- | -------- | ------ | ------------ |
| 023 | [Fix ephemeral release identity](./023-fix-ephemeral-release-identity.md) | High     | [DONE] | 020, 022     |

### Sprint 10: Independent Release Identity Proof

Sprint 10 fixes the Tasklet 023 regression where the `.5` release
identity was generated from the same artifact graph later served to
consumers. Release identity validation must use an independent
consumer lockfile expectation and must retire historical versions that
cannot be reproduced byte-for-byte.

| ID  | Tasklet                                                                       | Priority | Status | Dependencies |
| --- | ----------------------------------------------------------------------------- | -------- | ------ | ------------ |
| 024 | [Fix independent release identity](./024-fix-independent-release-identity.md) | High     | [DONE] | 023          |

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
- a separate first-party consumer can install exact immutable versions
  from the approved private registry without local tarball paths,
  workspace links, sibling checkouts, Git dependencies, pnpm overrides,
  or public npm publication;
- the plan documents any behavior that remains intentionally
  incompatible with upstream Prisma defaults.

## Completion Validation Status

Tasklets 001 through 019 are `[DONE]`. This validation pass records
the package-rename fixes, private release validation, external npm
consumer proof, and final validation evidence. Repo-root build
validation passed after rerunning outside the sandbox:

```sh
pnpm build
```

The first sandboxed build failed at `tsx` IPC socket creation under
`/var/folders/...`; the latest escalated rerun passed with `44
successful, 44 total`.

Repo-root test validation was run in this local environment with the
documented SQL Server and CockroachDB skips:

```sh
CI=true GITHUB_REF_NAME=target-7.8.0-lossless \
  TERM=xterm-256color TEST_SKIP_MSSQL=true \
  TEST_SKIP_COCKROACHDB=true pnpm test
```

Before the test run, the stale local database
`tests-migrate-prisma-config-extensions` was dropped so the migrate
snapshots could start from the expected local state.

The root test run failed only in `packages/migrate`, where four
PostgreSQL setup hooks exceeded the 10 second Jest hook timeout after
many PostgreSQL migrate cases had already passed. No lossless package,
release tooling, generated guidance, client runtime, or adapter test
failed.

The failed package was rerun in isolation with the same local
environment flags:

```sh
CI=true GITHUB_REF_NAME=target-7.8.0-lossless \
  TERM=xterm-256color TEST_SKIP_MSSQL=true \
  TEST_SKIP_COCKROACHDB=true pnpm --filter @prisma/migrate test
```

That rerun passed all migrate tests: `33` suites, `352` passed tests,
`2` skipped tests, and `580` snapshots.

## Private Distribution Status

Tasklets 015 through 024 are `[DONE]`. The current immutable private
release validated for first-party use is `7.8.0-lossless.6`, served
through the ephemeral registry wrapper with the `lossless` dist-tag.

The historical `7.8.0-lossless.5` identity is recorded as
unavailable. GWEN's lockfile proves the original `.5` client tarball
integrity, but the current prebuilt packaging path cannot reproduce
those client bytes. The wrapper therefore rejects `.5` before
starting Verdaccio and instructs consumers to use `.6`.

The isolated npm consumer at
`tmp/lossless-json-tasklet-019/consumer-7.8.0-lossless.5` previously
validated the runtime behavior of the forked packages against the
locally running PostgreSQL `18.3` server. Tasklet 024 supersedes its
release identity proof with a temporary consumer whose lockfile is
independent of the serving identity and pins all ten private packages
to `7.8.0-lossless.6`.

This closes the separate first-party consumption gap without
publishing to the worldwide npm registry and without requiring a
direct consumer dependency on any stock `@prisma/*` adapter package.

Tasklet 024 validation:

- `pnpm exec prettier --check ...` passed for all touched files.
- `NODE_OPTIONS=--max-old-space-size=8192 pnpm exec eslint ...`
  passed for all changed TypeScript tooling and tests.
- `pnpm exec vitest run scripts/lossless-private-release.test.ts
scripts/lossless-private-registry-run.test.ts
scripts/lossless-private-registry.test.ts` passed (`32` tests).
- `PRISMA_LOSSLESS_RUN_REGISTRY_INTEGRATION=1 pnpm exec vitest run
scripts/lossless-private-registry-run.integration.test.ts` passed
  outside the sandbox (`4` tests). The test used an empty pnpm store,
  proved Corepack selected consumer `pnpm v11.1.1`, verified
  `LosslessNumber`, proved repeat `.6` packaging integrity, rejected
  `.5`, rejected a mismatched fixture, and checked cleanup.
- `NODE_OPTIONS=--max-old-space-size=8192 pnpm exec tsc --noEmit
--pretty false` aborted with a V8 heap out-of-memory failure before
  producing TypeScript diagnostics. The repo-root build below is the
  authoritative build/type gate used for this tasklet.
- `pnpm build` passed (`44` successful, `44` total).
- Root `pnpm test` first failed before tests started in the sandbox
  because `tsx` could not create its IPC pipe. The escalated rerun with
  SQL Server and CockroachDB skipped reached `@prisma/migrate` and
  failed only because local MongoDB was not running and the stale
  `tests-migrate-prisma-config-extensions` database already existed.
  The stale PostgreSQL test database was dropped, and the root test was
  rerun with `TEST_SKIP_MONGODB=true` as supported by the migrate test
  matrix. That rerun passed migrate, client, and integration packages
  but exited nonzero in the final CLI package due 5 second CLI Jest
  timeouts under full-suite load.
- The failed CLI files were rerun in isolation with `--runInBand` and
  passed (`2` suites, `35` tests).

## Validation Bug Review: Client Type Harness Package Rename

Observed problem: root `pnpm test` passes migrate with the documented
local SQL Server and CockroachDB skips, then fails in
`@prisma-lossless/client` type tests. The failures report many
`Expected an error, but found none` diagnostics from `tsd`, which means
the generated test client is effectively typed as `any`.

Violated contract or invariant: Sprint 2 renamed the local client
package to `@prisma-lossless/client`, but the client type-test harness
must still copy the actual local client package before generating typed
fixtures. Asking `getPackedPackage('@prisma/client')` after the rename
does not resolve the workspace package and can copy the wrong package.

Owning layer: `packages/client/src/__tests__/types/types.test.ts` owns
packing the local client package for these generated type fixtures.
`packages/client/src/utils/generateInFolder.ts` owns the generated
fixture output location, which remains `node_modules/@prisma/client`
for legacy fixture imports.

Intended solution: change the type-test harness to pack
`@prisma-lossless/client`. Keep generated fixture imports and output
paths unchanged, and install the same packed source under
`node_modules/@prisma-lossless/client` so generated declarations can
resolve their runtime imports after the fork rename.

Rejected wrong-layer solution: do not rewrite every legacy type fixture
from `@prisma/client` to `@prisma-lossless/client`, and do not weaken
or remove `tsd` error assertions. The generated fixture import surface
is a compatibility test surface; the package/runtime aliasing is what
must reflect the fork rename.

Validation that proves the fix: rerun the focused client type-test
suite, then rerun root `pnpm test` with the documented local skips for
the unavailable SQL Server container and the locally timing-out
CockroachDB migrate suite.

Post-implementation review: the implemented change stays in the
type-test harness. It does not weaken `tsd`, does not alter generated
client type contracts, and does not rewrite fixture imports away from
the compatibility `@prisma/client` surface. The harness now copies the
same packed `@prisma-lossless/client` source to both the compatibility
fixture path and the renamed runtime package path required by generated
declarations.

Validation performed:

- `GITHUB_REF_NAME=target-7.8.0-lossless TERM=xterm-256color
TEST_SKIP_MSSQL=true TEST_SKIP_COCKROACHDB=true pnpm --dir
packages/client exec dotenv -e ../../.db.env -- jest --silent
src/__tests__/types/types.test.ts --runInBand` passed (`26` tests).
- `GITHUB_REF_NAME=target-7.8.0-lossless TERM=xterm-256color
TEST_SKIP_MSSQL=true TEST_SKIP_COCKROACHDB=true pnpm --dir
packages/client run test` passed (`40` suites passed, `1` skipped,
  `671` tests passed).

## Validation Bug Review: CLI Rename Fixture Resolution

Observed problem: after the client type-test harness fix, root
`pnpm test` reaches the `prisma-lossless` CLI package. CLI update and
version tests still assert stock `@prisma/client` and `prisma` output,
while generate tests fail because temp fixtures cannot resolve
`@prisma-lossless/client`.

Violated contract or invariant: Sprint 2 renamed the fork's CLI and
client packages. CLI messages and version output must assert the fork
package names. Generate fixtures must provide the renamed local client
package because `resolvePrismaClient()` now reads the local client
package metadata and resolves `@prisma-lossless/client`.

Owning layer: CLI tests own the expected public messages. The shared
Jest fixture helper in `@prisma/get-platform` owns temp fixture
`node_modules` setup for CLI tests that generate Prisma Client from an
isolated project directory.

Intended solution: update CLI update-message, print-update-message, and
version snapshots to assert `prisma-lossless` and
`@prisma-lossless/client`. Extend the fixture helper to symlink the
local client package at both `node_modules/@prisma/client` for legacy
fixture imports and `node_modules/@prisma-lossless/client` for the
renamed package resolver.

Rejected wrong-layer solution: do not change the CLI constants back to
stock Prisma names, do not weaken generate tests, and do not rewrite
custom-output schema fixtures that intentionally exercise arbitrary
output paths such as `@prisma/client`.

Validation that proves the fix: rerun the focused CLI tests covering
update messages, version output, and generate fixtures, then rerun root
`pnpm test` with the documented local SQL Server and CockroachDB skips.

Post-implementation review: the implemented change keeps the forked
package constants intact. CLI assertions now expect
`prisma-lossless` and `@prisma-lossless/client`, and the fixture helper
continues to expose the legacy `@prisma/client` path while adding the
renamed `@prisma-lossless/client` path required by package resolution.
The fix does not weaken generate coverage and does not reinterpret
custom output paths as package names.

Validation performed:

- `GITHUB_REF_NAME=target-7.8.0-lossless TERM=xterm-256color
TEST_SKIP_MSSQL=true TEST_SKIP_COCKROACHDB=true pnpm --dir
packages/cli exec dotenv -e ../../.db.env -- jest --silent
src/__tests__/update-message.test.ts
src/__tests__/printUpdateMessage.test.ts
src/__tests__/commands/Version.test.ts
src/__tests__/commands/Generate.test.ts --runInBand` first passed the
  rename-related tests but failed the custom generator test because the
  sandbox prevented `npm` from writing under `/Users/alex/.npm`.
- The same focused CLI command passed outside the sandbox (`4` suites,
  `52` tests, `41` snapshots).

## Validation Bug Review: CLI Init And Link Rename Snapshots

Observed problem: root `pnpm test` now reaches the final CLI Vitest
suite. Jest CLI tests pass, but `Init.vitest.ts` snapshots and one
Postgres link assertion still expect stock command text such as
`prisma db pull`, `npx prisma dev`, `prisma/config`, and
`prisma generate`. The same output also exposes remaining product copy
that still says `prisma migrate dev`.

Violated contract or invariant: Sprint 2 renamed the forked CLI package
to `prisma-lossless`. Tests for generated setup instructions and config
imports must match the forked public command/package surface whenever
the implementation now emits that surface.

Owning layer: CLI next-step copy owns the generated command text. CLI
Vitest snapshots and CLI link assertions own the expected strings.

Intended solution: update the remaining CLI next-step copy to use
`prisma-lossless migrate dev`, and update the affected Vitest snapshots
and assertions to expect `prisma-lossless` command/config text.

Rejected wrong-layer solution: do not change product copy back to stock
Prisma command names to satisfy stale snapshots, and do not delete the
Vitest assertions. The failure is stale fork-package test evidence, not
a reason to weaken CLI coverage.

Validation that proves the fix: rerun focused CLI Vitest coverage for
`Init.vitest.ts` and `Link.vitest.ts`, then rerun root `pnpm test` with
the documented local SQL Server and CockroachDB skips.

Post-implementation review: the implemented change keeps the forked
package surface in the CLI copy layer and the tests that assert it.
The `init` and Postgres `link` next-step messages now consistently
emit `prisma-lossless` commands, and the snapshots/assertions check
the same public surface. The fix does not change command behavior,
does not weaken CLI Vitest coverage, and does not move package rename
knowledge into unrelated runtime code.

Validation performed:

- `GITHUB_REF_NAME=target-7.8.0-lossless TERM=xterm-256color
pnpm --dir packages/cli exec vitest run src/__tests__/Init.vitest.ts
src/postgres/link/__tests__/Link.vitest.ts --passWithNoTests
--reporter=dot` passed outside the sandbox (`2` files, `42` tests).
