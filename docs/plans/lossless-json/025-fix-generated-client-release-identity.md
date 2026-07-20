# Sprint 11

### [DONE] Tasklet 025: Fix Generated Client Release Identity

Branch: `target-7.8.0-lossless`

Status: approved for implementation by the user prompt.

## Goal

Fix the prisma-lossless release, build, and generator pipeline so
generated clients carry the same immutable release identity as the
installed fork packages.

The broken behavior is visible in GWEN after installing immutable
private release `7.8.0-lossless.6`: `prisma-lossless generate`
prints `Generated Prisma Client (v0.0.0)`, warns that the CLI and
client versions do not match, and writes
`node_modules/.prisma/client/package.json` with version `0.0.0` and a
stock `@prisma/client-runtime-utils` dependency.

Release `7.8.0-lossless.6` is immutable and must not be repacked or
mutated. This tasklet must mint the next valid immutable private
version, expected to be `7.8.0-lossless.7`, and record the exact
source provenance plus every private package integrity in the release
identity fixture.

Do not modify `/Users/alex/git/ctosclub/gwe`.

## Required Investigation

Before implementation, inspect build-time version substitutions,
generator metadata, generated package templates, runtime client-version
constants, package-name rewrites, and release packing steps.

The fix must make generation read the version and package namespace
from one authoritative release identity. It must not suppress the
version mismatch warning, post-process generated output in GWEN, or
allow checkout development placeholders to leak into an immutable
private release.

## Investigation Record

The default `prisma-client-js` generator returns its manifest version
from `packages/client-generator-js/package.json`. That package is not
part of the ten-package private release graph and remains at the
workspace development version `0.0.0`.

The same generator passes that placeholder as `clientVersion` into the
generated client builder. The builder writes it into generated
`Prisma.prismaVersion.client` and into
`node_modules/.prisma/client/package.json`.

The generated package template also hard-codes a dependency on stock
`@prisma/client-runtime-utils`. The fork owns a corresponding private
package named `@prisma-lossless/client-runtime-utils`, so generated
dependency metadata must use the fork namespace.

The installed CLI package version is already read from the staged
`prisma-lossless/package.json`, which Tasklet 024 rewrites to
`7.8.0-lossless.6`. That is why the warning compares
`prisma-lossless@7.8.0-lossless.6` to
`@prisma-lossless/client@0.0.0`: the CLI side has the immutable
release identity, while the generator side still has an unrelated
development placeholder.

The built client runtime files also embed `0.0.0` from
`packages/client/package.json` in fallback client-version constants.
Generated clients normally pass the generated version explicitly, but
private release packing must still prevent this placeholder from
leaking into shipped runtime artifacts.

## Pre-Implementation Review

Observed problem: immutable release `7.8.0-lossless.6` installs under
the correct package version, but generated clients report `0.0.0` and
write generated dependency metadata for the stock Prisma namespace.

Violated contract or invariant: an npm package name plus exact version
is the immutable release identity consumed by first-party projects.
Every generated client produced by that release must report the same
fork package name and version, and generated dependencies must use the
fork namespace whenever a corresponding private fork package exists.

Owning layer: the prisma-lossless build, release, generator, and
generated-client packaging layers own generated client identity.
Consumer repositories own only the exact version they install and the
command they run through the ephemeral registry wrapper.

Intended solution: make generator manifest and generated output read
the installed `@prisma-lossless/client` package version instead of the
generator package version. Change generated package metadata to depend
on `@prisma-lossless/client-runtime-utils`. During private release
staging, rewrite built CLI/client artifacts that still contain
package-version placeholders so the packed release cannot ship
`0.0.0` as a runtime fallback. Mint a new immutable private release
after the fix and record its provenance and integrities.

Rejected solution: do not hide the warning, patch GWEN's generated
files, mutate `7.8.0-lossless.6`, or teach consumers to rewrite
generated package metadata after generation.

Validation that proves the fix: focused unit tests must fail against
the current `0.0.0` behavior and pass with the corrected release
identity. A real temporary external consumer must install the new
immutable release through the ephemeral registry using its pinned pnpm,
run `prisma-lossless generate`, and prove generated output, generated
package metadata, runtime `Prisma.prismaVersion.client`, import and
instantiation, LosslessNumber behavior, frozen-lockfile installs from
an empty store, repeated packing integrity, pre-registry rejection
paths, and cleanup behavior.

## Implementation Steps

1. Inspect version and package-name sources used by the CLI, client
   generator, generated package templates, runtime version constants,
   package-name rewrites, and private release packing.
2. Record the confirmed root cause in this tasklet before editing code.
3. Add focused unit tests for generated client release package name,
   version, generated dependency namespace, mismatch handling, and
   release identity edge cases.
4. Patch the owning build, release, or generator path so generated
   clients receive one authoritative fork release identity.
