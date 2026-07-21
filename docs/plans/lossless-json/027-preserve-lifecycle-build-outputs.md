# Sprint 13

### [DONE] Tasklet 027: Preserve Lifecycle Build Outputs

Branch: `target-7.8.0-lossless`

Status: approved for implementation by the user prompt.

## Goal

Fix the build-output cleanup regression that made
`7.8.0-lossless.9` unsafe for first-party adoption. The release
identity is immutable and must not be repacked in place. The fix must
mint a new immutable release after proving normal installation with
package lifecycle scripts enabled.

Do not modify `/Users/alex/git/ctosclub/gwe` or any IPG checkout.

## Confirmed Root Cause

The engines package builds these outputs in order:

```text
dist/scripts/postinstall.js
dist/scripts/localinstall.js
dist/index.js
```

The shared compile helper cleans each output directory immediately
before the corresponding esbuild invocation. It first cleans
`dist/scripts` and writes both lifecycle bundles. It later treats the
parent `dist` directory as a separate cleanup target and recursively
deletes `dist`, erasing the lifecycle bundles before writing
`dist/index.js`. Type generation leaves only lifecycle `.d.ts` files,
which explains the `@prisma-lossless/engines@7.8.0-lossless.9`
tarball contents.

GWEN proved all ten `.9` lockfile integrities matched the recorded
identity, and `--lockfile-only` succeeded. A normal frozen install
failed because `dist/scripts/postinstall.js` was absent. A diagnostic
install with `--ignore-scripts` passed, and `dist/index.js` loaded
successfully, ruling out general extraction or tarball corruption.

Tasklet 026's integration test used `--ignore-scripts`, so it did not
exercise the lifecycle-script contract required by first-party
consumers that allow Prisma engine lifecycle builds through
`onlyBuiltDependencies`.

## Pre-Implementation Review

Observed problem: `@prisma-lossless/engines@7.8.0-lossless.9`
successfully installs only when lifecycle scripts are disabled. Normal
consumer installation fails because the package's postinstall entry
points to `dist/scripts/postinstall.js`, which the release tarball does
not contain.

Violated contract or invariant: publishable package builds must leave
all generated outputs required by package lifecycle scripts in the
final package tree. A private release that passes lockfile integrity
checks but cannot run its lifecycle scripts is not consumable.

Owning layer: the shared compile helper owns output-directory cleanup
for packages built through `helpers/compile/build.ts`; the
ephemeral-registry integration owns proving the consumer installation
contract with lifecycle scripts enabled.

Intended solution: make cleanup ancestor-aware across the full build
option set before any esbuild output is written. If a later output
directory is an ancestor of an earlier output directory, clean only the
ancestor before the build sequence begins, and record covered
descendants so nested outputs are not removed after being written.
Then update the integration to run a normal frozen install, verify the
engines lifecycle JavaScript files exist, and execute them.

Rejected solution: do not reorder the engines build solely to hide the
helper bug, do not keep using `--ignore-scripts` for the real
external-consumer proof, and do not repair `.9` by changing its
recorded integrity. The cleanup contract belongs in the shared helper,
and `.9` is immutable.

Validation that proves the fix: add focused unit coverage for a
`dist/scripts` output followed by a parent `dist` output, run the
engines build and verify both lifecycle JavaScript outputs remain,
run the real ephemeral-registry integration with lifecycle scripts
enabled, mint the next immutable private release, prove repeated
integrities, update the migration guide and release identity fixtures,
and pass repo-root `pnpm build`.

## Implementation Steps

1. Add a failing unit test for nested generated output directories
   where `dist/scripts` is built before parent `dist`.
2. Change the compile helper to plan cleanup once from all build
   outputs before esbuild writes any file.
3. Build `@prisma-lossless/engines` and verify
   `dist/scripts/postinstall.js` and `dist/scripts/localinstall.js`
   both exist and execute.
4. Update the ephemeral-registry integration to install the recorded
   release with lifecycle scripts enabled and assert the installed
   engines lifecycle JavaScript files exist.
