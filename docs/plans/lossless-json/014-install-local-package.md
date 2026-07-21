# Sprint 2

### [DONE] Tasklet 014: Install Fork Locally And Smoke Test

## Goal

Install the renamed fork package locally and verify it preserves
loss-sensitive JSON numeric tokens in a downstream-style project.

## Instructions

Create or select a local smoke-test project that can install the fork
artifacts without conflicting with stock Prisma packages. The smoke test
must exercise the installed package, not the repository source tree
directly.

The smoke test must cover:

- generated client import from the renamed package;
- read of a JSON large integer token;
- read of a JSON decimal token;
- write of a `LosslessNumber` large integer;
- write of a `LosslessNumber` decimal;
- raw query returning JSON;
- raw query returning JSON cast to text.

## Pre-Implementation Review

Capture the AGENTS-required review record before creating or modifying a
local smoke-test project.

## Pre-Implementation Review Record

Observed problem: the fork packages have been packed, but the plan has
not yet proven that a downstream project can install the renamed CLI and
client package, generate a client from that installation, and preserve
loss-sensitive JSON numeric tokens through model and raw-query paths.

Violated contract: Sprint 2 is not complete until the package artifacts
can be consumed outside the repository source tree without colliding
with stock Prisma package names and without losing JSON number tokens.

Owning layer: the local smoke project owns downstream installation and
runtime validation. The fork packages own the renamed package metadata,
generated-client import path, and lossless JSON runtime behavior.

Intended solution: create a project-local ignored smoke project under
`tmp/lossless-json-tasklet-014`, install the Tasklet 013 tarballs by
file path, pack the Better SQLite3 adapter closure needed only by the
smoke harness, generate a client with `prisma-lossless`, and run a
script that verifies JSON reads, writes, raw JSON results, and text-cast
results.

Rejected wrong-layer solution: do not run the smoke against workspace
source packages or import runtime helpers directly from the repository.
That would bypass the installed package contract that Sprint 2 must
prove.

Validation that proves this tasklet: the recorded install command must
complete in the smoke project, `prisma-lossless generate` must produce a
client imported from `@prisma-lossless/client`, and the smoke script must
print passing evidence for generated import, large integer read, decimal
read, `LosslessNumber` large integer write, `LosslessNumber` decimal
write, raw JSON result materialization, and raw JSON text-cast behavior.

## Validation

Record the exact install command, smoke-test command, and passing
output. Do not mark the full plan complete until repo-root `pnpm test`
passes, unless the user explicitly approves a narrower completion
standard.

## Post-Implementation Review Record

The smoke project exercised the installed tarballs under
`tmp/lossless-json-tasklet-014/smoke` with `pnpm install
--ignore-workspace --force`. The install used local tarball overrides
for every `0.0.0` Prisma package in the CLI, client, and Better SQLite3
adapter closure, so transitive dependencies did not resolve to stock
Prisma packages from npm.

This did not bypass the product path: client generation used the
installed `prisma-lossless` binary, and runtime code imported
`PrismaClient`, `Prisma`, and `Prisma.LosslessNumber` from the installed
`@prisma-lossless/client` package. The smoke project created its own
SQLite database and used the installed Better SQLite3 adapter package.

The rejected workspace-source path was validated by an initial install
attempt that printed `Scope: all 48 workspace projects`. That result was
not used as completion evidence. The accepted install used
`--ignore-workspace` and only then ran generation and smoke assertions.

## Validation Performed

Adapter smoke harness build:

```sh
pnpm --filter @prisma-lossless/driver-adapter-utils \
  --filter @prisma-lossless/adapter-better-sqlite3 build
```

Result: passed.

Adapter smoke harness package artifacts:

```sh
pnpm --filter @prisma-lossless/driver-adapter-utils \
  --filter @prisma-lossless/adapter-better-sqlite3 pack \
  --pack-destination /Users/alex/git/github/prisma/tmp/lossless-json-tasklet-014/artifacts
```

Result: produced
`prisma-driver-adapter-utils-0.0.0.tgz` and
`prisma-adapter-better-sqlite3-0.0.0.tgz`.

Isolated downstream install:

```sh
pnpm install --ignore-workspace --force
```

Working directory:
`/Users/alex/git/github/prisma/tmp/lossless-json-tasklet-014/smoke`.

Result: passed. Installed `@prisma-lossless/client@0.0.0`,
`prisma-lossless@0.0.0`, the local `@prisma/*@0.0.0` package
artifacts, `@prisma-lossless/adapter-better-sqlite3@0.0.0`,
`better-sqlite3@12.11.1`, and `typescript@5.4.5`.

Generated client from installed CLI:

```sh
pnpm exec prisma-lossless generate
```

Result: passed. Prisma Client `v0.0.0` was generated into the installed
`@prisma-lossless/client` package under the smoke project's
`node_modules`.

Smoke command:

```sh
node smoke.mjs
```

Passing output:

```text
PASS generated client import from @prisma-lossless/client
PASS read JSON large integer token
PASS read JSON decimal token
PASS write LosslessNumber large integer
PASS write LosslessNumber decimal
PASS raw query returning JSON
PASS raw query returning JSON cast to text
```

`pnpm exec prisma-lossless generate` required filesystem escalation
because the installed CLI updates the Prisma engine cache under the user
home directory. No tracked source files were changed by the smoke
project.
