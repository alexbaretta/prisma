# Sprint 6

### [DONE] Tasklet 020: Run Isolated Ephemeral Registries

Branch: `target-7.8.0-lossless`

Status: implemented and focused validation passed.

## Goal

Run one temporary Verdaccio instance for each consumer build so
concurrent builds can install an immutable prisma-lossless release
without a system-level registry service or a cloud registry.

## Pre-Implementation Review

Observed problem: the current registry tooling binds a fixed loopback
port and assumes a manually managed registry lifecycle. Concurrent
consumer builds cannot safely share that fixed process, and a clean
build should not require a long-running service.

Violated contract: each consumer build must receive the exact private
release graph through npm protocol semantics, own its registry
lifecycle, coexist with concurrent builds, and leave no live process
after success or failure.

Owning layer: prisma-lossless release tooling owns the package graph,
manifest validation, Verdaccio configuration, publication, lifecycle,
and generic child-command environment. Consumer repositories own only
their build commands and Docker-specific forwarding of the exported
registry URL.

Intended solution: add a generic wrapper in `scripts/` that accepts a
private release manifest followed by `--` and a child command. Allocate
a distinct loopback port, create unique runtime and storage paths,
start pinned Verdaccio, publish the validated graph, export host and
Docker registry URLs, run the child, then stop only the owned registry
and release all resources. Preserve the child exit status and clean up
after signals and thrown errors.

Rejected solutions: do not synthesize Verdaccio or pnpm store internals.
Do not use a shared scalar reference count because killed clients,
startup and shutdown races, stale counts, and conflicting release bytes
require a materially more complex lease supervisor. Do not embed IPG-
specific build commands in this repository.

Validation: unit tests must cover manifest rejection, URL and child
environment construction, child failure propagation, process cleanup,
and occupied-port retry behavior. A focused integration test must run
two wrappers concurrently, prove distinct healthy registries, install
or inspect the expected package graph, and prove both registries stop.
Run focused Vitest, ESLint, TypeScript/build validation, and the
documented wrapper smoke.

## Implementation Steps

1. Parameterize the existing registry primitives for safe dynamic
   loopback ports and non-interactive publication through an ephemeral
   publisher identity scoped to the isolated local instance.
2. Add strict private release manifest and tarball metadata validation.
3. Add the per-build wrapper, environment contract, signal handling,
   child exit propagation, and owned-process cleanup.
4. Add focused unit and concurrent Verdaccio integration coverage.
5. Update `MIGRATION_FROM_PRISMA.md` with host and Docker invocation
   examples and the exported environment contract.
6. Record the post-implementation review and validation evidence here.

## Acceptance Criteria

- Concurrent wrappers use different loopback ports and runtime roots.
- Each wrapper publishes only the validated immutable release graph.
- Host commands receive the loopback registry URL.
- Docker-aware consumers receive the corresponding
  `host.docker.internal` URL.
- A child success returns zero and a child failure preserves its code.
- Success, failure, and termination stop only the owned Verdaccio.
- No system-level Verdaccio service or cloud registry is required.
- Existing fixed-registry release commands remain supported.
- Focused tests, lint, and the relevant repository build pass.

## Post-Implementation Review

Observed problem and ownership: the fixed-port, manually managed
registry lifecycle was owned by the prisma-lossless release scripts.
The implementation keeps manifest validation, publication, child
environment setup, and cleanup in that layer; consumer commands remain
generic inputs.

Contract result: the wrapper validates the exact ordered release graph
and tarball provenance, obtains an OS-assigned loopback port, creates a
unique runtime root and ephemeral publisher, exports host and Docker
URLs, preserves the child status, retries port handoff collisions, and
stops only its own Verdaccio process after success, failure, or a
handled termination signal.

Rejected alternatives review: the result does not synthesize npm or
pnpm store internals, add a shared process counter, require a system
service, use a cloud registry, or embed a consumer-specific command.

Diagnostic review: no diagnostic assertions, throws, or error dialogs
were added. Throws classify as bona fide input, provenance, process,
and lifecycle contract failures for which publication or the child
build cannot safely continue.

Validation evidence:

- Focused Vitest: 14 tests passed across the registry primitive and
  wrapper unit suites.
- Focused ESLint passed for both registry scripts and all three test
  files.
- Real concurrency integration: two complete ten-package fixture
  graphs published on distinct ports; both child npm lookups passed;
  both registry health checks failed after cleanup as required.
- Actual-release smoke: the wrapper validated and published all ten
  `7.8.0-lossless.5` tarballs and its child resolved exactly
  `7.8.0-lossless.5`.
- Repository build: `pnpm build` passed all 44 Turbo tasks.
- Full-suite attempt: `GITHUB_REF_NAME=target-7.8.0-lossless pnpm test`
  reached package tests but the existing environment gate did not pass.
  Two MySQL cases reported schema-engine `ENOSPC`, two SQL Server cases
  could not reach `localhost:1433`, and one interactive-mode case
  expected a TTY. These failures are outside this tasklet's files and
  contracts; no full-plan completion claim is made from that run.
