# AGENTS.md

Note: Also refer to *_AGENTS.md for additional instructions.

## Purpose
- Operate with strict typing, explicit contracts, surgical changes, and strong
  verification.
- zod schemas may not me anonymous. Always declare the zod schema as an exported
  const object. Always git it an explicit type annotation.
- Avoid speculative edits and AI-slop behavior.
- End every full reply with a local timestamp in `YYYY-MM-DD HH:mm:ss`.

## Operating Defaults
- Be direct and technical.
- Challenge incorrect assumptions with evidence.
- Do not broaden scope without approval.
- User owns git workflow unless a rule below explicitly says otherwise.
- Make reasonable local decisions and continue autonomously unless a listed stop
  condition is hit.
- Progress updates are status reports, not handoff points.
- Never delete a file unless you have the user's explicit authorization.
- When the user points out that you made a procedural error, such as deleting a
  file without authorization, do not attempt to correct it unless the user
  explicitly requests that you do so. Otherwise, assume that the user is merely
  providing feedback that you should abide by in subsequent prompts.

## Stop Conditions
- Stop if coding has not yet been approved for a multi-task plan.
- Stop if required scope or acceptance criteria are still ambiguous.
- Stop if a new long-lived plan is starting and the repo state violates the plan
  prerequisites.
- Stop if newly discovered work materially broadens scope.
- Stop if a contract mismatch requires introducing a new correct contract and
  that change is not already approved.
- Stop if a concrete blocker cannot be resolved autonomously.
- Stop before any edit or command that would create or modify
  `schema.prisma` or any file under `packages/database/prisma/migrations/`,
  unless the user explicitly authorized that exact database mutation in the
  current prompt.

## Deployment Safety
- Non-waivable rule: you may not create Cloud Run revisions through `gcloud`,
  OpenTofu, the GCP Console, or any other manual process. Cloud Run revisions
  may be created only by running the repo's build-push-deploy pipeline. The
  user is not allowed to waive this rule.
- You may not perform deployments to the `prod`, `app`, or `demo`
  environments. The user is not allowed to waive this rule.

## Investigation And Change Discipline
- For bug work: gather evidence, form hypotheses, test hypotheses, then apply a
  surgical fix after root cause is confirmed.
- When the `project_tracker` submodule exists or work touches tracker data,
  read `project_tracker/qa-tracker-guide/README.md` before creating, moving,
  assigning, prioritizing, archiving, or executing tracker items.
- If root cause is not confirmed, report uncertainty and continue
  investigation instead of making speculative edits.
- Do not make behavior-changing trial-and-error patches to diagnose bugs. Add
  instrumentation or tests first, then change behavior only after the evidence
  identifies the violated contract.
- Prefer strong static typing. No `any` unless explicitly justified.
- Prefer shared named types over repeated inline structural types.
- Avoid dead code and unnecessary abstractions.
- If two blocks share substantial logic, factor the shared logic instead of
  duplicating it.
- Do not brush a bug under the rug with compensating code at a different
  boundary or layer. Fix the side that is violating the contract.
- No silent fallbacks for contract-critical behavior. Fail fast with actionable
  errors.

## Pre-Implementation Review Gate
- Before implementing any non-trivial fix, describe the intended change in
  plain English and review it as if it were proposed code.
- Treat every problem/solution pair as requiring adversarial review. Attempt
  to disprove the proposed solution before editing code by asking whether it
  bypasses the product path, duplicates an existing mechanism, moves
  responsibility to the wrong layer, hides a contract violation, or weakens a
  trust boundary.
- For each problem being solved, including unforeseen subproblems discovered
  during implementation, identify:
  - the observed problem,
  - the violated contract or invariant,
  - the layer that owns the fix,
  - the intended solution,
  - one rejected unsafe or wrong-layer solution,
  - the validation that will prove the fix.
- Capture the pre-implementation review in the active plan document before
  editing code for that problem or subproblem.
- Do not implement a solution that bypasses the product path being tested,
  duplicates an existing mechanism, moves responsibility across trust
  boundaries, or hides a contract violation at another layer.
- After implementation, review the resulting code against the same criteria
  before treating the tasklet as complete. Capture this post-implementation
  review in the active plan document together with the validation evidence.

## Testing
- Every bug fix must include unit tests that fail before the fix and pass after
  it.
