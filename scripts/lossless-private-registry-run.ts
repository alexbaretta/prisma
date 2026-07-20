import { type ChildProcess, spawn, type SpawnOptions } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

import {
  getRegistryRuntimePaths,
  publishPackage,
  RegistryPortUnavailableError,
  type RegistryRuntimePaths,
  type StartedRegistry,
  startRegistry,
  stopStartedRegistry,
} from './lossless-private-registry'
import {
  prepareBuiltPrivateReleaseCandidates,
  readPackedPackageJson,
  RELEASE_PACKAGES,
  validateReleasePackageMetadata,
} from './lossless-private-release'

const MAX_PORT_ALLOCATION_ATTEMPTS = 5
const RUNTIME_ROOT = path.join(os.tmpdir(), 'prisma-lossless-private-registry-runs')
const BUILT_RELEASE_ROOT = path.join(process.cwd(), 'tmp/prisma-lossless-private-registry-runs')

type JsonObject = Record<string, unknown>

export type PrivateReleasePackage = {
  name: string
  version: string
  sourceCommit: string
  tarballPath: string
}

export type PrivateReleaseManifest = {
  version: string
  sourceCommit: string
  packages: PrivateReleasePackage[]
}

export type RegistryUrls = {
  host: string
  docker: string
}

export type ReservedPort = {
  port: number
  release: () => Promise<void>
}

export type EphemeralRegistry = {
  paths: RegistryRuntimePaths
  startedRegistry: StartedRegistry
  urls: RegistryUrls
}

export type RegistryRunnerDependencies = {
  reservePort: () => Promise<ReservedPort>
  makeRuntimePaths: () => RegistryRuntimePaths
  start: (paths: RegistryRuntimePaths, registry: string) => Promise<StartedRegistry>
  stop: (startedRegistry: StartedRegistry) => Promise<void>
  authenticate: (paths: RegistryRuntimePaths, registry: string) => Promise<void>
  publish: (packagePath: string, registry: string, paths: RegistryRuntimePaths) => void
  removeRuntime: (runtimeRoot: string) => void
  runChild: (command: readonly string[], environment: NodeJS.ProcessEnv, cwd: string) => Promise<number>
}

export type BuiltReleaseRunnerDependencies = {
  makeReleaseRoot: () => string
  prepareRelease: (version: string, outputRoot: string) => PrivateReleaseManifest
  runRegistry: (manifest: PrivateReleaseManifest, command: readonly string[], consumerDir: string) => Promise<number>
  removeRelease: (releaseRoot: string) => void
}

export type RegistryRunnerArguments =
  | { mode: 'manifest'; manifestPath: string; consumerDir: string; command: string[] }
  | { mode: 'built'; version: string; consumerDir: string; command: string[] }

class RegistryRunTerminatedError extends Error {
  constructor(readonly signal: NodeJS.Signals) {
    super(`Registry run terminated by ${signal}`)
  }
}

const DEFAULT_DEPENDENCIES: RegistryRunnerDependencies = {
  reservePort: reserveAvailablePort,
  makeRuntimePaths: createRuntimePaths,
  start: (paths, registry) => startRegistry(paths, registry, { detached: false }),
  stop: stopStartedRegistry,
  authenticate: createEphemeralPublisher,
  publish: publishPackage,
  removeRuntime: (runtimeRoot) => fs.rmSync(runtimeRoot, { recursive: true, force: true }),
  runChild: runChildCommand,
}

const DEFAULT_BUILT_RELEASE_DEPENDENCIES: BuiltReleaseRunnerDependencies = {
  makeReleaseRoot: createBuiltReleaseRoot,
  prepareRelease: prepareBuiltPrivateReleaseCandidates,
  runRegistry: runWithEphemeralRegistry,
  removeRelease: (releaseRoot) => fs.rmSync(releaseRoot, { recursive: true, force: true }),
}

export function buildRegistryUrls(port: number): RegistryUrls {
  if (!Number.isInteger(port) || port < 1024 || port > 65_535) {
    throw new Error(`Registry port is outside the approved range: ${port}`)
  }

  return {
    host: `http://127.0.0.1:${port}/`,
    docker: `http://host.docker.internal:${port}/`,
  }
}

