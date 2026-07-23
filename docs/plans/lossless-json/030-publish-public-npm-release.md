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

### [DONE] Tasklet 031: Promote Latest Dist Tag

Status: approved for implementation by the user prompt to make this
the default behavior of `pnpm run publish-lossless-public`.

## Pre-Implementation Review: Promote Latest Dist Tag

Observed problem: `pnpm run publish-lossless-public` publishes each
package with the `lossless` npm dist-tag. npmjs.org therefore records
`7.8.0-lossless.13` as the `lossless` version, but the package page
and default install metadata still show stale `latest` values from
older partial releases.

Violated contract or invariant: the public prisma-lossless fork owns
its npm namespace. A successful public release command must leave the
new immutable release as the default package identity for consumers of
that namespace, not only as a secondary tag.

Owning layer: `scripts/ci/publish.ts` owns npm publication and npm
tagging for the public release command. Tag promotion should happen in
that layer after the package publish loop succeeds or skips packages
that npm already accepted during a retry.

Intended solution: make the lossless public publish path promote every
validated package in the release graph to npm's `latest` dist-tag after
publication. Dry-runs must log the exact `npm dist-tag add` commands
without mutating the registry, while real publishes must run them
against npmjs.org.

Rejected solution: do not ask users to repair npm tags manually in the
npm website, and do not add a second standalone tag-repair script as
the normal path. That would split the release contract across tools
and leave the default command producing surprising registry state.

Validation that proves the fix: focused unit tests must prove the
generated `npm dist-tag add` commands cover the complete
prisma-lossless public package graph and target `latest` at the
requested release version. Formatting and the focused publish test
suite must pass.

## Post-Implementation Review: Promote Latest Dist Tag

Observed result: the lossless public publish path now promotes all ten
validated prisma-lossless package names to npm's `latest` dist-tag
after the package publish loop. Dry-run mode logs the exact
`npm dist-tag add <name>@<version> latest` commands without mutating
the registry.

Contract review: the fix remains inside Prisma's existing
`scripts/ci/publish.ts` release tooling. It does not add a second
publisher, does not rewrite package metadata, and does not rely on
manual npm website repair. Because the tag step runs after the publish
loop, retries that skip already-published packages still repair the
default dist-tag state for the same immutable version.

Rejected wrong-layer solution retained: do not leave `latest` repair
as an external checklist item. The default public publish command must
produce the registry state consumers see by default.

Validation evidence:

- `pnpm exec vitest run scripts/ci/publish.test.ts` passed with 16
  tests.
- `pnpm exec prettier --check scripts/ci/publish.ts
scripts/ci/publish.test.ts
docs/plans/lossless-json/030-publish-public-npm-release.md` passed.
- `NODE_OPTIONS=--max-old-space-size=8192 pnpm exec eslint
scripts/ci/publish.ts scripts/ci/publish.test.ts` passed with 0
  errors and 6 existing unsafe-`any` warnings in `publish.ts`.
- `pnpm run publish-lossless-public-dryrun` passed outside the
  sandbox after the sandboxed attempt hit a `tsx` IPC `EPERM`
  restriction. The dry-run printed all ten
  `npm dist-tag add ... latest --registry=https://registry.npmjs.org/`
  commands with `(dry)`.
- No actual npm dist-tags were mutated by this Codex run.

## Implementation Steps

1. Add `--lossless-public-release <version>` to `scripts/ci/publish.ts`.
2. Reuse the existing package inventory and publish-order machinery.
3. Constrain the mode to the ten `RELEASE_PACKAGES` package names.
4. Validate the requested immutable release identity is available.
5. Assert source package versions and fork-owned dependency specifiers
   already match the requested version.
6. Treat already-published target package versions as retryable during
   the package publish loop.
7. Publish with `--access public` and `--tag lossless` in dependency
   order, without package metadata rewrites.
8. Promote every target package/version to npm's `latest` dist-tag.
9. Update `MIGRATION_FROM_PRISMA.md` with public npm install guidance.
10. Run focused tests, formatting, lint, repo build, npm dry-run, and
    the user-approved public npm publish.

## Acceptance Criteria

