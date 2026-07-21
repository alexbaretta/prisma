# Sprint 3

### [DONE] Tasklet 017: Publish And Validate Private Release

## Goal

Publish the immutable private release and prove that a separate
first-party consumer can install and use the fork from the private
registry without tarball paths, workspace membership, sibling checkout
dependencies, Git dependencies, or pnpm overrides.

## Instructions

Publish the Tasklet 016 candidates to the approved private registry
using the guarded release path. Verify that the registry refuses an
attempt to overwrite the same immutable version.

Inspect registry metadata and downloaded package contents before
accepting the release.

Create an isolated ignored consumer that is not part of this workspace.
Its `package.json` must use exact semantic versions for
`prisma-lossless` and `@prisma-lossless/client`. Its lockfile must
record ordinary registry resolution and integrity metadata.

The isolated consumer must not use:

- local tarball references;
- Git dependencies;
- sibling-checkout dependencies;
- workspace membership;
- pnpm overrides.

Install from the private registry, generate the client, build the
consumer, and run the PostgreSQL lossless smoke suite.

Use the stock `@prisma-lossless/adapter-pg` release declared compatible with the
fork unless the test proves a fork adapter is required.

The smoke suite must cover:

- model reads from JSON columns;
- model writes to JSON columns;
- raw JSON reads;
- raw JSON text casts;
- large integer JSON tokens;
- high-precision decimal JSON tokens;
- nested objects;
- arrays;
- JSON nulls;
- `LosslessNumber` parameters.

Add failure coverage for:

- public registry resolution;
- missing private packages;
- dependency substitution;
- stale lockfiles;
- unavailable registry.

Record the private registry identity without credentials, package
names, versions, source commit, integrity metadata, compatible adapter
version, commands, and passing output in the plan.

Do not publish to the worldwide npm registry. Document public
open-source publication only as a future milestone.

## Pre-Implementation Review

Capture the AGENTS-required review record before publishing packages or
creating the isolated consumer.

The review must identify:

- why the isolated consumer is the product path for first-party use;
- the registry and credential trust boundaries;
- the compatible adapter decision;
- the dependency-substitution risk;
- one rejected approach that relies on local tarballs, workspace links,
  public npm fallback, or mutable versions.

## Pre-Implementation Review Record

Observed problem: Tasklet 016 produced immutable private release
candidates, but no separate project has proven it can resolve, install,
generate, build, and run the fork from registry metadata. Without that
proof, first-party adoption can still accidentally rely on tarballs,
workspace links, stale locks, public npm fallback, or stock Prisma
substitution.

Violated contract or invariant: Sprint 3 requires an external
first-party consumer to use exact immutable versions from the approved
private registry without local tarball paths, workspace membership,
sibling checkouts, Git dependencies, pnpm overrides, or public npm
publication.

Owning layer: private release tooling owns guarded publication,
overwrite refusal, and registry metadata inspection. The isolated
consumer owns install, lockfile, generation, build, and PostgreSQL
smoke validation. The registry runtime owns credentials and package
storage outside tracked source.

Intended solution: publish the Tasklet 016 manifest in dependency
order through the Tasklet 015 allowlisted registry guard, using npm
credentials stored only in the external registry runtime userconfig.
Then create an ignored consumer under `tmp/`, install exact
`prisma-lossless` and `@prisma-lossless/client` versions from the
private registry with `npm`, generate the client with the installed CLI,
build the consumer, and run a PostgreSQL lossless JSON smoke suite.

The registry trust boundary is `http://127.0.0.1:4873/` for publish
and local install. Docker or public-network hostnames are not publish
targets. Credential state stays under
`/private/tmp/prisma-lossless-private-registry/` and is not written to
tracked files, package manifests, lockfiles, or command arguments.

The compatible adapter decision starts with the stock
`@prisma-lossless/adapter-pg` package. If generation, build, or smoke execution
proves that public adapter cannot satisfy this fork, the failing
boundary must be documented before broadening the private package
closure.

Rejected unsafe or wrong-layer solution: do not install from the
Tasklet 016 tarball paths, do not use pnpm workspace links or overrides,
do not use Git dependencies or branch specifiers, do not publish to the
worldwide npm registry, and do not accept a mutable or overwritten
version as release evidence.

## Adapter Substitution Subproblem Review

Observed problem: the first isolated `npm install` with stock
`@prisma-lossless/adapter-pg@7.8.0` succeeded, but lockfile inspection showed
stock `@prisma-lossless/driver-adapter-utils@7.8.0` and stock
`@prisma-lossless/debug@7.8.0` in the installed graph. That violates the Sprint
3 dependency-substitution check even though the direct fork packages
resolved from the private registry.

