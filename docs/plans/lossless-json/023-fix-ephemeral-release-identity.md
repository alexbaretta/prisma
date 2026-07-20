# Sprint 9

### [DONE] Tasklet 023: Fix Ephemeral Release Identity

Branch: `target-7.8.0-lossless`

Status: implemented, validated, and ready to commit.

## Goal

Fix the ephemeral prisma-lossless installer so an exact private
version is immutable and consumer child tooling resolves from the
consumer project, without requiring permanent registry configuration,
checked-in tarballs, consumer release manifests, registry storage, or
copied wrapper implementation.

## Pre-Implementation Review

Observed problem: `--from-built 7.8.0-lossless.5` derives package
provenance from the current checkout and repacks different bytes under
an already consumed npm identity. GWEN's frozen lockfile rejected the
new tarballs with `ERR_PNPM_TARBALL_INTEGRITY` even though the old
`.5` graph from provenance commit
`f98f2e0f42cd7d9d9556567f9236c98eed00da16` still installs.

Violated contract: a private npm package version is an immutable
identity. Reusing an exact version must reproduce the same package
bytes, source provenance, dependency graph, and integrity metadata, or
the wrapper must reject before Verdaccio starts and before the
consumer command runs.

Owning layer: prisma-lossless release tooling owns package provenance,
release identity, packing, manifest construction, integrity checks,
ephemeral registry publication, and child process setup. Consumer
repositories own only their package dependencies and build commands.

Intended solution: add a Prisma-owned immutable release identity for
known private versions and have `--from-built` resolve the requested
exact version through that identity. For an existing version, pack with
the recorded provenance commit, assert release package sources still
match that provenance, validate the complete ten-package graph, and
compare every packed tarball integrity before starting Verdaccio. If
the built graph differs or the version has no recorded identity, fail
with instructions to mint a new version through the release layer
rather than mutating an existing version.

Rejected solution: do not update GWEN's lockfile to accept a second
`.5` artifact, do not make the consumer provide or cache a release
manifest, do not publish worldwide, do not keep registry storage, and
do not copy this wrapper into consumer repositories.

Observed problem: the documented child command uses
`pnpm --dir /path/to/consumer` while the child working directory
remains the prisma checkout. The real install selected prisma's pnpm
`10.15.1` instead of GWEN's `11.1.1`, creating an incompatible modules
layout for the consumer.

Violated contract: the consumer child command must execute with the
consumer project as its working directory whenever package-manager
resolution or Docker build context belongs to that repository.
Corepack must observe the consumer `packageManager` field.

Owning layer: the registry runner owns child process spawning and the
explicit contract for selecting the consumer working directory.

Intended solution: add an explicit `--consumer-dir <path>` argument,
validate that it is an existing directory with `package.json`, and run
the child with `cwd` set to that directory. Keep Docker support by
allowing the child command to be `docker build .`, where `.` resolves
to the consumer repository. Preserve the registry URL environment
contract for host and Docker child processes.

Rejected solution: do not rely on `pnpm --dir`, caller discipline, or
wrapper-specific shell snippets to make package-manager and Docker
context resolution happen in the correct repository.

Validation that proves the fix: unit tests must cover argument
parsing, consumer-directory validation, immutable identity resolution,
mismatched and incomplete built graphs, child exit propagation,
signals, and cleanup. A real temporary-consumer integration test must
install the complete ten-package graph through the ephemeral registry
with a frozen lockfile, prove the consumer `packageManager` version is
used, import `LosslessNumber`, prove repeated packaging of the same
release retains identical integrity metadata, reject tooling-only
checkout mutation of an existing release, reject changed package
sources under an existing version, and prove registry and transient
release roots are removed after success and failure. Retain existing
concurrency coverage, run focused tests, lint, typechecking,
integration validation, `pnpm build`, and the plan-required checks.

## Implementation Steps

1. Add an immutable release identity source in prisma-lossless release
   tooling for `7.8.0-lossless.5`, including provenance and package
   integrity metadata.
2. Change `--from-built` to resolve existing versions through the
   immutable identity, pack with recorded provenance, compare
   integrity metadata, and reject unknown or changed release graphs
   before starting Verdaccio.
3. Add `--consumer-dir <path>` parsing and validation, set child
   `cwd` to that path, and update host and Docker invocations to rely
   on the child working directory instead of `pnpm --dir`.
4. Add focused unit coverage for parsing, validation, identity,
   release mismatch, child exit, signal propagation, and cleanup.
5. Add a real temporary-consumer integration test for frozen installs,
   package-manager selection, `LosslessNumber`, repeated integrity,
   immutable-version rejection, changed-graph rejection, and cleanup.
