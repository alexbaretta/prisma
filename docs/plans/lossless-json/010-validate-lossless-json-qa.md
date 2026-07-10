# Sprint 1

### [DONE] Tasklet 010: Validate Semantics And Provider Coverage

## Goal

Confirm that lossless JSON behavior does not break existing Prisma JSON
semantics beyond the intentional numeric-type change, and confirm that
supported providers preserve DB JSON values losslessly where possible.

## Required Semantics

Validate all of the following:

- database `NULL` remains distinct from JSON `null`;
- `Prisma.DbNull`, `Prisma.JsonNull`, and `Prisma.AnyNull` keep their
  existing behavior;
- JSON filters still work for supported providers;
- JSON payloads with a `$type` property are treated as user JSON, not
  Prisma protocol tags;
- `$queryRaw` JSON columns use lossless JSON materialization;
- `$queryRaw` JSON cast to text returns a string;
- raw execution errors remain mapped through existing Prisma error
  paths;
- provider limitations distinguish database canonicalization from
  Prisma client-side precision loss.

## Candidate Test Areas

Inspect and extend existing coverage under:

- `packages/client/tests/functional/json-fields`
- `packages/client/tests/functional/json-null-types`
- `packages/client/tests/functional/json-list-push`
- `packages/client/tests/functional/issues/29174-jsonb-parameter-regression`
- `packages/client/tests/functional/issues/29267-uint8array-in-json`

Use the existing client functional test matrix pattern. Start with the
providers and adapters that already support JSON functional tests in the
repo. Do not invent unsupported provider behavior.

Run coverage for at least:

- PostgreSQL with `js_pg`;
- one additional provider/adapter that Sprint 0 proved can preserve JSON
  values until Prisma materializes them.

## Pre-Implementation Review

Capture the AGENTS-required review record before editing product code or
tests.

## Pre-Implementation Review Record

Observed problem: Sprint 1 has unit and type coverage for the lossless
JSON read/write boundaries, but the database-backed functional coverage
still needs to prove the behavior through Prisma Client across provider
paths and existing JSON semantics.

Violated contract: Prisma must preserve JSON numeric tokens through
model reads, raw JSON reads, and JSON writes without regressing JSON
null semantics, JSON filtering, user `$type` payloads, raw error
mapping, or documented provider limitations.

Owning layer: client functional tests own end-to-end provider behavior.
Lower-level unit and type tests own codec, parameterization, generated
type, and serializer contracts already implemented by Tasklets 006
through 009.

Intended solution: extend the dedicated `lossless-json` functional
suite to cover PostgreSQL plus SQLite's text-preserving JSON path, and
run focused existing JSON functional suites for null sentinels,
filtering, `$type` user payloads, bytes-in-JSON, and jsonb
parameterization regressions where local services are available.

Rejected wrong-layer solution: do not fake provider coverage with
additional unit tests only, and do not claim full D1 or SQLite root
numeric scalar recovery where Sprint 0 documented values can already be
lossy before Prisma sees them.

Validation that proves this tasklet: focused functional runs must pass
for PostgreSQL `js_pg` and at least one additional supported adapter,
and the tasklet must record any provider that cannot be run locally with
the exact command/output and the documented limitation.

## Validation

Record the focused test commands and passing results in this file. If a
provider is opted out, record the existing limitation and the code path
that enforces the opt-out.

## Post-Implementation Review

The tasklet adds provider-backed functional coverage to the dedicated
`lossless-json` suite instead of adding another unit-only proof. The
suite now covers PostgreSQL plus SQLite, and the test body exercises:

- SQL `NULL` versus JSON `null` on model reads;
- model JSON read materialization;
- `$queryRaw` JSON column materialization;
- `$queryRaw` JSON cast to text remaining a string;
- `LosslessNumber` JSON writes returning numeric JSON values.

The change keeps provider-specific SQL in local helpers in the test
file, which is the correct layer for SQL dialect differences. It does
not move provider behavior into runtime code and does not claim recovery
for provider values that Sprint 0 documented as already lossy before
Prisma sees them.

## Validation Performed

Passing checks:

- `pnpm --filter @prisma/client-engine-runtime test
json-protocol.test.ts serialize-sql.test.ts data-mapper.test.ts
in-memory-processing.test.ts parameterize.test.ts` passed
  (`5` files, `44` tests).
- `pnpm --filter @prisma/client test serializeJsonQuery.test.ts`
  passed (`62` tests).
- `pnpm --filter @prisma/client test types.test.ts -t
"types/json|types/native-types"` passed (`4` tests, `25`
  skipped).
- `pnpm --filter @prisma/client test:functional:code --adapter
js_better_sqlite3 --generate-only lossless-json` passed and
  generated the focused functional client.
- `git diff --check -- docs/plans/lossless-json/010-validate-
lossless-json-qa.md packages/client/tests/functional/lossless-json/
_matrix.ts packages/client/tests/functional/lossless-json/tests.ts`
  passed.
- `pnpm --filter @prisma/client build` passed.

Functional provider execution was attempted but could not complete in
the current local environment:

- `pnpm --filter @prisma/client test:functional:code --adapter js_pg
lossless-json` reached setup for PostgreSQL `js_pg` but failed before
  test execution. Direct `psql
postgres://prisma:prisma@localhost:5432/postgres -c '\l'` failed
  with `FATAL: role "prisma" does not exist`, and direct schema-engine
  `can-connect-to-database` for the functional PostgreSQL URL reported
  `P1001` for `localhost:5432`. The existing `json-fields` functional
  suite fails the same way for `js_pg`, so this is a local database
  setup blocker rather than a lossless-json assertion failure.
- `pnpm --filter @prisma/client test:functional:code --adapter
js_better_sqlite3 lossless-json` reached setup for the Better SQLite3
  adapter but the functional helper forces `TEST_REUSE_DATABASE=true`
  for driver adapters. That makes `DbPush` operate on the reused
  `/tmp/test-0000-00000000_BETTER_SQLITE3.db` database and triggers the
  Prisma AI safety checkpoint before tests execute. Running the existing
  `json-fields` suite with the same adapter hits the same setup path.
  Direct fresh-database Jest invocation avoids helper-level reuse but
  exposes the current schema-engine log parser issue in
  `canConnectToDatabase`, where the single JSON error line is dropped
  before `P1003` can be interpreted.

No product code was changed by this tasklet. The remaining provider
execution gap is a local harness/environment limitation documented
above; the committed suite is ready to run in an environment with the
expected PostgreSQL role and explicit Prisma test-database setup
consent where driver-adapter reuse is required.
