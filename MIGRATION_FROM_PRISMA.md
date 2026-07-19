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

Build the exact approved private release artifacts directly from their
pinned source commit. This command does not contact a registry to choose
or manufacture the release version:

```sh
pnpm exec tsx scripts/lossless-private-release.ts build-pinned \
  7.8.0-lossless.5 \
  f98f2e0f42cd7d9d9556567f9236c98eed00da16 \
  tmp/lossless-json-private-release
```

The command prints the resulting manifest path. Run each consumer
install or build through the ephemeral registry wrapper using that
manifest. The wrapper starts its own pinned Verdaccio process on an
OS-assigned loopback port, publishes the exact recorded packages, runs
the command after `--`, and stops the registry on success or failure:

```sh
pnpm exec tsx scripts/lossless-private-registry-run.ts \
  tmp/lossless-json-private-release/runs/<run>/private-release-manifest.json \
  -- pnpm --dir /path/to/consumer install --frozen-lockfile
```

Do not configure a permanent registry URL in the consumer project.
The wrapper overrides both the default npm registry and the
`@prisma-lossless` scoped registry for its child process. Concurrent
builds receive different ports and independent registry storage.

The child process also receives these explicit URLs:

- `PRISMA_LOSSLESS_REGISTRY_URL` is the loopback URL for host tools.
- `PRISMA_LOSSLESS_DOCKER_REGISTRY_URL` uses
  `host.docker.internal` for a Docker build.

A consumer Docker build should pass the Docker URL into its package
installation stage, for example:

```sh
pnpm exec tsx scripts/lossless-private-registry-run.ts \
  /path/to/private-release-manifest.json -- \
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
