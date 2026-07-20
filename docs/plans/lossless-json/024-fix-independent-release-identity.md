# Sprint 10

### [DONE] Tasklet 024: Fix Independent Release Identity

Branch: `target-7.8.0-lossless`

Status: approved for implementation by the user prompt.

## Goal

Repair `--from-built` so a consumer with an independently pinned
lockfile cannot receive changed package bytes for an existing
prisma-lossless release version.

The completed result must produce a new commit after
`3f4aa0a9b`. It must not modify `/Users/alex/git/ctosclub/gwe`.

## Investigation Record

GWEN's committed lockfile and preflight script agree that
`@prisma-lossless/client@7.8.0-lossless.5` has integrity
`sha512-UihOGAfSMX6aI3RNROnr05dGEUkG1PsVVLh2YOtKJ7wTNEe1rVfuv2/sDdV+6BjARp9DTHfpmpPzGa+hGXy51w==`.

The Tasklet 023 release identity records
`sha512-bYNBaEInTymBhOp0CI4vtkmqjE/Wibo7vI8sajeS3Akk141+E/CkK7CgNAVgYAtGqV3yJS9tfqzIFfo29lYnOQ==`
for that same package name and version.

All other private packages in GWEN's lockfile currently match the
Tasklet 023 identity:

| Package                                 | GWEN `.5` integrity                                                                               |
| --------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `@prisma-lossless/debug`                | `sha512-f8g63A0ARkt2+GCgRpiA09mxDgXjzU/EATxcA0ebSQOtDbhReQDri7n7m6b3u8XZfugxZYt4ZE5W32wAg2pANQ==` |
| `@prisma-lossless/driver-adapter-utils` | `sha512-Ow22QHvHic7XNSozhTgreG6/KO5ZT4PO5NjOyxQP9Es/dgbeU9QXrPWFHJgCgn1FMv1zkISBZQqU+Iw01o4XAQ==` |
| `@prisma-lossless/get-platform`         | `sha512-toOrsnC4yoSJW6C+n2uKhdKj3yW7ZMX5e6WhJ4TBKD2Cp8/xOyB2qJ3vdrZbSV4T4oSzWMK/2dyeeHR1VmFgZg==` |
| `@prisma-lossless/fetch-engine`         | `sha512-WVBGYupq9SSoNfzeoMU0tlERfiMvgLMRH/KazW9Jbkz3GzaNxiXGWfK2n1/a+nlBb5UoarmwlnAeslVvkcxWvg==` |
| `@prisma-lossless/engines`              | `sha512-4odujRKCFlmBSxyGadjOBLhTcfhUPStW3CYlZ8iQRzGR0l851aZoGbrGu05Cd6eX2BrWqBcMNZv8azb+Bw5CKg==` |
| `@prisma-lossless/config`               | `sha512-0CvTZ2Z0a3EO0N6RTTgbZPkDFHdqizqzLe4pgyTguv4VlIIkqle8QN2qE4nBFEmGwKbLjdBGmCs70yFikwByZQ==` |
| `@prisma-lossless/client-runtime-utils` | `sha512-foVxxmGM2AiA6+HWuEd+qktk0e0bz2srWbeI/YFr0zoZ9dlMOJgMDNEY/tPz8kaKEYX2E7mJ1XOTSKeG/FB2rA==` |
| `@prisma-lossless/adapter-pg`           | `sha512-eUjSlk+HmsRVDTpYfP8K/cbxbr2YQtiDpwkvbkCq637itkl8RSSlbKmkJAl+8/XN3tHjBQtKXYymlQj3Mqt09g==` |
| `@prisma-lossless/client`               | `sha512-UihOGAfSMX6aI3RNROnr05dGEUkG1PsVVLh2YOtKJ7wTNEe1rVfuv2/sDdV+6BjARp9DTHfpmpPzGa+hGXy51w==` |
| `prisma-lossless`                       | `sha512-fj66iWLeEPNJv86rgPP6gNn7JAGMxStypHohKz7mU5ujhF5ZxsJA34VJr2MJf4ovfRV5nkboqRJM8+GIIGhmAA==` |

The package-source diff from provenance commit
`f98f2e0f42cd7d9d9556567f9236c98eed00da16` to `HEAD` is empty for the
ten release package source directories. The current built tree still
packs a different client tarball for `.5`, which means the historical
`.5` client bytes are not reproducible by the current `--from-built`
path. The adapter and CLI appear unchanged because their tarball bytes
still match GWEN's lockfile; the client package is the only verified
mismatch after checking all ten private package resolutions.

