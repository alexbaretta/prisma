# Sprint 8

### [DONE] Tasklet 022: Run From Prebuilt Artifacts

Branch: `target-7.8.0-lossless`

Status: approved for the IPG prisma-lossless migration.

## Goal

Let a consumer invoke the ephemeral registry from an already-built
prisma-lossless project without building the project, pinning its Git
commit, or constructing and caching a release manifest itself.

## Pre-Implementation Review

Observed problem: the runner requires a pre-existing release manifest,
so IPG currently invokes `build-pinned`, verifies a fixed source commit,
and caches manifests. That moves fork release construction into the
consumer workflow despite the project already being built.

Violated contract: prisma-lossless owns packing its built package graph
and the ephemeral registry lifecycle. A consumer owns only its project
path and child command and must not build or Git-verify the fork.

Owning layer: the private-release script owns package rewriting and
packing. The registry runner owns transient release preparation,
publication, child execution, and cleanup.

Intended solution: add a runner mode that accepts an exact lossless
package version and a child command. Package the current built outputs
under transient runner storage, record current provenance without
comparing it to a pinned commit, publish through the existing isolated
registry path, execute the child, and remove the transient release.

Rejected solutions: do not make consumers locate temporary manifests,
build the fork, inspect Git state, cache manifests, rewrite packages, or
run a long-lived registry.

Validation: unit tests must prove argument parsing, child failure
propagation, release cleanup, and existing manifest compatibility. A
real smoke must publish the built graph and resolve the requested exact
CLI version. Run focused lint and the repository build.

## Acceptance Criteria

- The new mode consumes already-built package outputs.
- It does not run a project build or compare sources to a Git commit.
- Packing, manifest creation, publication, and cleanup remain fork-owned.
- Existing manifest mode remains compatible.
- Concurrent invocations retain isolated registry and release roots.
- Child success and failure preserve their exit status.
- Focused tests, lint, a real registry smoke, and the build pass.

## Post-Implementation Review

Ownership and scope: the private-release module now packages the
current built outputs at an exact requested version without comparing
them to a pinned source commit. The registry runner owns the transient
release root, publication, child execution, and cleanup. Consumers
provide only the project path, version, and child command.

Contract result: `--from-built` creates an isolated transient release,
publishes it through the existing isolated Verdaccio path, preserves
the child status, and removes the release on success or failure. The
existing explicit-manifest interface remains supported.

Rejected alternatives remain absent: no consumer-side package rewrite,
manifest discovery, Git verification, fork build, persistent cache, or
long-lived registry was introduced.

Validation evidence: 17 focused release and runner tests pass. Focused
Prettier and ESLint checks pass. The real wrapper packed and published
all ten built `7.8.0-lossless.5` packages and its child resolved the
exact CLI version. The repository build passed all 44 Turbo tasks.

Failure classification: invalid versions, missing built outputs,
packing or publication failures, and child-launch failures are bona
fide build-tooling contract failures. Continuing cannot produce a valid
consumer install. No production diagnostic assertion or application
failure path was added.
