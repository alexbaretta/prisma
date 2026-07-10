# Sprint 1

### [ ] Tasklet 010: Validate Semantics And Provider Coverage

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

## Validation

Record the focused test commands and passing results in this file. If a
provider is opted out, record the existing limitation and the code path
that enforces the opt-out.
