# Sprint 12

### [DONE] Tasklet 026: Prove Fresh Release Reproducibility

Branch: `target-7.8.0-lossless`

Status: complete; implementation and validation evidence recorded.

## Goal

Fix the private release pipeline so an immutable private release can be
reproduced from a clean checkout, not merely from the session-local
build state that originally produced its fixture.

GWEN attempted to consume `7.8.0-lossless.7` from a clean
prisma-lossless checkout at commit
`198ccfba6dffc54808c9e5b041066b8c3a13d921` using:

```sh
pnpm exec tsx scripts/lossless-private-registry-run.ts \
  --consumer-dir /Users/alex/git/ctosclub/gwe \
  --from-built 7.8.0-lossless.7 \
  -- corepack pnpm install --lockfile-only
```

The wrapper rejected the request before Verdaccio startup because the
freshly prepared `@prisma-lossless/client@7.8.0-lossless.7` tarball
integrity was:

```text
sha512-Hz/T1Bt2NBkXBSf0ZRt+iM4ea/xCPWb9zCdarp2SkQzLPRgPPFgDw+9g+ILNnlt69NlLxTtU6jGcZ0wOftAOuQ==
```

The recorded immutable release identity for the same package name and
version was:

```text
sha512-/0p3P3MKG2rnQYsGym8dEnCBqLi1W0owvtHEpZj/ue17MU9CgCE1Z2BQb3pnr3LzlC9A++sQ3p8D2jScLdC6eg==
```

Do not modify `/Users/alex/git/ctosclub/gwe`. Do not change the `.7`
recorded integrity to accept newly produced bytes.

## Required Investigation

Diagnose why a clean checkout's current built client package does not
reproduce the Tasklet 025 `.7` identity. Inspect ignored build outputs,
generated client files, package staging inputs, package inclusion
rules, post-test mutations, release packing normalization, and any
dependency on session-local state.

The investigation must determine whether exact `.7` bytes can be
reproduced. If they cannot, mark `.7` unavailable and mint the next
valid immutable private version. The replacement release must be proven
reproducible from a fresh checkout before it is reported as current.

## Confirmed Root Cause

The `.7` fixture tarball still exists at:

```text
/private/tmp/prisma-lossless-private-release-7/runs/1784589648121-de26dd065099/artifacts/prisma-lossless-client-7.8.0-lossless.7.tgz
```

It matches the recorded `.7` client integrity. Repacking `.7` from the
current clean checkout produces the same nine non-client package
integrities, but `@prisma-lossless/client` changes. Extracting the
recorded and freshly packed client tarballs shows only these files
changed:

```text
runtime/wasm-compiler-edge.js.map
runtime/wasm-compiler-edge.mjs.map
```

The source maps differ because
`helpers/compile/plugins/fill-plugin/fillPlugin.ts` constructs its
esbuild virtual namespace with `Math.random()`. The randomized
namespace is serialized into the source map `sources` array, for
example `fill-plugin-0g0cqs:os` versus
`fill-plugin-p2gays:os`. The compiled JavaScript is byte-identical,
but the published client tarball includes the source maps, so release
identity depends on session-local build output.

The same plugin also writes bundled polyfill loaders to filenames
containing `crypto.randomBytes(4)`. The `.7` client diff is explained
by the namespace, but the loader path is another package-build input
that can leak random session-local paths into source maps.

The release provenance source set also omits `helpers/compile`, even
though `packages/client/helpers/build.ts` imports the fill plugin from
that tree. A build-helper change can therefore alter published client
bytes without `assertReleaseSourcesMatchCommit` seeing release-source
drift.

## Pre-Implementation Review

Observed problem: the wrapper correctly rejects
`7.8.0-lossless.7` from a clean checkout because the freshly prepared
client tarball integrity does not match the recorded immutable release
identity.

Violated contract or invariant: a recorded private package name plus
exact version must identify one immutable byte sequence. A clean
checkout of the recorded provenance must either reproduce those bytes
or reject the version before registry startup and child execution.

Owning layer: the prisma-lossless release and build tooling owns
package staging, generated artifact inclusion, ignored output
normalization, release identity availability, and the fresh-checkout
reproducibility proof.

