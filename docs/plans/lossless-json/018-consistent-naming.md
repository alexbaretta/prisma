# Sprint 4

### [DONE] Tasklet 018: Publish Consistently Named Private Release

## Goal

Publish a superseding private release whose consumer-facing package
names use the lossless nomenclature consistently. First-party
consumers must depend on `@prisma-lossless/adapter-pg`, not
`@prisma/adapter-pg`.

## Instructions

Update the private release graph so every fork artifact that the graph
publishes under an npm scope is published under `@prisma-lossless/*`.
The direct consumer package set must be:

- `prisma-lossless`;
- `@prisma-lossless/client`;
- `@prisma-lossless/adapter-pg`.

Do not publish any new fork artifact under `@prisma/*`.

Built source may continue to import internal Prisma module specifiers
where those imports are upstream implementation details. If a built
package still imports an internal `@prisma/*` package, the published
package metadata must use an npm alias dependency that resolves the
old install path to the matching `@prisma-lossless/*` artifact. This
keeps runtime resolution correct while ensuring the fetched artifact is
the fork.

The isolated consumer must import the PostgreSQL adapter from
`@prisma-lossless/adapter-pg` and must not mention
`@prisma/adapter-pg` in its package manifest or source.

Add or update tests for:

- release graph names;
- dependency alias rewriting for renamed internal packages;
- adapter package metadata;
- rejected unsafe alias specifiers.

Rebuild, publish, inspect, install, generate, typecheck, and smoke test
the superseding private release. Record the exact version, registry
metadata, lockfile evidence, and validation commands here.

## Pre-Implementation Review Record

Observed problem: the validated `7.8.0-lossless.3` external consumer
still had to depend directly on `@prisma/adapter-pg`. That name is a
stock Prisma package name and conflicts with the fork naming contract
the CLI and client already use.

Violated contract or invariant: first-party consumers must adapt to
the fork's lossless nomenclature instead of relying on registry
configuration to make stock package names resolve to fork artifacts.
Consumer manifests and imports should not use `@prisma/adapter-pg`
for the forked PostgreSQL adapter.

Owning layer: private release graph tooling owns the published package
names and dependency metadata. The isolated consumer owns proving the
new names are the externally adopted product path. Public generated
guidance, CLI output, and package README content own teaching that
path to downstream users.

Intended solution: publish the PostgreSQL adapter as
`@prisma-lossless/adapter-pg` and publish scoped internal release
artifacts as `@prisma-lossless/*`. For built code that still imports
an upstream internal specifier such as
`@prisma/driver-adapter-utils`, write an npm alias dependency from the
old install path to the matching lossless package and exact immutable
version. Update consumer-facing examples so they import the adapter
from `@prisma-lossless/adapter-pg`.

Rejected unsafe or wrong-layer solution: do not keep requiring
consumer manifests to mention `@prisma/adapter-pg`; do not rely on the
public registry or stock adapter package; do not rewrite broad
upstream source imports as a distribution-only fix; and do not publish
new fork artifacts under `@prisma/*` merely to satisfy existing import
paths.

Validation that proves the fix: the release manifest and registry
metadata must show `@prisma-lossless/adapter-pg`. The isolated npm
consumer must install exact lossless package names, import
`PrismaPg` from `@prisma-lossless/adapter-pg`, generate, typecheck,
and pass the PostgreSQL lossless JSON smoke suite. Its direct
dependencies and source must not mention `@prisma/adapter-pg`.

## Validation Evidence

Post-implementation review: the release graph now separates the
source package name from the published package name. This keeps the
workspace source package layout compatible with upstream Prisma while
publishing all scoped fork artifacts under `@prisma-lossless/*`.
Built source imports that still use internal upstream specifiers are
not exposed to the consumer as stock artifacts; their package metadata
uses exact npm alias dependencies that resolve to matching
`@prisma-lossless/*` tarballs. Public README, CLI output, generated
client comments, and constructor errors now teach
`@prisma-lossless/adapter-pg`.

Rejected after implementation: renaming `packages/adapter-pg` source
metadata directly would have broken existing workspace links and tests
without improving the external package contract. Publishing a forked
artifact as `@prisma/adapter-pg` was also rejected; the private
registry now returns `E404` for `@prisma/adapter-pg@7.8.0-lossless.4`.

