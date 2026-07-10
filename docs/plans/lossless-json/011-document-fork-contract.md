# Sprint 2

### [ ] Tasklet 011: Document Fork Behavior

## Goal

Document the behavior of this Prisma branch so downstream consumers know
what changed and how to validate it.

## Documentation Requirements

Add or update repo-local documentation that states:

- Prisma `Json` field reads preserve JSON numeric tokens losslessly;
- read-side JSON numbers are not JavaScript `number` values;
- write-side JSON inputs may include `LosslessNumber`;
- ordinary JavaScript `number` write inputs remain accepted but are
  already lossy if constructed imprecisely before the Prisma call;
- Prisma `Decimal` scalar fields are not JSON numeric tokens;
- SQL `NULL` and JSON `null` semantics remain unchanged;
- raw queries returning JSON columns follow the same lossless
  materializer;
- raw queries returning JSON cast to text return strings;
- provider limitations are documented where the database or adapter has
  already canonicalized or parsed JSON before Prisma can preserve it.

## Downstream Integration Note

Downstream application repositories should still hide Prisma API design
behind repository or storage adapters. This Prisma branch can make the
storage adapter safer, but it should not cause application domain models
or third-party canonical payload contracts to expose Prisma JSON utility
types directly.

## Pre-Implementation Review

Capture the AGENTS-required review record before editing docs.

## Validation

Run `git diff --check` for the documentation changes. If code examples
are added, run or typecheck the examples where the repository has an
existing docs-example validation path.