5. Mark `.9` unavailable, mint the next immutable private release,
   update release identities, independent fixtures, docs, and
   canonical consumer commands.
6. Run focused unit tests, the real ephemeral-registry integration,
   fresh-checkout reproducibility proof, affected builds, and
   repo-root `pnpm build`.

## Acceptance Criteria

- The compile helper never deletes a nested generated output after a
  child build has written files into it.
- `@prisma-lossless/engines` build leaves both lifecycle JavaScript outputs in
  `dist/scripts`.
- The external-consumer integration performs a normal frozen install
  with lifecycle scripts enabled.
- The current usable release identity is not `.9`; `.9` is recorded as
  unavailable.
- The replacement release has exact provenance and all ten package
  integrities recorded.
- The migration guide and plan index point consumers to the new
  immutable version.

## Implementation Notes

The shared compile helper now plans cleanup once across the full
output set before any esbuild output is written. Nested generated
output directories are covered by their generated ancestor, so
`dist/scripts` is not deleted after lifecycle bundles have been
written when a later `dist/index.js` output is built.

The owning source fix was committed as:

```text
58e63ae633e5efe0dbb379fbce133e13e637f86a
```

That commit is the source provenance for
`7.8.0-lossless.10`. Release `.9` remains immutable and is recorded as
unavailable because it reproduces byte-for-byte but lacks the engines
lifecycle JavaScript artifacts needed by a normal consumer install.

The ephemeral consumer integration now has two distinct install
proofs. The acceptance proof runs `pnpm install --frozen-lockfile`
from an empty store with lifecycle scripts enabled. A separate
`--ignore-scripts` proof remains for package-resolution coverage only.

During the cold-install proof, pnpm `11.1.1` required explicit
`allowBuilds` entries in the temporary consumer's
`pnpm-workspace.yaml`; `onlyBuiltDependencies` was visible in config
but did not authorize these lifecycle scripts by itself. The migration
guide now documents both entries for pnpm 11 consumers.

## Release Identity

Version:

```text
7.8.0-lossless.10
```

Source provenance:

```text
58e63ae633e5efe0dbb379fbce133e13e637f86a
```

Complete package integrities:

```text
@prisma-lossless/debug
sha512-sfELdxpxNVmOHVnYEw9yqjEgYBcqqc/8+5zVrdiuQUH582AfWSHpk945s3Ah5Eag1oT/phR5XpO/qhnCc9CFhw==

@prisma-lossless/driver-adapter-utils
sha512-b7GKRN7U4tOExz6QpffsjFemIR1/olvXF+4FJG6YgSj86LhgYR7OkdF+7oefjJgFj8x0nCl7fHWJGQ/Sggm/5w==

@prisma-lossless/get-platform
sha512-I/nh/plOnHJbvDvNupUhn6+5mB3KCaYx+4BN+Ua4NeVWdlFNsJg/HUe9Zb1NxQtqiABU54sAVQULRNIJU/Ui/w==

@prisma-lossless/fetch-engine
sha512-H6V4qd31ikPiqcp7fyzf3/vPEKGx/gWNlBeAE6IcPPKxmasHOBZV2/waDOizo4IsV33TyRMkSFIqgrsKAlwBsQ==

@prisma-lossless/engines
sha512-FNl4zmocJ7EbouE31CNcUgaLBJzMy/epqpPHkQ5MY4h4XN9IVLIq1X71l8VSRhu5d8dGqU398/EoFVtVJzEe6A==

@prisma-lossless/config
sha512-BRjh3qWeYGPHDZe2/XZEHlfDsicJjEJMX8FgP9hN0avxkkB1lsr/0VCSp5CqcJj5Yn7KJIpNMTOcwOZtMQze/Q==

@prisma-lossless/client-runtime-utils
sha512-0z9GZSZYsaLnh0xHfafHAkqkV+lnRUSbEEh0GDg2pW81WiWKS1B7HqkMWIgipSRnW6Bi2d3Q8T5t5SBgfsDFig==

@prisma-lossless/adapter-pg
sha512-IvQNcTOAbIc07rspYH5GJXNQppflN5RcjL4m/ijBJBTfKC5sx5ALbO63m7bZLKmMBVy0U/U1raUgrS5RzHV/Rg==

@prisma-lossless/client
sha512-yTQctWGLDhSGuVarvVnAhldPPiLlfFzgYw5R0FNaY/Jd1rjxuX8dUn2K1FI8cqplljgzS2abK8mWD05wr0XBLA==

prisma-lossless
sha512-xdqrTXxfOw4d6jAPmo256NNgin2V3MD/DN2zsJnxVKowiHChoUliVLf7hHqrM2LK3fS2a74RfCMU+6+e44Xkxw==
```