Violated contract or invariant: the first-party consumer must not
silently substitute stock Prisma packages for the fork runtime closure.
The adapter boundary participates in the runtime path, so its private
closure must be published when stock adapter installation pulls stock
internal Prisma packages.

Owning layer: release graph tooling owns adding the proven-required
PostgreSQL adapter closure. The consumer owns depending on the exact
private adapter version once stock adapter substitution has been
proven.

Intended solution: extend the private release graph with
`@prisma-lossless/driver-adapter-utils` and `@prisma-lossless/adapter-pg`, rebuild a new
immutable private prerelease, publish it, and make the isolated
consumer install exact `7.8.0-lossless.<N>` versions for the CLI,
client, and PostgreSQL adapter.

Rejected unsafe or wrong-layer solution: do not hide the stock
substitution with npm overrides, do not accept the stock adapter after
the lockfile proved stock internal dependencies, and do not mutate the
consumer lockfile by hand.

Validation that proves the fix: the isolated npm lockfile must show
private-registry `7.8.0-lossless.<N>` resolution and integrity metadata
for `@prisma-lossless/adapter-pg`, `@prisma-lossless/driver-adapter-utils`, and the fork
runtime closure, with no `file:`, `workspace:`, `link:`, Git, branch,
checkout, or home-directory dependency references.

## Publish Tag Subproblem Review

Observed problem: the guarded publish path failed before uploading the
first tarball because npm `11.12.1` requires an explicit `--tag` when
publishing a prerelease version.

Violated contract or invariant: private publication must be automated
through the guarded release path and must not accidentally assign the
fork prerelease to the normal `latest` tag.

Owning layer: `scripts/lossless-private-registry.ts` owns the guarded
`npm publish` command shape.

Intended solution: add a named private release tag and pass
`--tag lossless` from the guarded publish helper and command plan.

Rejected unsafe or wrong-layer solution: do not publish with
`--tag latest`, do not bypass the helper with an ad hoc unguarded
`npm publish`, and do not rename the version to avoid npm's prerelease
tag protection.

Validation that proves the fix: focused registry helper tests must
prove the publish command includes the private tag, and the publish
command must succeed against the local private registry.

## Registry Body Limit Subproblem Review

Observed problem: publication succeeded for the first six packages but
failed for `@prisma-lossless/client` with `413 Payload Too Large`. The
packed client tarball is about `28.0 MB` because it includes runtime
Wasm compiler assets.

Violated contract or invariant: the local private registry contract
must accept the package artifacts that the fork actually publishes.
Rejecting the client tarball prevents the external first-party install
path from being validated.

Owning layer: the Verdaccio runtime configuration generated by
`scripts/lossless-private-registry.ts` owns local registry upload
limits.

Intended solution: set an explicit local `max_body_size` high enough
for the fork client tarball, regenerate the Verdaccio config, and
restart the local registry before retrying publication.

Rejected unsafe or wrong-layer solution: do not strip Wasm runtime
assets from the client tarball merely to fit a registry default, and do
not publish the client through an unguarded alternate registry path.

Validation that proves the fix: focused registry config tests must
prove the body-size setting exists, and the private registry publish
must succeed for `@prisma-lossless/client`.

## Update Guidance Subproblem Review

Observed problem: repo-root `pnpm test` generated an update banner
that still recommended `npm i --save-dev prisma@latest` while the
client line correctly used `@prisma-lossless/client@latest`.

Violated contract or invariant: first-party consumers of this fork
must not be guided back to stock public Prisma package names. The
installable CLI package is `prisma-lossless`, not `prisma`.

Owning layer: the CLI update-message helper owns the user-facing
upgrade command. Checkpoint metadata is an upstream service boundary
and may still report the stock `prisma` package name.

Intended solution: make CLI update guidance use the fork CLI package
name `prisma-lossless` regardless of the checkpoint package field, and
add regression coverage for checkpoint results that still say
`prisma`.

Rejected unsafe or wrong-layer solution: do not rename internal
workspace packages such as `@prisma-lossless/migrate` solely because tests print
their workspace names, and do not trust checkpoint metadata to carry
the fork package name.

Validation that proves the fix: focused CLI update-message tests must
pass, and regenerated CLI build output must not contain stock
`prisma@latest` update guidance.

## Validation

Run the focused package suites, repo-root build, and repo-root tests
required by the Prisma plan and repository instructions.