The existing clean-consumer integration test is a circular oracle. It
creates the temporary lockfile through `runWithBuiltRelease()` and then
uses that same generated lockfile for the frozen install. That proves
the current identity agrees with itself, but it does not prove
compatibility with an independently committed consumer lockfile.

During the Tasklet 024 integration run, `.6` packaging produced a
different `@prisma-lossless/debug` tarball integrity than the earlier
repeat packaging probe. That shows the current staging and `pnpm pack`
path is not a sufficient immutable byte producer. The release layer
must normalize package staging before packing, then mint `.6` from the
deterministic output.

The root cause is two-part. `pnpm pack` implicitly includes the
nearest license file, so packages staged under the repo contained the
root `LICENSE` while packages staged under `/private/tmp` did not.
After making the license explicit, the CLI package still differed
because `npm-packlist` applies Git ignore rules when staging is inside
the checkout and omitted `dist/cli/src/config.d.ts`. Release staging
must therefore live outside the checkout, and the release tooling must
reject checkout-contained output roots.

## Pre-Implementation Review

Observed problem: `--from-built 7.8.0-lossless.5` serves a client
tarball whose integrity differs from GWEN's immutable lockfile. A
clean install fails with `ERR_PNPM_TARBALL_INTEGRITY`; a prior apparent
success was a pnpm cache hit.

Violated contract: npm package name plus version is an immutable byte
identity. Existing versions must reproduce the exact package bytes
known to consumers or fail before Verdaccio starts and before any
consumer command runs.

Owning layer: the prisma-lossless release identity and ephemeral
registry tooling own release availability, provenance, package graph
integrity, and consumer install setup. Consumer repositories own only
their dependency versions and lockfiles.

Intended solution: record `.5` as a historical unavailable release
whose independent expected integrities are known but whose current
packaging path cannot reproduce the original client bytes. Make
`--from-built 7.8.0-lossless.5` reject with an actionable message
before any registry starts. Mint `7.8.0-lossless.6` for the current
reproducible built graph, record one provenance commit and every
package integrity, and update the migration guide to use `.6`.

Rejected solution: do not relabel
`sha512-bYNBaEInTymBhOp0CI4vtkmqjE/Wibo7vI8sajeS3Akk141+E/CkK7CgNAVgYAtGqV3yJS9tfqzIFfo29lYnOQ==`
as a valid `.5` client artifact. Do not change GWEN's lockfile, rely
on pnpm cache hits, generate expected test integrities from the same
identity used by the publisher, or make consumers manage release
manifests, tarballs, copied wrappers, or permanent registry config.

Validation that proves the fix: unit tests must cover argument
parsing, consumer working-directory validation, immutable release
identity, unavailable historical versions, mismatched and incomplete
built graphs, child exit propagation, signals, and cleanup. The real
temporary-consumer integration test must use an independent fixture,
an empty pnpm store, and a frozen lockfile containing all exact private
package integrities. It must prove all private tarballs are downloaded
through dynamic Verdaccio, Corepack selects the consumer pnpm version,
the installed client exposes `LosslessNumber`, repeated packaging
keeps identical integrity metadata, tooling-only changes cannot mutate
existing release bytes, changed built graphs cannot publish under an
existing version, and success and failure paths remove registry and
release roots.

Observed subproblem: package staging copies can yield different
tarball bytes for the same version and source graph.

Violated contract: a recorded release identity must be reproducible by
the build/release layer. File timestamps or other staging metadata
must not affect immutable package bytes.

Owning layer: `scripts/lossless-private-release.ts` owns staging and
packing release candidates before the ephemeral registry can publish
them.

Intended solution: normalize staged file and directory mtimes before
running `pnpm pack`, explicitly copy the root `LICENSE`, use an
external transient release root, and reject release output roots inside
the checkout. Recompute the `.6` identity from that deterministic
output.

Rejected solution: do not update `.6` test fixtures to whichever
tarball bytes a single run happens to emit, and do not push this
problem into consumer lockfile updates.

Validation that proves the subproblem fix: repeated `.6` packaging in
unit or integration coverage must produce identical package
integrities, and the independent fixture must match the actual
manifest before registry startup.

## Implementation Steps

1. Add an independent immutable release fixture for the ten `.5`
   package integrities from GWEN's lockfile and the ten `.6`
   package integrities minted by this tasklet.
2. Change release identities so `.5` is recorded as unavailable and
   `.6` is the reproducible current release identity.
3. Make `--from-built` reject unavailable historical versions before
   preparing a release or starting Verdaccio.
