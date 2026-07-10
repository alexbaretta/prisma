# Sprint 2

### [ ] Tasklet 012: Rename Npm Packages For Local Fork

## Goal

Rename the forked npm package outputs so local installs cannot conflict
with stock Prisma packages.

## Instructions

Research the package publication graph before editing package metadata.
Identify every package that must be renamed for the local fork to be
installed safely, including generated client dependencies and CLI/client
coupling.

Do not rename packages speculatively. The rename set must be limited to
packages required for local installation and runtime use of the fork.

Update the plan with:

- packages that must be renamed;
- packages that must not be renamed;
- dependency references that must follow the rename;
- generated package metadata that must be updated;
- local install command shape expected by Tasklet 014.

## Pre-Implementation Review

Capture the AGENTS-required review record before editing package
metadata. Include one rejected approach that would conflict with stock
Prisma packages or unnecessarily broaden the package rename.

## Validation

Run focused package metadata checks and `git diff --check`. If package
metadata changes can affect build output, run the relevant build command
identified by the package graph research.
