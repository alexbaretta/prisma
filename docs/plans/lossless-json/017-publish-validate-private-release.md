# Sprint 3

### [ ] Tasklet 017: Publish And Validate Private Release

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

Use the stock `@prisma/adapter-pg` release declared compatible with the
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

## Validation

Run the focused package suites, repo-root build, and repo-root tests
required by the Prisma plan and repository instructions.

Do not mark this tasklet `[DONE]` until the private registry publish,
overwrite refusal, isolated consumer install, smoke suite, failure
coverage, and validation evidence are committed.