export function buildChildEnvironment(
  urls: RegistryUrls,
  base = process.env,
  npmUserConfigFile?: string,
): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    ...base,
    PRISMA_LOSSLESS_REGISTRY_URL: urls.host,
    PRISMA_LOSSLESS_DOCKER_REGISTRY_URL: urls.docker,
    npm_config_registry: urls.host,
    NPM_CONFIG_REGISTRY: urls.host,
    'npm_config_@prisma-lossless:registry': urls.host,
    'NPM_CONFIG_@PRISMA_LOSSLESS:REGISTRY': urls.host,
  }

  if (npmUserConfigFile) {
    environment.npm_config_userconfig = npmUserConfigFile
    environment.NPM_CONFIG_USERCONFIG = npmUserConfigFile
  }

  return environment
}

export function resolveConsumerDirectory(consumerDir: string): string {
  const resolvedConsumerDir = path.resolve(consumerDir)
  const stat = fs.statSync(resolvedConsumerDir, { throwIfNoEntry: false })

  if (!stat?.isDirectory()) {
    throw new Error(`Consumer directory does not exist: ${resolvedConsumerDir}`)
  }

  const packageJsonPath = path.join(resolvedConsumerDir, 'package.json')

  if (!fs.statSync(packageJsonPath, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`Consumer directory must contain package.json: ${resolvedConsumerDir}`)
  }

  return resolvedConsumerDir
}

export function loadPrivateReleaseManifest(manifestPath: string): PrivateReleaseManifest {
  const resolvedManifestPath = path.resolve(manifestPath)
  const manifest = parseJsonObject(fs.readFileSync(resolvedManifestPath, 'utf-8'), resolvedManifestPath)
  const version = readRequiredString(manifest, 'version', resolvedManifestPath)
  const sourceCommit = readRequiredString(manifest, 'sourceCommit', resolvedManifestPath)

  if (!Array.isArray(manifest.packages)) {
    throw new Error(`Private release manifest has no package list: ${resolvedManifestPath}`)
  }

  if (manifest.packages.length !== RELEASE_PACKAGES.length) {
    throw new Error(
      `Private release manifest contains ${manifest.packages.length} packages; expected ${RELEASE_PACKAGES.length}`,
    )
  }

  const manifestDir = path.dirname(resolvedManifestPath)
  const packages = manifest.packages.map((candidate, index) => {
    if (!isJsonObject(candidate)) {
      throw new Error(`Private release package ${index} is malformed`)
    }

    const expectedName = RELEASE_PACKAGES[index].name
    const name = readRequiredString(candidate, 'name', `private release package ${index}`)
    const packageVersion = readRequiredString(candidate, 'version', name)
    const packageSourceCommit = readRequiredString(candidate, 'sourceCommit', name)
    const recordedTarballPath = readRequiredString(candidate, 'tarballPath', name)

    if (name !== expectedName) {
      throw new Error(`Private release package ${index} is ${name}; expected ${expectedName}`)
    }

    if (packageVersion !== version || packageSourceCommit !== sourceCommit) {
      throw new Error(`Private release package ${name} does not match manifest provenance`)
    }

    const tarballPath = resolveTarballPath(recordedTarballPath, manifestDir)
    const packageJson = readPackedPackageJson(tarballPath)
    validateReleasePackageMetadata(packageJson, version, sourceCommit)

    if (packageJson.name !== name) {
      throw new Error(`Tarball ${tarballPath} contains ${String(packageJson.name)}; expected ${name}`)
    }

    return { name, version, sourceCommit, tarballPath }
  })

  return { version, sourceCommit, packages }
}

export async function reserveAvailablePort(): Promise<ReservedPort> {
  const server = net.createServer()
  server.unref()

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })

  const address = server.address()

  if (address === null || typeof address === 'string') {
    server.close()
    throw new Error('Could not determine the reserved registry port')
  }

  let released = false

  return {
    port: address.port,
    release: async () => {
      if (released) {
        return
      }

      released = true
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
    },
  }
}

export function createRuntimePaths(): RegistryRuntimePaths {
  const runtimeRoot = path.join(RUNTIME_ROOT, `${process.pid}-${randomUUID()}`)
  return getRegistryRuntimePaths(runtimeRoot)
}