- Public publication uses `scripts/ci/publish.ts`, not a new
  standalone publisher.
- The mode publishes only the ten validated lossless release packages.
- The mode refuses unavailable or unknown immutable release versions.
- The mode can be retried when npm already accepted a package/version.
- The mode does not rewrite package names, versions, dependencies, or
  generated metadata before publishing.
- The public publish command tags the release as `lossless` and
  promotes the same version to `latest` after publication.
- `MIGRATION_FROM_PRISMA.md` documents normal public npm install
  commands after publication.
- All ten packages are publicly published to npmjs.org when the final
  publish command runs.

### [DONE] Tasklet 032: Correct Public Repository Metadata

Status: approved for implementation by the user report that npm lists
the stock Prisma repository for prisma-lossless packages.

## Pre-Implementation Review: Correct Public Repository Metadata

Observed problem: npmjs.org lists
`https://github.com/prisma/prisma` as the repository for published
`@prisma-lossless/*` packages. The source package manifests for the ten
public release packages still contain
`https://github.com/prisma/prisma.git`, and several also contain stock
Prisma homepage and issue tracker URLs.

Violated contract or invariant: public package metadata is part of the
artifact identity consumers inspect before adoption. A fork-owned
`@prisma-lossless/*` package must not advertise the upstream Prisma
repository, homepage, or issue tracker as if it were stock Prisma.

Owning layer: the source `package.json` files for the public release
graph own npm package metadata. `scripts/private-release.ts` owns the
pre-publish metadata validation that must prevent this regression from
reaching npm again.

Intended solution: update the ten public release package manifests to
advertise the fork repository at
`https://github.com/alexbaretta/prisma.git`, the matching README
homepage, and the matching issue tracker where homepage or bugs
metadata is present. Strengthen release metadata validation so any
future public package graph that points to upstream Prisma is rejected
before packing or publishing.

Rejected solution: do not try to edit npmjs.org metadata for
`7.8.0-lossless.13`; npm package version metadata is immutable after
publication. Do not leave this as a manual npm website correction,
because the source manifests would keep producing the same wrong
metadata in the next release.

Validation that proves the fix: focused unit tests must fail if a
release package manifest points at `github.com/prisma/prisma` and pass
for the corrected fork metadata. Formatting, focused private-release
tests, focused publish tests, and a dry-run package metadata check
must pass before minting or publishing a replacement version.

## Post-Implementation Review: Correct Public Repository Metadata

Observed result: the public release package graph now records the fork
repository `https://github.com/alexbaretta/prisma.git`. Existing
homepage and issue tracker metadata in those packages now points to
the matching fork README and issue tracker. Release metadata
validation rejects public package manifests that advertise the
upstream Prisma repository, homepage, or issue tracker.

Contract review: the fix stays in source package metadata and the
release validation layer. It does not rewrite staged artifacts during
packing, does not attempt to mutate already-published npm metadata,
and does not rely on manual npm website edits. Because npm metadata
for `7.8.0-lossless.13` is immutable, that release is recorded as
unavailable and replaced by `7.8.0-lossless.14`.

Rejected wrong-layer solution retained: do not edit npmjs.org package
pages manually and do not repack `.13` with different bytes. The
correct package metadata must be present in source and enforced before
packing or publishing.

Validation evidence:

- `pnpm install` refreshed the workspace links for the `.14` graph.
- `pnpm build` passed outside the sandbox with 44 successful tasks.
  The sandboxed attempt failed earlier because `tsx` could not create
  IPC pipes under `/var/folders/...` (`EPERM`).
- `pnpm exec vitest run scripts/private-release.test.ts
scripts/ci/publish.test.ts` passed with 34 tests.
- `preparePinnedPrivateReleaseCandidates('7.8.0-lossless.14',
'0cada8c97c73855d0639b40cc33da0ccbfc4d179')` produced the recorded
  ten-package identity.
- `prepareBuiltPrivateReleaseCandidates('7.8.0-lossless.14')`
  reproduced the recorded identity with ten packages.
- Packed package metadata inspection showed all ten packages record
  `https://github.com/alexbaretta/prisma.git`; packages that carry
  homepage and bugs metadata point to the matching fork URLs.
