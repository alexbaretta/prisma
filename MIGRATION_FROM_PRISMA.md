# Migrating From Stock Prisma

This fork uses lossless JSON handling for Prisma `Json` fields and
uses different npm package names so it can coexist with stock Prisma.

## Package Changes

Replace stock Prisma packages in your application:

```json
{
  "dependencies": {
    "@prisma-lossless/client": "7.8.0-lossless.5",
    "@prisma-lossless/adapter-pg": "7.8.0-lossless.5"
  },
  "devDependencies": {
    "prisma-lossless": "7.8.0-lossless.5"
  }
}
```

Remove these stock packages from direct application dependencies:

- `prisma`
- `@prisma/client`
- `@prisma/adapter-pg`

For the current private release, point npm at the private registry:

```ini
registry=http://127.0.0.1:4873/
@prisma-lossless:registry=http://127.0.0.1:4873/
```

## Import Changes

Update runtime imports:

```ts
import { PrismaClient } from '@prisma-lossless/client'
import { PrismaPg } from '@prisma-lossless/adapter-pg'
```

Update Prisma config imports:

```ts
import { defineConfig } from 'prisma-lossless/config'
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
npm install
npx prisma-lossless generate
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