Intended solution: add a regression that exports or otherwise creates a
genuinely fresh clean source tree, installs and builds prerequisites
from scratch, produces the private release, runs the external-consumer
generation integration, and then starts a separate reproduction process
from clean repository state to verify every package integrity again.
Fix the release pipeline so this proof passes, or retire `.7` and mint
a new immutable release whose bytes pass that proof.

Rejected solution: do not update `.7` to the newly observed client
integrity, do not weaken GWEN's lockfile or wrapper checks, do not
reuse the staging directory that generated the fixture, and do not
allow ignored build outputs or generated client files to silently
participate in release identity.

Validation that proves the fix: focused unit tests must cover the
fresh-checkout source export or clean-tree reproduction path,
unavailable-version handling, and mismatched package integrity
rejection. The real ephemeral-registry integration must run from a
fresh build and prove generated client identity, LosslessNumber, empty
store install, repeated integrities, and cleanup. A separate
post-integration process must reproduce every package integrity from
clean state.

Confirmed subproblem: the client build graph can produce
functionally equivalent but byte-distinct published artifacts because
the fill plugin writes random virtual namespaces and random polyfill
loader filenames into source-map-visible build paths.

Violated contract or invariant: publishable build artifacts must be
deterministic for identical source and dependency inputs. Source maps
are package bytes, so they cannot contain random build-local names.

Owning layer: the shared esbuild fill plugin owns the virtual module
namespace it contributes to bundled source maps.

Intended solution: replace the random namespace and temporary loader
filename with deterministic identifiers derived from stable plugin and
module inputs. Distinct plugin instances still receive distinct
namespaces when their configuration differs, but identical builds
produce byte-identical source maps.

Rejected solution: do not drop source maps from the client package and
do not strip only the two known map files during release packing. Both
would hide nondeterministic build output instead of fixing its source.

Validation that proves the subproblem fix: add focused tests proving
the fill plugin namespace and loader path are stable for identical
inputs and different for different configurations where needed, then
rebuild and repack from clean source to prove package integrities are
reproducible.

Confirmed subproblem: release provenance did not include all tracked
build inputs for the client package.

Violated contract or invariant: the recorded source commit must cover
tracked source and build tooling inputs that can affect package bytes.

Owning layer: the private release source inventory in
`scripts/lossless-private-release.ts` owns this boundary.

Intended solution: add the shared compile helper tree to
`PRIVATE_RELEASE_SOURCE_DIRS` and test that it remains part of the
provenance check.

Rejected solution: do not rely only on post-pack integrity checks. The
wrapper must reject source drift before preparing a known immutable
version whenever tracked build inputs have changed.

Validation that proves the subproblem fix: focused release unit tests
must assert that compile helper changes are release-source inputs, and
`.7` must be marked unavailable once the deterministic fix proves its
recorded random source-map bytes cannot be reproduced.

Confirmed subproblem: split-build packages can leave stale hashed
chunks in `dist`. The recorded `.8` `@prisma-lossless/get-platform`
tarball included `dist/chunk-WFCM4MDC.js`, but a fresh clean root build
did not produce that file. Because `@prisma-lossless/get-platform` publishes the
whole `dist` directory, the stale ignored chunk changed the package
identity.

Violated contract or invariant: package builds that produce hashed
chunks must leave their output directories in a canonical state. A
publishable package cannot include chunks from an earlier build that
are not produced by the current source tree.

Owning layer: the shared compile helper owns output-directory hygiene
for packages built through `helpers/compile/build.ts`.

Intended solution: clean each non-watch build output directory once
before running that build pipeline, preserving multi-format outputs
that intentionally share a directory within the same build invocation.

Rejected solution: do not special-case `chunk-WFCM4MDC.js` in release
packing and do not mark `.8` available with the stale file. That would
preserve another session-local package identity.

Validation that proves the subproblem fix: add focused tests for the
output-directory selection and cleanup behavior, rerun a fresh
checkout build, and prove the replacement release graph matches from
both the normal checkout and a fresh clone.