export async function startEphemeralRegistry(
  manifest: PrivateReleaseManifest,
  dependencies: RegistryRunnerDependencies = DEFAULT_DEPENDENCIES,
  terminationSignal: () => NodeJS.Signals | undefined = () => undefined,
): Promise<EphemeralRegistry> {
  let lastPortError: Error | undefined

  for (let attempt = 0; attempt < MAX_PORT_ALLOCATION_ATTEMPTS; attempt++) {
    const paths = dependencies.makeRuntimePaths()
    const reservation = await dependencies.reservePort()
    const urls = buildRegistryUrls(reservation.port)
    let startedRegistry: StartedRegistry | undefined

    try {
      await reservation.release()
      startedRegistry = await dependencies.start(paths, urls.host)
      await dependencies.authenticate(paths, urls.host)
      throwIfTerminated(terminationSignal())

      for (const releasePackage of manifest.packages) {
        dependencies.publish(releasePackage.tarballPath, urls.host, paths)
        await new Promise<void>((resolve) => setImmediate(resolve))
        throwIfTerminated(terminationSignal())
      }

      return { paths, startedRegistry, urls }
    } catch (error) {
      if (startedRegistry) {
        await dependencies.stop(startedRegistry)
      }
      dependencies.removeRuntime(paths.root)

      if (error instanceof RegistryPortUnavailableError) {
        lastPortError = error
        continue
      }

      throw error
    }
  }

  throw new Error(`Could not allocate a registry port after ${MAX_PORT_ALLOCATION_ATTEMPTS} attempts`, {
    cause: lastPortError,
  })
}

export async function runWithEphemeralRegistry(
  manifest: PrivateReleaseManifest,
  command: readonly string[],
  consumerDir: string,
  dependencies: RegistryRunnerDependencies = DEFAULT_DEPENDENCIES,
): Promise<number> {
  if (command.length === 0 || command[0] === '') {
    throw new Error('A child command is required after --')
  }

  const resolvedConsumerDir = resolveConsumerDirectory(consumerDir)
  let signal: NodeJS.Signals | undefined
  let registry: EphemeralRegistry | undefined
  const signalHandlers = new Map<NodeJS.Signals, () => void>()

  for (const handledSignal of ['SIGINT', 'SIGTERM'] as const) {
    const handler = () => {
      signal ??= handledSignal
    }
    signalHandlers.set(handledSignal, handler)
    process.once(handledSignal, handler)
  }

  try {
    registry = await startEphemeralRegistry(manifest, dependencies, () => signal)

    if (signal) {
      return signalExitCode(signal)
    }

    return await dependencies.runChild(
      command,
      buildChildEnvironment(registry.urls, process.env, registry.paths.npmUserConfigFile),
      resolvedConsumerDir,
    )
  } catch (error) {
    if (error instanceof RegistryRunTerminatedError) {
      return signalExitCode(error.signal)
    }

    throw error
  } finally {
    for (const [handledSignal, handler] of signalHandlers) {
      process.off(handledSignal, handler)
    }

    if (registry) {
      try {
        await dependencies.stop(registry.startedRegistry)
      } finally {
        dependencies.removeRuntime(registry.paths.root)
      }
    }
  }
}

export async function runWithBuiltRelease(
  version: string,
  command: readonly string[],
  consumerDir: string,
  dependencies: BuiltReleaseRunnerDependencies = DEFAULT_BUILT_RELEASE_DEPENDENCIES,
): Promise<number> {
  const resolvedConsumerDir = resolveConsumerDirectory(consumerDir)
  const releaseRoot = dependencies.makeReleaseRoot()

  try {
    const manifest = dependencies.prepareRelease(version, releaseRoot)
    return await dependencies.runRegistry(manifest, command, resolvedConsumerDir)
  } finally {
    dependencies.removeRelease(releaseRoot)
  }
}

export function createBuiltReleaseRoot(): string {
  fs.mkdirSync(BUILT_RELEASE_ROOT, { recursive: true })
  return fs.mkdtempSync(path.join(BUILT_RELEASE_ROOT, 'built-release-'))
}

export async function runChildCommand(
  command: readonly string[],
  environment: NodeJS.ProcessEnv,
  cwd: string,
): Promise<number> {
  const [executable, ...args] = command
  const options: SpawnOptions = { cwd, env: environment, stdio: 'inherit' }
  const child = spawn(executable, args, options)
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM']
  const handlers = new Map<NodeJS.Signals, () => void>()

  for (const signal of signals) {
    const handler = () => child.kill(signal)
    handlers.set(signal, handler)
    process.once(signal, handler)
  }

  try {
    return await childExitCode(child)
  } finally {
    for (const [signal, handler] of handlers) {
      process.off(signal, handler)
    }
  }
}

function childExitCode(child: ChildProcess): Promise<number> {
  return new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (code, signal) => {
      if (code !== null) {
        resolve(code)
        return
      }

      resolve(signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : 1)
    })
  })
}