6. Update `MIGRATION_FROM_PRISMA.md` with corrected host install,
   Docker build, and regenerate commands.
7. Run the required focused tests, lint, typechecking, integration
   tests, `pnpm build`, and plan validation. Record final version,
   provenance, integrity evidence, invocation, validation, and commit.

## Acceptance Criteria

- `--from-built 7.8.0-lossless.5` reproduces the recorded `.5`
  package bytes and provenance or rejects before registry startup.
- A tooling-only checkout change cannot mutate an existing version.
- A changed release package graph cannot publish under an existing
  version.
- Unknown existing-version requests fail with instructions to mint a
  new release identity in the prisma-lossless release layer.
- The child command runs from the validated consumer directory.
- Corepack and pnpm resolve from the consumer `packageManager` field.
- Docker build commands use the consumer repository as build context.
- Success, child failure, startup failure, and signals clean registry
  and transient release roots.
- The migration guide contains host install, Docker build, and
  regenerate commands that need no permanent registry configuration.
- Focused unit tests, real integration coverage, lint, typechecking,
  `pnpm build`, and the plan-required validation pass or have a
  recorded environment-only exception.

## Post-Implementation Review

The fix stays in the prisma-lossless release and registry-runner
tooling. Consumers still provide only an exact release version and a
consumer directory; they do not build this fork, inspect Git state,
configure a registry permanently, store tarballs, or keep release
manifests.

Existing private version `7.8.0-lossless.5` now resolves through a
Prisma-owned immutable identity in
`scripts/lossless-private-release-identities.ts`. The identity records
source provenance
`f98f2e0f42cd7d9d9556567f9236c98eed00da16` and all ten package
integrities. `--from-built` rejects unknown versions before starting
Verdaccio, packs known versions with the recorded provenance, checks
that release package sources still match that provenance, and compares
every packed tarball integrity before executing the consumer command.

The first rejected unsafe solution was accepting new tarball bytes
under `.5` and changing a consumer lockfile to match them. The second
was making consumers carry release manifests or wrapper logic. The
implemented contract keeps immutable package identity in this fork's
release layer and forces changed release bytes to become a newly
minted private version instead.

The registry runner now requires `--consumer-dir <path>` for both
manifest and built-release modes. The path must exist and contain a
`package.json`. Child commands run with `cwd` set to that consumer
directory, and the transient npm userconfig plus registry environment
are passed to the child. This lets Corepack select the consumer
`packageManager` and lets commands such as `docker build .` use the
consumer repository as build context.

The rejected wrong-layer solution was relying on `pnpm --dir` or
caller-specific shell discipline. That keeps process `cwd` in the
Prisma checkout and lets Corepack select the wrong package manager.

## Release Identity Evidence

Final version: `7.8.0-lossless.5`

Provenance commit:
`f98f2e0f42cd7d9d9556567f9236c98eed00da16`

No new private version was necessary. Repacking the current built graph
from the recorded package sources reproduces the existing `.5`
integrity metadata.

| Package                                 | Integrity                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `@prisma-lossless/debug`                | `sha512-f8g63A0ARkt2+GCgRpiA09mxDgXjzU/EATxcA0ebSQOtDbhReQDri7n7m6b3u8XZfugxZYt4ZE5W32wAg2pANQ==` |
| `@prisma-lossless/driver-adapter-utils` | `sha512-Ow22QHvHic7XNSozhTgreG6/KO5ZT4PO5NjOyxQP9Es/dgbeU9QXrPWFHJgCgn1FMv1zkISBZQqU+Iw01o4XAQ==` |
| `@prisma-lossless/get-platform`         | `sha512-toOrsnC4yoSJW6C+n2uKhdKj3yW7ZMX5e6WhJ4TBKD2Cp8/xOyB2qJ3vdrZbSV4T4oSzWMK/2dyeeHR1VmFgZg==` |
| `@prisma-lossless/fetch-engine`         | `sha512-WVBGYupq9SSoNfzeoMU0tlERfiMvgLMRH/KazW9Jbkz3GzaNxiXGWfK2n1/a+nlBb5UoarmwlnAeslVvkcxWvg==` |
| `@prisma-lossless/engines`              | `sha512-4odujRKCFlmBSxyGadjOBLhTcfhUPStW3CYlZ8iQRzGR0l851aZoGbrGu05Cd6eX2BrWqBcMNZv8azb+Bw5CKg==` |
| `@prisma-lossless/config`               | `sha512-0CvTZ2Z0a3EO0N6RTTgbZPkDFHdqizqzLe4pgyTguv4VlIIkqle8QN2qE4nBFEmGwKbLjdBGmCs70yFikwByZQ==` |
| `@prisma-lossless/client-runtime-utils` | `sha512-foVxxmGM2AiA6+HWuEd+qktk0e0bz2srWbeI/YFr0zoZ9dlMOJgMDNEY/tPz8kaKEYX2E7mJ1XOTSKeG/FB2rA==` |
| `@prisma-lossless/adapter-pg`           | `sha512-eUjSlk+HmsRVDTpYfP8K/cbxbr2YQtiDpwkvbkCq637itkl8RSSlbKmkJAl+8/XN3tHjBQtKXYymlQj3Mqt09g==` |
| `@prisma-lossless/client`               | `sha512-bYNBaEInTymBhOp0CI4vtkmqjE/Wibo7vI8sajeS3Akk141+E/CkK7CgNAVgYAtGqV3yJS9tfqzIFfo29lYnOQ==` |
| `prisma-lossless`                       | `sha512-fj66iWLeEPNJv86rgPP6gNn7JAGMxStypHohKz7mU5ujhF5ZxsJA34VJr2MJf4ovfRV5nkboqRJM8+GIIGhmAA==` |