- Unauthenticated `npm view` checks reported all ten
  `7.8.0-lossless.14` package versions absent on npmjs.org before
  publication.
- `pnpm run publish-lossless-public-dryrun` passed for all ten
  packages under the `lossless` tag and printed all ten dry
  `npm dist-tag add ... latest` commands.

### [DONE] Tasklet 033: Eliminate Stock Package Graph

Status: approved for implementation by the user prompt. This tasklet
records the package-graph defect reported after public npm adoption.
The user explicitly authorized committing or resetting the current
edits as necessary, removing deprecated local delivery mechanisms, and
considering an install-time incompatibility guard.
This tasklet is complete for source graph cleanup, public npm only
tooling, and install-time stock Prisma rejection. Actual npm
publication remains a separate release operation through
`pnpm run publish-lossless-public`.

## Diagnosis

Published `@prisma-lossless/cli@7.8.0-lossless.13` declares runtime
dependencies on stock `@prisma/dev@0.24.14` and
`@prisma/studio-core@0.27.3`. Published
`@prisma-lossless/engines@7.8.0-lossless.13` declares a runtime
dependency on stock `@prisma/engines-version`. Published
`@prisma-lossless/fetch-engine@7.8.0-lossless.13` declares the same
stock `@prisma/engines-version` dependency.

The stock transitive dependency paths are concrete:

- `@prisma-lossless/cli -> @prisma/dev -> @prisma/get-platform`
- `@prisma-lossless/cli -> @prisma/dev -> @prisma/query-plan-executor`
- `@prisma-lossless/cli -> @prisma/dev -> @prisma/streams-local`
- `@prisma-lossless/cli -> @prisma/dev -> @prisma/get-platform
-> @prisma/debug`
- `@prisma-lossless/cli -> @prisma/studio-core`
- `@prisma-lossless/engines -> @prisma/engines-version`
- `@prisma-lossless/fetch-engine -> @prisma/engines-version`

The current source manifests still contain the same immediate
stock identities:

- `packages/cli/package.json` depends on `@prisma/dev` and
  `@prisma/studio-core`.
- `packages/engines/package.json` depends on
  `@prisma/engines-version`.
- `packages/fetch-engine/package.json` depends on
  `@prisma/engines-version`.
- `packages/client/package.json`, `packages/migrate/package.json`,
  `packages/client-generator-js/package.json`, and
  `packages/client-generator-ts/package.json` still carry
  `@prisma/engines-version` in build or runtime package metadata.

The fork already owns local packages named
`@prisma-lossless/debug`, `@prisma-lossless/get-platform`, and
`@prisma-lossless/query-plan-executor`. The checkout does not
currently contain owned packages named
`@prisma-lossless/dev`, `@prisma-lossless/studio-core`,
`@prisma-lossless/streams-local`, or
`@prisma-lossless/engines-version`.

## Pre-Implementation Review: Package Graph Independence

Observed problem: the published prisma-lossless graph can still
resolve executable stock Prisma package identities from npm. This
happens through direct package metadata in owned release packages and
through the stock packages they pull transitively.

Violated contract or invariant: published Prisma Lossless packages may
depend on `prisma-lossless` and `@prisma-lossless/*` only. A clean
consumer's resolved package graph must contain no package named
`prisma` and no package whose name starts with `@prisma/`. This
invariant applies to runtime, optional, peer, bundled, generated, and
transitive package identities. Documentation and historical plan text
do not count as executable package-graph violations.

Owning layer: package source manifests, workspace package ownership,
runtime imports, generated package templates, release package
selection, packing validation, and external-consumer QA jointly own
the package graph. The fix belongs in those layers, not in a
consumer-side override or a publish-time rewrite.

Intended solution: replace each owned stock Prisma dependency with a
corresponding owned prisma-lossless package. Publish or otherwise
include any required internal support package in the lossless release
graph under `@prisma-lossless/*`. Update internal imports and runtime
resolution from stock package names to lossless package names. Extend
release validation so packed manifests reject any dependency,
optional dependency, peer dependency, bundled dependency, or resolved
lockfile package identity named `prisma` or starting with `@prisma/`.

