# Sprint 16

### [ ] Tasklet 030: Publish Public Npm Release

Branch: `target-7.8.0-lossless`

Status: approved for implementation and public npm publication by the
user prompt.

## Goal

Adapt Prisma's existing `scripts/ci/publish.ts` tooling so this fork
can publish the exact prisma-lossless release graph to the global npm
registry. Do not create a competing standalone publisher.

The public publish path must publish only the ten fork-owned public
artifacts that are part of the validated lossless release graph, under
the `lossless` npm dist-tag, and it must refuse to mutate source
package metadata while publishing.

## Pre-Implementation Review

Observed problem: Prisma already has npm publishing support in
`scripts/ci/publish.ts`, but its default release flow targets upstream
Prisma channels and workspace semantics. It calculates dev or release
versions, updates internal package dependencies during publish, writes
package versions to manifests, special-cases stock `prisma`, and can
publish more than the validated lossless release graph.

Violated contract or invariant: public npm publication is an
irreversible package identity boundary. The fork must publish the exact
versioned source package graph already validated for
prisma-lossless, not a graph whose metadata is rewritten during
publication or whose package set is inferred from the whole workspace.

Owning layer: `scripts/ci/publish.ts` owns npm publication for Prisma
packages. It should gain a fork-specific public release mode that
reuses the existing publish-order execution but constrains package set,
version, dist-tag, and mutation behavior. `scripts/private-release.ts`
continues to own the immutable private release identity fixture; the
public publish mode should consume that identity as the source of
truth.

Intended solution: add a `--lossless-public-release <version>` mode to
`scripts/ci/publish.ts`. The mode must require an available immutable
private release identity for the exact version, select only the ten
`RELEASE_PACKAGES`, assert their source manifests already carry the
requested version and exact fork-owned dependency specifiers, verify
that each package/version is not already present on npmjs.org, and run
`pnpm publish --no-git-checks --access public --tag lossless` in
dependency order. It must skip the upstream version-selection,
ecosystem-test, package-version-writing, and dependency-update steps.

Rejected solution: do not manually publish package by package, do not
use the ephemeral Verdaccio wrapper for public npm, do not invoke the
stock publish flow with only environment variables and hope
`ONLY_PACKAGES` prevents metadata mutation, and do not publish under
`latest`. Those approaches either bypass the owning publish tooling,
retain wrong-layer artifact mutation, or expose the fork as the default
Prisma-compatible release channel.

Validation that proves the fix: focused unit tests must prove the
lossless public package selection, version/source metadata checks,
publish-order filtering, and existing-version refusal behavior. The
release tooling must pass formatting and focused lint. Repo-root
`pnpm build` must pass. A dry-run publish must contact npmjs.org and
run npm's package dry-run checks, then the approved actual publish
must publish all ten packages publicly under the `lossless` dist-tag.

## Pre-Implementation Review: Local Branch Fallback

Observed problem: the public lossless dry-run command fails in a
developer terminal because `scripts/ci/publish.ts` requires
`GITHUB_REF_NAME` before it parses and handles the
`--lossless-public-release` mode. Prisma's existing branch helper
already knows how to ask git for the current branch, but the early
guard prevents that fallback from running.

Violated contract or invariant: the public publish command must remain
usable from both CI and an authenticated developer shell. `GITHUB_REF_NAME`
is a CI input, not an npm publication contract. When it is absent, the
currently checked out branch is the authoritative local branch.

Owning layer: `scripts/ci/publish.ts` owns branch resolution for the
publish flow. It should preserve `GITHUB_REF_NAME` as the highest
priority source and fall back to `git rev-parse` for local execution.

Intended solution: remove the unconditional early
`GITHUB_REF_NAME` guard, expose branch resolution as a small helper,
and make patch-branch detection consume the already resolved branch.
The helper must return `GITHUB_REF_NAME` when present and otherwise use
the currently checked out git branch.

Rejected solution: do not require users to export fake CI variables in
their shell, and do not bypass the publish script with a separate
public npm publisher. Both would move responsibility out of the
existing publish tooling instead of fixing the branch-resolution
contract it already owns.