function throwIfTerminated(signal: NodeJS.Signals | undefined): void {
  if (signal) {
    throw new RegistryRunTerminatedError(signal)
  }
}

function signalExitCode(signal: NodeJS.Signals): number {
  return signal === 'SIGINT' ? 130 : 143
}

export async function createEphemeralPublisher(paths: RegistryRuntimePaths, registry: string): Promise<void> {
  const username = `build-${randomUUID()}`
  const password = randomUUID()
  const userEndpoint = new URL(`/-/user/org.couchdb.user:${username}`, registry)
  const response = await fetch(userEndpoint, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      _id: `org.couchdb.user:${username}`,
      name: username,
      password,
      type: 'user',
      roles: [],
      email: `${username}@localhost.invalid`,
    }),
  })

  if (!response.ok) {
    throw new Error(`Could not create the ephemeral registry publisher: ${response.status} ${response.statusText}`)
  }

  const body: unknown = await response.json()

  if (!isJsonObject(body) || typeof body.token !== 'string' || body.token === '') {
    throw new Error('Ephemeral registry publisher response did not contain an authentication token')
  }

  const registryUrl = new URL(registry)
  const authenticationKey = `//${registryUrl.host}${registryUrl.pathname}:_authToken`
  fs.mkdirSync(paths.root, { recursive: true })
  fs.writeFileSync(
    paths.npmUserConfigFile,
    `registry=${registry}\n@prisma-lossless:registry=${registry}\n${authenticationKey}=${body.token}\n`,
  )
}

function resolveTarballPath(recordedPath: string, manifestDir: string): string {
  const resolvedRecordedPath = path.resolve(recordedPath)

  if (fs.statSync(resolvedRecordedPath, { throwIfNoEntry: false })?.isFile()) {
    return resolvedRecordedPath
  }

  const relocatedPath = path.join(manifestDir, 'artifacts', path.basename(recordedPath))

  if (fs.statSync(relocatedPath, { throwIfNoEntry: false })?.isFile()) {
    return relocatedPath
  }

  throw new Error(`Private release tarball does not exist: ${recordedPath}`)
}

function parseJsonObject(input: string, source: string): JsonObject {
  let parsed: unknown

  try {
    parsed = JSON.parse(input)
  } catch {
    throw new Error(`Private release manifest is not valid JSON: ${source}`)
  }

  if (!isJsonObject(parsed)) {
    throw new Error(`Private release manifest must be a JSON object: ${source}`)
  }

  return parsed
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readRequiredString(object: JsonObject, key: string, source: string): string {
  const value = object[key]

  if (typeof value !== 'string' || value === '') {
    throw new Error(`${source} has no valid ${key}`)
  }

  return value
}

export function parseArguments(argv: readonly string[]): RegistryRunnerArguments {
  const separatorIndex = argv.indexOf('--')

  if (separatorIndex < 0 || argv.length <= separatorIndex + 1) {
    throw usageError()
  }

  const options = argv.slice(0, separatorIndex)
  const command = argv.slice(separatorIndex + 1)
  let consumerDir: string | undefined
  let source: { mode: 'built'; version: string } | { mode: 'manifest'; manifestPath: string } | undefined

  for (let index = 0; index < options.length; index++) {
    const option = options[index]

    if (option === '--consumer-dir') {
      const value = options[++index]

      if (!value) {
        throw usageError()
      }

      consumerDir = value
      continue
    }

    if (option === '--from-built') {
      const value = options[++index]

      if (!value || source) {
        throw usageError()
      }

      source = { mode: 'built', version: value }
      continue
    }

    if (!option.startsWith('-') && !source) {
      source = { mode: 'manifest', manifestPath: option }
      continue
    }

    throw usageError()
  }

  if (!consumerDir || !source) {
    throw usageError()
  }

  return { ...source, consumerDir, command }
}

function usageError(): Error {
  return new Error(
    'Usage: pnpm exec tsx scripts/lossless-private-registry-run.ts ' +
      '--consumer-dir <consumer-project> [--from-built <version> | <private-release-manifest.json>] ' +
      '-- <command> [args...]',
  )
}

async function main(argv: readonly string[]): Promise<void> {
  const parsed = parseArguments(argv)

  if (parsed.mode === 'built') {
    process.exitCode = await runWithBuiltRelease(parsed.version, parsed.command, parsed.consumerDir)
    return
  }

  const manifest = loadPrivateReleaseManifest(parsed.manifestPath)
  process.exitCode = await runWithEphemeralRegistry(manifest, parsed.command, parsed.consumerDir)
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error: Error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