Rejected solution: do not keep `@prisma/dev`,
`@prisma/studio-core`, `@prisma/engines-version`, or any other stock
identity behind an allowlist, and do not hide the defect with
consumer `pnpm.overrides`. Do not rewrite staged tarballs during
packing; the source package graph must already be correct.

Validation that proves the fix: a focused package-graph QA check must
inspect actual package identities from packed release manifests and a
clean external consumer lockfile. It must fail on any resolved
`prisma` or `@prisma/*` package identity. Focused tests must prove the
complete packed release graph has no stock identities and that CLI,
generation, migration, adapter, engine, and generated-client behavior
still works from the packed artifacts.

## Pre-Implementation Review: CLI Support Packages

Observed problem: moving `@prisma/dev` from the CLI's runtime
dependencies to development metadata removes the stock package from a
consumer lockfile, but the CLI build then attempts to bundle
`@prisma/dev` into the CommonJS CLI artifact. That package contains
top-level-await ESM chunks and runtime assets that the current CLI
bundle target cannot include. The CLI also imports
`@prisma/studio-core` directly in backend Studio code and in the
browser Studio entry.

Violated contract or invariant: the published CLI must keep the
`prisma init`, local Prisma Postgres classification, and Studio code
paths functional while resolving only owned prisma-lossless package
identities. A build workaround that removes those paths or leaves
stock runtime packages in the consumer graph violates that contract.

Owning layer: workspace package source and CLI imports own these
runtime identities. The release layer should pack owned
`@prisma-lossless/dev`, `@prisma-lossless/studio-core`, and
`@prisma-lossless/streams-local` packages as source inputs, then make
the CLI depend on those names.

Intended solution: introduce owned workspace packages for the required
CLI support packages, update their package metadata and internal
runtime references to lossless package names, add them to the
immutable release package graph, and update CLI imports, tests, and
version reporting to use the owned names. `@prisma-lossless/dev`
remains an external runtime dependency of the CLI rather than being
bundled into `build/index.js`.

Rejected solution: do not disable the `prisma init` local database URL
path or the Studio code path to avoid the dependency. Do not keep
`@prisma/dev` or `@prisma/studio-core` in the published graph and
attempt to suppress the package-graph QA result. Do not rewrite
packed tarballs after `pnpm pack`; the source package manifests and
runtime imports must already be correct before packing starts.

Validation that proves the fix: `@prisma-lossless/cli` builds with
the owned support packages externalized, focused tests prove the
release graph includes the support packages and rejects stock
identities, packed release manifests contain no `prisma` or
`@prisma/*` dependencies, and a clean consumer lockfile parser fails
on any stock package identity.

## Pre-Implementation Review: Public NPM Only Tooling

Observed problem: the repository still contains executable private
release, local tarball, ephemeral registry, and Verdaccio tooling that
was built for local first-party consumption before the fork moved to
public npm packages. The public publisher still imports its package
inventory and metadata checks from that deprecated private-release
layer.

Violated contract or invariant: prisma-lossless is now a plain public
npm project. The release and migration paths must not require or
advertise local tarballs, private manifests, `--from-built`, Verdaccio,
or ephemeral registry processes.

Owning layer: `scripts/ci/publish.ts`, public release helper code,
migration documentation, and the active release plan own the public npm
release workflow. The old private-registry and private-release scripts
own only the deprecated deployment mechanism and should be removed.

Intended solution: replace the public publisher's dependency on
`scripts/private-release.ts` with a public npm package inventory and
metadata guard, then delete source files solely devoted to private
release identity fixtures, local release packing, ephemeral registries,
and Verdaccio tests.

Rejected solution: do not keep the private release scripts as hidden
implementation details for public publication, and do not validate
public npm packages by installing from an ephemeral registry.

Validation that proves the fix: a source search must find no live
`scripts/private-*` local-delivery implementation, public publish tests
must pass through the new public helper, and documentation for consumer
migration must reference npmjs.org installation only.

## Pre-Implementation Review: Stock Prisma Install Guard