Validation that proves the fix: focused unit tests must prove that
`GITHUB_REF_NAME` is retained when present, local git branch resolution
is used when it is absent, branch lookup failure remains non-fatal,
and patch-branch detection uses the resolved branch.

## Post-Implementation Review: Local Branch Fallback

Observed result: `scripts/ci/publish.ts` no longer rejects local
execution when `GITHUB_REF_NAME` is unset. The script resolves the
branch from `GITHUB_REF_NAME` when present, otherwise calls
`git rev-parse --symbolic-full-name --abbrev-ref HEAD`, logs that
branch, and computes patch-branch behavior from the resolved value.

Contract review: the fix stays in the publish layer that owns branch
selection. It does not require callers to spoof CI state, does not
introduce a separate publisher, and does not weaken npm identity
checks. The lossless public mode still validates immutable release
metadata before publication and still refuses already-published
package versions before starting the package publish loop.

Rejected wrong-layer solution retained: callers should not export a
fake `GITHUB_REF_NAME` in their shell. That would make local
publication depend on manually-maintained CI state rather than the
checked-out git branch.

Validation evidence:

- `pnpm exec vitest run scripts/ci/publish.test.ts` passed with 11
  tests.
- `pnpm exec prettier --check scripts/ci/publish.ts
scripts/ci/publish.test.ts
docs/plans/lossless-json/030-publish-public-npm-release.md` passed.
- `NODE_OPTIONS=--max-old-space-size=8192 pnpm exec eslint
scripts/ci/publish.ts scripts/ci/publish.test.ts` passed with 0
  errors and 6 existing unsafe-`any` warnings in `publish.ts`.
- `pnpm run publish-lossless-public-dryrun` passed without
  `GITHUB_REF_NAME`; it resolved branch `target-7.8.0-lossless` from
  git and completed npm dry-run publication for all ten packages under
  the `lossless` dist-tag.
- `pnpm build` passed with 44 successful build tasks.

Remaining acceptance work: run the non-dry-run public npm publication
from an authenticated shell, then verify npmjs.org reports all ten
package versions under the `lossless` dist-tag. Do not mark this
tasklet `[DONE]` until that public publish evidence exists.

## Pre-Implementation Review: Scoped CLI Package

Observed problem: the public publish path reaches the final CLI
package and npm rejects `prisma-lossless` with `E403`. The first nine
packages are under the `@prisma-lossless` organization scope, but the
CLI package is unscoped. An npm organization token owns scoped package
names such as `@prisma-lossless/cli`; it does not own the global
unscoped package namespace.

Violated contract or invariant: the fork's public artifacts must use a
consistent organization-owned npm identity. A public package graph that
mixes `@prisma-lossless/*` packages with an unscoped
`prisma-lossless` package is not wholly owned by the npm organization
and cannot be published with the same credential contract.

Owning layer: package metadata, release identity, private registry
fixtures, public publish selection, and migration documentation own the
artifact identity. Runtime command UX owns the executable name and
should keep the `prisma-lossless` bin.

Intended solution: rename the CLI package from `prisma-lossless` to
`@prisma-lossless/cli`, keep `"bin": { "prisma-lossless": ... }`,
update the lossless release package graph and tests to use the scoped
package name, update consumer docs to install `@prisma-lossless/cli`,
and mint/use a new immutable release version. The failed `.11` public
attempt must not be reused.

Rejected solution: do not ask the user to claim or publish an unscoped
`prisma-lossless` package manually. That keeps a package outside the
organization namespace and preserves the mixed-identity release graph.
Also do not suppress the CLI package from public publication; consumers
need a normal dev dependency that provides the `prisma-lossless`
executable.

Validation that proves the fix: focused tests must prove the public
release graph includes `@prisma-lossless/cli` and excludes unscoped
`prisma-lossless`, package metadata validation accepts the scoped CLI
package, and publish order includes the scoped CLI package last. The
public dry-run must show npm preparing `@prisma-lossless/cli` while the
tarball still provides the `prisma-lossless` executable.

## Post-Implementation Review: Scoped CLI Package

