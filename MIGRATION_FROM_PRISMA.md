# Migrating From Stock Prisma

This fork uses lossless JSON handling for Prisma `Json` fields and
uses different npm package names so it can coexist with stock Prisma.

## Package Changes

Replace stock Prisma packages in your application:

```json
{
  "dependencies": {
    "@prisma-lossless/client": "7.8.0-lossless.16",
    "@prisma-lossless/adapter-pg": "7.8.0-lossless.16"
  },
  "devDependencies": {
    "@prisma-lossless/cli": "7.8.0-lossless.16"
  }
}
```

Remove these stock packages from direct application dependencies:

- `prisma`
- `@prisma/client`
- `@prisma/adapter-pg`

`@prisma-lossless/cli` rejects consumer projects that directly declare
`prisma` or `@prisma/*` packages in their dependency metadata. Remove
the stock packages before installing the lossless fork.

If the consumer uses pnpm 11, allow Prisma lifecycle scripts in the
consumer repository before running a normal install:

```yaml
allowBuilds:
  '@prisma-lossless/engines': true
  '@prisma-lossless/cli': true

onlyBuiltDependencies:
  - '@prisma-lossless/engines'
  - '@prisma-lossless/cli'
```

Use `7.8.0-lossless.16` or newer from the public npm registry with
normal package-manager commands:

```sh
pnpm add @prisma-lossless/client@7.8.0-lossless.16 \
  @prisma-lossless/adapter-pg@7.8.0-lossless.16
pnpm add -D @prisma-lossless/cli@7.8.0-lossless.16
```

## Import Changes

Update runtime imports:

```ts
import { PrismaClient } from '@prisma-lossless/client'
import { PrismaPg } from '@prisma-lossless/adapter-pg'
```

Update Prisma config imports:

```ts
import { defineConfig } from '@prisma-lossless/cli/config'
```

Update CLI commands:

```sh
npx prisma-lossless generate
npx prisma-lossless migrate dev
npx prisma-lossless studio
```

## Regenerate

After changing dependencies and imports, reinstall and regenerate:

```sh
pnpm install --frozen-lockfile
pnpm exec prisma-lossless generate
```

Commit the resulting lockfile change so all environments resolve the
same lossless package versions.

## JSON Behavior Changes

Prisma `Json` fields now preserve JSON numeric tokens losslessly.
Large integers and precise decimal tokens read from JSON columns are
materialized as `Prisma.LosslessNumber` values instead of JavaScript
`number` values.

Code that assumes `typeof value === "number"` for JSON-field numbers
must be updated. Use `value.toString()` when you need the exact JSON
numeric token, or convert explicitly when precision loss is acceptable.

JavaScript `number` inputs remain accepted, but precision already lost
by user code cannot be recovered. Use `new Prisma.LosslessNumber(...)`
for JSON numbers that must be written without precision loss.

Raw SQL JSON parameters are covered by the same contract. Objects that
contain `Prisma.LosslessNumber` values may be passed directly through
`$queryRaw` and `$executeRaw` and cast to `jsonb`; no consumer-side
pre-stringification helper is required.