Observed problem: npm package metadata does not provide a portable
`conflicts` field that makes npm reject installing `prisma-lossless`
beside stock `prisma`. An optional peer dependency with an impossible
stock Prisma version does not make npm fail when stock Prisma is also
declared by the consumer.

Violated contract or invariant: a consumer project should not link the
lossless fork and stock Prisma packages in the same dependency graph,
because that mixes incompatible generated-client, CLI, and runtime
contracts.

Owning layer: the published `@prisma-lossless/cli` lifecycle script
already owns install-time environment checks. It can inspect the
consumer project's root `package.json` through npm's `INIT_CWD`
contract and fail the install before the CLI is used.

Intended solution: extend the CLI preinstall script to reject a
consumer root package that directly declares `prisma` or any
`@prisma/*` package in dependency, dev dependency, optional
dependency, or peer dependency metadata.

Rejected solution: do not add a non-optional impossible peer dependency
on `prisma`, because that can make installing prisma-lossless alone
fail by asking npm to resolve an impossible missing peer. Do not rely on
warnings from optional peers because npm permits that installation.

Validation that proves the fix: focused preinstall unit tests must
prove stock Prisma dependencies fail with an actionable message and a
lossless-only consumer package succeeds.

## Post-Implementation Review: Public NPM Only Tooling

Observed result: the public publisher no longer imports private
release identity, local packing, or ephemeral registry code. Public
package selection and metadata validation now live in
`scripts/lossless-public-release.ts`, which enumerates the public
`@prisma-lossless/*` package graph, validates fork repository
metadata, rejects stock Prisma package identities in installable
dependency sections, and requires exact version specifiers for
owned public release dependencies.

Contract review: the fix removes the deprecated local delivery layer
instead of preserving it as a hidden implementation detail. Source
files solely devoted to private release fixtures, local package
packing, ephemeral registries, and Verdaccio tests were deleted.
Consumer documentation now describes only ordinary npmjs.org
installation and regeneration commands.

Rejected wrong-layer solution retained: do not use ephemeral
registries, local tarballs, private release manifests, or copied
wrapper implementations to validate or deliver public prisma-lossless
packages.

Validation evidence:

- `rg` found no live `private-registry`, `private-release`,
  `from-built`, `Verdaccio`, `verdaccio`, `ephemeral registry`,
  `PRISMA_LOSSLESS_RUN_REGISTRY`, `lockfile-only`, or
  `ignore-scripts` references in `scripts`, root `package.json`, or
  `MIGRATION_FROM_PRISMA.md`.
- `pnpm exec vitest run scripts/ci/publish.test.ts` passed with 16
  tests after the public metadata helper replaced the private release
  dependency.
- Public metadata validation rejects stock Prisma names from the
  installable package graph while allowing repository-only dev tooling
  dependencies that are not installed by consumers.
- Sandboxed repo-root `pnpm build` failed earlier with `tsx` IPC
  `EPERM` under `/var/folders/...`. The same `pnpm build` was rerun
  outside the sandbox and passed with 44 successful build tasks.

## Post-Implementation Review: Stock Prisma Install Guard

Observed result: the CLI preinstall script now reads the consumer
root from npm's `INIT_CWD` contract, inspects the root `package.json`,
and exits with an actionable error when the consumer directly declares
`prisma` or any `@prisma/*` package in dependencies,
devDependencies, optionalDependencies, or peerDependencies. The guard
allows `@prisma-lossless/*` package names.

Contract review: npm does not provide a portable declarative package
conflict mechanism. A local npm experiment with an optional
impossible peer dependency still allowed a consumer to install both
package identities. The preinstall guard therefore lives in the
published CLI lifecycle layer, which is the earliest reliable
consumer-install boundary this package owns.

Rejected wrong-layer solution retained: do not rely on optional peer
warnings, non-standard npm metadata, or consumer package-manager
overrides to prevent stock Prisma and prisma-lossless from being
linked together.

Validation evidence:

- `pnpm --filter @prisma-lossless/cli build` passed and regenerated
  the CLI preinstall artifact.
- `pnpm --filter @prisma-lossless/cli test
src/__tests__/preinstall.test.ts` passed with 14 Jest tests and 12
  snapshots.