4. Strengthen unit tests for immutable identity, unavailable versions,
   graph mismatch, argument parsing, consumer cwd, child exit, signals,
   and cleanup.
5. Strengthen the integration test so its expectation comes from the
   independent fixture and its frozen install uses an empty pnpm store
   and empty modules directory.
6. Update `MIGRATION_FROM_PRISMA.md` with `.6`, corrected host
   install, Docker build, and regeneration invocations.
7. Run focused unit tests, integration tests, lint, typechecking,
   `pnpm build`, and the active-plan validation that is feasible in
   this local environment.

## Acceptance Criteria

- `--from-built 7.8.0-lossless.5` rejects before Verdaccio starts.
- `--from-built 7.8.0-lossless.6` serves only the recorded package
  bytes for the complete ten-package private graph.
- Tests use an independent immutable fixture rather than the serving
  identity as their expectation.
- A frozen temporary consumer install downloads every private tarball
  from an empty pnpm store through the ephemeral registry.
- The temporary consumer uses its pinned Corepack pnpm version.
- The installed client exposes `LosslessNumber` and preserves its
  numeric token.
- Registry roots and transient release roots are removed after tested
  success and failure paths.
- The migration guide gives consumers durable commands that require no
  permanent registry configuration, tarballs, release manifests,
  registry storage, or copied wrapper implementation.
- The tasklet is marked `[DONE]` only after validation passes and the
  completed changes are committed.

## Post-Implementation Review

The implementation keeps release identity ownership in the
prisma-lossless release layer. It does not push manifests, tarballs,
registry configuration, or wrapper copies into consumer repositories.
`7.8.0-lossless.5` is preserved as historical evidence but is marked
unavailable because the current built graph cannot reproduce the
original GWEN-pinned client tarball. `--from-built
7.8.0-lossless.5` now rejects before release preparation, Verdaccio
startup, and child execution.

The current release graph is `7.8.0-lossless.6`, with provenance
commit `f98f2e0f42cd7d9d9556567f9236c98eed00da16`. Its package
integrities are recorded in both the production identity table and an
independent test fixture. The tests compare those two sources instead
of deriving expectations from the publisher input being served.

Release packing now uses an external transient root, explicitly copies
the root `LICENSE`, normalizes staged mtimes, and rejects output roots
inside the prisma checkout. This keeps npm packlist behavior out of
the checkout's Git ignore state and prevents a tooling-only checkout
change from mutating existing release bytes.

The wrapper still starts an ephemeral Verdaccio registry only after
identity availability and package-graph checks pass. Child commands
run from the validated consumer directory, so Corepack resolves the
consumer's `packageManager` field and Docker build contexts are
consumer-relative.

## Final Release Identity

Final version: `7.8.0-lossless.6`

Provenance commit:
`f98f2e0f42cd7d9d9556567f9236c98eed00da16`

| Package                                 | Integrity                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `@prisma-lossless/debug`                | `sha512-vnOk4JguCs8zTwkESpJHcAr8+wfwPVxmL/nsUBHFFSrlVF0FFUBX3AXvqlEdO8SGNsIa+mhF1vvuEpYYKU6Fmg==` |
| `@prisma-lossless/driver-adapter-utils` | `sha512-TnSHKUXAb9PRZxHjgBwr5ZXkuKpNZlkhMfltUD4cbngiMEWFKlo13KBPrGEWFciKOosviRS9uAAVdC9Gzo8Seg==` |
| `@prisma-lossless/get-platform`         | `sha512-a9N2yUHDIiHA92YmQjVbiRxcqmnE2EdO3+/2ygmznRKawCgUIHYNYFNCLw3mbalhy/s9SreIZMf2lyDRBKE6Zw==` |
| `@prisma-lossless/fetch-engine`         | `sha512-AXLJMoUJx30K0daMiW928NS9YGH2KWiL2fyUd+f8tE82r6yzW5KPBb3BDPpqWv3ww4DyQK8Hm8pYhdT9pirBAA==` |
| `@prisma-lossless/engines`              | `sha512-Vlo2R8L42kt5IPhiIlrTX3DESpmHlkS3YGDK1UhcVZ2vbMsUfp7Ym0GO604ffvFgPTD4ebe9d6JvqYtpaJrfFw==` |
| `@prisma-lossless/config`               | `sha512-rtXgteUdVx998rJNZnzf00zBJiccASqzasMyGTUYU0W+iCNFwaGI7c/DfBGz11LMK7xtbefQD42DpBAF1tTW2g==` |
| `@prisma-lossless/client-runtime-utils` | `sha512-8p+OF0JH7O/8mLdSWybQ4EWgR6L0k/wkgIMO4gyfQaGMDVX3pPlCOqfeKUNfZA/DZaOz9xlntCHf4O3XxOEaKg==` |
| `@prisma-lossless/adapter-pg`           | `sha512-GWYnZnTl5QnVh91oecYc/HGthy2Pb0cwLhPpZ6pLHKNArQCAXdfViGjgI/T9YjPV5PgQi8jj8k8YaA7GH5HLTA==` |
| `@prisma-lossless/client`               | `sha512-NEqO6v44KtU8aWf6qKGsZliWGf4kaHtK8+BCLKHqQjCjcuUS8GIYNJOBi7eiKzLxqJkyNRCEkHBowuxCca3QFQ==` |
| `prisma-lossless`                       | `sha512-3cxuvBiqwiMlLHXYIem/opHW3qb+DXtJNPCPyA+ohjlMzF1q59BybfImQt/wgUw6w1lgK6i5W8PZ42coIB3H/g==` |

