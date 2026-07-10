# Lossless JSON Fork Behavior

This fork changes Prisma `Json` column handling so JSON numeric tokens
can cross Prisma read and write boundaries without being coerced into
lossy JavaScript `number` values.

## Runtime Contract

Prisma Client reads JSON numeric tokens from `Json` fields as
`LosslessNumber` values. A value read from a JSON payload such as:

```json
{ "large": 9007199254740993, "decimal": 0.1234567890123456789 }
```

is not represented as:

```ts
{ large: 9007199254740992, decimal: 0.12345678901234568 }
```

The numeric tokens are preserved as lossless numeric values. Code that
previously assumed `typeof value === 'number'` for every JSON number
must be updated to handle `LosslessNumber`.

Generated clients expose `Prisma.LosslessNumber` through the Prisma
namespace. Use that value when constructing JSON payloads that must be
written as JSON numeric tokens without losing precision before Prisma
sees them.

```ts
await prisma.record.create({
  data: {
    payload: {
      large: new Prisma.LosslessNumber('9007199254740993'),
      decimal: new Prisma.LosslessNumber('0.1234567890123456789'),
    },
  },
})
```

Ordinary JavaScript `number` values are still accepted in JSON writes.
They are already lossy if user code constructed them imprecisely before
calling Prisma, so Prisma cannot recover the original token text.

`Prisma.Decimal` scalar fields are unchanged. Decimal scalar values are
not JSON numeric tokens, and JSON numeric tokens are not represented as
`Prisma.Decimal`.

## Null Semantics

SQL `NULL` and JSON `null` behavior is unchanged. `Prisma.DbNull`,
`Prisma.JsonNull`, and `Prisma.AnyNull` keep their existing filter and
write semantics. The lossless JSON codec only handles JSON text after
the existing null-sentinel path has selected a JSON value boundary.

## Raw Queries

Raw queries returning database JSON columns use the same lossless JSON
materializer as model reads. Numeric tokens inside those JSON values are
returned as `LosslessNumber`.

Raw queries that cast JSON to text, such as a PostgreSQL
`jsonb_column::text` expression, return plain strings. Prisma does not
reinterpret those text results as JSON values.

## Provider Limits

Prisma can preserve JSON numeric tokens only when the database and
adapter still provide Prisma with JSON text or an equivalent
JSON-preserving value boundary.

Known limits:

- PostgreSQL `jsonb` and CockroachDB JSONB may canonicalize JSON before
  Prisma reads it. Prisma preserves the canonical numeric token text it
  receives, not formatting that the database has already discarded.
- SQLite-family adapters preserve Prisma-written JSON values because
  Prisma writes JSON parameters as strings. Existing rows written by
  SQL functions or other clients may already have provider-specific
  representation changes that Prisma cannot reverse.
- D1 can return root JSON scalar numbers as JavaScript numbers before
  Prisma receives them. Once the adapter has already materialized a
  number as a JavaScript `number`, the original token is unavailable.
- SQL Server is not covered by the SQL adapter JSON text path used for
  this fork's lossless JSON work.

## Downstream Integration

Application repositories should keep Prisma-specific JSON utility types
behind repository or storage adapters. This fork makes the storage layer
safer for persisted JSON, but domain models and third-party canonical
payload contracts should not expose Prisma JSON implementation details
unless that is an explicit application contract.