Published release:

- Registry: `http://127.0.0.1:4873/`.
- Version: `7.8.0-lossless.4`.
- Run directory:
  `tmp/lossless-json-tasklet-016/runs/1784338687876-49664fc694e4`.
- Direct consumer packages:
  `prisma-lossless@7.8.0-lossless.4`,
  `@prisma-lossless/client@7.8.0-lossless.4`, and
  `@prisma-lossless/adapter-pg@7.8.0-lossless.4`.

Registry metadata inspection:

- `npm view @prisma-lossless/adapter-pg@7.8.0-lossless.4 ...`
  returned name `@prisma-lossless/adapter-pg`, version
  `7.8.0-lossless.4`, and a local registry tarball URL.
- `npm view @prisma-lossless/client@7.8.0-lossless.4 ...`
  returned name `@prisma-lossless/client`, version
  `7.8.0-lossless.4`, and a local registry tarball URL.
- `npm view prisma-lossless@7.8.0-lossless.4 ...` returned name
  `prisma-lossless`, version `7.8.0-lossless.4`, and a local registry
  tarball URL.
- `npm view @prisma/adapter-pg@7.8.0-lossless.4 --registry
http://127.0.0.1:4873/` failed with `E404`.

Tarball metadata inspection:

- `@prisma-lossless/adapter-pg` package metadata has dependency
  `"@prisma/driver-adapter-utils":
"npm:@prisma-lossless/driver-adapter-utils@7.8.0-lossless.4"`.
- `@prisma-lossless/client` package metadata has dependency
  `"@prisma/client-runtime-utils":
"npm:@prisma-lossless/client-runtime-utils@7.8.0-lossless.4"`.
- `prisma-lossless` package metadata has dependencies
  `"@prisma/config": "npm:@prisma-lossless/config@7.8.0-lossless.4"`
  and
  `"@prisma/engines": "npm:@prisma-lossless/engines@7.8.0-lossless.4"`.

Isolated consumer:

- Path:
  `tmp/lossless-json-tasklet-018/consumer-7.8.0-lossless.4`.
- Root dependencies are `@prisma-lossless/adapter-pg`,
  `@prisma-lossless/client`, `prisma-lossless`, and `typescript`.
- `rg -n "@prisma/adapter-pg" package.json src package-lock.json`
  returned no matches.
- Lockfile contains `node_modules/@prisma-lossless/adapter-pg`
  resolved from the local registry.
- Lockfile contains `node_modules/@prisma/driver-adapter-utils` with
  package name `@prisma-lossless/driver-adapter-utils`, proving the
  internal npm alias resolves to the lossless tarball.

Validation commands:

- `pnpm exec prettier --write ...` passed for touched files.
- `pnpm exec vitest run scripts/lossless-private-release.test.ts
--reporter=dot` passed: 1 file, 5 tests.
- `pnpm --filter @prisma-lossless/client exec jest
src/__tests__/validatePrismaClientOptions.test.ts --runInBand`
  passed: 18 tests, 12 snapshots.
- `pnpm exec eslint ...` completed with existing warnings only in
  client runtime files.
- `pnpm --filter ... build` passed for the private release graph.
- `pnpm exec vitest run scripts/lossless-private-release.test.ts
scripts/lossless-private-registry.test.ts --reporter=dot` passed:
  2 files, 11 tests.
- In the isolated consumer, `npm install` passed from the private
  registry.
- In the isolated consumer, `npm exec -- prisma-lossless generate`
  passed. It printed the known local generated-client version warning.
- In the isolated consumer, `npm exec -- tsc -p tsconfig.json` passed.
- In the isolated consumer, `npm run smoke` passed against local
  PostgreSQL and verified lossless model reads, lossless writes, raw
  JSON reads, and raw JSON text casts.
- `pnpm build` first failed in the sandbox with `tsx` IPC
  `listen EPERM`, then passed when rerun with escalation: 44 tasks.
- Root `pnpm test` was run with
  `TEST_SKIP_MSSQL=true TEST_SKIP_COCKROACHDB=true`. It failed only in
  `packages/migrate` due four PostgreSQL setup hook timeouts. The
  rerun
  `pnpm --filter @prisma/migrate test` passed all migrate tests:
  33 suites, 352 passed, 2 skipped.
