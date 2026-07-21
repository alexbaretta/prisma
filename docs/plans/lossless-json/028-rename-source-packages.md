# Sprint 14

### [DONE] Tasklet 028: Rename Source Packages To Lossless

Branch: `target-7.8.0-lossless`

Status: approved for implementation by the user prompt.

## Goal

Remove the release architecture that builds forked artifacts from
stock `@prisma/*` source package identities and then rewrites staged
package metadata into `@prisma-lossless/*`.

Fork-owned package names must be authoritative in source. The build
graph, workspace dependencies, generated metadata, private release
fixtures, and external release artifacts must all use the final
`@prisma-lossless/*` or `prisma-lossless` names directly.

Do not modify `/Users/alex/git/ctosclub/gwe`, any IPG checkout, or
`/Users/alex/git/ctosclub/gwe-worktrees/gwe-001/codex/skills/plan-tasklets/SKILL.md`.

## Pre-Implementation Review

Observed problem: the private release path still stages packages from
source packages named `@prisma/*` and rewrites their package metadata
to `@prisma-lossless/*`. The installed artifact therefore does not
come from a source package whose identity matches the artifact
identity.

Violated contract or invariant: package identity is a provenance and
trust boundary. A fork-owned release artifact must be built from a
source package with the same fork-owned identity, not from a stock
identity plus a mutation step.

Owning layer: workspace package metadata, workspace dependency
specifiers, source imports, generated package metadata, and the
private release builder own package identity. Source package manifests
must also own the release package version and runtime dependency
specifiers. The release builder may record provenance in the immutable
release identity and manifest, but it must not mutate staged artifact
contents to stamp names, versions, dependency specifiers, or generated
runtime version strings.

Intended solution: rename every fork-owned workspace package from
`@prisma/*` to `@prisma-lossless/*`, update internal dependency and
import specifiers to the renamed packages, record the next immutable
release version and exact release dependency specifiers in the ten
shipped source package manifests, remove source-name to release-name
mappings and package-json/generated-file rewriting from
`scripts/lossless-private-release.ts`, and make release validation fail
if a published fork-owned package relies on namespace or metadata
rewriting.

Rejected solution: do not keep source packages under `@prisma/*`, do
not keep `0.0.0` source package versions, and do not hide either fact
with staging rewrites, npm aliases, lockfile overrides, or
generated-client normalization. Those approaches move package identity
out of source control and preserve the same trust defect.

Validation that proves the fix: add focused release-tooling tests that
fail if package names or dependency keys are rewritten from stock
Prisma names, run package builds for the renamed release graph, run
the external ephemeral-registry integration from an empty store, prove
generated client metadata uses the lossless namespace, mint a new
immutable private release, and pass repo-root `pnpm build`.

## Additional Pre-Implementation Review: Default Dist Cleanup

Observed problem: after source package renaming, a clean exported source
tree produced different `@prisma-lossless/get-platform` and
`@prisma-lossless/fetch-engine` tarball integrities than the current
checkout. The current checkout still contained ignored stale `dist`
chunks that package-specific rebuilds did not remove.

Violated contract or invariant: a release package must be reproducible
from tracked source and a clean build. Ignored build outputs may not
survive package rebuilds and become release inputs.

Owning layer: `helpers/compile/build.ts` owns cleaning generated output
directories before writing build artifacts. The release builder owns
rejecting mismatched release identities, but it must not compensate by
changing or filtering package bytes.

Intended solution: make compile output cleanup resolve the same default
`dist` directory that the later build pipeline uses when no explicit
`outdir` or `outfile` is supplied. Add focused unit coverage proving a
default-output build removes stale files before rebuilding.

Rejected solution: do not delete stale chunks in release staging, do
not mutate the recorded `.11` identity to match session-local bytes,
and do not add package-specific cleanup scripts. Those fixes hide the
build-system contract violation instead of repairing the owner.

Validation that proves the fix: the compile helper unit test must fail
before the helper change and pass after it. Rebuilding
`@prisma-lossless/get-platform` and `@prisma-lossless/fetch-engine`
must remove stale chunks. Fresh-checkout release reproduction must
match the recorded `.11` fixture.