Do not mark this tasklet `[DONE]` until the private registry publish,
overwrite refusal, isolated consumer install, smoke suite, failure
coverage, and validation evidence are committed.

## Post-Implementation Review Record

The implementation keeps publication behind the existing private
registry allowlist and does not add public npm, tarball, Git,
workspace, sibling-checkout, or override adoption paths.

The release graph now includes the PostgreSQL adapter closure because
the isolated consumer proved that stock `@prisma-lossless/adapter-pg@7.8.0`
would otherwise install stock `@prisma-lossless/driver-adapter-utils` and stock
`@prisma-lossless/debug`. The fix belongs in release graph construction because
dependency substitution is a package-publication concern, not a
consumer lockfile workaround.

The guarded publish helper now passes `--tag lossless`, avoiding npm's
prerelease publish guard and avoiding accidental `latest` tagging. The
Verdaccio config now sets `max_body_size: 200mb`, which is required for
the 28 MB client tarball that includes Wasm runtime assets.

Rejected after implementation: do not call the stock adapter compatible
after the lockfile showed stock internal dependencies, do not publish
with `latest`, do not shrink the client tarball by removing required
Wasm assets, and do not hand-edit the consumer lockfile as adoption
evidence.

## Validation Evidence

Private registry:

- registry: `http://127.0.0.1:4873/`;
- runtime root: `/private/tmp/prisma-lossless-private-registry`;
- credentials: external npm userconfig only, not tracked;
- publish tag: `lossless`;
- upload limit: `max_body_size: 200mb`.

Published immutable version:

- version: `7.8.0-lossless.3`;
- source commit: `1b52c8b0bf090176f5fff36e25919dfb6526b572`;
- manifest run directory:
  `tmp/lossless-json-tasklet-016/runs/1784335135982-1b52c8b0bf09`;
- manifest file: `private-release-manifest.json`.

Published packages:

- `@prisma-lossless/debug`;
- `@prisma-lossless/driver-adapter-utils`;
- `@prisma-lossless/get-platform`;
- `@prisma-lossless/fetch-engine`;
- `@prisma-lossless/engines`;
- `@prisma-lossless/config`;
- `@prisma-lossless/client-runtime-utils`;
- `@prisma-lossless/adapter-pg`;
- `@prisma-lossless/client`;
- `prisma-lossless`.

Registry metadata inspection passed for the install-critical packages:

```sh
npm view @prisma-lossless/client@7.8.0-lossless.3 \
  name version dist.integrity dist.tarball \
  --registry http://127.0.0.1:4873/

npm view prisma-lossless@7.8.0-lossless.3 \
  name version dist.integrity dist.tarball \
  --registry http://127.0.0.1:4873/

npm view @prisma-lossless/adapter-pg@7.8.0-lossless.3 \
  name version dist.integrity dist.tarball \
  --registry http://127.0.0.1:4873/
```

Result: all returned exact version `7.8.0-lossless.3`, private
registry tarball URLs, and sha512 integrity metadata.

Downloaded package content inspection passed:

```sh
npm pack @prisma-lossless/client@7.8.0-lossless.3 \
  --registry http://127.0.0.1:4873/ \
  --pack-destination \
  tmp/lossless-json-tasklet-017/downloads-7.8.0-lossless.3

npm pack prisma-lossless@7.8.0-lossless.3 \
  --registry http://127.0.0.1:4873/ \
  --pack-destination \
  tmp/lossless-json-tasklet-017/downloads-7.8.0-lossless.3

npm pack @prisma-lossless/adapter-pg@7.8.0-lossless.3 \
  --registry http://127.0.0.1:4873/ \
  --pack-destination \
  tmp/lossless-json-tasklet-017/downloads-7.8.0-lossless.3
```

Result: package manifests inside the downloaded tarballs recorded
`7.8.0-lossless.3` and `prismaLosslessRelease.sourceCommit`. The
client tarball recorded `@prisma-lossless/client-runtime-utils` and peer
`prisma-lossless` at `7.8.0-lossless.3`. The adapter tarball recorded
`@prisma-lossless/driver-adapter-utils` at `7.8.0-lossless.3`. The CLI tarball
recorded no dependency on `@prisma-lossless/migrate`.

Update-guidance inspection passed:

```sh
tar -xOf tmp/lossless-json-tasklet-017/downloads-7.8.0-lossless.3/\
prisma-lossless-7.8.0-lossless.3.tgz package/build/index.js |
  rg --text "npm i --save-dev prisma@|npm install --save-dev prisma$|\
prisma@latest"
```