- Every feature must include success-path and failure/edge-path unit tests.
- Run relevant focused tests during implementation when feasible.
- For Bash-only, deployment-script-only, infrastructure-script-only, or other
  non-TypeScript tooling changes that do not affect TypeScript source,
  generated TypeScript artifacts, package contracts, runtime product behavior,
  or package manager/build-system configuration, do not run repo-root
  `pnpm build` or `pnpm test` by default. Use focused validation instead, such
  as `bash -n`, script-specific tests, targeted fixture tests, or `git diff`.
- Before returning control to the user, run repo-root `pnpm build` when the
  change can affect buildable product code, generated artifacts, package
  contracts, runtime behavior, tests, scripts used by the build, or repo
  configuration consumed by TypeScript, Vite, Electron, Prisma, Turbo, or
  package tooling.
- For documentation-only, tracker-only, skill-only, plan-only, or comment-only
  changes that cannot affect the TypeScript/build pipeline, do not run
  `pnpm build` by default. Instead, verify with a focused check appropriate to
  the change, such as `git diff`, link/path checks, Markdown search, or the
  relevant docs-specific validation if one exists.
- If the impact is uncertain, explain the uncertainty and choose the narrowest
  reasonable validation before escalating to `pnpm build`.
- Before considering any tasklet complete, run and pass the relevant project
  build. A tasklet is not complete while the build is failing.

## Git And Change Scope
- Do not commit, reset, rebase, merge, or change branches unless explicitly
  asked, except as required by the approved long-lived-plan workflow below.
- When creating a new file as part of requested work, stage only that new file
  unless the user says otherwise.
- Do not stage modified pre-existing files unless explicitly requested.
- Make minimal, surgical changes that satisfy the request.
- When making a commit stick to the following guidelines for the commit message:
```
Structure: Separate the subject from the body with a blank line.
Subject Line: Limit to 50 characters, capitalize it, and avoid a trailing period.
Tone: Use the imperative mood (e.g., "Fix bug" not "Fixed bug").
Body: Wrap at 72 characters and focus on the "what" and "why" of the change.
```
Do not introduce verbatim '\n' in the git commit message (literally a backslash
character followed by an 'n'). By '\n' we mean a single byte ASCII newline
character.

## Long-Lived Plans
- For tasks spanning multiple implementation steps, create and maintain a plan
  document in `docs/plans/<branch_name>/<plan_name>.md` or in
  `pm/bugfixing/<YYYY>-<MM>-<DD>--<HHMM>` for a bugfixing plan to address a bug
  reports in the same directory.
- Ignore the `codex/` prefix in the branch name: the effective branch name is
  only the text after `codex/`.
- Do not start coding until the plan has been iterated with the user, scope and
  acceptance criteria are explicit, and the feature branch name is recorded in
  the plan.
- Tasklet descriptions shal contain all implementation details and shall adopt a
  72 character per line limit.
- Once approved, execute the plan one tasklet at a time and continue
  autonomously until completion or a listed stop condition.
- Before starting a new plan, the repo must be clean except for untracked files
  the user has explicitly approved to ignore.
- A tasklet is completed when the required functionality has been implemented in
  the codebase, the build succeeds, unit tests have been built or edited to test
  both the successful cases and the error cases, and a selective run of those
  unit tests passes.
- Mark each completed tasklet `[DONE]` immediately, commit it using the tasklet
  title, and reread the plan before starting the next tasklet.
- The header of the commit message shall be
  `[${branch_name_short}] {tasklet-title}`,
  where tasklet-title is a short summary of the tasklet description.
- The body of the commit message shall be the tasklet description, formatted to
  observe a limit of 72 characters per line.
- Rereading the plan is an internal sync step, not a handoff, where
  branch_name_short is the first 3 words of the branch name.
- If new required work is discovered, update the plan before proceeding. If the
  work materially broadens scope, stop and get approval on the revised plan.
- Before returning control to the user, ensure all plan items are `[DONE]` or
  explicitly pending with a documented reason.
- Do not return control to the user on a long-lived plan until repo-root
  `pnpm build` has passed for the current tree.
- Do not treat a full plan or a milestone as complete until `pnpm test` passes
  from the repo root.
- During testing and bugfixing we will use the following process: the user will
  describe the bug, and you will diagnose it and document it in the plan as a
  new tasklet. After the bug is fixed and approved by the user, you will mark
  the bug tasklet DONE and you will commit.
- After completing each tasklet and before deciding the next action, reread
  AGENTS.md and the current plan document. Treat this as a mandatory internal
  sync step, not a handoff point. Continue immediately unless a listed stop
  condition is hit.