- A temporary npm package-manager experiment proved an optional
  impossible peer does not fail installation when stock `prisma` is
  also declared, so the rejected declarative-peer approach is not
  sufficient.

## Post-Implementation Review: Package Graph Independence

Observed result: the release graph now contains fifteen owned
prisma-lossless packages. The added release packages are
`@prisma-lossless/query-plan-executor`,
`@prisma-lossless/streams-local`, `@prisma-lossless/dev`, and
`@prisma-lossless/studio-core`. The CLI source now imports
`@prisma-lossless/dev`, `@prisma-lossless/studio-core`, and
`@prisma-lossless/management-api-sdk` instead of stock Prisma package
names. `@prisma-lossless/dev` package-internal executable artifacts
now resolve `@prisma-lossless/get-platform`,
`@prisma-lossless/query-plan-executor`,
`@prisma-lossless/streams-local`, `@prisma-lossless/client`, and
`@prisma-lossless/engines-version`.

Contract review: the fix changes source package manifests, source
imports, public package selection, public release validation, and
generated lockfile QA. It does not use consumer overrides as the
product fix, does not suppress the stock package warning, and does not
rely on private release packing as a public npm validation path.

Rejected wrong-layer solution retained: do not leave
`@prisma/dev`, `@prisma/studio-core`,
`@prisma/management-api-sdk`, `@prisma/streams-local`, or
`@prisma/engines-version` in the consumer-resolved graph. Do not
solve this in GWEN or another consumer with `pnpm.overrides`.

Validation evidence:

- `pnpm install` passed after adding the owned support packages.
- `pnpm --filter @prisma-lossless/fetch-engine build` passed.
- `pnpm --filter @prisma-lossless/engines build` passed.
- `pnpm --filter @prisma-lossless/client build` passed.
- `pnpm --filter @prisma-lossless/query-plan-executor build` passed.
- `pnpm --filter @prisma-lossless/cli build` passed.
- `pnpm exec vitest run scripts/private-release.test.ts
scripts/ci/publish.test.ts` passed with 37 tests.
- `pnpm --filter @prisma-lossless/cli test
src/__tests__/commands/Version.test.ts src/__tests__/Studio.vitest.ts
src/__tests__/Init.vitest.ts src/utils/ppgInfo.test.ts` passed with
  56 tests and 2 snapshots.
- `pnpm exec prettier --check` passed for the touched source,
  package, release-tooling, and plan files.
- `NODE_OPTIONS=--max-old-space-size=8192 pnpm exec eslint` passed
  for touched TypeScript files with 0 errors and 7 existing
  unsafe-`any` warnings.
- A post-build executable-artifact scan found no runtime import,
  dynamic import, `require`, registry lookup, or known package-identity
  string targeting `prisma` or `@prisma/*` in the checked release
  artifacts.
- Fresh post-build package metadata inspection found no `prisma` or
  `@prisma/*` dependency, optional dependency, peer dependency, or
  bundled dependency in the public package graph.
- Sandboxed repo-root `pnpm build` failed with `tsx` IPC `EPERM` under
  `/var/folders/...`. The same `pnpm build` was rerun outside the
  sandbox and passed with 44 successful build tasks.
- No npm publication or branch change was performed.

## Implementation Steps

1. Inventory every direct stock Prisma package identity in owned
   package manifests that can affect release, build, generation, or
   runtime behavior.
2. Add or rename owned lossless packages for every required stock
   support package that has no current `@prisma-lossless/*`
   counterpart.
3. Replace source manifest dependencies, peer dependencies, optional
   dependencies, and bundled dependency metadata with exact
   prisma-lossless names and versions.
4. Update internal imports, dynamic imports, `require.resolve` calls,
   generated package templates, CLI studio/dev entry points, engine
   version imports, and publish tooling to use lossless names.
5. Extend public package selection so the complete npm graph includes
   every required lossless-owned package.
6. Add a package-graph QA helper that reads package identity data from
   public package metadata without scanning arbitrary prose.
7. Add focused unit tests for immediate manifest rejection,
   transitive package rejection, and successful lossless-only public
   graph validation.
8. Remove deprecated private release, local tarball, ephemeral
   registry, and Verdaccio tooling.
