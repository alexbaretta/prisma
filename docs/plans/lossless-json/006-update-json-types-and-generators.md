# Sprint 1

### [ ] Tasklet 006: Introduce Internal JSON Codec

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

## Validation

Add unit tests for the codec itself. Include a test that distinguishes a
large integer token from the rounded JavaScript `number` equivalent.
