# Sprint 13

### [ ] Tasklet 027: Preserve Lifecycle Build Outputs

Branch: `target-7.8.0-lossless`

Status: approved for implementation by the user prompt.

## Goal

Fix the build-output cleanup regression that made
`7.8.0-lossless.9` unsafe for first-party adoption. The release
identity is immutable and must not be repacked in place. The fix must
mint a new immutable release after proving normal installation with
package lifecycle scripts enabled.

Do not modify `/Users/alex/git/ctosclub/gwe` or any IPG checkout.

## Confirmed Root Cause

The engines package builds these outputs in order:

```text
dist/scripts/postinstall.js
dist/scripts/localinstall.js
dist/index.js
```

The shared compile helper cleans each output directory immediately
before the corresponding esbuild invocation. It first cleans
`dist/scripts` and writes both lifecycle bundles. It later treats the
parent `dist` directory as a separate cleanup target and recursively
deletes `dist`, erasing the lifecycle bundles before writing
`dist/index.js`. Type generation leaves only lifecycle `.d.ts` files,
which explains the `@prisma-lossless/engines@7.8.0-lossless.9`
tarball contents.

GWEN proved all ten `.9` lockfile integrities matched the recorded
identity, and `--lockfile-only` succeeded. A normal frozen install
failed because `dist/scripts/postinstall.js` was absent. A diagnostic
install with `--ignore-scripts` passed, and `dist/index.js` loaded
successfully, ruling out general extraction or tarball corruption.

Tasklet 026's integration test used `--ignore-scripts`, so it did not
exercise the lifecycle-script contract required by first-party
consumers that allow Prisma engine lifecycle builds through
`onlyBuiltDependencies`.

## Pre-Implementation Review

Observed problem: `@prisma-lossless/engines@7.8.0-lossless.9`
successfully installs only when lifecycle scripts are disabled. Normal
consumer installation fails because the package's postinstall entry
points to `dist/scripts/postinstall.js`, which the release tarball does
not contain.

Violated contract or invariant: publishable package builds must leave
all generated outputs required by package lifecycle scripts in the
final package tree. A private release that passes lockfile integrity
checks but cannot run its lifecycle scripts is not consumable.

Owning layer: the shared compile helper owns output-directory cleanup
for packages built through `helpers/compile/build.ts`; the
ephemeral-registry integration owns proving the consumer installation
contract with lifecycle scripts enabled.

Intended solution: make cleanup ancestor-aware across the full build
option set before any esbuild output is written. If a later output
directory is an ancestor of an earlier output directory, clean only the
ancestor before the build sequence begins, and record covered
descendants so nested outputs are not removed after being written.
Then update the integration to run a normal frozen install, verify the
engines lifecycle JavaScript files exist, and execute them.

Rejected solution: do not reorder the engines build solely to hide the
helper bug, do not keep using `--ignore-scripts` for the real
external-consumer proof, and do not repair `.9` by changing its
recorded integrity. The cleanup contract belongs in the shared helper,
and `.9` is immutable.

Validation that proves the fix: add focused unit coverage for a
`dist/scripts` output followed by a parent `dist` output, run the
engines build and verify both lifecycle JavaScript outputs remain,
run the real ephemeral-registry integration with lifecycle scripts
enabled, mint the next immutable private release, prove repeated
integrities, update the migration guide and release identity fixtures,
and pass repo-root `pnpm build`.

## Implementation Steps

1. Add a failing unit test for nested generated output directories
   where `dist/scripts` is built before parent `dist`.
2. Change the compile helper to plan cleanup once from all build
   outputs before esbuild writes any file.
3. Build `@prisma/engines` and verify
   `dist/scripts/postinstall.js` and `dist/scripts/localinstall.js`
   both exist and execute.
4. Update the ephemeral-registry integration to install the recorded
   release with lifecycle scripts enabled and assert the installed
   engines lifecycle JavaScript files exist.
5. Mark `.9` unavailable, mint the next immutable private release,
   update release identities, independent fixtures, docs, and
   canonical consumer commands.
6. Run focused unit tests, the real ephemeral-registry integration,
   fresh-checkout reproducibility proof, affected builds, and
   repo-root `pnpm build`.

## Acceptance Criteria

- The compile helper never deletes a nested generated output after a
  child build has written files into it.
- `@prisma/engines` build leaves both lifecycle JavaScript outputs in
  `dist/scripts`.
- The external-consumer integration performs a normal frozen install
  with lifecycle scripts enabled.
- The current usable release identity is not `.9`; `.9` is recorded as
  unavailable.
- The replacement release has exact provenance and all ten package
  integrities recorded.
- The migration guide and plan index point consumers to the new
  immutable version.