## Additional Pre-Implementation Review: Test Version Lookup

Observed problem: repo-root `pnpm test` enters
`scripts/ci/publish.ts --test`, but the harness calculates a new dev
publish version before running tests. That calculation asks the public
npm registry for `@prisma-lossless/debug`, which intentionally does
not exist because this fork uses local ephemeral private release
artifacts.

Violated contract or invariant: a local test command must not depend
on public registry presence for private fork package identities. Public
npm version discovery belongs to publish and dry-run publish flows,
not the test-only path.

Owning layer: `scripts/ci/publish.ts` owns selecting a publish version
and running package tests. The release wrapper owns ephemeral private
package serving; the test command must not require a permanent public
registry entry.

Intended solution: for `--test` without `--publish` or `--dry-run`,
use the local CLI package version as the reporting version and skip
remote npm version discovery. Keep publish and dry-run behavior
unchanged.

Rejected solution: do not publish placeholder `@prisma-lossless/*`
packages to public npm, do not add permanent npm registry
configuration, and do not make root tests invoke the ephemeral release
wrapper. Those approaches move a local test concern into package
distribution.

Validation that proves the fix: rerun repo-root `pnpm test` with the
documented local database skips. It must reach package test execution
instead of failing during public npm version discovery.

## Implementation Steps

1. Rename all fork-owned workspace package `package.json` names to
   `@prisma-lossless/*` or `prisma-lossless`.
2. Update workspace dependency keys, source imports, generated
   dependency metadata, test fixtures, package filters, and scripts to
   resolve the new source identities.
3. Remove release-time package-name, package-version,
   dependency-specifier, and generated-file rewriting from the private
   release builder. The release identity fixture and generated release
   manifest record source provenance; package artifacts do not receive
   self-referential commit metadata through a staging mutation.
4. Add tests that prove the private release builder rejects stock
   `@prisma/*` package identities for fork-owned packages and does not
   publish alias dependencies for fork-owned packages.
5. Mark `.10` unavailable if the source-identity contract cannot be
   satisfied by its recorded bytes, then mint the next immutable
   private version from the renamed source graph.
6. Update migration documentation, release identities, independent
   fixtures, and canonical consumer commands to the new release.
7. Run focused unit tests, affected package builds, the
   lifecycle-enabled external consumer integration, fresh-checkout
   reproducibility proof, repo-root `pnpm build`, and repo-root
   `pnpm test` or record any environment blocker.

## Acceptance Criteria

- No fork-owned workspace package has a stock `@prisma/*` package
  name.
- No private release artifact is produced by translating package names
  from `@prisma/*` to `@prisma-lossless/*`.
- Published package metadata for fork-owned packages contains no stock
  `@prisma/*` dependency key when a fork-owned package exists.
- Generated Prisma Client metadata and runtime imports use the
  lossless package namespace wherever the fork owns the package.
- The external consumer installation uses exact immutable
  `@prisma-lossless/*` package names from an empty store and runs
  lifecycle scripts successfully.
- The current usable immutable release is newer than `.10`; `.10` is
  unavailable if it cannot satisfy the source-identity contract.

## Implementation Notes

All workspace packages that previously declared stock `@prisma/*`
package names now declare `@prisma-lossless/*` names. The forked CLI
continues to declare `prisma-lossless`. Workspace dependency keys,
source imports, build filters, generated metadata tests, sandbox
projects, and local fixture references were updated to the lossless
namespace for fork-owned packages.

The private release graph no longer records a separate `sourceName`
for any release package. Release package metadata validation now
requires the source package name, package version, and fork-owned
dependency specifiers to match the immutable release identity before
packing. The release builder records provenance in the manifest and
identity fixture, but it no longer stamps package names, package
versions, dependency specifiers, generated runtime versions, or
generated dependency names into staged artifact contents.

The compile helper now resolves default `dist` output directories
through the same helper used by the build pipeline. Package builds that
omit `outdir` can no longer retain ignored stale chunks in `dist`.