5. Extend the real ephemeral-registry consumer integration test with a
   minimal Prisma schema and generation proof.
6. Mint the next immutable private release version and record exact
   provenance plus all ten private package integrities in the release
   identity fixture.
7. Update `MIGRATION_FROM_PRISMA.md` and canonical wrapper commands to
   use the new immutable version.
8. Run focused release and generation tests, the real integration
   suite, affected package builds, repo-root `pnpm build`, and the
   validation required by the active lossless-json plan.

## Acceptance Criteria

- The generated client version is the new immutable release version,
  not `0.0.0`.
- `prisma-lossless generate` emits no CLI/client version mismatch
  warning for the new release.
- Installed `@prisma-lossless/client`, generated
  `node_modules/.prisma/client/package.json`, and
  `Prisma.prismaVersion.client` all report the new release version.
- Generated dependency metadata uses the `@prisma-lossless/*`
  namespace whenever the fork owns the corresponding package.
- A generated client can be imported and instantiated through
  `@prisma-lossless/client`.
- The existing LosslessNumber runtime proof still passes.
- Frozen-lockfile installation works from an empty pnpm store.
- Repeated packing preserves identical integrity metadata.
- Unavailable-version and mismatched-provenance requests fail before
  Verdaccio starts or the child command executes.
- Registry, release, and temporary-consumer state is cleaned after
  success and failure.
- The tasklet is marked `[DONE]` only after validation passes and the
  completed changes are committed.

## Post-Implementation Review

The implementation keeps generated client identity in the Prisma fork's
generator and release layers. The JavaScript and TypeScript generators
resolve the installed `@prisma-lossless/client/package.json` from the
consumer schema location, then use that installed package version for
generator manifest metadata and generated client output. They no longer
derive release identity from the generator package's workspace
`0.0.0` development placeholder.

Generated package metadata now depends on
`@prisma-lossless/client-runtime-utils` when the fork owns that runtime
package. The fix does not suppress the CLI/client mismatch warning and
does not normalize generated files in GWEN or any other consumer.

Private release staging also rewrites built runtime artifacts that
still contain package-version placeholders before packing. This keeps
runtime fallback constants and bundled generated metadata aligned with
the single immutable private release identity. The release source
verification now includes the client generator packages because they
own generated client identity even though they are not themselves
published in the ten-package private graph.

`7.8.0-lossless.6` remains immutable and is not repacked. It is
recorded as unavailable because it installs with correct package
metadata but generates clients with `0.0.0`. The next usable immutable
private release identity is `7.8.0-lossless.7`.

## Final Release Identity

Final version: `7.8.0-lossless.7`

Provenance commit:
`de26dd06509902ef202e675bb3eb2d2ee9b7fc4a`

| Package                                 | Integrity                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `@prisma-lossless/debug`                | `sha512-CbQwVaNgGD+QMI+nvmbFZZ7+YVVs0jyhLe5sFRm4VU+ZlNMpMjn1dCeCp3FmztemiRAoLjj/MRTQgFM7eRBDtg==` |
| `@prisma-lossless/driver-adapter-utils` | `sha512-LJWEh7v18pR1RUGel8b115bRn1pxkIY1uGOsb2fvcp43/b8+McW2EV6KBDU3NpnjLTxzX6WzqB29vH40TfMdtA==` |
| `@prisma-lossless/get-platform`         | `sha512-k1H+c5eBYZn2m9buHVy5nfa7evMiEc+yRRc8mJZXyg/oBvT8shQfQ32sCBNuzFJMFGgvUXjzjPqzuGsxHxIkhA==` |
| `@prisma-lossless/fetch-engine`         | `sha512-Ep25kydhl1wz4Fu4VN3lPt182yKnyk35k50hGmKzrSsnkG/Z3+LjnQZ8zFTkh3XN6HZPj01yPet3MOTkAcXDMA==` |
| `@prisma-lossless/engines`              | `sha512-1Zz2ky5tbVqaKrg9sQHfbPEvXBFmo0nA8ypV6neBhGM2hdc5Z6lIhH4CCFpd8IaS+hhCju6M/eV7kC+QikIrAQ==` |
| `@prisma-lossless/config`               | `sha512-dFxDUMNdccMLhtDFx0se/Rf7u7YeMGiG9Fm4PVQCgAxvbEHuNyONuXoKTa3ODOyw8WZYnd9PVMSyEDgqVTyFxA==` |
| `@prisma-lossless/client-runtime-utils` | `sha512-pdFPma5Yy/5vGlMFggcxk2/Ps/8LyMqiAMnCo+rUiHJoTXaB1vrCjBgz/gKm9GEvPEqGN4sioHbJn8AVuBZDbw==` |
| `@prisma-lossless/adapter-pg`           | `sha512-maS90+bMuqmAl/xBoJs4AckEJ+zsaI0Cqh4Uq61ATBP6apaG5zso1vYnidtcd/Apr6nN+YNoQ7YUztNQBDC4fQ==` |
| `@prisma-lossless/client`               | `sha512-/0p3P3MKG2rnQYsGym8dEnCBqLi1W0owvtHEpZj/ue17MU9CgCE1Z2BQb3pnr3LzlC9A++sQ3p8D2jScLdC6eg==` |
| `prisma-lossless`                       | `sha512-gqZO9gX2J5rNBp/41xTlc3kiwHcWgQZ1JUCNN4uC5O9b8LWkKruJ6dez41hByJAw2GFW0MY3ByHLJVtTdGVB/Q==` |