Observed result: the CLI npm package source is now named
`@prisma-lossless/cli`, while its binary remains `prisma-lossless`.
The release graph, private registry tooling, public publish tooling,
consumer documentation, client peer dependency metadata, bootstrap
messages, generated config imports, and update-message tests now use
the scoped package where package identity is required. Historical
immutable releases through `.11` remain recorded with their original
unscoped package names and are unavailable with replacement
`7.8.0-lossless.12`.

Contract review: the fix keeps package ownership in the
`@prisma-lossless` npm organization and preserves the user command
surface as a binary name. It does not rewrite artifacts during public
publication and does not suppress the CLI package from the graph.
The immutable `.12` release identity is recorded against source
commit `b2ab5c601d5e894c4a3c80ad8363c89ae7d5dea5` and reproduces
the package graph ending in `@prisma-lossless/cli`.

Rejected wrong-layer solution retained: do not publish the unscoped
`prisma-lossless` package manually, and do not ask consumers to mix a
scoped runtime graph with an unscoped CLI package. That would keep
ownership split across npm namespaces.

Validation evidence:

- `pnpm build` passed from the repo root after the package rename.
- `prepareBuiltPrivateReleaseCandidates('7.8.0-lossless.12')`
  passed after recording the `.12` identity.
- `pnpm exec vitest run scripts/private-release.test.ts
scripts/private-registry.test.ts scripts/private-registry-run.test.ts
scripts/ci/publish.test.ts` passed with 48 tests.
- `pnpm --filter @prisma-lossless/cli test
src/__tests__/update-message.test.ts
src/__tests__/printUpdateMessage.test.ts` passed with 12 tests
  and 7 snapshots.
- `pnpm --filter @prisma-lossless/cli test
src/bootstrap/__tests__/Bootstrap.vitest.ts
src/__tests__/Init.vitest.ts` passed with 44 tests.
- `pnpm exec prettier --check` passed for the touched release
  tooling, docs, and plan files.
- `NODE_OPTIONS=--max-old-space-size=8192 pnpm exec eslint`
  passed for touched release tooling with 0 errors and 7 existing
  unsafe-`any` warnings.
- `pnpm run publish-lossless-public-dryrun` passed. Its publish
  order ended with `@prisma-lossless/cli`, and its engines tarball
  included `dist/scripts/postinstall.js` and
  `dist/scripts/localinstall.js`.

Remaining acceptance work: the non-dry-run
`pnpm run publish-lossless-public` command reached its built-in
dry-run successfully, then failed on the first real publish because
this Codex process is not authenticated to npmjs.org. `npm whoami
--registry=https://registry.npmjs.org/` returned `E401 Unauthorized`,
and no `.12` package was published. Re-run the same command from an
authenticated shell, then verify all ten package versions are visible
on npmjs.org under the `lossless` dist-tag before marking this
tasklet `[DONE]`.

## Implementation Steps

1. Add `--lossless-public-release <version>` to `scripts/ci/publish.ts`.
2. Reuse the existing package inventory and publish-order machinery.
3. Constrain the mode to the ten `RELEASE_PACKAGES` package names.
4. Validate the requested immutable release identity is available.
5. Assert source package versions and fork-owned dependency specifiers
   already match the requested version.
6. Verify every target package/version is absent from npmjs.org before
   publishing.
7. Publish with `--access public` and `--tag lossless` in dependency
   order, without package metadata rewrites.
8. Update `MIGRATION_FROM_PRISMA.md` with public npm install guidance.
9. Run focused tests, formatting, lint, repo build, npm dry-run, and
   the user-approved public npm publish.

## Acceptance Criteria

- Public publication uses `scripts/ci/publish.ts`, not a new
  standalone publisher.
- The mode publishes only the ten validated lossless release packages.
- The mode refuses unavailable or unknown immutable release versions.
- The mode refuses to publish if any package/version already exists on
  npmjs.org.
- The mode does not rewrite package names, versions, dependencies, or
  generated metadata before publishing.
- The public dist-tag is `lossless` unless an explicit override is
  supplied.
- `MIGRATION_FROM_PRISMA.md` documents normal public npm install
  commands after publication.
- All ten packages are publicly published to npmjs.org when the final
  publish command runs.
