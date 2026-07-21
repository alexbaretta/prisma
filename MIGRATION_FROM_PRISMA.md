# Migrating From Stock Prisma

This fork uses lossless JSON handling for Prisma `Json` fields and
uses different npm package names so it can coexist with stock Prisma.

## Package Changes

Replace stock Prisma packages in your application:

```json
{
  "dependencies": {
    "@prisma-lossless/client": "7.8.0-lossless.11",
    "@prisma-lossless/adapter-pg": "7.8.0-lossless.11"
  },
  "devDependencies": {
    "prisma-lossless": "7.8.0-lossless.11"
  }
}
```

Remove these stock packages from direct application dependencies:

- `prisma`
- `@prisma/client`
- `@prisma/adapter-pg`

If the consumer uses pnpm 11, allow Prisma lifecycle scripts in the
consumer repository before running a normal install:

```yaml
allowBuilds:
  '@prisma-lossless/engines': true
  prisma-lossless: true

onlyBuiltDependencies:
  - '@prisma-lossless/engines'
  - prisma-lossless
```

Use `7.8.0-lossless.11` or newer. Historical
`7.8.0-lossless.5`, `7.8.0-lossless.6`,
`7.8.0-lossless.7`, `7.8.0-lossless.8`,
`7.8.0-lossless.9`, and `7.8.0-lossless.10`
identities are known, but the current wrapper
rejects them instead of serving package bytes that do not match their
immutable release identity or cannot be reproduced from a clean
checkout. The `.9` identity reproduces, but it omits required engines
lifecycle JavaScript files and cannot complete a normal cold install.
The `.10` identity installs, but it was produced by staging package
metadata from source manifests that still used development versions and
workspace dependency specifiers.

Run each consumer install or build through the ephemeral registry
wrapper. The wrapper builds prisma-lossless, transiently packs the
release graph, starts its own Verdaccio process on an OS-assigned
loopback port, publishes the exact packages, runs the command after
`--`, and removes the registry and release artifacts on success or
failure:

```sh
pnpm exec tsx scripts/private-registry-run.ts \
  --consumer-dir /path/to/consumer \
  --from-built 7.8.0-lossless.11 \
  -- corepack pnpm install --frozen-lockfile
```

Do not configure a permanent registry URL in the consumer project.
The wrapper overrides both the default npm registry and the
`@prisma-lossless` scoped registry for its child process. Concurrent
builds receive different ports and independent registry storage.
The child process runs with `/path/to/consumer` as its working
directory, so Corepack reads the consumer `packageManager` field and
Docker build contexts resolve relative to the consumer repository.

The child process also receives these explicit URLs:

- `PRISMA_LOSSLESS_REGISTRY_URL` is the loopback URL for host tools.
- `PRISMA_LOSSLESS_DOCKER_REGISTRY_URL` uses
  `host.docker.internal` for a Docker build.

A consumer Docker build should pass the Docker URL into its package
installation stage, for example:

```sh
pnpm exec tsx scripts/private-registry-run.ts \
  --consumer-dir /path/to/consumer \
  --from-built 7.8.0-lossless.11 \
  -- \
  docker build \
    --build-arg PRISMA_LOSSLESS_DOCKER_REGISTRY_URL \
    .
```

The consumer Dockerfile remains responsible for applying that build
argument to npm or pnpm. Docker takes the named build argument from the
environment injected into its process by the wrapper. Linux Docker
engines may additionally require
`--add-host host.docker.internal:host-gateway`; Docker Desktop supplies
that hostname automatically.

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
pnpm exec tsx scripts/private-registry-run.ts \
  --consumer-dir /path/to/consumer \
  --from-built 7.8.0-lossless.11 \
  -- corepack pnpm install --frozen-lockfile

pnpm exec tsx scripts/private-registry-run.ts \
  --consumer-dir /path/to/consumer \
  --from-built 7.8.0-lossless.11 \
  -- corepack pnpm exec prisma-lossless generate
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
