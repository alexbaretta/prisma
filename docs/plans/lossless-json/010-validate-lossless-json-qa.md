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

## Validation Bug Review: Schema Engine Log Parsing

Observed problem: root `pnpm test` and fresh functional-test database
setup fail in `@prisma/internals` because `canConnectToDatabase`
throws `Schema engine error:` with an empty message when the schema
engine writes a single JSON error line to stderr.

Violated contract: schema-engine command helpers must preserve
structured schema-engine error codes such as `P1001`, `P1003`, and
`P1013` so callers can distinguish missing databases, unreachable
servers, invalid URLs, and real command failures.

Owning layer: `packages/internals/src/schemaEngineCommands.ts` owns
schema-engine stderr parsing. Functional tests and Prisma Migrate
commands should not compensate for parser output loss.

Intended solution: make `parseJsonFromStderr` parse all non-empty JSON
stderr lines and tolerate a non-JSON prelude before the first JSON log
line, instead of unconditionally discarding the first line.

Rejected wrong-layer solution: do not weaken the lossless-json
functional tests, bypass Prisma's AI safety checkpoint, or special-case
functional test setup around a parser bug.

Validation that proves the fix: rerun
`pnpm --filter @prisma/internals test schemaEngineCommands.test.ts`,
then rerun root `pnpm test` with `TERM=xterm` so the existing
interactive TTY test is not invalidated by Codex's default
`TERM=dumb` environment.

Validation performed:

- `TERM=xterm pnpm --filter @prisma/internals exec dotenv -e
../../.db.env -- vitest run --silent=true
schemaEngineCommands.test.ts -t "sqlite - cannot|postgresql - server
does not exist|invalid database type|empty connection string"`
  passed (`5` tests, `11` skipped). These cases failed before the
  parser fix because single-line schema-engine JSON stderr was dropped
  before callers could see `P1001`, `P1003`, or `P1013`.
- Full `schemaEngineCommands.test.ts` still depends on local database
  services. MySQL passes when run outside the sandbox. SQL Server is
  unavailable because the local `mssql` Docker service repeatedly
  restarts with an `Invalid mapping of address` server startup error.
  PostgreSQL host port `5432` resolves to a different local server with
  no `prisma` role even though the compose container itself has the
  expected `prisma` role and `tests`, `postgres`, and `template1`
  databases. This is a local test-environment issue, not a parser
  regression.

## Validation Bug Review: Migrate AI Marker Inheritance

Observed problem: root `pnpm test` reaches `@prisma/migrate` and then
fails many reset, force-reset, and accept-data-loss tests because the
Jest process inherits Codex agent marker environment variables. The
tests intentionally exercise destructive-command behavior against
fixtures, but the global test setup restores the inherited environment
before each test and reintroduces those markers.

Violated contract: migrate tests should run in a deterministic test
environment. The AI safety unit tests own coverage for inherited agent
markers; unrelated migrate command tests should not fail merely because
the test runner itself is Codex.

Owning layer: `packages/migrate/src/__tests__/setup.ts` owns shared
test environment restoration for migrate Jest tests.

Intended solution: after restoring the original test environment,
delete all AI-agent marker variables and the dangerous-action consent
variable in the shared migrate test setup. Individual AI safety tests
can still set marker variables explicitly inside their own test bodies.

Rejected wrong-layer solution: do not set
`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` for the root test run and
do not weaken the product AI safety checkpoint. The fix belongs in the
test harness so tests decide which ambient markers are present.

Validation that proves the fix: rerun the focused migrate AI safety
unit tests and a focused destructive migrate command test, then rerun
root `pnpm test` without granting dangerous-action consent.

Validation performed:

- `pnpm --filter @prisma/migrate exec dotenv -e ../../.db.env -- jest
--runInBand src/__tests__/utils/ai-safety.test.ts` passed (`30`
  tests), confirming explicit marker detection still works.
- `pnpm --filter @prisma/migrate exec dotenv -e ../../.db.env -- jest
--runInBand src/__tests__/MigrateReset.test.ts -t "should work
\\(--force\\)|triggers the AI safety checkpoint|reset should error
in unattended environment"` passed (`2` tests, `11` skipped),
  confirming inherited Codex markers no longer block ordinary migrate
  reset tests while existing safety assertions still run.

## Validation Bug Review: Drop Database Success Detection

Observed problem: after the AI-marker test setup fix, `DbDrop` tests
run the schema engine successfully, but `dropDatabase` throws because
the schema engine exits with code `0` and empty stderr instead of
including the historical success text in stderr.

Violated contract: a schema-engine command that exits successfully
must be treated as success by the TypeScript helper. Human-readable
stderr text is not the success contract.

Owning layer: `packages/internals/src/schemaEngineCommands.ts` owns
normalizing schema-engine process results for CLI callers.

Intended solution: make `dropDatabase` return success for any
non-throwing schema-engine invocation with exit code `0`; keep the
existing structured error parsing for thrown failures.

Rejected wrong-layer solution: do not adjust `DbDrop` snapshots or
teach individual CLI command tests to compensate for helper-level
success detection.

Validation that proves the fix: rerun focused `DbDrop` success tests
and the affected `@prisma/migrate` package tests.

Validation performed:

- `pnpm --filter @prisma/migrate exec dotenv -e ../../.db.env -- jest
--runInBand src/__tests__/DbDrop.test.ts -t "should work"` passed
  (`4` tests, `7` skipped).
- `pnpm --filter @prisma/internals build` passed after the helper
  change.
- `pnpm --filter @prisma/migrate test` passed with local environment
  skips for unavailable SQL Server, the locally timing-out CockroachDB
  suite, and Docker-only extension coverage (`33` suites, `352` tests,
  `2` skipped).