9. Validate the public npm publish path through focused publish tests
   and dry-run metadata checks.
10. Keep downstream validation on the normal public npm release path;
    do not reintroduce local tarball, private registry, or ephemeral
    registry delivery as an acceptance shortcut.

## Acceptance Criteria

- No owned release package manifest contains a dependency,
  optionalDependency, peerDependency, bundledDependency, or
  bundleDependency named `prisma` or starting with `@prisma/`.
- No generated client package manifest requires a stock Prisma
  package where a lossless package is required.
- No release package runtime import, dynamic import, or
  `require.resolve` call targets a stock Prisma package.
- The complete public prisma-lossless release graph contains no
  package identity named `prisma` or starting with `@prisma/`.
- The migration guide instructs consumers to install from npmjs.org
  using ordinary package-manager commands only.
- Downstream CLI, generation, migration, adapter, engine, and
  generated-client validation uses public npm packages after the next
  publication, not local registry or tarball delivery.
- The package-graph QA check fails on direct stock dependencies,
  transitive stock dependencies, and generated package metadata
  regressions.
- The package-graph QA check is wired into the public publish metadata
  validation path before publication.
- `@prisma-lossless/cli` rejects direct consumer dependencies on
  `prisma` or `@prisma/*` during installation.

### [ ] Tasklet 034: Publish Public Version 16

Status: approved for implementation by the user prompt to keep going
after confirming that the public npm release must contain the
Tasklet 033 purge and install guard.

## Pre-Implementation Review

Observed problem: Tasklet 033 changed the public package graph and CLI
install behavior after the current source version had already been
prepared as `7.8.0-lossless.15`. This shell cannot verify npmjs.org
state because sandbox DNS fails and escalation is currently blocked by
the environment usage limit.

Violated contract or invariant: npm package identities are immutable.
The release process must not attempt to publish different bytes under
an already-used `name@version` identity.

Owning layer: source package metadata, root publish scripts, migration
documentation, lockfile metadata, public publish validation, and the
public npm registry own the release identity.

Intended solution: mint `7.8.0-lossless.16` as the next public release
target, update the source package graph and public publish commands to
that exact version, run focused publish validation and repo build,
then run the existing `pnpm run publish-lossless-public` command.

Rejected solution: do not retry `.15` without registry proof that it
is absent, and do not resurrect a local registry or tarball path to
stand in for public npm publication.

Validation that proves the fix: all public release package manifests
and owned dependency specifiers must record `7.8.0-lossless.16`.
Focused publish tests, formatting, focused lint, and repo-root
`pnpm build` must pass. The public publish command must either publish
the graph to npmjs.org or fail with a concrete external blocker.

## Preparation Evidence

- `pnpm install --lockfile-only` passed and normalized the lockfile
  for the `7.8.0-lossless.16` graph.
- `rg` found no `7.8.0-lossless.15` references in package manifests,
  root publish scripts, lockfile metadata, migration documentation, or
  release tests. The only remaining `.15` reference is this tasklet's
  rationale for minting `.16`.
- `pnpm exec vitest run scripts/ci/publish.test.ts` passed with 16
  tests.
- `pnpm --filter @prisma-lossless/cli test
src/__tests__/preinstall.test.ts` passed with 14 Jest tests and 12
  snapshots.
- `pnpm exec prettier --check` passed for the touched package
  metadata, lockfile, migration guide, plan, and tests.
- `NODE_OPTIONS=--max-old-space-size=8192 pnpm exec eslint
scripts/ci/publish.test.ts
packages/cli/src/__tests__/preinstall.test.ts` passed.
- `pnpm --filter @prisma-lossless/cli build` passed.
- Sandboxed `pnpm run publish-lossless-public-dryrun` failed before
  script startup with `tsx` IPC `EPERM`. The same command rerun
  outside the sandbox passed for all 15 public packages and printed
  dry `latest` dist-tag promotions.
- The dry-run `@prisma-lossless/engines` tarball contained
  `dist/scripts/postinstall.js` and `dist/scripts/localinstall.js`.
- `pnpm build` passed outside the sandbox with 44 successful tasks.
