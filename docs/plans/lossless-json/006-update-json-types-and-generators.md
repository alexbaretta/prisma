# Sprint 1

### [DONE] Tasklet 006: Introduce Internal JSON Codec

## Goal

Create a single internal Prisma JSON codec boundary that wraps native
JSON handling and `lossless-json` handling. This prevents scattered
calls to `lossless-json` and makes later upstreaming possible.

## Instructions

Add `lossless-json` to the minimal package set identified in Sprint 0.
Prefer adding it where JSON materialization and parameterization already
live, rather than making unrelated packages import it directly.

Create a small internal module with the contract finalized in Sprint 0.
The production codec for this branch should use `lossless-json` parse
and stringify. If a standard JSON codec is useful for tests, keep it
internal and explicit.

Do not use `any`. Keep types narrow. The parse return type should be
`unknown` at the codec boundary until runtime code validates or maps it
into Prisma's public JSON type.

## Required Behavior

- `LosslessNumber` serializes as a JSON numeric token.
- Plain JavaScript `number` serializes as JSON number, preserving only
  the precision already present in that JavaScript value.
- Unsupported values fail at the boundary finalized in Sprint 0.
- Existing non-lossless behavior for `BigInt`, `Uint8Array`, and other
  special inputs is preserved or intentionally rejected as documented in
  Sprint 0.

## Pre-Implementation Review

Capture the AGENTS-required review record before editing product code.

## Pre-Implementation Review Record

Observed problem: Prisma has multiple native JSON parse/stringify sites
that currently own DB JSON value materialization and parameter text
without a named Prisma boundary.

Violated contract: DB JSON numeric tokens must be parsed and
stringified by a single lossless Prisma-owned codec so call sites do
not drift or use native JSON behavior directly.

Owning layer: `@prisma/client-runtime-utils` owns the shared codec and
the public `LosslessNumber` re-export because both `@prisma/client` and
`@prisma/client-engine-runtime` already depend on it.

Intended solution: add `lossless-json` as a runtime dependency of
`@prisma/client-runtime-utils`, then expose `LosslessNumber`,
`isLosslessJsonNumber`, `parseJsonFieldValue`,
`stringifyJsonFieldValue`, and `normalizeJsonFieldText` from a new
`json-codec.ts` module.

Rejected wrong-layer solution: do not import `lossless-json` directly
from generated clients, provider adapters, or each runtime call site.
That would duplicate policy and make later upstreaming harder.

Validation that proves this tasklet: codec unit tests must pass and
must prove large integer and high-precision decimal token preservation,
unquoted `LosslessNumber` stringification, ordinary JavaScript number
acceptance, top-level unsupported-value rejection, and preservation of
the existing BigInt and `Uint8Array` JSON-field behavior.

## Validation

Add unit tests for the codec itself. Include a test that distinguishes a
large integer token from the rounded JavaScript `number` equivalent.

## Validation Performed

Focused codec tests:

```sh
pnpm --filter @prisma/client-runtime-utils test json-codec.test.ts
```

Result: passed. The test suite covers lossless parsing of large integer
and high-precision decimal tokens, distinguishes the parsed token from
the rounded JavaScript number equivalent, stringifies `LosslessNumber`
as an unquoted numeric token, preserves ordinary JavaScript numbers,
preserves existing BigInt and `Uint8Array` JSON field behavior, and
rejects unsupported top-level values.

Focused package build:

```sh
pnpm --filter @prisma/client-runtime-utils build
```

Result: passed.
