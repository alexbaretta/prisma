# Sprint 16

### [DONE] Tasklet 030: Publish Public Npm Release

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

Resolved acceptance work: npmjs.org verification reports all ten
package versions under the `lossless` dist-tag. The authenticated
publish command still needed retry repair because it failed after npm
accepted packages and a rerun treated existing versions as fatal.

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

Resolved acceptance work: the non-dry-run
`pnpm run publish-lossless-public` command reached its built-in
dry-run successfully, then failed on the first real publish because
this Codex process is not authenticated to npmjs.org. `npm whoami
--registry=https://registry.npmjs.org/` returned `E401 Unauthorized`,
and no `.12` package was published from the Codex shell. The user then
ran the same command from an authenticated shell. npmjs.org
verification reports all ten `.12` packages publicly available under
the `lossless` dist-tag, but the command did not finish cleanly and a
rerun failed on the old graph-wide absence preflight.

## Pre-Implementation Review: Optional Slack Notification

Observed problem: the authenticated public publish completed all ten
npm package uploads for `7.8.0-lossless.12`, then printed an
`Incoming webhook URL is required` stack trace from the Slack
notification path. Local npm publication is an approved execution
mode, but that shell does not necessarily have Prisma CI's Slack
webhook secret.

Violated contract or invariant: package publication is the irreversible
contract boundary. A missing optional notification secret must not make
a successful local publication look failed after npm accepted the
release graph. The publish script should still send Slack release
messages when the webhook is configured.

Owning layer: `scripts/ci/publish.ts` owns post-publish release
notifications. It should decide whether a Slack webhook is configured
before constructing `IncomingWebhook`.

Intended solution: add a typed helper that reads
`SLACK_RELEASE_FEED_WEBHOOK` from the environment, treats empty or
missing values as absent, and make `sendSlackMessage` return after a
clear log message when no webhook is configured. Preserve existing
Slack behavior when the variable is present.

Rejected solution: do not require local publishers to export a fake
Slack webhook, and do not remove Slack notification support for CI.
Both approaches would move responsibility to the wrong layer.

Validation that proves the fix: focused unit tests must prove missing
and empty webhook variables are skipped while configured webhooks are
retained. After publication, npmjs.org verification must prove all ten
packages are visible under the `lossless` dist-tag.

## Post-Implementation Review: Optional Slack Notification

Observed result: `scripts/ci/publish.ts` now reads the optional Slack
release feed webhook through a typed helper. `sendSlackMessage`
returns with a clear log message when
`SLACK_RELEASE_FEED_WEBHOOK` is absent or blank, and still constructs
`IncomingWebhook` when the webhook is configured.

Contract review: the fix stays in the post-publish notification layer.
It does not change package selection, version validation, npm
publication, dist-tag assignment, or immutable release metadata. A
missing local Slack secret no longer makes a successful publication
look like a release failure after npm has accepted the graph.

Rejected wrong-layer solution retained: local publishers should not
export fake Slack webhook values, and CI Slack notification support
should not be removed.

Validation evidence:

- `npm view` against `https://registry.npmjs.org/` verified all ten
  `7.8.0-lossless.12` packages are published and tagged `lossless`.
- `pnpm exec vitest run scripts/ci/publish.test.ts` passed with 13
  tests.
- `pnpm exec prettier --check scripts/ci/publish.ts
scripts/ci/publish.test.ts
docs/plans/lossless-json/030-publish-public-npm-release.md` passed.
- A full test suite was not run after this notification-only fix per
  the user's explicit request to keep validation focused.

## Pre-Implementation Review: Idempotent Public Publish Retry

Observed problem: retrying `pnpm run publish-lossless-public` after a
partially successful public publish fails before the publish loop
because `assertLosslessPublicVersionsUnpublished` rejects the first
already-published package version. npm publication is not atomic
across the ten-package graph, so a retry must tolerate packages that
npm already accepted.

Violated contract or invariant: the public release tool must be
restartable after a partial upload. An already-published
`name@version` is not by itself a fatal error for a retry; it is the
expected state for packages accepted before the previous failure.

Owning layer: `scripts/ci/publish.ts` owns public npm publication and
must handle npm's per-package conflict response in the publish loop.

Intended solution: remove the graph-wide absence preflight for the
lossless public mode. In the per-package publish step, catch npm's
already-published version error, log a warning, and continue to the
next package when static package metadata is enabled. Preserve normal
failure behavior for all other publish errors.