Confirmed subproblem: a blanket cleanup of every resolved output
directory is too broad. The CLI intentionally writes `config.js` and
`config.d.ts` at package root with `outdir: "."`, and the client build
writes `scripts/default-index.js` beside tracked files under
`packages/client/scripts`. Cleaning those directories deletes source
owned by the package before the same build invocation can finish.

Violated contract or invariant: build-output hygiene may remove stale
generated files, but it must not delete source-owned package roots or
tracked source directories.

Owning layer: the shared compile helper owns the decision about which
resolved output directories are safe to clean before esbuild runs.

Intended solution: restrict automatic cleanup to known generated
output directory names used by this build system, such as `dist`,
`build`, `runtime`, and `preinstall`. Package-root outputs and
source-owned directories are skipped.

Rejected solution: do not require individual packages to recover from
their sources being deleted, and do not solve this by restoring files
after the build. The cleanup boundary itself must prevent unsafe
deletion.

Validation that proves the subproblem fix: add focused tests proving
root outputs and source-owned `scripts` outputs are skipped while
generated outputs are still cleaned, then rerun the repo-root build.

Confirmed subproblem: the fresh-checkout integration cannot use a
plain `pnpm install --frozen-lockfile` in a source tree whose build
outputs are intentionally absent. The workspace `@prisma-lossless/engines`
postinstall script expects built `dist/scripts/*.js` files, so install
fails before the test can run the source build.

Violated contract or invariant: the fresh-checkout proof must start
from source and build prerequisites from scratch. It must not require
preexisting ignored build outputs, but it also must not let install
postinstall scripts run before those outputs can be generated.

Owning layer: the fresh-checkout integration test owns how it
bootstraps an exported source tree before invoking the repo build and
release packing.

Intended solution: install the fresh checkout with
`pnpm install --frozen-lockfile --ignore-scripts`, then run
`pnpm build` to generate package outputs through the normal build
graph before packing `.9`.

Rejected solution: do not copy built outputs from the original
checkout and do not make the test pass by running the wrapper from the
original tree. Either approach would hide the clean-source
reproducibility condition being tested.

Validation that proves the subproblem fix: rerun the fresh-checkout
integration and prove it gets past install, builds the cloned source,
packs `.9` twice, and installs through the wrapper from the clone.

Confirmed subproblem: the fresh-checkout integration originally passed
the Vitest worker environment and build-mode toggles into the cloned
checkout's build. That is not a real external source-build environment
and can alter publishable client bytes. The preserved failure produced
unminified client runtime files because client builds consult `DEV`
and `MINIFY`. The suite cleanup also removes a full cloned
`node_modules` tree, which can exceed Vitest's default ten second hook
timeout.

Violated contract or invariant: the fresh-checkout proof must model a
standalone external process. It must not let test-runner variables such
as `VITEST_*` or `NODE_ENV=test`, nor build toggles such as `DEV`,
`MINIFY`, `WATCH`, `IGNORE_EXTERNALS`, or
`PRISMA_COPY_RUNTIME_SOURCEMAPS`, become build inputs. Its cleanup must
be allowed enough time to remove the heavy temporary tree.

Owning layer: the integration test command runner owns the child
environment for source-build proof commands and the suite owns its
temporary root cleanup timeout.

Intended solution: strip Vitest-specific variables, tasklet gating
variables, `NODE_ENV`, and known Prisma build toggles from
`runRequired` child commands, while preserving the normal shell,
package-manager, and toolchain environment. Extend the after-all
cleanup timeout.

Rejected solution: do not update `.9` to accept bytes produced only
under a Vitest worker environment. The immutable release must represent
the real standalone build path.

Validation that proves the subproblem fix: rerun the fresh-checkout
integration and confirm it reproduces the recorded `.9` integrities
from a clean clone while cleanup completes.

## Implementation Steps

1. Reproduce the `.7` mismatch locally from the clean checkout and
   record the confirmed root cause in this tasklet.
2. Audit `@prisma-lossless/client` package inputs and ignored outputs
   that can affect `pnpm pack` bytes after builds or tests.
3. Add focused tests for fresh source export, release package input
   normalization, mismatched `.7` rejection, and replacement identity
   selection.
4. Add or strengthen a real fresh-checkout integration path that does
   not reuse the same staging directory or ignored build outputs that
   produced the fixture.