Repo-root `pnpm test` no longer performs public npm version discovery
for test-only runs. The harness reports the local CLI package version
for `--test` without `--publish` or `--dry-run`; publish and dry-run
publish flows still use the existing remote version selection.

Four upstream binary and service packages remain under their upstream
names because this repository does not own their source packages:
`@prisma/engines-version`, `@prisma/query-compiler-wasm`,
`@prisma/prisma-schema-wasm`, and `@prisma/schema-engine-wasm`.
The tasklet release validation must prove that fork-owned artifacts do
not expose stock names for packages owned by this repository.

## Post-Implementation Review

The resulting source tree satisfies the ownership boundary described in
the pre-implementation review. Fork-owned source package manifests now
carry lossless package names, version `7.8.0-lossless.11`, and exact
fork-owned dependency specifiers. The private release tool now copies
source packages, normalizes file mtimes, packs them, and validates the
packed metadata. It does not translate names from `@prisma/*`, write
package metadata, or patch generated runtime files.

The default `dist` cleanup fix stays in the build helper that owns
generated output deletion. It does not add release-staging filters or
package-specific cleanup scripts, so stale ignored files are removed
before normal package builds rather than hidden at pack time.

The test-only publish harness fix stays in the CI orchestration layer.
It does not change publish version selection and does not introduce a
registry dependency for root tests. The new unit test proves test-only
runs use the local package version while publish and dry-run publish
flows remain on the remote-version path.

## Validation Evidence

Focused release-tooling tests passed:

```sh
pnpm exec vitest run scripts/lossless-private-release.test.ts
```

Result: passed, `17` tests.

Compile helper cleanup tests passed:

```sh
pnpm exec vitest run helpers/compile/build.test.ts
```

Result: passed, `8` tests.

Package-name audits passed:

```sh
node -e '... assert no workspace package name starts with @prisma/ ...'
node -e '... assert no package manifest depends on an owned stock name ...'
```

Release rewrite-symbol audit passed:

```sh
rg "sourceName|rewritePackageJsonForPrivateRelease|\
rewriteStagedPrivateReleaseArtifacts|prismaLosslessRelease|\
DEVELOPMENT_VERSION_PLACEHOLDER|CLIENT_RELEASE_VERSION_ARTIFACTS" \
  scripts/lossless-private-release.ts \
  scripts/lossless-private-release.test.ts
```

Result: no matches.

Affected package rebuilds passed:

```sh
pnpm --filter @prisma-lossless/get-platform \
  --filter @prisma-lossless/fetch-engine build
```

The stale ignored chunk names were absent after rebuild.

The immutable `.11` release was packed from source provenance commit:

```text
65e86f5c32ac361ab31ea95967bdac8256cb0775
```

The recorded package integrities are:

