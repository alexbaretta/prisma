# Sprint 12

### [ ] Tasklet 026: Prove Fresh Release Reproducibility

Branch: `target-7.8.0-lossless`

Status: approved for implementation by the user prompt.

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
is therefore marked unavailable. The replacement release is
`7.8.0-lossless.8`, with source provenance:

```text
e44a7eb72e49bdac92b34f820dee9fbb1248abad
```

The `.8` package graph was packed twice in separate release roots:

```text
/private/tmp/prisma-lossless-private-release-8/runs/1784599961030-e44a7eb72e49/private-release-manifest.json
/private/tmp/prisma-lossless-private-release-8-repro/runs/1784599987766-e44a7eb72e49/private-release-manifest.json
```

Every package integrity matched between those two runs.

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

The `.7` identity remains recorded with its original bytes but is
unavailable. The wrapper now rejects `.5`, `.6`, and `.7` before
Verdaccio startup and instructs consumers to use `.8`.

## Validation Evidence

- `pnpm exec vitest run
helpers/compile/plugins/fill-plugin/fillPlugin.test.ts` passed
  (`4` tests).
- `pnpm --filter @prisma-lossless/client build` passed after the
  deterministic fill-plugin change.
- `pnpm exec tsx scripts/lossless-private-release.ts build-pinned
7.8.0-lossless.8
e44a7eb72e49bdac92b34f820dee9fbb1248abad
/private/tmp/prisma-lossless-private-release-8` passed.
- A second independent `build-pinned` run for `.8` passed in
  `/private/tmp/prisma-lossless-private-release-8-repro`, and all ten
  package integrities matched the first run.
- `pnpm exec vitest run
helpers/compile/plugins/fill-plugin/fillPlugin.test.ts
scripts/lossless-private-release.test.ts
scripts/lossless-private-registry-run.test.ts` passed (`32` tests).
- `prepareBuiltPrivateReleaseCandidates('7.8.0-lossless.8')` passed
  and validated the recorded `.8` identity before registry startup.
- `PRISMA_LOSSLESS_RUN_REGISTRY_INTEGRATION=1 pnpm exec vitest run
scripts/lossless-private-registry-run.integration.test.ts` passed
  outside the sandbox (`4` tests passed, `1` fresh-checkout test
  skipped pending the final committed tree).

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
