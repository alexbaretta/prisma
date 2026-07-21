# Sprint 2

### [DONE] Tasklet 012: Rename Npm Packages For Local Fork

## Goal

Rename the forked npm package outputs so local installs cannot conflict
with stock Prisma packages.

## Instructions

Research the package publication graph before editing package metadata.
Identify every package that must be renamed for the local fork to be
installed safely, including generated client dependencies and CLI/client
coupling.

Do not rename packages speculatively. The rename set must be limited to
packages required for local installation and runtime use of the fork.

Update the plan with:

- packages that must be renamed;
- packages that must not be renamed;
- dependency references that must follow the rename;
- generated package metadata that must be updated;
- local install command shape expected by Tasklet 014.

## Pre-Implementation Review

Capture the AGENTS-required review record before editing package
metadata. Include one rejected approach that would conflict with stock
Prisma packages or unnecessarily broaden the package rename.

## Package Graph Research

Packages that must be renamed:

- `packages/cli/package.json`: `prisma` becomes `prisma-lossless`.
  This is the package users install for the CLI and for
  `prisma/config` imports.
- `packages/client/package.json`: `@prisma-lossless/client` becomes
  `@prisma-lossless/client`. This is the package users import from
  application code and the generated client output.

Packages that must not be renamed in this tasklet:

- internal `@prisma/*` packages such as `@prisma-lossless/config`,
  `@prisma-lossless/engines`, `@prisma-lossless/client-runtime-utils`, adapters,
  generators, and runtime support packages;
- private workspace-only packages such as `bundle-size` and
  `@prisma-lossless/type-benchmark-tests`.

Those packages are not direct user install or import contracts for the
local fork. Renaming the whole internal graph would broaden this
tasklet into a fork-wide package namespace migration. Tasklets 013 and
014 may still have to pack or install internal tarballs under their
existing names so the locally installed fork resolves its nested
dependencies without using stock registry artifacts.

Dependency references that must follow the rename:

- `@prisma-lossless/client` workspace dependencies in `packages/cli`,
  `packages/bundle-size`, and `packages/type-benchmark-tests` must use
  `@prisma-lossless/client`;
- the `prisma` workspace dependency in `packages/bundle-size` must use
  `prisma-lossless`;
- the client peer dependency on the CLI must use `prisma-lossless`;
- TypeScript path aliases should include the renamed public package
  names while keeping old aliases for existing internal tests and source
  imports that still model upstream Prisma package names.

Generated package metadata that must be updated:

- generated default runtime imports must resolve
  `@prisma-lossless/client/runtime`;
- generated default output detection must recognize
  `node_modules/@prisma-lossless/client`;
- generated package overwrite guards and forwarding messages must use
  the renamed client package name;
- generated client dependency metadata can keep
  `@prisma-lossless/client-runtime-utils` because that remains an internal
  runtime support dependency, not the public client package.

CLI and runtime references that must follow the rename:

- client resolution must find `@prisma-lossless/client` near the
  `prisma-lossless` CLI package;
- version output and client-version discovery must read
  `@prisma-lossless/client`;
- install hints and bootstrap dependency checks must mention the
  renamed package pair;
- generated config scaffolding must import from
  `prisma-lossless/config`;
- the fallback ungenerated client entrypoint must tell users to run
  `prisma-lossless generate`.

The expected Tasklet 014 local install shape is:

```sh
pnpm add -D <local-tarball-for-prisma-lossless>
pnpm add <local-tarball-for-@prisma-lossless/client>
pnpm exec prisma-lossless generate
```

Tasklet 013 must identify and build any additional internal tarballs
required for those two public package tarballs to install without
falling back to stock Prisma packages from the registry.

## Pre-Implementation Review Record

Observed problem: the fork currently publishes and resolves the same
public package names as stock Prisma: `prisma` and `@prisma-lossless/client`.
Installing it into a local project can overwrite or be overwritten by
stock Prisma packages, and generated code still points at the stock
client import path.