```text
@prisma-lossless/debug
sha512-fmjKOQZWxT/IJ2s7GYEkgmN9cqB6HEarViFMhwuGXhAtnXUTy/bTS28xT8yyBfRpKfNizqAJMFpNxb98mpgzLw==
@prisma-lossless/driver-adapter-utils
sha512-YXEPL7Ua22jy1S/QeS4LE07QOBUF+5veU1/Ki1LYBFFSoVWOcJ/tIWKcOuvrSw4DFrz94Ev/oIpY8brq2bdR1w==
@prisma-lossless/get-platform
sha512-qc8YUQ6PP1Sdb/M1C/JHh2sDXAM1m1btksiRKQLt1pwaht9pen5WWq36DXzDcSM/dlwhmSKicR1PR2N0C3qYYA==
@prisma-lossless/fetch-engine
sha512-MmPAUHSuDMmWfDwpe5x5UrxboRrlGLgYyp1SXWF+uJOD/P1iXsVAPJ40zTroXUCqScTqPJCWoUbn7bDQ7LxggQ==
@prisma-lossless/engines
sha512-C/F6Piav1pHQZutHZR9SfJWn7ka2NaWI8nxSc2QyayZGyDu3lE6alfiZ2OwOuLRZa7muaUu2vxcIWuA9iYJi6A==
@prisma-lossless/config
sha512-bpJqFgHTtmdEysY+qxmOAwmdgbqeJzolHeXDY71ss0sIKjmuStymTPxIoTtLDgy4I9pM5hI0TkENhIaby+t+dQ==
@prisma-lossless/client-runtime-utils
sha512-qUiUk1XMXFPRHILKHtf2FRXB9wc069jUBYqllSu7RxNF8kAT7Z6Se+M4ZmaxkMHBBsRVgzjvKikTmO9sCLI4Pg==
@prisma-lossless/adapter-pg
sha512-7wroe4uDLJaX4pHxTCOw2cZXfksyFFaGqf/woQfFW8wG3aTh1GctKf0Y1HNtHFHMIKgRnHDganQ9NUK10Zs6qA==
@prisma-lossless/client
sha512-ZdCZz2ivmcT0JVvyyRJqBISZgia8rD1dWPwO6/8E1v8RCbvE+tcb+j+hOAqNZUP7UTzqsBS4aljv//C/hjlY4A==
prisma-lossless
sha512-0oCj8EQWRz6ixgQQ6hxDMFVyjopsVYFZ+XkMKlU7Kl0lARaQQzAXq3x9gBhOfgCH5ljfJC+h7a1AIsBPwxl3Pg==
```

External ephemeral-registry integration passed:

```sh
PRISMA_LOSSLESS_RUN_REGISTRY_INTEGRATION=1 \
  pnpm exec vitest run \
  scripts/lossless-private-registry-run.integration.test.ts
```

Result: passed, `5` tests, `1` fresh-checkout test skipped in this
mode. The lifecycle-enabled cold install used consumer pnpm
`11.1.1`, generated Prisma Client `7.8.0-lossless.11`, proved
`LosslessNumber`, and removed transient registry and release roots.

Fresh clean checkout reproduction passed:

```sh
PRISMA_LOSSLESS_RUN_REGISTRY_INTEGRATION=1 \
PRISMA_LOSSLESS_RUN_FRESH_CHECKOUT_INTEGRATION=1 \
  pnpm exec vitest run \
  scripts/lossless-private-registry-run.integration.test.ts \
  -t "reproduces the recorded release from a fresh clean checkout"
```

Result: passed, `1` test, `5` skipped. The test built a clean cloned
checkout, reproduced the recorded package integrities twice, installed
the external consumer from an empty store, generated the client, proved
`LosslessNumber`, and verified cleanup.

Publish-harness unit tests passed:

```sh
pnpm exec vitest run scripts/ci/publish.test.ts
```

Result: passed, `3` tests.

Internals version snapshot tests passed:

```sh
pnpm --dir packages/internals exec vitest run \
  src/__tests__/formatTable.test.ts \
  src/__tests__/engine-commands/validate.test.ts \
  src/__tests__/engine-commands/getDmmf.test.ts --silent
```

Result: passed, `29` tests, `4` skipped.

Repo-root build passed outside the sandbox after refreshing the pnpm
workspace layout:

```sh
pnpm install --lockfile-only
pnpm install
pnpm build
```

The first sandboxed `pnpm build` failed only because `tsx` could not
create IPC pipes under `/var/folders/...`. The escalated build passed
with `44` successful tasks. After the final CI harness and snapshot
updates, the escalated rerun passed again with `44` successful tasks.

Repo-root test validation was attempted:

```sh
CI=true GITHUB_REF_NAME=target-7.8.0-lossless \
  TERM=xterm-256color TEST_SKIP_MSSQL=true \
  TEST_SKIP_COCKROACHDB=true TEST_SKIP_MONGODB=true pnpm test
```

The first rerun failed before tests because public npm has no
`@prisma-lossless/debug`; the CI harness fix corrected that. The final
rerun reached package test execution and failed in
`@prisma-lossless/internals` only because local PostgreSQL and MySQL
servers were not reachable at the `.db.env` ports `localhost:5432` and
`localhost:3306`. There is no supported skip flag in
`schemaEngineCommands.test.ts` for those four create-database cases.