5. If `.7` is unreproducible, mark `.7` unavailable, mint the next
   immutable private release, and update identities, independent
   fixtures, unavailable-version handling, integration constants, and
   `MIGRATION_FROM_PRISMA.md`.
6. Run focused release tests, the real ephemeral-registry integration,
   affected package builds, repo-root `pnpm build`, and plan-required
   validation feasible in this local environment.

## Implementation Notes

The fill plugin now derives its esbuild namespace from a stable hash of
the normalized filler configuration. Its bundled polyfill loader
filename is also derived from the module name and package version
instead of random bytes. `helpers/compile` is now part of
`PRIVATE_RELEASE_SOURCE_DIRS` so tracked build-helper changes are
release-source inputs.

The recorded `.7` client tarball cannot be reproduced without the
random source-map namespace from the original session-local build. It
is therefore marked unavailable.

The initial replacement release, `7.8.0-lossless.8`, was also marked
unavailable. Its `@prisma-lossless/get-platform` package included a
stale ignored `dist/chunk-WFCM4MDC.js` build chunk that was not
produced by a fresh clean root build.

The current replacement release is `7.8.0-lossless.9`, with source
provenance:

```text
790912aad9a5a1a562d5038c65d91f70d023de4c
```

The `.9` package graph was packed twice in separate release roots:

```text
/private/tmp/prisma-lossless-private-release-9/runs/1784602166720-790912aad9a5/private-release-manifest.json
/private/tmp/prisma-lossless-private-release-9-repro/runs/1784602185461-790912aad9a5/private-release-manifest.json
```

Every package integrity matched between those two runs.

The recorded `.9` package integrities are:

```text
@prisma-lossless/debug
sha512-pG2Hd8Fx4piA8pRYD0pzYikRaV4Uc9Sx7iHo5XzJoxhgVFpsKgQdEiR/8P4EJRrHHwhDe2EZpInKIjAPpX2Ovw==
@prisma-lossless/driver-adapter-utils
sha512-zKqRLokSEllGq9s4ITrWnj/oBF8Bzrj1Uq6n2FDA8mIHyt4+hEt5V5qHkbsCaxt3RPcCtLnIUHbx32cTS6+nuw==
@prisma-lossless/get-platform
sha512-Mo1SE+qx7joSh02/gg4oavvZENx5Gyv6m33E4PEy8HGsjc88TIaI0uxFiF+lbz1ZMnmCVxcXJVE3XDM1PBnF3w==
@prisma-lossless/fetch-engine
sha512-SroAXaOe+YxP7Pf4I8dqZb34IDnDADoo8FnMVtuo/WJx3zUxmqqIvDqpSZ3ZVNcgWTmqVnO6AKagZL6CAeZhyg==
@prisma-lossless/engines
sha512-bnu9MPLjJGpt+XdRnxT1mQxsLWWIJVmrLIEutDOEp8OkZwtArXUO5cCoRA3quunlqfOxSZOhFzmAoHStRuC7xw==
@prisma-lossless/config
sha512-FZxIZLI3rGD6nxBAzQBxqAWKv90twuMZFV0Mtd2iyXkE/tB4votAsb2/GhPMolXZ/cuD2FJKihujgEKmL9atDA==
@prisma-lossless/client-runtime-utils
sha512-9iBUGpk97M6kUtREMgPNAWMu88pYAkjZFaH/k5ZC/dhbX8SAw+kW4kfAmw+hmOKBurxdEo6TgFrsN9u4J4mUdw==
@prisma-lossless/adapter-pg
sha512-HCjHHf9H2kFkjRK11mUvzHozEW8ov47t3/icGXXpUA0filhKs3qmhse1296ikfuI11hOE/f4g3QShq7V1CoBOg==
@prisma-lossless/client
sha512-vPWG12Wj//MfwHPh30z0QXR1E16c1cmChm9ttxcPWCsz2xHioLyazWrrSijR0PZpAcYm4e/Y5OJAXkYqt3S9tA==
prisma-lossless
sha512-OW8v1bLTH2eIuGkHJQi0lLpy1fiSPqpaL6RE2F9WbWOcg/FUczUl1pPO+ITOokEQz009SoJZULoAzBKDkxdqKw==
```