Rejected solution: do not ask the user to mint a new version solely to
recover from a retryable partial upload, and do not require manual
package-by-package publishing outside `scripts/ci/publish.ts`.

Validation that proves the fix: focused unit tests must prove the
already-published npm error is classified, unrelated publish errors
are not classified, and the existing lossless publish tests still pass.

## Post-Implementation Review: Idempotent Public Publish Retry

Observed result: the lossless public publish mode no longer performs
the graph-wide absence preflight. The real publish loop now catches
npm's already-published version error, logs a warning for that
`name@version`, and continues to the next package. Other publish
errors still throw.

Contract review: the fix is in the publish layer that owns npm's
per-package result handling. It does not bypass `scripts/ci/publish.ts`,
does not manually publish packages, and does not weaken metadata
validation before publishing. Retry behavior is scoped to the static
lossless public release path.

Rejected wrong-layer solution retained: do not mint a new release just
to recover from a partial upload, and do not ask the user to finish the
graph package-by-package.

Validation evidence:

- `npm view` against `https://registry.npmjs.org/` showed all ten
  `7.8.0-lossless.12` package versions exist. The existing packages
  still have `latest` at `.11` and `lossless` at `.12`; the new
  `@prisma-lossless/cli` package has both tags at `.12`.
- `pnpm exec vitest run scripts/ci/publish.test.ts` passed with 15
  tests.
- `pnpm exec prettier --check scripts/ci/publish.ts
scripts/ci/publish.test.ts
docs/plans/lossless-json/030-publish-public-npm-release.md` passed.
- A full test suite was not run per the user's explicit request to
  keep this fix quick and focused.

## Pre-Implementation Review: Mint Public Version 13

Observed problem: rerunning the `.12` public publish still fails on
`@prisma-lossless/client-runtime-utils@7.8.0-lossless.12`. The retry
classifier did not see npm's stderr in the thrown error shape, and
the `.12` public attempt no longer provides a clean end-to-end
publication run.

Violated contract or invariant: the public release version used by
consumers should come from a clean, repeatable release command, not
from a partially-failed command that requires interpreting mixed npm
state after the fact.

Owning layer: source package metadata, immutable release identity
fixtures, public publish scripts, and migration documentation own the
versioned package graph.

Intended solution: bump the lossless package graph and public publish
commands from `7.8.0-lossless.12` to `7.8.0-lossless.13`, record a
new immutable release identity for `.13`, update user migration
guidance to install `.13`, and broaden the retry classifier so it can
inspect nested process error stdout/stderr while retaining fatal
handling for unrelated publish failures.

Rejected solution: do not continue asking the user to republish `.12`
or manually repair the graph through the npm website. Also do not hide
the retry classifier defect by version bumping only; the classifier
still owns future partial-publish recovery.

Validation that proves the fix: focused release and publish unit tests
must pass, formatting must pass for touched files, and npmjs.org must
report `.13` absent before the user runs the actual public publish.

## Post-Implementation Review: Mint Public Version 13

Observed result: the package graph, root public publish commands,
lockfile specifiers, migration guide, and release tests now target
`7.8.0-lossless.13`. A new immutable `.13` release identity is
recorded against source provenance
`7fc4bafb1882d52bee610816d0479828430c68e9`.

Contract review: the fix keeps Prisma's existing
`scripts/ci/publish.ts` as the public publish path. It does not add a
manual publisher or require npm website repair. The retry classifier
now inspects nested publish error output, but unrelated publish errors
remain fatal.

Rejected wrong-layer solution retained: do not keep retrying `.12` as
the recommended public target, and do not ask the user to manually
publish individual packages.

Validation evidence:

- `pnpm exec vitest run scripts/private-release.test.ts
scripts/ci/publish.test.ts` passed with 32 tests.
- `prepareBuiltPrivateReleaseCandidates('7.8.0-lossless.13')`
  passed after the public dry-run rebuilt package artifacts.
- `npm view` against `https://registry.npmjs.org/` reported all ten
  `7.8.0-lossless.13` packages absent before publication.
- `pnpm run publish-lossless-public-dryrun` passed for all ten
  packages under the `lossless` tag. The engines dry-run tarball
  included `dist/scripts/postinstall.js` and
  `dist/scripts/localinstall.js`.
- Full repo validation was not run; this was kept focused for the
  requested quick version switch.

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
