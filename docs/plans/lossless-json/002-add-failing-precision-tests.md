# Sprint 0

### [ ] Tasklet 002: Audit Generated JSON API Usage

## Goal

Research generated Prisma Client code and generated fixtures for uses of
native JavaScript JSON APIs that could affect DB JSON values or the
public JSON type contract.

## Instructions

Inspect generator source and generated output for JSON parse/stringify
or `toJSON()` behavior. Include at least:

- `packages/client-generator-js`
- `packages/client-generator-ts`
- generated Prisma namespace files and runtime imports
- generated test fixtures under `packages/client/tests/**/.generated`
  where they are relevant to JSON runtime or type behavior
- generated package metadata only when it can affect runtime JSON
  handling or dependency ownership

Resolve how generated clients will refer to the lossless numeric type:

- direct import from `lossless-json`;
- Prisma runtime re-export;
- generated `Prisma` namespace alias;
- structural type.

Do not leave this decision open for Sprint 1.

## Deliverable

Update this file with:

- generated-code evidence table;
- generated type contract decision;
- runtime import or re-export decision;
- any generator snapshots or fixture files that Sprint 1 must update.

## Pre-Implementation Review

This is a research tasklet. Do not change product code.

## Validation

No product code should be changed in this task. Validation is the
completed generated-code evidence table plus `git diff --check` for this
task file.
