# Sprint 1

### [ ] Tasklet 008: Patch Write Parameterization

## Goal

Use the internal lossless JSON codec when Prisma serializes JSON field
inputs into query parameters.

## Instructions

Patch the write path where JSON values are converted into query-plan
parameters. Known files to inspect are:

- `packages/client/src/runtime/core/jsonProtocol/serializeJsonQuery.ts`
- `packages/client-engine-runtime/src/parameterization/classify.ts`
- `packages/client-engine-runtime/src/parameterization/parameterize.ts`
- `packages/client-engine-runtime/src/utils.ts`

The implementation must ensure `LosslessNumber` values inside JSON
inputs serialize as numeric JSON tokens. They must not become quoted
strings or object-shaped artifacts.

Keep Prisma `Decimal` scalar handling separate. Do not reinterpret a
Prisma `Decimal` scalar as a JSON numeric token unless it is explicitly
inside a Prisma `Json` field value and the JSON codec owns that
serialization.

## Edge Cases

- Query parameter cache keys or placeholder identity logic that uses
  stringified JSON must remain deterministic.
- Unsupported JSON input values should fail with actionable errors.
- Plain JavaScript numbers remain accepted as write-side inputs.
- Client serialization must not lose `LosslessNumber` before
  parameterization sees the JSON field value.

## Pre-Implementation Review

Capture the AGENTS-required review record before editing product code.

## Validation

Run the failing write tests from Tasklet 005. Add unit tests for the
parameterization helper showing that a `LosslessNumber` survives into
the parameter text as an unquoted JSON numeric token.
