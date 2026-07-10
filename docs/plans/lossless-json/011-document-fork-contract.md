# Sprint 2

### [DONE] Tasklet 011: Document Fork Behavior

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

## Pre-Implementation Review Record

Observed problem: Sprint 1 changed Prisma `Json` read and write
behavior, but downstream consumers need a stable repo-local contract
document outside the implementation tasklet notes.

Violated contract: local adopters must know that JSON numeric tokens are
lossless values on reads, that `LosslessNumber` is accepted on writes,
and that non-JSON scalar, null, raw-query text, and provider-limitation
semantics did not collapse into a single generic JSON behavior.

Owning layer: repository documentation owns the consumer-facing fork
contract. Package metadata and artifact generation are owned by later
Sprint 2 tasklets.

Intended solution: add `docs/lossless-json-fork.md` with the fork
behavior, integration guidance, and provider limitations, then record
validation in this tasklet.

Rejected wrong-layer solution: do not rely only on plan tasklet notes
or generated TypeScript types as the downstream contract, and do not
document package names before Tasklet 012 finishes the fork package
rename.

Validation that proves the fix: run `git diff --check` over the new
documentation and plan changes.

## Validation

Run `git diff --check` for the documentation changes. If code examples
are added, run or typecheck the examples where the repository has an
existing docs-example validation path.

## Post-Implementation Review

The new document states the fork's JSON numeric-token behavior without
introducing executable examples that would need a separate docs example
runner. It keeps the downstream integration recommendation at the
storage-adapter boundary and avoids committing to final renamed package
install commands before Tasklets 012 through 014 produce them.

## Validation Performed

- `git diff --check -- docs/lossless-json-fork.md
docs/plans/lossless-json/011-document-fork-contract.md
docs/plans/lossless-json/000-lossless-json-index.md` passed.
