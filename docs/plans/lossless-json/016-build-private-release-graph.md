# Sprint 3

### [ ] Tasklet 016: Build Private Release Graph

## Goal

Build immutable release candidates for the private first-party registry
so an external first-party project can depend on exact semantic
versions instead of local tarball paths, workspace links, Git
dependencies, or public npm packages.

## Instructions

Create an immutable `7.8.0-lossless.<N>` prerelease, starting with the
next unused positive `N` in the approved private registry. Do not reuse
or replace an existing version. Preserve source commit provenance in
the release metadata.

Publish candidate artifacts for the runtime closure already proven by
Tasklet 013:

- `@prisma/debug`;
- `@prisma/get-platform`;
- `@prisma/fetch-engine`;
- `@prisma/engines`;
- `@prisma/config`;
- `@prisma/client-runtime-utils`;
- `@prisma-lossless/client`;
- `prisma-lossless`.

Use the repository's standard build and npm packlist behavior. Extend
or wrap existing release tooling instead of inventing a package archive
format.

The private-release path must:

- take an explicit allowlisted registry;
- refuse public or unapproved registries;
- assign the selected version consistently;
- rewrite `workspace:*` dependencies to immutable published versions;
- publish packages in dependency order;
- record the selected source commit.

Transient pack output may exist only in a project-local ignored
temporary directory or another non-source release workspace. No
tarball, registry storage, checksum manifest, or copied package tree
may be committed.

Leave the tracked checkout in a deliberate, reviewable state. Do not
use a destructive reset to clean release-time metadata changes.

This tasklet may continue using private `@prisma/*` names for the
internal closure because the registry is private. Namespace ownership
and any additional renaming for a worldwide open-source release belong
to a future plan and are not part of this tasklet.

## Pre-Implementation Review

Capture the AGENTS-required review record before changing package
metadata, release tooling, or registry state.

The review must identify:

- why exact private versions are needed for first-party consumers;
- the package graph and publish order;
- the owner of version rewriting;
- the guard that prevents public publication;
- one rejected approach that leaves `0.0.0`, `workspace:*`, `file:`,
  `link:`, Git, branch, checkout, or home-directory dependencies in a
  release candidate.

## Validation

Add metadata tests that unpack the release candidates and reject:

- `0.0.0`;
- `workspace:*`;
- `file:`;
- `link:`;
- Git dependencies;
- branch dependencies;
- checkout paths;
- home-directory paths.

Prove that every package records the selected version and exact source
commit. Prove that `@prisma-lossless/client` depends on the private
lossless runtime closure.

Run focused package builds and the repo-root build required by the
repository instructions.

Do not mark this tasklet `[DONE]` until the release graph, metadata
tests, build evidence, and review record are committed.
