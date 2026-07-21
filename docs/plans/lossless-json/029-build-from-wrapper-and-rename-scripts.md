# Sprint 15

### [DONE] Tasklet 029: Build From Wrapper And Rename Scripts

Branch: `target-7.8.0-lossless`

Status: approved for implementation by the user prompt.

## Goal

Make the consumer-facing ephemeral registry wrapper build the
prisma-lossless package artifacts before it prepares a `--from-built`
release. A caller should only need to invoke the registry wrapper from
this checkout.

Also rename every `scripts/lossless-private*.ts` release helper to the
shorter `scripts/private-*.ts` form, and update all live imports,
tests, usage text, and consumer-facing documentation to use the new
script names.

## Pre-Implementation Review

Observed problem: the migration guide still tells users to run
`pnpm build` before calling the ephemeral registry wrapper. That leaves
the consumer workflow split across two commands and makes the wrapper
depend on previously produced ignored build output.

Violated contract or invariant: the wrapper is the durable consumer
entry point for private prisma-lossless installation. It must own the
complete local preparation needed to serve the exact immutable release
graph, while the release packer continues to own byte-for-byte
identity validation.

Owning layer: `scripts/private-registry-run.ts` owns the
consumer-facing orchestration for `--from-built`. It should run the
repository build before preparing release candidates, then call the
existing release packer. `scripts/private-release.ts` remains the
owner of package graph packing and immutable integrity checks.

Intended solution: rename the private release and registry scripts to
`scripts/private-*.ts`, update imports and usage strings, add a build
dependency to the `--from-built` runner, and run the repository build
before `prepareBuiltPrivateReleaseCandidates`. If the build fails, the
wrapper must fail before release packing, Verdaccio startup, child
execution, or cleanup-sensitive registry work.

Rejected solution: do not ask consumers to run a separate `pnpm build`,
do not build inside manifest mode where the manifest already names
specific tarballs, and do not move build failure handling into the
release packer. Those choices either preserve the split workflow,
change unrelated manifest semantics, or blur the boundary between
orchestration and immutable package validation.

Validation that proves the fix: focused wrapper unit tests must prove
`--from-built` builds before packing, build failures stop before
packing and registry startup, manifest mode does not build, and
transient release cleanup still runs. Existing release and registry
unit tests must pass under the renamed script paths. Repo-root
`pnpm build` must pass because the change affects TypeScript tooling
and package workflow code.

## Implementation Steps

1. Rename all live `scripts/lossless-private*.ts` files to
   `scripts/private-*.ts`.
2. Update live TypeScript imports, usage strings, tests, docs, and the
   lossless JSON plan index to use the renamed paths.
3. Add a build function to the `--from-built` runner dependency set.
   The default implementation should run `pnpm build` from the prisma
   checkout with inherited stdio.
4. Call the build function after consumer-directory validation and
   before release-root creation and release packing.
5. Add focused unit tests for build ordering, failure behavior,
   manifest-mode behavior, and cleanup.
6. Run focused renamed-script tests, docs/path audits, and repo-root
   `pnpm build`.

## Acceptance Criteria

- The durable consumer command invokes only
  `scripts/private-registry-run.ts`.
- `--from-built` runs `pnpm build` before packing release candidates.
- A build failure rejects before release packing, Verdaccio startup,
  and child command execution.
- Manifest mode keeps its existing behavior and does not run a repo
  build.
- No live import, usage string, or consumer-facing doc refers to
  `scripts/lossless-private*.ts`.
- The renamed script test suite passes.
- Repo-root `pnpm build` passes for the final tree.

## Post-Implementation Review

The implemented change stays in the wrapper and release-tooling layers
identified in the pre-implementation review. The renamed registry
runner now runs `pnpm build` for `--from-built` before it creates a
transient release root or calls the release packer. The release packer
still owns immutable identity validation and package integrity checks;
it was not changed to compensate for missing build artifacts.

Manifest mode continues to load and serve the manifest tarballs
without invoking the repository build. That preserves the existing
meaning of a manifest as an already materialized package graph.

The script rename is a source-level rename. Live imports, test imports,
usage strings, current plan commands, and consumer-facing migration
commands now use `scripts/private-*.ts`. Historical tasklet files that
record previous validation commands were left as history rather than
rewritten as if those old runs used the new names.

## Validation Evidence

Focused renamed-script tests passed:

```sh
pnpm exec vitest run scripts/private-release.test.ts \
  scripts/private-registry-run.test.ts scripts/private-registry.test.ts
```

Result: passed, `3` files and `37` tests.

The wrapper unit suite proves that `--from-built` builds before
release packing, that a build failure stops before release-root
creation, release packing, registry startup, and child execution, and
that cleanup still runs for prepare and child failures.

Prettier validation passed:

```sh
pnpm exec prettier --check scripts/private-release.ts \
  scripts/private-release.test.ts scripts/private-release-identities.ts \
  scripts/private-release-fixtures.ts scripts/private-registry.ts \
  scripts/private-registry.test.ts scripts/private-registry-run.ts \
  scripts/private-registry-run.test.ts \
  scripts/private-registry-run.integration.test.ts \
  MIGRATION_FROM_PRISMA.md \
  docs/plans/lossless-json/000-lossless-json-index.md \
  docs/plans/lossless-json/029-build-from-wrapper-and-rename-scripts.md
```

Result: passed.

Focused ESLint validation passed with no errors:

```sh
NODE_OPTIONS=--max-old-space-size=8192 pnpm exec eslint \
  scripts/private-release.ts scripts/private-release.test.ts \
  scripts/private-release-identities.ts \
  scripts/private-release-fixtures.ts scripts/private-registry.ts \
  scripts/private-registry.test.ts scripts/private-registry-run.ts \
  scripts/private-registry-run.test.ts \
  scripts/private-registry-run.integration.test.ts
```

Result: passed with the existing `scripts/private-release.test.ts`
`no-unsafe-argument` warning.

Live script path audit passed:

```sh
rg --files scripts | rg 'lossless-private.*\.ts$'
rg "scripts/lossless-private|from './lossless-private" \
  scripts MIGRATION_FROM_PRISMA.md \
  docs/plans/lossless-json/000-lossless-json-index.md
```

Result: no live script files and no live current references.

Repo-root build passed:

```sh
pnpm build
```

Result: passed, `44` successful tasks out of `44`.