Result: no matches. The built CLI contains `prisma-lossless` command
and update guidance strings.

Overwrite refusal passed:

```sh
PRISMA_LOSSLESS_REGISTRY_ROOT=/private/tmp/\
prisma-lossless-private-registry \
  pnpm exec tsx scripts/lossless-private-registry.ts publish \
  http://127.0.0.1:4873/ \
  tmp/lossless-json-tasklet-017/downloads-7.8.0-lossless.3/\
prisma-lossless-client-7.8.0-lossless.3.tgz
```

Result: expected `E409 Conflict` because the package version is already
present.

Isolated consumer:

- location:
  `tmp/lossless-json-tasklet-017/consumer-7.8.0-lossless.3`;
- package manager: `npm`;
- dependencies: exact `7.8.0-lossless.3` versions for
  `prisma-lossless`, `@prisma-lossless/client`, and
  `@prisma-lossless/adapter-pg`;
- no `file:`, `workspace:`, `link:`, Git, sibling checkout, or home
  directory references in `package-lock.json`.

Consumer validation passed:

```sh
npm install
npm exec -- prisma-lossless generate
npm exec -- tsc -p tsconfig.json
npm run smoke
```

The generated-client banner still reports internal client version
`0.0.0`, but installed package manifests remain
`7.8.0-lossless.3`.

The PostgreSQL smoke suite passed against the locally running
PostgreSQL `18.3` server:

- generated client import from `@prisma-lossless/client`;
- model read JSON large integer, decimal, nested array, and JSON null;
- model write `LosslessNumber` parameters, nested array, and JSON
  null;
- raw JSON read;
- raw JSON text cast.

Dependency-substitution validation passed. The consumer lockfile
resolves these package entries from `http://127.0.0.1:4873/` at
`7.8.0-lossless.3`:

- `node_modules/prisma-lossless`;
- `node_modules/@prisma-lossless/client`;
- `node_modules/@prisma-lossless/adapter-pg`;
- `node_modules/@prisma-lossless/driver-adapter-utils`;
- `node_modules/@prisma-lossless/debug`;
- `node_modules/@prisma-lossless/client-runtime-utils`;
- `node_modules/@prisma-lossless/config`;
- `node_modules/@prisma-lossless/engines`.

Failure coverage passed:

- public npm lookup for
  `@prisma-lossless/client@7.8.0-lossless.3` returned `E404`;
- local private lookup for
  `@prisma-lossless/client@7.8.0-lossless.999` returned `E404`;
- stale lockfile fixture returned `EUSAGE` because locked
  `@prisma-lossless/client@7.8.0-lossless.3` did not satisfy exact
  `7.8.0-lossless.2`;
- unavailable registry lookup at `http://127.0.0.1:59999/` returned
  `ECONNREFUSED`.

Focused repo validation passed:

```sh
pnpm exec vitest run scripts/lossless-private-release.test.ts \
  scripts/lossless-private-registry.test.ts --reporter=dot

pnpm exec eslint scripts/lossless-private-release.ts \
  scripts/lossless-private-release.test.ts \
  scripts/lossless-private-registry.ts \
  scripts/lossless-private-registry.test.ts

pnpm --filter prisma-lossless exec jest \
  src/__tests__/update-message.test.ts

pnpm build
```

Repo-root test validation passed after dropping the generated stale
local test database
`tests-migrate-prisma-config-extensions`:

```sh
CI=true GITHUB_REF_NAME=target-7.8.0-lossless \
  TERM=xterm-256color TEST_SKIP_MSSQL=true \
  TEST_SKIP_COCKROACHDB=true pnpm test
```

Relevant root-test evidence:

- `@prisma-lossless/migrate` passed (`33` suites, `352` tests, `580`
  snapshots), with SQL Server and CockroachDB skipped by explicit
  local environment flags.
- `@prisma-lossless/client` passed (`40` suites, `671` tests, `214`
  snapshots), including the generated type harness.
- `@prisma-lossless/integration-tests` passed (`8` suites, `514` tests, `514`
  snapshots).
- `prisma-lossless` Jest passed (`22` suites, `244` tests, `152`
  snapshots).
- `prisma-lossless` Vitest passed (`12` files, `165` tests).

The root run still printed existing type-benchmark baseline exceedance
messages in `basic/client-options.bench.ts` and
`lots-of-relations/client-options.bench.ts`; the root `pnpm test`
process exited successfully with code `0`.