## Consumer Invocation

Host install:

```sh
pnpm exec tsx scripts/lossless-private-registry-run.ts \
  --consumer-dir /path/to/consumer \
  --from-built 7.8.0-lossless.6 \
  -- corepack pnpm install --frozen-lockfile
```

Docker build:

```sh
pnpm exec tsx scripts/lossless-private-registry-run.ts \
  --consumer-dir /path/to/consumer \
  --from-built 7.8.0-lossless.6 \
  -- \
  docker build \
    --build-arg PRISMA_LOSSLESS_DOCKER_REGISTRY_URL \
    .
```

GWEN must update its direct prisma-lossless dependencies from `.5` to
`.6` and regenerate its lockfile through the wrapper before its frozen
install can succeed. This tasklet did not modify
`/Users/alex/git/ctosclub/gwe`.

## Validation Evidence

- `pnpm exec prettier --check scripts/lossless-private-release.ts
scripts/lossless-private-registry-run.ts
scripts/lossless-private-release-identities.ts
scripts/lossless-private-release-fixtures.ts
scripts/lossless-private-release.test.ts
scripts/lossless-private-registry-run.test.ts
scripts/lossless-private-registry-run.integration.test.ts
MIGRATION_FROM_PRISMA.md
docs/plans/lossless-json/000-lossless-json-index.md
docs/plans/lossless-json/024-fix-independent-release-identity.md`
  passed.
- `NODE_OPTIONS=--max-old-space-size=8192 pnpm exec eslint
scripts/lossless-private-release.ts
scripts/lossless-private-release-identities.ts
scripts/lossless-private-release-fixtures.ts
scripts/lossless-private-registry-run.ts
scripts/lossless-private-registry-run.test.ts
scripts/lossless-private-release.test.ts
scripts/lossless-private-registry-run.integration.test.ts`
  passed.
- `pnpm exec vitest run scripts/lossless-private-release.test.ts
scripts/lossless-private-registry-run.test.ts
scripts/lossless-private-registry.test.ts` passed (`3` files,
  `32` tests).
- `PRISMA_LOSSLESS_RUN_REGISTRY_INTEGRATION=1 pnpm exec vitest run
scripts/lossless-private-registry-run.integration.test.ts` passed
  outside the sandbox (`4` tests). The sandboxed run cannot bind the
  required loopback registry port.
- `NODE_OPTIONS=--max-old-space-size=8192 pnpm exec tsc --noEmit
--pretty false` aborted with a V8 heap out-of-memory failure before
  reporting TypeScript diagnostics. `pnpm build` is the repo's
  authoritative build/type gate for this tasklet.
- `pnpm build` passed (`44` successful, `44` total).
- Root `pnpm test` was run outside the sandbox with
  `CI=true GITHUB_REF_NAME=target-7.8.0-lossless
TERM=xterm-256color TEST_SKIP_MSSQL=true
TEST_SKIP_COCKROACHDB=true TEST_SKIP_MONGODB=true`. It passed
  migrate, client, and integration packages but exited nonzero in the
  final CLI package because three CLI Jest tests exceeded their
  5 second timeout under full-suite load.
- The timed-out CLI tests were rerun in isolation with
  `pnpm --dir packages/cli exec dotenv -e ../../.db.env -- jest
--silent src/__tests__/commands/Version.test.ts
src/__tests__/config.test.ts --runInBand` and passed (`2` suites,
  `35` tests).
- Transient repo-local and `/private/tmp` tasklet probe roots were
  removed. Integration coverage also asserts success and failure
  cleanup for registry and release roots.