The engines tarball for `.10` contains:

```text
package/dist/scripts/localinstall.js
package/dist/scripts/postinstall.js
package/scripts/postinstall.js
```

Repeated packaging of `.10` from the same built graph produced the
same integrity metadata and matched the independent release fixture.

## Validation Evidence

Focused unit tests:

```sh
pnpm exec vitest run helpers/compile/build.test.ts \
  scripts/lossless-private-release.test.ts \
  scripts/lossless-private-registry-run.test.ts
```

Result: passed, `35` tests across `3` files.

Affected engines build:

```sh
pnpm --filter @prisma-lossless/engines build
```

Result: passed. The build produced
`packages/engines/dist/scripts/postinstall.js` and
`packages/engines/dist/scripts/localinstall.js`.

Focused cold-install integration:

```sh
PRISMA_LOSSLESS_RUN_REGISTRY_INTEGRATION=1 \
  pnpm exec vitest run \
  scripts/lossless-private-registry-run.integration.test.ts \
  -t "installs the recorded release"
```

Result: passed. The temporary consumer used pnpm `11.1.1`, installed
from an empty store with lifecycle scripts enabled, generated Prisma
Client `7.8.0-lossless.10`, imported and instantiated the generated
client, and proved `LosslessNumber` stringification.

Full ephemeral-registry integration:

```sh
PRISMA_LOSSLESS_RUN_REGISTRY_INTEGRATION=1 \
  pnpm exec vitest run \
  scripts/lossless-private-registry-run.integration.test.ts
```

Result: passed, `5` tests passed and the fresh-checkout test was
skipped because `PRISMA_LOSSLESS_RUN_FRESH_CHECKOUT_INTEGRATION` was
not set. The passing cases covered concurrent isolated registries,
normal lifecycle-enabled install, `--ignore-scripts` resolution,
unavailable and mismatched identity rejection before child execution,
and cleanup after child failure.

Fresh-clean-checkout integration:

```sh
PRISMA_LOSSLESS_RUN_REGISTRY_INTEGRATION=1 \
  PRISMA_LOSSLESS_RUN_FRESH_CHECKOUT_INTEGRATION=1 \
  pnpm exec vitest run \
  scripts/lossless-private-registry-run.integration.test.ts \
  -t "reproduces the recorded release from a fresh clean checkout"
```

Result: passed in `236.63s`. The test cloned the committed checkout,
installed prerequisites, ran `pnpm build` in the clone, produced `.10`
twice from clean release roots in separate processes, matched the
independent fixture integrities, installed through the wrapper, ran
generation in the temporary external consumer, and verified both the
generated client version and `LosslessNumber` behavior.

Repo-root build:

```sh
pnpm build
```

Result: passed, `44` tasks successful.

## Post-Implementation Review

The fix remains at the owning build layer. It does not inject
lifecycle files into release staging, reorder only the engines package,
or mutate `.9` package identity. The integration now follows the
consumer product path: an exact version is served through the wrapper,
Corepack resolves from the consumer directory, pnpm installs from an
empty store, lifecycle scripts are allowed by consumer config, and
generation is run from the installed fork.

The rejected unsafe alternatives remain rejected. No consumer lockfile
is weakened to accept a second artifact for `.9`, no registry storage
is made permanent, and no copied wrapper implementation is required in
consumer repositories.
