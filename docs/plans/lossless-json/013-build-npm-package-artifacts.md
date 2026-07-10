# Sprint 2

### [DONE] Tasklet 013: Build Fork Npm Package Artifacts

## Goal

Build the renamed fork package artifacts that will be installed locally
for downstream validation.

## Instructions

Use the repo's existing package build and packing workflow. Do not
invent a custom tarball process if the repo already has one.

Record:

- exact build command;
- exact pack command;
- generated artifact paths;
- package names and versions;
- whether artifacts contain the renamed package metadata from
  Tasklet 012.

## Pre-Implementation Review

Capture the AGENTS-required review record before running package build
or pack commands.

## Package Artifact Scope

Tasklet 012 renamed only the public package pair. A local install of
those tarballs still needs the runtime workspace dependency closure
that would otherwise resolve to registry packages by name and version.

Build and pack these workspace packages:

- `@prisma/debug` from `packages/debug`;
- `@prisma/get-platform` from `packages/get-platform`;
- `@prisma/fetch-engine` from `packages/fetch-engine`;
- `@prisma/engines` from `packages/engines`;
- `@prisma/config` from `packages/config`;
- `@prisma/client-runtime-utils` from
  `packages/client-runtime-utils`;
- `@prisma-lossless/client` from `packages/client`;
- `prisma-lossless` from `packages/cli`.

Do not pack every workspace package. This artifact set is the runtime
dependency closure for the renamed public CLI/client install path.

Use the existing package build scripts and `pnpm pack`. Store generated
tarballs under the project-local ignored directory
`tmp/lossless-json-tasklet-013/`.

## Pre-Implementation Review Record

Observed problem: the renamed public tarballs depend on internal Prisma
workspace packages. If only `prisma-lossless` and
`@prisma-lossless/client` are packed, downstream local installation can
try to resolve internal dependencies from the registry instead of this
fork.

Violated contract or invariant: Sprint 2 requires a local installable
fork package set that does not conflict with stock Prisma packages and
does not silently depend on stock Prisma artifacts for the fork runtime.

Owning layer: package build and packing own the artifact set. Package
metadata owns the dependency names and versions. Tasklet 014 owns the
consumer install command that wires the local tarballs together.

Intended solution: run the repo's package build scripts for the runtime
dependency closure and pack those packages with `pnpm pack` into the
project-local ignored `tmp/lossless-json-tasklet-013/` directory. Verify
each tarball's embedded package metadata before proceeding.

Rejected unsafe or wrong-layer solution: do not hand-copy built files
or create tarballs with a custom archive command. That could omit npm
packlist behavior, package lifecycle behavior, or rewritten package
metadata. Also do not pack the entire monorepo, because that broadens
the artifact set beyond the local fork install path.

Validation that proves the fix: the focused build command must pass,
`pnpm pack` must produce tarballs for the eight package names listed
above, tarball inspection must show the expected package names and
versions, and the renamed public tarballs must contain
`prisma-lossless` and `@prisma-lossless/client` package metadata.

## Validation

Run the package build and verify the produced package artifacts. If the
package build can affect buildable product code, run the relevant
project build required by `AGENTS.md`.

## Build And Pack Commands

Build command:

```sh
pnpm --filter @prisma/debug --filter @prisma/get-platform \
  --filter @prisma/fetch-engine --filter @prisma/engines \
  --filter @prisma/config --filter @prisma/client-runtime-utils \
  --filter @prisma-lossless/client --filter prisma-lossless build
```

Pack command:

```sh
pnpm --filter @prisma/debug --filter @prisma/get-platform \
  --filter @prisma/fetch-engine --filter @prisma/engines \
  --filter @prisma/config --filter @prisma/client-runtime-utils \
  --filter @prisma-lossless/client --filter prisma-lossless pack \
  --pack-destination \
  /Users/alex/git/github/prisma/tmp/lossless-json-tasklet-013
```

`pnpm pack` initially reported that the renamed workspace dependency
`@prisma-lossless/client` was not linked in `node_modules`. Running
`pnpm install --ignore-scripts` refreshed the local workspace links
without changing the lockfile, and the pack command then passed.

## Generated Artifacts

All artifacts are local ignored files under:

`tmp/lossless-json-tasklet-013/`

- `@prisma/debug@0.0.0`:
  `prisma-debug-0.0.0.tgz`;
- `@prisma/get-platform@0.0.0`:
  `prisma-get-platform-0.0.0.tgz`;
- `@prisma/fetch-engine@0.0.0`:
  `prisma-fetch-engine-0.0.0.tgz`;
- `@prisma/engines@0.0.0`:
  `prisma-engines-0.0.0.tgz`;
- `@prisma/config@0.0.0`:
  `prisma-config-0.0.0.tgz`;
- `@prisma/client-runtime-utils@0.0.0`:
  `prisma-client-runtime-utils-0.0.0.tgz`;
- `@prisma-lossless/client@0.0.0`:
  `prisma-lossless-client-0.0.0.tgz`;
- `prisma-lossless@0.0.0`:
  `prisma-lossless-0.0.0.tgz`.

The public tarballs contain the renamed package metadata:

- `prisma-lossless-0.0.0.tgz` embeds package name
  `prisma-lossless`, bin `prisma-lossless`, and dependencies on
  `@prisma/engines@0.0.0` and `@prisma/config@0.0.0`;
- `prisma-lossless-client-0.0.0.tgz` embeds package name
  `@prisma-lossless/client`, dependency
  `@prisma/client-runtime-utils@0.0.0`, and peer dependency
  `prisma-lossless`.

## Post-Implementation Review

The artifact set matches the package dependency closure identified in
the pre-implementation review. The build used existing package scripts,
and packing used `pnpm pack` so package `files`, packlist behavior, and
packed package metadata are the npm artifacts that Tasklet 014 will
consume.

The implementation did not hand-copy package contents or invent a
custom archive format. It also did not pack the entire monorepo. The
remaining Tasklet 014 work is to install these local tarballs into a
local smoke project and verify the fork can generate and use a client.

## Validation Performed

- `git check-ignore -v tmp/lossless-json-tasklet-013` confirmed the
  artifact directory is ignored by git.
- The focused build command above passed for all eight packages.
- `pnpm install --ignore-scripts` refreshed the renamed local workspace
  links and made no tracked file changes.
- The pack command above passed and produced eight tarballs.
- A tarball metadata check read each `package/package.json` with
  `tar -xOf` and verified package name `0.0.0` metadata for all eight
  artifacts.
- The same metadata check verified the `prisma-lossless` bin and the
  `@prisma-lossless/client` peer dependency on `prisma-lossless`.
- `git status --short --untracked-files=all` showed only this tasklet
  plan file as modified after the artifact build and pack.
