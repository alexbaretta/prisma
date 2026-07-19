# Sprint 7

### [DONE] Tasklet 021: Build a Pinned Release Offline

Branch: `target-7.8.0-lossless`

Status: approved as required input to the IPG prisma-lossless cutover.

## Goal

Let a clean consumer builder reconstruct the immutable
`7.8.0-lossless.5` tarball graph from pinned public source, then feed
that manifest to the existing ephemeral registry wrapper without first
contacting a long-running Verdaccio instance.

## Pre-Implementation Review

Observed problem: the ephemeral runner owns registry lifecycle but
requires an existing manifest and tarballs. The current release builder
chooses its version by querying a registry, so a clean builder cannot
reconstruct the approved release when no registry is already running.

Violated contract: prisma-lossless owns artifact construction. A clean
first-party build must be able to reproduce an exact approved release
graph from public source without GCP, a system service, mutable package
versions, or consumer-owned package rewriting.

Owning layer: `lossless-private-release.ts` owns package rewriting,
packing, graph order, release metadata, and source provenance. The
ephemeral registry runner remains responsible only for manifest
validation, publication, child execution, and cleanup.

Intended solution: add a `build-pinned` release command accepting an
exact lossless version, source commit, and output root. Before packing,
prove every release-package source directory is unchanged from that
commit. Reuse the existing package rewrite and packing implementation;
do not duplicate the release graph. Keep the registry-selected `build`
command unchanged.

Rejected solutions: do not have IPG rewrite Prisma packages, synthesize
tarballs, vendor artifacts, query a fixed registry to manufacture the
version, or claim provenance for package sources that differ from the
recorded commit.

Validation: unit tests must reject malformed versions, missing commits,
and changed release-package sources while accepting script-only changes.
A focused build must reconstruct `7.8.0-lossless.5`, and the ephemeral
runner must publish it and resolve the exact CLI version.

## Acceptance Criteria

- `build-pinned` does not query or require a registry.
- Only exact `7.8.0-lossless.N` versions are accepted.
- Package-source drift from the provenance commit fails before packing.
- Script and documentation changes after the provenance commit are
  allowed when package sources are unchanged.
- The existing registry-selected build remains supported.
- The resulting manifest passes the existing ephemeral runner.

## Post-Implementation Review

Ownership and scope: the release builder now accepts the exact release
version and provenance commit, verifies all release-package source
directories against that commit, and reuses the existing package graph
and packing implementation. The registry runner still owns only the
ephemeral registry lifecycle, publication, child execution, and cleanup.

Rejected alternatives remain absent: consumers do not rewrite packages,
vendor tarballs, query a fixed registry to choose the version, or rely on
a long-running Verdaccio service.

Validation evidence: 15 focused release and runner tests pass. Focused
ESLint passes. The full build passes all 44 tasks. A pinned build
reconstructed `7.8.0-lossless.5` from source commit
`f98f2e0f42cd7d9d9556567f9236c98eed00da16`; the ephemeral runner
published all ten packages and resolved the CLI as
`7.8.0-lossless.5`. `MIGRATION_FROM_PRISMA.md` documents both pinned
reconstruction and ephemeral consumer execution.

Failure classification: malformed versions, missing provenance commits,
release-source drift, and unverifiable Git state are bona fide artifact
identity failures. Continuing could publish bytes under a false immutable
identity, so hard failure is required. No diagnostic assertion, warning,
or user-visible product error was added.