## Consumer Invocation

Host install:

```sh
pnpm exec tsx scripts/lossless-private-registry-run.ts \
  --consumer-dir /path/to/consumer \
  --from-built 7.8.0-lossless.7 \
  -- corepack pnpm install --frozen-lockfile
```

Regeneration:

```sh
pnpm exec tsx scripts/lossless-private-registry-run.ts \
  --consumer-dir /path/to/consumer \
  --from-built 7.8.0-lossless.7 \
  -- corepack pnpm exec prisma-lossless generate
```

Docker build:

```sh
pnpm exec tsx scripts/lossless-private-registry-run.ts \
  --consumer-dir /path/to/consumer \
  --from-built 7.8.0-lossless.7 \
  -- \
  docker build \
    --build-arg PRISMA_LOSSLESS_DOCKER_REGISTRY_URL \
    .
```

## Validation Evidence

- `pnpm --filter @prisma/client-generator-js build` passed.
- `pnpm --filter @prisma/client-generator-ts build` passed.
- `pnpm --filter @prisma-lossless/client build` passed.
- `pnpm --filter prisma-lossless build` passed.
- `pnpm exec tsx scripts/lossless-private-release.ts build-pinned
7.8.0-lossless.7
de26dd06509902ef202e675bb3eb2d2ee9b7fc4a
/private/tmp/prisma-lossless-private-release-7` passed outside the
  sandbox after the sandboxed run failed at `tsx` IPC socket creation.
- `pnpm --dir packages/client-generator-js exec vitest run
tests/generator.test.ts --reporter=dot` passed (`8` tests).
- `pnpm exec vitest run scripts/lossless-private-release.test.ts
scripts/lossless-private-registry-run.test.ts
scripts/lossless-private-registry.test.ts --reporter=dot` passed
  (`33` tests).
- `PRISMA_LOSSLESS_RUN_REGISTRY_INTEGRATION=1 pnpm exec vitest run
scripts/lossless-private-registry-run.integration.test.ts
--reporter=dot` passed outside the sandbox (`4` tests). The test
  installed `7.8.0-lossless.7` from an empty pnpm store, proved
  consumer `pnpm v11.1.1` was selected, ran
  `prisma-lossless generate`, observed
  `Generated Prisma Client (v7.8.0-lossless.7)`, observed no
  version-mismatch warning, verified generated package metadata,
  imported and constructed `@prisma-lossless/client`, verified
  `Prisma.prismaVersion.client`, verified `LosslessNumber`, proved
  repeated packing integrity, rejected `.6`, rejected mismatched
  fixture evidence, and checked success and failure cleanup.
- `pnpm exec prettier --check ...` passed for the touched markdown and
  TypeScript files.
- `NODE_OPTIONS=--max-old-space-size=8192 pnpm exec eslint ...`
  passed for the touched TypeScript release files and tests.
- `pnpm build` failed in the sandbox at `tsx` IPC socket creation for
  the generator packages, then passed outside the sandbox (`44`
  successful, `44` total).
- `NODE_OPTIONS=--max-old-space-size=8192 pnpm exec tsc --noEmit
--pretty false` failed with broad repository diagnostics, including
  transient `tmp/lossless-json-tasklet-023-probe/...` staging sources
  and existing fixture type drift. No diagnostic implicated the Tasklet
  025 generated-client identity change.
- `CI=true GITHUB_REF_NAME=target-7.8.0-lossless
TERM=xterm-256color TEST_SKIP_MSSQL=true TEST_SKIP_COCKROACHDB=true
TEST_SKIP_MONGODB=true pnpm test` failed in `@prisma/migrate`
  because the local PostgreSQL database
  `tests-migrate-prisma-config-extensions` already existed and changed
  one snapshot line.
- After dropping only that stale local test database,
  `CI=true GITHUB_REF_NAME=target-7.8.0-lossless
TERM=xterm-256color TEST_SKIP_MSSQL=true TEST_SKIP_COCKROACHDB=true
TEST_SKIP_MONGODB=true pnpm --filter @prisma/migrate test` passed
  (`33` suites, `341` passed tests, `2` skipped tests, `543`
  snapshots).
