# Sprint 0

### [DONE] Tasklet 003: Define Lossless JSON Contract

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

## Upstream API Facts

The branch will use `lossless-json` as the parser/stringifier
implementation. The upstream README documents that native JSON parsing
can corrupt large or precise numeric tokens, while `lossless-json`
parses numbers into `LosslessNumber` values and stringifies those values
back as JSON numeric tokens. It also documents that `LosslessNumber`
stores the token text, exposes `.toString()`, exposes
`.isLosslessNumber`, and is supported by `isLosslessNumber`.

Source checked during Sprint 0:

- https://github.com/josdejong/lossless-json

## Package Ownership Decision

`@prisma/client-runtime-utils` owns the shared lossless JSON surface.
It already owns runtime-exported client utility values such as
`Decimal`, SQL template helpers, and null sentinels, and both
`@prisma/client` and `@prisma/client-engine-runtime` already depend on
it. That dependency direction avoids introducing a reverse dependency
from the client-engine runtime back into the generated client package.

Sprint 1 will add `lossless-json` as a runtime dependency of
`packages/client-runtime-utils`. Direct imports from `lossless-json`
must stay inside that package. Other packages consume named Prisma
helpers from `@prisma/client-runtime-utils`.

The shared module should be named `json-codec.ts` and should export:

- `LosslessNumber` as the public runtime value and type;
- `isLosslessJsonNumber(value)` as Prisma's type guard;
- `parseJsonFieldValue(text)` for DB JSON text materialization;
- `stringifyJsonFieldValue(value)` for DB JSON parameter text;
- `normalizeJsonFieldText(text)` for tests, snapshots, and protocol
  normalization where canonical JSON text is needed without losing
  numeric token text.

The client-engine runtime may keep local wrapper names if that improves
readability, but those wrappers must delegate to the shared codec.

## Public Prisma Contract

Read-side `Json` values include `LosslessNumber` anywhere a JSON number
can appear. Generated `Prisma.JsonValue` must include
`runtime.LosslessNumber` in object and array positions.

Write-side `Json` input accepts `LosslessNumber` and ordinary
JavaScript `number`. A `LosslessNumber` writes as a numeric JSON token.
A JavaScript `number` writes as the already-constructed number value;
Prisma does not claim to recover precision lost before Prisma saw the
value.

Generated clients re-export the runtime value and type instead of
depending on `lossless-json` directly:

- traditional JS generator: destructure `LosslessNumber` from runtime,
  assign `Prisma.LosslessNumber = LosslessNumber`, and emit
  `export import LosslessNumber = runtime.LosslessNumber`;
- TS generator: emit a namespace value and type alias to
  `runtime.LosslessNumber`.

`Prisma.Decimal` remains the scalar type for Prisma `Decimal` fields.
It is not used for JSON numeric tokens. Non-JSON numeric scalar fields
continue to materialize as their existing scalar types.

SQL `NULL`, JSON `null`, `Prisma.DbNull`, `Prisma.JsonNull`, and
`Prisma.AnyNull` keep their existing semantics. The JSON codec only
parses and stringifies JSON text after the null sentinel decision has
already selected a JSON value path.

The branch preserves the DB-returned numeric token text, not
necessarily the original application token spelling. Providers such as
PostgreSQL `jsonb` may canonicalize JSON before Prisma reads it.

## JSON Input Serialization Contract

`LosslessNumber` must be recognized before generic `{ toJSON() }`
handling. A generic `toJSON()` branch is the wrong layer for this work
because it can stringify a lossless number into a quoted string or an
implementation object before the JSON scalar edge is known.

When `LosslessNumber` crosses the Prisma client JSON protocol boundary,
it should be represented with the existing JSON tagged-value shape:

```ts
{ $type: 'Json', value: '<json numeric token>' }
```

The `value` string is a complete JSON text fragment and must be parsed
by `parseJsonFieldValue` when parameterization needs the JavaScript
value again. The whole JSON scalar is finally parameterized with
`stringifyJsonFieldValue`.

For arrays and objects, the client serializer must recurse into nested
positions and apply the same explicit `LosslessNumber` handling before
checking generic JSON-convertible objects.

Existing supported special values keep their current behavior:

- `Date` crossing the protocol as `DateTime` is not a JSON number;
- `Decimal` crossing the protocol as `Decimal` is not a JSON number;
- `BigInt` in JSON input should continue to serialize through the
  current safe JSON behavior unless Sprint 1 tests prove it was not a
  supported public input;
- `Uint8Array` in JSON input should continue to serialize as base64
  text where the current safe JSON path already supports it;
- arbitrary `{ toJSON() }` input remains accepted after
  `LosslessNumber` has been handled explicitly.

## Read Materialization Contract

Every model and raw-query path that receives a DB JSON column as text
must use `parseJsonFieldValue`. Native `JSON.parse` is not allowed on
DB JSON text because it materializes numeric tokens as JavaScript
numbers.

