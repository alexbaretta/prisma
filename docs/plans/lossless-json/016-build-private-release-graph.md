# Sprint 3

### [DONE] Tasklet 016: Build Private Release Graph

## Goal

Build immutable release candidates for the private first-party registry
so an external first-party project can depend on exact semantic
versions instead of local tarball paths, workspace links, Git
dependencies, or public npm packages.

## Instructions

Create an immutable `7.8.0-lossless.<N>` prerelease, starting with the
next unused positive `N` in the approved private registry. Do not reuse
or replace an existing version. Preserve source commit provenance in
the release metadata.

Publish candidate artifacts for the runtime closure already proven by
Tasklet 013:

- `@prisma-lossless/debug`;
- `@prisma-lossless/get-platform`;
- `@prisma-lossless/fetch-engine`;
- `@prisma-lossless/engines`;
- `@prisma-lossless/config`;
- `@prisma-lossless/client-runtime-utils`;
- `@prisma-lossless/client`;
- `prisma-lossless`.

Use the repository's standard build and npm packlist behavior. Extend
or wrap existing release tooling instead of inventing a package archive
format.

The private-release path must:

- take an explicit allowlisted registry;
- refuse public or unapproved registries;
- assign the selected version consistently;
- rewrite `workspace:*` dependencies to immutable published versions;
- publish packages in dependency order;
- record the selected source commit.

Transient pack output may exist only in a project-local ignored
temporary directory or another non-source release workspace. No
tarball, registry storage, checksum manifest, or copied package tree
may be committed.

Leave the tracked checkout in a deliberate, reviewable state. Do not
use a destructive reset to clean release-time metadata changes.

This tasklet may continue using private `@prisma/*` names for the
internal closure because the registry is private. Namespace ownership
and any additional renaming for a worldwide open-source release belong
to a future plan and are not part of this tasklet.

## Pre-Implementation Review

Capture the AGENTS-required review record before changing package
metadata, release tooling, or registry state.

The review must identify:

- why exact private versions are needed for first-party consumers;
- the package graph and publish order;
- the owner of version rewriting;
- the guard that prevents public publication;
- one rejected approach that leaves `0.0.0`, `workspace:*`, `file:`,
  `link:`, Git, branch, checkout, or home-directory dependencies in a
  release candidate.

## Pre-Implementation Review Record

Observed problem: Sprint 2 produced local `0.0.0` tarballs whose
metadata still reflects workspace development. A separate first-party
project cannot depend on that shape through ordinary registry
semantics because package managers need immutable versions and
registry-resolvable dependency metadata.

Violated contract or invariant: Sprint 3 requires exact immutable
private versions and forbids local tarball paths, workspace links, Git
dependencies, public npm fallback, and stock Prisma substitution for
the fork runtime closure.

Owning layer: release tooling owns selecting the private prerelease
version, preparing temporary release metadata, preserving source commit
provenance, validating the candidate graph, and producing pack
artifacts. The package source directories remain the development
workspace contract and must not be mutated as release scratch state.

Intended solution: add a release-graph helper that queries the
allowlisted private registry for the next unused
`7.8.0-lossless.<N>` version, copies the eight package directories to a
project-local ignored release workspace, rewrites only those temporary
package manifests, packs them with standard `pnpm pack` behavior, and
validates every packed manifest before publication.

The package graph and publish order are:

1. `@prisma-lossless/debug`;
2. `@prisma-lossless/get-platform`;
3. `@prisma-lossless/fetch-engine`;
4. `@prisma-lossless/engines`;
5. `@prisma-lossless/config`;
6. `@prisma-lossless/client-runtime-utils`;
7. `@prisma-lossless/client`;
8. `prisma-lossless`.

The publish-target guard remains the Tasklet 015
`assertApprovedPublishRegistry` allowlist. The release helper must call
that guard before querying registry metadata or preparing candidate
metadata tied to a registry.

Rejected unsafe or wrong-layer solution: do not edit tracked
`package.json` files to release values and then rely on a destructive
reset. Also reject publishing `0.0.0`, leaving `workspace:*`, `file:`,
`link:`, Git, branch, checkout, or home-directory references in packed
metadata, and relying on consumer-side overrides to repair malformed
release packages.

Validation that proves this tasklet: metadata unit tests must reject
forbidden dependency references, prove dependency-order and version
selection behavior, and prove the lossless client depends on the
private runtime closure. A live candidate build must start from an
allowlisted registry, produce eight tarballs in ignored `tmp/` storage,
unpack each `package/package.json`, and prove the selected version,
source commit, and clean dependency metadata are present.

## Validation

Add metadata tests that unpack the release candidates and reject:

- `0.0.0`;
- `workspace:*`;
- `file:`;
- `link:`;
- Git dependencies;
- branch dependencies;
- checkout paths;
- home-directory paths.

Prove that every package records the selected version and exact source
commit. Prove that `@prisma-lossless/client` depends on the private
lossless runtime closure.

Run focused package builds and the repo-root build required by the
repository instructions.

Do not mark this tasklet `[DONE]` until the release graph, metadata
tests, build evidence, and review record are committed.

## Post-Implementation Review