Corrected GWEN host install invocation:

```sh
pnpm exec tsx scripts/lossless-private-registry-run.ts \
  --consumer-dir /Users/alex/git/ctosclub/gwe \
  --from-built 7.8.0-lossless.5 \
  -- corepack pnpm install --frozen-lockfile
```

Corrected Docker build invocation:

```sh
pnpm exec tsx scripts/lossless-private-registry-run.ts \
  --consumer-dir /Users/alex/git/ctosclub/gwe \
  --from-built 7.8.0-lossless.5 \
  -- \
  docker build \
    --build-arg PRISMA_LOSSLESS_DOCKER_REGISTRY_URL \
    .
```

Corrected dependency regeneration invocation:

```sh
pnpm exec tsx scripts/lossless-private-registry-run.ts \
  --consumer-dir /Users/alex/git/ctosclub/gwe \
  --from-built 7.8.0-lossless.5 \
  -- corepack pnpm install
```

## Validation Evidence

- `pnpm exec prettier --check scripts/lossless-private-release.ts scripts/lossless-private-release-identities.ts scripts/lossless-private-registry-run.ts scripts/lossless-private-registry-run.test.ts scripts/lossless-private-release.test.ts scripts/lossless-private-registry-run.integration.test.ts MIGRATION_FROM_PRISMA.md docs/plans/lossless-json/000-lossless-json-index.md docs/plans/lossless-json/023-fix-ephemeral-release-identity.md`
  passed.
- `NODE_OPTIONS=--max-old-space-size=8192 pnpm exec eslint scripts/lossless-private-release.ts scripts/lossless-private-release-identities.ts scripts/lossless-private-registry-run.ts scripts/lossless-private-registry-run.test.ts scripts/lossless-private-release.test.ts scripts/lossless-private-registry-run.integration.test.ts`
  passed. The same lint command without the heap setting failed before
  diagnostics with Node heap exhaustion.
- `pnpm exec vitest run scripts/lossless-private-release.test.ts scripts/lossless-private-registry-run.test.ts scripts/lossless-private-registry.test.ts`
  passed: 3 files, 29 tests.
- `PRISMA_LOSSLESS_RUN_REGISTRY_INTEGRATION=1 pnpm exec vitest run scripts/lossless-private-registry-run.integration.test.ts`
  passed: 1 file, 3 tests. The real temporary-consumer fixture
  installed all ten `.5` packages through the ephemeral registry,
  created and reused a frozen lockfile, used `pnpm v11.1.1` from the
  consumer `packageManager`, loaded `LosslessNumber`, proved repeated
  `.5` packaging keeps identical integrity metadata, retained
  concurrency coverage, propagated child exit code `42`, and proved
  registry and release roots were removed after success and failure.
- `NODE_OPTIONS=--max-old-space-size=8192 pnpm exec tsc --noEmit --pretty false`
  failed as an unsuitable repo-wide direct TypeScript gate for this
  checkout. It reported unrelated existing test-fixture errors and
  also walked a prior transient staging tree under
  `tmp/lossless-json-tasklet-023-probe`.
- `pnpm build` passed: Turbo reported 44 successful build tasks out of
  44 total.

## Final Status

Tasklet 023 is complete. GWEN can resume with exact private version
`7.8.0-lossless.5` and the corrected `--consumer-dir` invocation
above. The final commit ID is recorded by the tasklet commit.