The `Json` tagged-value branch in
`packages/client-engine-runtime/src/json-protocol.ts` must use the
codec for both `deserializeTaggedValue` and JSON tagged-value
normalization. A `JSON.stringify(JSON.parse(value))` normalization is
not allowed on JSON field text.

`safeJsonStringify` is no longer allowed for DB JSON value text unless
it delegates to `stringifyJsonFieldValue`. Its current BigInt and
`Uint8Array` behavior must be preserved in the codec or in an explicit
DB JSON replacer used by the codec.

## Cache, Protocol, And Logging Contract

Query-plan cache keys remain deterministic by ensuring `LosslessNumber`
objects do not remain as arbitrary class instances in cache-keyed
structures. JSON scalar inputs are parameterized to stable JSON strings
before cache-key serialization. JSON tagged values carry string payloads
when they must remain in the protocol tree.

Native JSON APIs remain allowed for non-DB JSON value transport:

- protocol envelopes sent to Wasm, Accelerate, or Data Proxy;
- error payloads, config payloads, telemetry, and debug logging;
- test snapshots and cache-key assertions that do not parse DB JSON
  value text;
- package metadata, build tooling, lockfiles, and generated metadata
  files that do not contain DB JSON values.

If any of those paths can carry a `LosslessNumber`, Sprint 1 must add a
focused test showing either that it is converted to a deterministic
string/tag before native JSON serialization, or that the path is not a
DB JSON preservation boundary.

## Pre-Implementation Review Records

| Problem | Violated contract | Owning layer | Intended solution | Rejected solution | Validation |
| --- | --- | --- | --- | --- | --- |
| DB JSON reads use native parsing. | `Json` field numbers must not become lossy `number` values. | `client-runtime-utils` codec, called by client-engine data mapping and raw serializers. | Replace DB JSON text parsing with `parseJsonFieldValue`. | Driver JSON parser overrides or app-level helpers. | Unit tests for codec and mapper plus functional JSON precision reads. |
| DB JSON writes use native stringification. | `LosslessNumber` input must write as an unquoted numeric token. | `client-runtime-utils` codec, called by parameterization. | Replace DB JSON value stringification with `stringifyJsonFieldValue`. | Calling `.toString()` through generic `toJSON()` and losing field context. | Unit tests for parameterization and functional write/read round trips. |
| Generated JSON types only expose `number`. | Generated clients must type values returned by Prisma accurately. | Both client generators and exported runtime JSON types. | Add `LosslessNumber` to read and input JSON utility types. | Generated clients importing `lossless-json` directly. | Generator snapshot/type tests for JS and TS generators. |
| JSON protocol can hide numeric text in objects. | Protocol transport must not force native numeric materialization. | Client serializer and client-engine JSON protocol helpers. | Encode lossless numeric values as JSON tagged values with string payloads. | Letting generic object traversal serialize `LosslessNumber` internals. | Serializer unit tests for top-level and nested JSON values. |
| Cache keys may see class instances. | Query-plan cache keys must be deterministic. | Parameterization and client-engine cache boundary. | Parameterize JSON values to stable JSON strings before keying. | Relying on native `JSON.stringify` of `LosslessNumber`. | Cache-key tests with equivalent lossless JSON inputs. |
| Special values may regress. | Existing BigInt, bytes, Decimal, Date, and null contracts must hold. | Codec plus existing protocol tag handlers. | Preserve existing non-JSON-number handling and add regression tests. | Treat all object-like values as plain JSON through lossless-json. | Existing protocol tests plus focused JSON edge tests. |

## Sprint 1 Implementation Notes

Add codec unit tests before replacing call sites. The first tests should
prove a large integer and a high-precision decimal round trip through
`parseJsonFieldValue` and `stringifyJsonFieldValue` without token loss.

Patch call sites in this order:

1. shared codec exports and runtime re-exports;
2. client JSON serializer handling for `LosslessNumber`;
3. client-engine JSON protocol parse/normalize helpers;
4. parameterization stringification for JSON scalar placeholders;
5. read materialization in model and raw-query paths;
6. generated JSON utility types and namespace re-exports.

Do not start Sprint 1 until Tasklet 004 confirms provider and raw-query
coverage for every supported adapter path.

## Tasklet Validation Performed

- `rg` confirmed that `@prisma/client` and
  `@prisma/client-engine-runtime` both depend on
  `@prisma/client-runtime-utils`.
- `rg` confirmed that no current package depends on `lossless-json`.
- Reviewed the current native JSON DB value sites in
  `json-protocol.ts`, `parameterize.ts`, `utils.ts`, and
  `serializeJsonQuery.ts`.
- Checked the upstream `lossless-json` README for `LosslessNumber`,
  parser, stringifier, and type guard behavior.
