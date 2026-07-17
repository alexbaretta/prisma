import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const VERDACCIO_VERSION = '6.8.0'
export const DEFAULT_REGISTRY_URL = 'http://127.0.0.1:4873/'
export const DEFAULT_DOCKER_REGISTRY_URL = 'http://host.docker.internal:4873/'
export const PRIVATE_RELEASE_DIST_TAG = 'lossless'
export const PRIVATE_REGISTRY_MAX_BODY_SIZE = '200mb'

const DEFAULT_ROOT = path.join(os.tmpdir(), 'prisma-lossless-private-registry')
const PUBLIC_REGISTRY_HOSTS = new Set(['registry.npmjs.org', 'npmjs.org', 'www.npmjs.com'])
const APPROVED_PUBLISH_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])
const DEFAULT_PORT = '4873'

export type RegistryRuntimePaths = {
  root: string
  configFile: string
  storageDir: string
  authDir: string
  logFile: string
  pidFile: string
  npmUserConfigFile: string
}

export type RegistryCommandPlan = {
  start: string[]
  health: string[]
  authenticate: string[]
  publish: string[]
  inspect: string[]
  stop: string[]
}

export function getRegistryRuntimePaths(root = process.env.PRISMA_LOSSLESS_REGISTRY_ROOT): RegistryRuntimePaths {
  const runtimeRoot = path.resolve(root ?? DEFAULT_ROOT)

  assertOutsideCheckout(runtimeRoot)

  return {
    root: runtimeRoot,
    configFile: path.join(runtimeRoot, 'verdaccio.yaml'),
    storageDir: path.join(runtimeRoot, 'storage'),
    authDir: path.join(runtimeRoot, 'auth'),
    logFile: path.join(runtimeRoot, 'verdaccio.log'),
    pidFile: path.join(runtimeRoot, 'verdaccio.pid'),
    npmUserConfigFile: path.join(runtimeRoot, 'npm-userconfig'),
  }
}

export function assertOutsideCheckout(targetPath: string, checkout = process.cwd()): void {
  const resolvedTarget = path.resolve(targetPath)
  const resolvedCheckout = path.resolve(checkout)
  const relative = path.relative(resolvedCheckout, resolvedTarget)

  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    throw new Error(`Registry runtime path must be outside the checkout: ${resolvedTarget}`)
  }
}

