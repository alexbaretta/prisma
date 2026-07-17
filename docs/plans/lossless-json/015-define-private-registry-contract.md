# Sprint 3

### [ ] Tasklet 015: Define Private Registry Contract

## Goal

Define the private npm-compatible registry contract required for a
separate first-party project to consume this fork without local
tarball paths, sibling checkouts, public npm publication, or implicit
fallback to stock Prisma packages.

This tasklet is not required for local tarball smoke testing. It is
required when a first-party project must install the fork from an
ordinary registry endpoint in local development, CI, or Docker image
builds.

## Instructions

Use a standard npm-protocol registry that is private and initially
local to the developer workstation and image-build host. Prefer a
pinned Verdaccio release unless this repository already provides an
equivalent local private-registry workflow that satisfies every
criterion in this tasklet.

Keep registry configuration, package storage, authentication state, and
logs outside the Prisma and downstream project source trees. Bind the
registry so it is not publicly reachable. It must be reachable from
local package-manager commands and from the local Docker BuildKit
builder.

The registry may proxy ordinary public npm dependencies. Lossless
Prisma packages must resolve only from the private package storage.

Define explicit commands for:

- start;
- health check;
- authenticate;
- publish;
- inspect;
- stop.

Pin the registry tool version. Never store a token in a tracked file,
command transcript, image layer, or lockfile.

Add a publish-target guard that rejects `registry.npmjs.org` and every
other non-approved endpoint before any publish command can run.

## Pre-Implementation Review

Capture the AGENTS-required review record before changing tooling.

The review must identify:

- why external first-party consumption cannot rely on local tarballs;
- the registry trust boundary;
- the storage and credential locations;
- the allowlisted publish endpoint;
- one rejected approach that could publish to npm public, leak a token,
  or make Docker builds depend on workstation-only paths.

## Validation

Add success tests for the approved private endpoint.

Add failure tests for:

- public registry endpoints;
- missing registry endpoints;
- malformed registry endpoints;
- unexpectedly remote registry endpoints.

Validate that registry storage remains ignored or outside the checkout.
Validate that a Docker build can reach the registry endpoint without
making the registry publicly reachable.

Do not mark this tasklet `[DONE]` until the registry commands, guard,
tests, and recorded validation evidence are committed.
