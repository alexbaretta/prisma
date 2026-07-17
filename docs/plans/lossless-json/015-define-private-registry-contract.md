# Sprint 3

### [DONE] Tasklet 015: Define Private Registry Contract

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

## Pre-Implementation Review Record

Observed problem: Sprints 0 through 2 prove local tarball adoption, but
an external first-party project still cannot consume the fork through
ordinary package-manager registry semantics. Tarball paths and sibling
checkouts are not reproducible across local development, CI, and image
build hosts.

Violated contract or invariant: Sprint 3 requires private first-party
registry consumption without public npm publication, local tarball
references, workspace links, sibling checkouts, Git dependencies, or
implicit fallback to stock Prisma packages for the lossless package
surface.

Owning layer: repository release tooling owns the registry endpoint
contract, publish-target guard, and local command entry point. The
private registry runtime owns package storage, authentication state,
and logs. The downstream project owns its own registry configuration
and lockfile once packages are published.

Intended solution: add a pinned Verdaccio-based private-registry helper
under `scripts/` that writes runtime configuration outside the checkout,
starts and stops a localhost-bound registry, checks health, validates
publish targets, and runs publish or inspect commands only against an
allowlisted private endpoint. Add focused tests for endpoint approval
and rejection.

Rejected unsafe or wrong-layer solution: do not publish to
`registry.npmjs.org`, do not rely on global npm state, do not store
tokens in tracked files, and do not make downstream consumers install
from workstation-only tarball paths or sibling checkouts. Those options
either cross the wrong trust boundary or preserve the non-reproducible
dependency model that Sprint 3 is meant to replace.

Validation that proves this tasklet: focused tests must pass for the
registry endpoint guard and runtime path checks. The helper must be
able to start a pinned Verdaccio process, pass a health check, reject a
public publish target, and define inspect, authenticate, publish, and
stop commands that use only the approved private endpoint and
out-of-checkout auth/config/storage paths.

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

## Post-Implementation Review

The implementation adds `scripts/lossless-private-registry.ts` as the
single private-registry contract boundary for this fork. It pins
Verdaccio to `6.8.0`, writes Verdaccio configuration under an
out-of-checkout runtime root, starts the registry bound to
`127.0.0.1:4873`, checks health through `/-/ping`, and exposes explicit
commands for config, command inspection, start, health, authenticate,
publish, package inspection, and stop.

The publish guard rejects `registry.npmjs.org`, malformed URLs,
credential-bearing URLs, remote hosts, Docker-only hostnames, and
unexpected ports before any publish or inspect path can run. Registry
tokens are stored only through an npm userconfig path under the
external runtime root, not in tracked files.

This stays in the release-tooling layer. It does not modify runtime
lossless JSON behavior, package metadata, package versions, or
downstream project files. Docker uses `host.docker.internal:4873` only
for reachability validation; publish remains restricted to localhost.

The rejected approaches remain rejected: no public npm publication, no
global npm state as the contract, no tracked token files, and no
downstream dependency on local tarball paths or sibling checkouts.

## Validation Performed

Focused guard tests:

```sh
pnpm exec vitest run scripts/lossless-private-registry.test.ts \
  --reporter=dot
```

Result: passed (`1` file, `6` tests).

Focused lint:

```sh
pnpm exec eslint scripts/lossless-private-registry.ts \
  scripts/lossless-private-registry.test.ts
```

Result: passed.

Whitespace validation:

```sh
git diff --check
```

Result: passed.

Repo-root build:

```sh
pnpm build
```

Result: passed (`44` successful, `44` total).

Pinned registry start and health validation:

```sh
ROOT=/private/tmp/prisma-lossless-private-registry
env \
  PRISMA_LOSSLESS_REGISTRY_ROOT="$ROOT" \
  pnpm exec tsx scripts/lossless-private-registry.ts start
```

Result: passed. Verdaccio `6.8.0` became healthy at
`http://127.0.0.1:4873/`.

Explicit health command:

```sh
ROOT=/private/tmp/prisma-lossless-private-registry
env \
  PRISMA_LOSSLESS_REGISTRY_ROOT="$ROOT" \
  pnpm exec tsx scripts/lossless-private-registry.ts health \
  http://127.0.0.1:4873/
```

Result: passed.

Public-registry rejection:

```sh
ROOT=/private/tmp/prisma-lossless-private-registry
env \
  PRISMA_LOSSLESS_REGISTRY_ROOT="$ROOT" \
  pnpm exec tsx scripts/lossless-private-registry.ts commands \
  https://registry.npmjs.org/
```

Result: failed as expected with:

```text
Refusing to publish lossless Prisma packages to public registry:
https://registry.npmjs.org/
```

Runtime storage location:

```sh
ls -la /private/tmp/prisma-lossless-private-registry
```

Result: passed. The registry config, storage, auth directory, log, and
PID file are outside `/Users/alex/git/github/prisma`.

Docker reachability:

```sh
docker run --rm --add-host=host.docker.internal:host-gateway \
  mcr.microsoft.com/dotnet/sdk:10.0 \
  bash -lc 'curl -fsS http://host.docker.internal:4873/-/ping'
```

Result: passed with `{}`.

Registry stop:

```sh
ROOT=/private/tmp/prisma-lossless-private-registry
env \
  PRISMA_LOSSLESS_REGISTRY_ROOT="$ROOT" \
  pnpm exec tsx scripts/lossless-private-registry.ts stop
```

Result: passed.
