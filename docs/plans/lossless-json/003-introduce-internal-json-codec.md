# Sprint 0

### [ ] Tasklet 003: Define Lossless JSON Contract

## Goal

Define the exact lossless JSON architecture and public/internal
contracts before implementation starts.

## Instructions

Resolve these decisions:

- which package owns the internal JSON codec;
- which packages depend on `lossless-json`;
- whether Prisma re-exports `LosslessNumber`;
- how generated clients refer to the lossless numeric type;
- how `LosslessNumber` crosses the client JSON protocol boundary;
- how query-plan cache keys remain deterministic;
- whether the branch preserves original lexical token spelling or only
  the DB-returned numeric value text;
- how `Prisma.Decimal`, `BigInt`, `Uint8Array`, `Date`, `JsonNull`,
  `DbNull`, `AnyNull`, and arbitrary `{ toJSON() }` inputs interact
  with JSON field serialization;
- which native JSON APIs remain allowed for non-DB protocol, config,
  build, cache, logging, or test behavior.

## Required Architecture

Create a design for a small internal module with named helpers
equivalent to:

- parse DB JSON text into Prisma Client JSON values;
- stringify Prisma JSON input values into DB JSON parameter text;
- identify or serialize lossless numeric values without relying on
  generic object traversal.

Do not spread direct `lossless-json` calls through unrelated packages.

## Deliverable

Update this file with the finalized contract and design. Include the
AGENTS-required review record for each implementation problem that will
be solved in Sprint 1.

## Validation

No product code should be changed in this task. Validation is the
completed architecture record plus `git diff --check` for this task
file.
