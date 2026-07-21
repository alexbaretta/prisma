# Sprint 14

### [ ] Tasklet 028: Rename Source Packages To Lossless

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
private release builder own package identity. The release builder may
stamp version and provenance, but it must not translate package names
or dependency names between stock and fork namespaces.

Intended solution: rename every fork-owned workspace package from
`@prisma/*` to `@prisma-lossless/*`, update internal dependency and
import specifiers to the renamed packages, remove source-name to
release-name mappings from `scripts/lossless-private-release.ts`, and
make release validation fail if a published fork-owned package relies
on namespace rewriting.

Rejected solution: do not keep source packages under `@prisma/*` and
hide that fact with staging rewrites, npm aliases, lockfile overrides,
or generated-client normalization. Those approaches move package
identity out of source control and preserve the same trust defect.

Validation that proves the fix: add focused release-tooling tests that
fail if package names or dependency keys are rewritten from stock
Prisma names, run package builds for the renamed release graph, run
the external ephemeral-registry integration from an empty store, prove
generated client metadata uses the lossless namespace, mint a new
immutable private release, and pass repo-root `pnpm build`.

## Implementation Steps

1. Rename all fork-owned workspace package `package.json` names to
   `@prisma-lossless/*` or `prisma-lossless`.
2. Update workspace dependency keys, source imports, generated
   dependency metadata, test fixtures, package filters, and scripts to
   resolve the new source identities.
3. Remove release-time package-name and dependency-name rewriting from
   the private release builder. Version and provenance stamping may
   remain.
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
requires the source package name to match the release package name
before packing. The release builder still stamps exact private
versions and release provenance into staged package metadata, but it
no longer translates dependency keys from stock `@prisma/*` names or
publishes npm alias dependencies for fork-owned packages.

Four upstream binary and service packages remain under their upstream
names because this repository does not own their source packages:
`@prisma/engines-version`, `@prisma/query-compiler-wasm`,
`@prisma/prisma-schema-wasm`, and `@prisma/schema-engine-wasm`.
The tasklet release validation must prove that fork-owned artifacts do
not expose stock names for packages owned by this repository.

## Validation Evidence

Focused release-tooling tests passed:

```sh
pnpm exec vitest run scripts/lossless-private-release.test.ts
```

Result: passed, `17` tests.

Package-name audits passed:

```sh
node -e '... assert no workspace package name starts with @prisma/ ...'
node -e '... assert no package manifest depends on an owned stock name ...'
```

Repo-root build passed outside the sandbox after refreshing the pnpm
workspace layout:

```sh
pnpm install --lockfile-only
pnpm install
pnpm build
```

The first sandboxed `pnpm build` failed only because `tsx` could not
create IPC pipes under `/var/folders/...`. The escalated build passed
with `44` successful tasks.
