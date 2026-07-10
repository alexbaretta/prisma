# Sprint 2

### [ ] Tasklet 014: Install Fork Locally And Smoke Test

## Goal

Install the renamed fork package locally and verify it preserves
loss-sensitive JSON numeric tokens in a downstream-style project.

## Instructions

Create or select a local smoke-test project that can install the fork
artifacts without conflicting with stock Prisma packages. The smoke test
must exercise the installed package, not the repository source tree
directly.

The smoke test must cover:

- generated client import from the renamed package;
- read of a JSON large integer token;
- read of a JSON decimal token;
- write of a `LosslessNumber` large integer;
- write of a `LosslessNumber` decimal;
- raw query returning JSON;
- raw query returning JSON cast to text.

## Pre-Implementation Review

Capture the AGENTS-required review record before creating or modifying a
local smoke-test project.

## Validation

Record the exact install command, smoke-test command, and passing
output. Do not mark the full plan complete until repo-root `pnpm test`
passes, unless the user explicitly approves a narrower completion
standard.
