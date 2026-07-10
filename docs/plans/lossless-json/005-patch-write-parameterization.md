# Sprint 1

### [ ] Tasklet 005: Add Failing Precision Tests

## Goal

Add tests that prove current native JSON behavior loses precision. These
tests must fail before production implementation and pass only after the
lossless JSON migration.

## Required Test Cases

Add focused coverage for both read and write behavior.

Read cases:

- JSON large integer token greater than `Number.MAX_SAFE_INTEGER`;
- JSON decimal token with precision that cannot be represented exactly
  as a JavaScript `number`;
- nested numeric tokens inside arrays and objects;
- JSON `null` inside the payload;
- SQL `NULL` for the entire JSON column.

Write cases:

- input object containing a `LosslessNumber` large integer;
- input object containing a `LosslessNumber` decimal;
- input object containing an ordinary JavaScript `number`, with the test
  documenting that this value is accepted but already lossy if it was
  constructed imprecisely by user code.

Raw query cases:

- `$queryRaw` returning a JSON/JSONB column should use the Prisma JSON
  materializer;
- `$queryRaw` returning `jsonb::text` should return a string.

## Candidate Test Locations

Prefer a narrowly scoped new functional test under:

- `packages/client/tests/functional/lossless-json/`

If a lower-level client-engine-runtime test can isolate the materializer
without a database, add it too, but do not replace the database-backed
functional test with a pure unit test.

## Pre-Implementation Review

Record the observed lossy behavior, the violated JSON preservation
contract, the layer that owns each assertion, and the validation command
before changing implementation code.

## Validation

Run the focused test command for the selected package. Record the exact
command and the failing assertion in this file before implementing the
codec.
