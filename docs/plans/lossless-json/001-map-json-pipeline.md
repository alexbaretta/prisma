# Sprint 0

### [ ] Tasklet 001: Inventory DB JSON API Usage

## Goal

Create a current, code-anchored inventory of every native JavaScript
JSON operation that could affect database JSON value preservation before
changing behavior.

## Instructions

Inventory every `JSON.parse`, `JSON.stringify`, `safeJsonStringify`,
and `toJSON()` boundary in at least:

- `packages/client/src/runtime`
- `packages/client-engine-runtime/src`
- `packages/query-plan-executor/src`
- `packages/json-protocol/src`
- `packages/adapter-*`

Classify each operation as one of:

- DB JSON read materialization;
- DB JSON write parameterization;
- raw query JSON materialization;
- generated client runtime behavior;
- query protocol, query cache, logging, config, build metadata, or
  test-only behavior;
- provider adapter behavior that has already preserved or already lost
  numeric token precision.

## Deliverable

Update this file with an evidence table listing:

- file path;
- function or exported type;
- native JSON operation or JSON type assumption;
- classification;
- whether Sprint 1 must replace, preserve, or explicitly ignore the
  operation;
- reason for that decision.

## Pre-Implementation Review

This is a research tasklet. Do not change product code.

## Validation

No product code should be changed in this task. Validation is the
completed evidence table plus `git diff --check` for this task file.