export function normalizeRegistryUrl(registry: string): string {
  let parsed: URL

  try {
    parsed = new URL(registry)
  } catch {
    throw new Error(`Registry URL is malformed: ${registry}`)
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Registry URL must use http or https: ${registry}`)
  }

  if (parsed.username || parsed.password) {
    throw new Error('Registry URL must not contain credentials')
  }

  parsed.pathname = parsed.pathname.endsWith('/') ? parsed.pathname : `${parsed.pathname}/`
  parsed.search = ''
  parsed.hash = ''

  return parsed.toString()
}

export function assertApprovedPublishRegistry(registry: string): string {
  const normalized = normalizeRegistryUrl(registry)
  const parsed = new URL(normalized)

  if (PUBLIC_REGISTRY_HOSTS.has(parsed.hostname)) {
    throw new Error(`Refusing to publish lossless Prisma packages to public registry: ${normalized}`)
  }

  if (!APPROVED_PUBLISH_HOSTS.has(parsed.hostname) || parsed.port !== DEFAULT_PORT) {
    throw new Error(`Registry is not an approved private publish target: ${normalized}`)
  }

  return normalized
}

export function buildVerdaccioConfig(paths: RegistryRuntimePaths): string {
  return `storage: ${paths.storageDir}
max_body_size: ${PRIVATE_REGISTRY_MAX_BODY_SIZE}
auth:
  htpasswd:
    file: ${path.join(paths.authDir, 'htpasswd')}
uplinks:
  npmjs:
    url: https://registry.npmjs.org/
packages:
  '@prisma-lossless/*':
    access: $all
    publish: $authenticated
    unpublish: $authenticated
  'prisma-lossless':
    access: $all
    publish: $authenticated
    unpublish: $authenticated
  '@prisma/*':
    access: $all
    publish: $authenticated
    unpublish: $authenticated
    proxy: npmjs
  '**':
    access: $all
    publish: $authenticated
    unpublish: $authenticated
    proxy: npmjs
server:
  keepAliveTimeout: 60
logs:
  - { type: stdout, format: pretty, level: http }
`
}

export function writeRegistryConfig(paths = getRegistryRuntimePaths()): void {
  fs.mkdirSync(paths.root, { recursive: true })
  fs.mkdirSync(paths.storageDir, { recursive: true })
  fs.mkdirSync(paths.authDir, { recursive: true })
  fs.writeFileSync(paths.configFile, buildVerdaccioConfig(paths))
}

export function buildCommandPlan(registry = DEFAULT_REGISTRY_URL): RegistryCommandPlan {
  const approvedRegistry = assertApprovedPublishRegistry(registry)

  return {
    start: ['pnpm', 'dlx', `verdaccio@${VERDACCIO_VERSION}`, '--config', '<config>', '--listen', '127.0.0.1:4873'],
    health: ['npm', 'ping', '--registry', approvedRegistry],
    authenticate: [
      'npm',
      'adduser',
      '--registry',
      approvedRegistry,
      '--auth-type=legacy',
      '--userconfig',
      '<userconfig>',
    ],
    publish: [
      'npm',
      'publish',
      '<package>',
      '--registry',
      approvedRegistry,
      '--userconfig',
      '<userconfig>',
      '--tag',
      PRIVATE_RELEASE_DIST_TAG,
    ],
    inspect: ['npm', 'view', '<package>', '--registry', approvedRegistry, '--json', '--userconfig', '<userconfig>'],
    stop: ['kill', '<pid>'],
  }
}

export async function checkRegistryHealth(registry = DEFAULT_REGISTRY_URL): Promise<void> {
  const approvedRegistry = assertApprovedPublishRegistry(registry)
  const response = await fetch(new URL('/-/ping', approvedRegistry))

  if (!response.ok) {
    throw new Error(`Registry health check failed: ${response.status} ${response.statusText}`)
  }
}

export async function startRegistry(paths = getRegistryRuntimePaths()): Promise<void> {
  writeRegistryConfig(paths)

  const logHandle = fs.openSync(paths.logFile, 'a')
  const child = spawn(
    'pnpm',
    ['dlx', `verdaccio@${VERDACCIO_VERSION}`, '--config', paths.configFile, '--listen', '127.0.0.1:4873'],
    {
      detached: true,
      stdio: ['ignore', logHandle, logHandle],
    },
  )

  child.unref()
  fs.writeFileSync(paths.pidFile, `${child.pid}\n`)

  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      await checkRegistryHealth()
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  throw new Error(`Timed out waiting for Verdaccio. See ${paths.logFile}`)
}

export function stopRegistry(paths = getRegistryRuntimePaths()): void {
  const pid = Number(fs.readFileSync(paths.pidFile, 'utf-8').trim())

  if (!Number.isInteger(pid) || pid <= 0) {
    throw new Error(`Registry PID file is malformed: ${paths.pidFile}`)
  }

  process.kill(pid, 'SIGTERM')
}

export function authenticate(registry = DEFAULT_REGISTRY_URL, paths = getRegistryRuntimePaths()): void {
  const approvedRegistry = assertApprovedPublishRegistry(registry)
  runNpm(['adduser', '--registry', approvedRegistry, '--auth-type=legacy', '--userconfig', paths.npmUserConfigFile])
}

export function publishPackage(
  packagePath: string,
  registry = DEFAULT_REGISTRY_URL,
  paths = getRegistryRuntimePaths(),
): void {
  const approvedRegistry = assertApprovedPublishRegistry(registry)
  runNpm([
    'publish',
    packagePath,
    '--registry',
    approvedRegistry,
    '--userconfig',
    paths.npmUserConfigFile,
    '--tag',
    PRIVATE_RELEASE_DIST_TAG,
  ])
}

export function inspectPackage(
  packageName: string,
  registry = DEFAULT_REGISTRY_URL,
  paths = getRegistryRuntimePaths(),
): void {
  const approvedRegistry = assertApprovedPublishRegistry(registry)
  runNpm(['view', packageName, '--registry', approvedRegistry, '--json', '--userconfig', paths.npmUserConfigFile])
}

function runNpm(args: string[]): void {
  const result = spawnSync('npm', args, { stdio: 'inherit' })

  if (result.status !== 0) {
    throw new Error(`npm ${args.join(' ')} failed with exit code ${result.status}`)
  }
}

async function main(argv: string[]): Promise<void> {
  const [command, ...args] = argv
  const paths = getRegistryRuntimePaths()
  const registry = args[0] ?? DEFAULT_REGISTRY_URL

  switch (command) {
    case 'config':
      writeRegistryConfig(paths)
      console.log(paths.configFile)
      return
    case 'commands':
      console.log(JSON.stringify(buildCommandPlan(registry), null, 2))
      return
    case 'start':
      await startRegistry(paths)
      console.log(`Verdaccio ${VERDACCIO_VERSION} is healthy at ${DEFAULT_REGISTRY_URL}`)
      return
    case 'health':
      await checkRegistryHealth(registry)
      console.log(`Registry is healthy at ${assertApprovedPublishRegistry(registry)}`)
      return
    case 'authenticate':
      authenticate(registry, paths)
      return
    case 'publish':
      publishPackage(args[1], registry, paths)
      return
    case 'inspect':
      inspectPackage(args[1], registry, paths)
      return
    case 'stop':
      stopRegistry(paths)
      console.log(`Sent SIGTERM to registry process from ${paths.pidFile}`)
      return
    default:
      throw new Error(
        'Usage: pnpm exec tsx scripts/lossless-private-registry.ts ' +
          '[config|commands|start|health|authenticate|publish|inspect|stop] [registry] [package]',
      )
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error: Error) => {
    console.error(error.message)
    process.exit(1)
  })
}