The fresh-checkout integration initially found a second test-harness
leak: `DEV` and `MINIFY` from the Vitest process can alter client
runtime minification. `runRequired` now strips Vitest variables,
tasklet gating variables, `NODE_ENV`, and known Prisma build toggles
before invoking source-build subprocesses.

## Post-Implementation Review

The fix remains at the build-tooling layer that produced the
non-reproducible package bytes. It does not weaken the wrapper,
lockfile integrity, or GWEN's consumer checks. It does not strip
source maps or remove package contents to force a match; it makes the
source-map-visible build paths deterministic.

The release provenance source set now includes the compile helper tree
that affects client package bytes. This prevents a future build-helper
change from being treated as unrelated tooling when an immutable
release is prepared from a later checkout.

The output cleanup now skips package roots and source-owned
directories, so the build helper no longer deletes `packages/cli` or
tracked files under `packages/client/scripts` when an esbuild target
uses `outdir: "."` or writes beside source-owned scripts.

The `.7` and `.8` identities remain recorded with their original bytes
but are unavailable. The wrapper now rejects `.5`, `.6`, `.7`, and
`.8` before Verdaccio startup and instructs consumers to use `.9`.

The fresh-checkout proof remains in the real release path. It clones
the current repository, installs with `--ignore-scripts` so absent
ignored build outputs are not required before the source build, runs
`pnpm build`, packs `.9` twice in distinct release roots, and then
serves the recorded release through the wrapper to a temporary
external consumer.

## Validation Evidence

- `pnpm exec vitest run
helpers/compile/plugins/fill-plugin/fillPlugin.test.ts` passed
  (`4` tests).
- `pnpm --filter @prisma-lossless/client build` passed after the
  deterministic fill-plugin change.
- `pnpm exec vitest run helpers/compile/build.test.ts` passed
  (`5` tests).
- `pnpm exec tsx scripts/lossless-private-release.ts build-pinned
7.8.0-lossless.9
790912aad9a5a1a562d5038c65d91f70d023de4c
/private/tmp/prisma-lossless-private-release-9` passed.
- A second independent `build-pinned` run for `.9` passed in
  `/private/tmp/prisma-lossless-private-release-9-repro`, and all ten
  package integrities matched the first run.
- `pnpm exec vitest run
helpers/compile/build.test.ts
helpers/compile/plugins/fill-plugin/fillPlugin.test.ts
scripts/lossless-private-release.test.ts
scripts/lossless-private-registry-run.test.ts` passed (`37` tests).
- `prepareBuiltPrivateReleaseCandidates('7.8.0-lossless.9')` passed
  and validated the recorded `.9` identity before registry startup.
- `PRISMA_LOSSLESS_RUN_REGISTRY_INTEGRATION=1
PRISMA_LOSSLESS_RUN_FRESH_CHECKOUT_INTEGRATION=1 pnpm exec vitest run
scripts/lossless-private-registry-run.integration.test.ts -t
"fresh clean checkout"` passed outside the sandbox (`1` test passed,
  `4` skipped by name filter, duration `411.33s`).
- `PRISMA_LOSSLESS_RUN_REGISTRY_INTEGRATION=1 pnpm exec vitest run
scripts/lossless-private-registry-run.integration.test.ts` passed
  outside the sandbox (`4` tests passed, `1` fresh-checkout test
  skipped by the explicit fresh-checkout gate, duration `191.48s`).
- `pnpm build` passed at the repo root for the current tree (`44`
  successful, `44` total).

## Acceptance Criteria

- A clean checkout or clean exported source tree can build and pack the
  current release graph twice in separate processes with identical
  package integrities.
- The external-consumer generation integration cannot pass by reusing
  ignored build outputs or the same staging directory that created the
  release fixture.
- `--from-built` rejects every unavailable historical version before
  Verdaccio startup and child execution.
- The current usable release identity is recorded with exact
  provenance and all ten package integrities.
- The migration guide uses only the current reproducible private
  version.
- The tasklet is marked `[DONE]` only after validation passes and the
  completed changes are committed.