The implementation adds `scripts/lossless-private-release.ts` as the
release-graph boundary for Sprint 3. It reuses the Tasklet 015
registry allowlist, queries the approved private registry for published
versions, selects the next unused `7.8.0-lossless.<N>` prerelease, and
prepares release candidates under the ignored
`tmp/lossless-json-tasklet-016/` tree.

The tracked package manifests remain unchanged. The helper copies each
package source directory to a temporary staging directory, rewrites only
that staged `package.json`, removes development-only dependencies from
release metadata, rewrites runtime `workspace:*` and lossless peer
references to the selected immutable version, records
`prismaLosslessRelease.version`, records
`prismaLosslessRelease.sourceCommit`, and updates the CLI
`prisma.prismaCommit` field to the same source commit.

Packing uses `pnpm pack` from each staged package directory, so npm
packlist behavior and each package's `files` metadata determine the
artifact contents. The helper then unpacks every produced tarball's
`package/package.json` and validates version, provenance, and
dependency metadata before writing a transient release manifest.

This stays in release tooling. It does not change runtime lossless JSON
behavior, the development workspace graph, or tracked package metadata.
The rejected approaches remain rejected: no tracked `package.json`
release edits, no destructive reset cleanup, no `0.0.0` release
metadata, no `workspace:*`, `file:`, `link:`, Git, branch, checkout, or
home-directory dependency specifiers, and no public npm registry target.

## Validation Performed

Focused release-tooling tests:

```sh
pnpm exec vitest run scripts/lossless-private-release.test.ts \
  scripts/lossless-private-registry.test.ts --reporter=dot
```

Result: passed (`2` files, `11` tests).

Focused lint:

```sh
pnpm exec eslint scripts/lossless-private-release.ts \
  scripts/lossless-private-release.test.ts \
  scripts/lossless-private-registry.ts \
  scripts/lossless-private-registry.test.ts
```

Result: passed.

Pinned private registry start:

```sh
ROOT=/private/tmp/prisma-lossless-private-registry
env \
  PRISMA_LOSSLESS_REGISTRY_ROOT="$ROOT" \
  pnpm exec tsx scripts/lossless-private-registry.ts start
```

Result: passed. Verdaccio `6.8.0` became healthy at
`http://127.0.0.1:4873/`.

Focused package build:

```sh
pnpm --filter @prisma-lossless/debug --filter @prisma-lossless/get-platform \
  --filter @prisma-lossless/fetch-engine --filter @prisma-lossless/engines \
  --filter @prisma-lossless/config --filter @prisma-lossless/client-runtime-utils \
  --filter @prisma-lossless/client --filter prisma-lossless build
```

Result: passed.

Private release candidate build:

```sh
ROOT=/private/tmp/prisma-lossless-private-registry
env \
  PRISMA_LOSSLESS_REGISTRY_ROOT="$ROOT" \
  pnpm exec tsx scripts/lossless-private-release.ts build \
  http://127.0.0.1:4873/
```

Result: passed. The helper selected version
`7.8.0-lossless.1` from the approved private registry and source
commit `95d53bd4df6632c52ccfe7e2f58d2003dbdd02b6`.

Generated release workspace:

```text
tmp/lossless-json-tasklet-016/runs/1784329941622-95d53bd4df66
```

Generated tarballs:

- `prisma-debug-7.8.0-lossless.1.tgz`;
- `prisma-get-platform-7.8.0-lossless.1.tgz`;
- `prisma-fetch-engine-7.8.0-lossless.1.tgz`;
- `prisma-engines-7.8.0-lossless.1.tgz`;
- `prisma-config-7.8.0-lossless.1.tgz`;
- `prisma-client-runtime-utils-7.8.0-lossless.1.tgz`;
- `prisma-lossless-client-7.8.0-lossless.1.tgz`;
- `prisma-lossless-7.8.0-lossless.1.tgz`.

Ignored transient storage validation:

```sh
git check-ignore -v tmp/lossless-json-tasklet-016
```

Result: passed. The generated staging tree, manifest, and tarballs are
under `.gitignore`'s `tmp` rule.

Independent packed metadata validation:

```sh
node -e '<read manifest, tar -xOf each package/package.json, \
  validate dependency specs, version, and source commit>'
```

Result: passed for all eight tarballs. Each packed manifest recorded
version `7.8.0-lossless.1` and source commit
`95d53bd4df6632c52ccfe7e2f58d2003dbdd02b6`. Dependency sections
contained no `0.0.0`, `workspace:*`, `file:`, `link:`, Git, branch,
checkout, or home-directory dependency specifiers.

The first broad metadata probe also flagged `../../.db.env` in
`@prisma-lossless/client` npm test scripts. That was not accepted as a
failure because the tasklet's forbidden-reference rule applies to
dependency specs, not development scripts in package metadata.

Public-registry guard:

```sh
ROOT=/private/tmp/prisma-lossless-private-registry
env \
  PRISMA_LOSSLESS_REGISTRY_ROOT="$ROOT" \
  pnpm exec tsx scripts/lossless-private-release.ts next-version \
  https://registry.npmjs.org/
```

Result: failed as expected with:

```text
Refusing to publish lossless Prisma packages to public registry:
https://registry.npmjs.org/
```

Repo-root build:

```sh
pnpm build
```

Result: passed (`44` successful, `44` total).