## Prisma And Migrations
- Database schema changes are user-owned unless the user explicitly grants
  permission in the current prompt.
- Apply migrations to the local development environment only by running
  `./scripts/setup_dev_environment.sh`. Do not use direct Prisma migration
  commands or smaller local helper scripts for local development database
  setup, reset, repair, or migration unless the user explicitly authorizes
  that exact command in the current prompt.
- The local superadmin account must always be configured with the
  credentials recorded in `.local_admin_credentials`. When local setup or
  database reset changes that account, restore the password from that file
  before running local authenticated workflows.
- Do not edit `packages/database/prisma/schema.prisma`.
- Do not create, edit, regenerate, move, rename, or delete Prisma migration
  files.
- Do not run commands that create or modify Prisma migrations, including
  `prisma migrate dev`, `prisma migrate diff`, or repo scripts that wrap them,
  unless the user explicitly asks for that command in the current prompt.
- Never edit pre-existing migrations. The user is not allowed to waive or
  override this rule.
- If a task appears to require a schema or migration change, stop before making
  code edits and report:
  - the required data model change,
  - the application code that depends on it,
  - the exact schema/migration work the user must perform or explicitly
    authorize.
- Do not mark a tasklet requiring schema or migration work `[DONE]` until the
  user has applied the database change and the relevant validation passes.

## Security And Contracts
- `IPX` is the generic acronym for either `IPW` or `IPG`. Use `IPX`
  when stating rules that apply uniformly to both families.
- Never expose database primary keys across a trust boundary.
- Internal database primary keys must never appear in:
  - URLs
  - external API contracts
  - user-visible UI
  - downloadable documents
  - customer/merchant-facing logs or messages
- Use UUIDs for anything that crosses a trust boundary.
- Do not smuggle data across mismatched domains or type names.
- If the name is wrong, the contract is wrong.
- Use the same named TypeScript type and Zod schema to serialize and
  deserialize persisted structured data. Do not create a separate reader type
  that is narrower, broader, or otherwise different from the writer contract.
- Do not serialize persisted structured data as `unknown`; serialize only
  values that have first been validated as a well-defined type-safe TypeScript
  contract.
- Authentication, authorization, session, cookie, token, and credential changes
  require extra scrutiny in the adversarial review. The review must identify
  trust boundaries and reject any approach that manually moves
  security-sensitive state across layers unless that movement is already an
  explicit product contract.
- Authorization decisions are made only by the backend.
- Every controller endpoint must authenticate and enforce authorization.
- All authorization logic belongs in `AuthorizationService`.
- Do not add IPW-specific or IPG-specific logic to Samba core.
  Provider-specific behavior belongs in loaded RPA workflow packages or
  explicit app-layer integrations outside Samba core.

## Controller / Service Architecture
- Controllers are thin shims around services.
- Business workflow orchestration belongs in services.
- Keep transaction boundaries explicit and auditable.
- Do not perform long-lived external calls inside database transactions.
- Within a REST endpoint, do not open multiple database transactions except for
  the narrow allowed pre-external-call / post-external-call persistence pattern.

## UI Rule: Disallowed Operations
- Display disallowed UX elements, such as textboxes, buttons, and hyperlinks,
  using disabled styling. "Grayed out" is an idiomatic expression for CSS
  styling that indicates a disabled UX element, not literally gray.
- Disable user interaction with the disallowed element.
- Add a tooltip explaining why the interaction is disallowed.
- Rather than displaying an error after the user attempts an operation that is
  not allowed, disable the functionality that would lead to that error.

## UI Rule: Disabled Buttons
- The only visual style change allowed for disabled buttons is
  `opacity: 0.5`.
- Do not change any other visual property in disabled selectors.
- Non-visual disabled behavior such as `cursor: not-allowed` is allowed.

## UI Rule: Survivable Errors
- Errors should be detected and reported, but they must be survivable.
- The React UX must not disappear entirely because of one exception or one HTTP
  error status.
- Use scoped error handling, recoverable error states, and localized fallback
  UI so the rest of the page or workflow remains usable whenever possible.

## Style rules
- The authoritative source of coding style rules is docs/style_guide.md.

## User-facing copy
- Samba and PILLAR are engineering project names, not user-facing copy. These
  words should not appear in any text rendered to the user.
- The appropriate user-facing copy is Anchorbase App and Anchorbase Portal.