Violated contract or invariant: Sprint 2 requires local fork packages
that can be installed and smoke-tested without conflicting with stock
Prisma package names. Generated client imports, resolver behavior, CLI
messages, and package metadata must all agree on the same public
package names.

Owning layer: package metadata owns the publish/install names; the
client generator owns generated default imports and output detection;
the CLI owns config scaffolding, version reporting, install hints, and
command names.

Intended solution: rename only the public CLI/client package pair to
`prisma-lossless` and `@prisma-lossless/client`, update the direct
workspace dependency references, add build path aliases for the renamed
public names, and update generated client and CLI references that are
needed for local fork installation and runtime use.

Rejected unsafe or wrong-layer solution: do not rename every internal
`@prisma/*` package. That would unnecessarily broaden this tasklet,
break internal source imports, and hide the real install contract under
a fork-wide namespace migration. Also do not leave the package names as
`prisma` and `@prisma-lossless/client`, because that would still conflict with
stock Prisma in the consuming project.

Validation that proves the fix: focused metadata checks must assert the
renamed package names, peer dependency, workspace references, and path
aliases. Focused source checks must assert that generated default
runtime imports, resolver package names, fallback messages, version
lookup, and generated config scaffolding use the renamed public package
names. `git diff --check` must pass. Because this changes package
metadata and generated-code source, focused package builds must pass or
the failure must be recorded with evidence before proceeding.

## Validation

Run focused package metadata checks and `git diff --check`. If package
metadata changes can affect build output, run the relevant build command
identified by the package graph research.

## Post-Implementation Review

The implementation renamed the public package pair to
`prisma-lossless` and `@prisma-lossless/client`, updated direct
workspace dependency references and the lockfile, and kept internal
`@prisma/*` packages under their upstream names. This matches the
approved package graph boundary and avoids a fork-wide internal package
namespace migration.

The generated client default runtime import now derives from the client
package metadata and resolves `@prisma-lossless/client/runtime`.
Generator tests were updated so the default output is
`node_modules/@prisma-lossless/client` while generated code is still
forwarded to `node_modules/.prisma/client`.

The CLI now exposes the `prisma-lossless` bin, discovers the renamed
client package for version reporting, emits install hints for the
renamed package pair, and generates config files importing
`prisma-lossless/config`. Bootstrap tests were updated to verify the
renamed dependency gate and install instructions.

The rejected all-internal-package rename remains rejected. Internal
support packages such as `@prisma-lossless/config`, `@prisma-lossless/engines`, and
`@prisma-lossless/client-runtime-utils` remain intentionally unrenamed. Tasklet
013 must pack the internal tarballs needed by local installation so
Tasklet 014 does not resolve stock registry artifacts for those nested
dependencies.

## Validation Performed

- `pnpm install --lockfile-only --ignore-scripts` updated
  `pnpm-lock.yaml` for the renamed workspace importers.
- Focused metadata assertions passed for package names, CLI bin,
  client peer dependency, workspace dependency references, TypeScript
  path aliases, and the renamed generator fixture package metadata.
- Focused stale-name search returned no public stock package matches
  for `@prisma-lossless/client`, `node_modules/@prisma-lossless/client`,
  `resolvePkg('prisma')`, `resolvePkg('@prisma-lossless/client')`,
  `prisma generate`, `prisma bootstrap`, `prisma@`, `npx prisma`, or
  `.bin/prisma` in the changed generator, CLI, and client script
  surfaces.
- `pnpm --filter prisma-lossless test
src/bootstrap/__tests__/Bootstrap.vitest.ts
src/bootstrap/__tests__/project-state.vitest.ts` passed.
- `pnpm --filter @prisma-lossless/client-generator-js test` passed.
- `pnpm --filter @prisma-lossless/client-generator-js build` passed.
- `pnpm --filter prisma-lossless build` passed.
- `pnpm --filter @prisma-lossless/client build` passed.
- `git diff --check` passed.
