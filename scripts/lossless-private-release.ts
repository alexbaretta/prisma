import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import {
  assertApprovedPublishRegistry,
  DEFAULT_REGISTRY_URL,
  getRegistryRuntimePaths,
  type RegistryRuntimePaths,
} from './lossless-private-registry'

export const PRIVATE_RELEASE_VERSION_PREFIX = '7.8.0-lossless'
export const DEFAULT_RELEASE_OUTPUT_ROOT = path.join(process.cwd(), 'tmp/lossless-json-tasklet-016')

export type ReleasePackage = {
  name: string
  sourceDir: string
}

export type ReleaseCandidate = {
  name: string
  version: string
  sourceCommit: string
  sourceDir: string
  stagingDir: string
  tarballPath: string
}

export type ReleaseManifest = {
  registry: string
  version: string
  sourceCommit: string
  runDir: string
  artifactsDir: string
  packages: ReleaseCandidate[]
}

type JsonObject = Record<string, unknown>
type DependencySection = 'dependencies' | 'devDependencies' | 'optionalDependencies' | 'peerDependencies'

const DEPENDENCY_SECTIONS: readonly DependencySection[] = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
]

const RELEASE_PACKAGE_NAMES = new Set([
  '@prisma/debug',
  '@prisma/driver-adapter-utils',
  '@prisma/get-platform',
  '@prisma/fetch-engine',
  '@prisma/engines',
  '@prisma/config',
  '@prisma/client-runtime-utils',
  '@prisma/adapter-pg',
  '@prisma-lossless/client',
  'prisma-lossless',
])

export const RELEASE_PACKAGES: readonly ReleasePackage[] = [
  { name: '@prisma/debug', sourceDir: 'packages/debug' },
  { name: '@prisma/driver-adapter-utils', sourceDir: 'packages/driver-adapter-utils' },
  { name: '@prisma/get-platform', sourceDir: 'packages/get-platform' },
  { name: '@prisma/fetch-engine', sourceDir: 'packages/fetch-engine' },
  { name: '@prisma/engines', sourceDir: 'packages/engines' },
  { name: '@prisma/config', sourceDir: 'packages/config' },
  { name: '@prisma/client-runtime-utils', sourceDir: 'packages/client-runtime-utils' },
  { name: '@prisma/adapter-pg', sourceDir: 'packages/adapter-pg' },
  { name: '@prisma-lossless/client', sourceDir: 'packages/client' },
  { name: 'prisma-lossless', sourceDir: 'packages/cli' },
]

export function selectNextReleaseVersion(publishedVersions: readonly string[]): string {
  const releaseVersion = new RegExp(`^${escapeRegExp(PRIVATE_RELEASE_VERSION_PREFIX)}\\.(\\d+)$`)
  let highestReleaseNumber = 0

  for (const version of publishedVersions) {
    const match = releaseVersion.exec(version)

    if (match) {
      highestReleaseNumber = Math.max(highestReleaseNumber, Number(match[1]))
    }
  }

  return `${PRIVATE_RELEASE_VERSION_PREFIX}.${highestReleaseNumber + 1}`
}

export function rewritePackageJsonForPrivateRelease(
  packageJson: JsonObject,
  version: string,
  sourceCommit: string,
): JsonObject {
  const rewritten = cloneJsonObject(packageJson)
  const name = readPackageName(rewritten)

  if (!RELEASE_PACKAGE_NAMES.has(name)) {
    throw new Error(`Package is not in the private release graph: ${name}`)
  }

  rewritten.version = version
  rewritten.prismaLosslessRelease = {
    version,
    sourceCommit,
  }

  if (name === 'prisma-lossless') {
    const prisma = readOptionalObject(rewritten.prisma)
    rewritten.prisma = {
      ...prisma,
      prismaCommit: sourceCommit,
    }
  }

  for (const section of DEPENDENCY_SECTIONS) {
    rewriteDependencySection(rewritten, section, version)
  }

  return rewritten
}

export function validateReleasePackageMetadata(packageJson: JsonObject, version: string, sourceCommit: string): void {
  const name = readPackageName(packageJson)

  if (!RELEASE_PACKAGE_NAMES.has(name)) {
    throw new Error(`Unexpected release package: ${name}`)
  }

  if (packageJson.version !== version) {
    throw new Error(`Package ${name} does not record release version ${version}`)
  }

  const releaseMetadata = readOptionalObject(packageJson.prismaLosslessRelease)

  if (releaseMetadata.version !== version || releaseMetadata.sourceCommit !== sourceCommit) {
    throw new Error(`Package ${name} does not record the expected release provenance`)
  }

  for (const section of DEPENDENCY_SECTIONS) {
    const dependencies = readOptionalStringMap(packageJson[section])

    for (const [dependencyName, specifier] of Object.entries(dependencies)) {
      assertAllowedDependencySpecifier(name, dependencyName, specifier)
    }
  }
}

export function assertReleaseGraphDependencyOrder(packages = RELEASE_PACKAGES): void {
  const packageIndexes = new Map(packages.map((releasePackage, index) => [releasePackage.name, index]))

  for (const releasePackage of packages) {
    const packageJson = readPackageJson(path.join(process.cwd(), releasePackage.sourceDir, 'package.json'))
    const packageIndex = packageIndexes.get(releasePackage.name)

    if (packageIndex === undefined) {
      throw new Error(`Release package is missing from the graph: ${releasePackage.name}`)
    }

    const dependencies = readOptionalStringMap(packageJson.dependencies)

    for (const dependencyName of Object.keys(dependencies)) {
      const dependencyIndex = packageIndexes.get(dependencyName)

      if (dependencyIndex !== undefined && dependencyIndex >= packageIndex) {
        throw new Error(`${releasePackage.name} must be published after ${dependencyName}`)
      }
    }
  }
}

export function buildPrivateReleasePackageJsons(version: string, sourceCommit: string): Map<string, JsonObject> {
  assertReleaseGraphDependencyOrder()

  return new Map(
    RELEASE_PACKAGES.map((releasePackage) => {
      const packageJson = readPackageJson(path.join(process.cwd(), releasePackage.sourceDir, 'package.json'))
      return [releasePackage.name, rewritePackageJsonForPrivateRelease(packageJson, version, sourceCommit)]
    }),
  )
}

export function readPublishedVersions(
  packageName: string,
  registry = DEFAULT_REGISTRY_URL,
  paths: RegistryRuntimePaths = getRegistryRuntimePaths(),
): string[] {
  const approvedRegistry = assertApprovedPublishRegistry(registry)
  const result = spawnSync(
    'npm',
    [
      'view',
      packageName,
      'versions',
      '--json',
      '--registry',
      approvedRegistry,
      '--userconfig',
      paths.npmUserConfigFile,
    ],
    {
      encoding: 'utf-8',
    },
  )
  const output = `${result.stdout}\n${result.stderr}`

  if (result.status !== 0) {
    if (output.includes('E404') || output.includes('404 Not Found')) {
      return []
    }

    throw new Error(`npm view ${packageName} failed with exit code ${result.status}: ${output.trim()}`)
  }

  const trimmed = result.stdout.trim()

  if (trimmed === '') {
    return []
  }

  const parsed: unknown = JSON.parse(trimmed)

  if (typeof parsed === 'string') {
    return [parsed]
  }

  if (Array.isArray(parsed) && parsed.every((version): version is string => typeof version === 'string')) {
    return parsed
  }

  throw new Error(`npm view ${packageName} returned malformed versions JSON`)
}

export function selectNextPrivateRegistryVersion(
  registry = DEFAULT_REGISTRY_URL,
  paths: RegistryRuntimePaths = getRegistryRuntimePaths(),
): string {
  const publishedVersions = RELEASE_PACKAGES.flatMap((releasePackage) =>
    readPublishedVersions(releasePackage.name, registry, paths),
  )

  return selectNextReleaseVersion(publishedVersions)
}

export function preparePrivateReleaseCandidates(
  registry = DEFAULT_REGISTRY_URL,
  outputRoot = DEFAULT_RELEASE_OUTPUT_ROOT,
  paths: RegistryRuntimePaths = getRegistryRuntimePaths(),
): ReleaseManifest {
  const approvedRegistry = assertApprovedPublishRegistry(registry)
  const version = selectNextPrivateRegistryVersion(approvedRegistry, paths)
  const sourceCommit = readSourceCommit()
  const runDir = path.join(path.resolve(outputRoot), 'runs', `${Date.now()}-${sourceCommit.slice(0, 12)}`)
  const stagingRoot = path.join(runDir, 'staging')
  const artifactsDir = path.join(runDir, 'artifacts')

  fs.mkdirSync(stagingRoot, { recursive: true })
  fs.mkdirSync(artifactsDir, { recursive: true })

  const packageJsons = buildPrivateReleasePackageJsons(version, sourceCommit)
  const packages = RELEASE_PACKAGES.map((releasePackage) => {
    const stagingDir = path.join(stagingRoot, packageSlug(releasePackage.name))
    const sourceDir = path.resolve(releasePackage.sourceDir)
    const packageJson = packageJsons.get(releasePackage.name)

    if (!packageJson) {
      throw new Error(`Missing rewritten package metadata for ${releasePackage.name}`)
    }

    copyPackageSource(sourceDir, stagingDir)
    fs.writeFileSync(path.join(stagingDir, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`)

    const tarballPath = packStagedPackage(stagingDir, artifactsDir, releasePackage.name, version)
    const packedPackageJson = readPackedPackageJson(tarballPath)
    validateReleasePackageMetadata(packedPackageJson, version, sourceCommit)

    return {
      name: releasePackage.name,
      version,
      sourceCommit,
      sourceDir,
      stagingDir,
      tarballPath,
    }
  })
  const manifest = {
    registry: approvedRegistry,
    version,
    sourceCommit,
    runDir,
    artifactsDir,
    packages,
  }

  fs.writeFileSync(path.join(runDir, 'private-release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

  return manifest
}

export function readPackedPackageJson(tarballPath: string): JsonObject {
  const result = spawnSync('tar', ['-xOf', tarballPath, 'package/package.json'], {
    encoding: 'utf-8',
  })

  if (result.status !== 0) {
    throw new Error(`Failed to read package metadata from ${tarballPath}: ${result.stderr.trim()}`)
  }

  return parseJsonObject(result.stdout)
}

function rewriteDependencySection(packageJson: JsonObject, section: DependencySection, version: string): void {
  if (section === 'devDependencies') {
    delete packageJson.devDependencies
    return
  }

  const dependencies = readOptionalStringMap(packageJson[section])
  const rewrittenDependencies: Record<string, string> = {}

  for (const [dependencyName, specifier] of Object.entries(dependencies)) {
    if (specifier.startsWith('workspace:')) {
      if (!RELEASE_PACKAGE_NAMES.has(dependencyName)) {
        throw new Error(`Dependency ${dependencyName} is not in the private release graph`)
      }

      rewrittenDependencies[dependencyName] = version
      continue
    }

    if (RELEASE_PACKAGE_NAMES.has(dependencyName) && (specifier === '*' || specifier === '0.0.0')) {
      rewrittenDependencies[dependencyName] = version
      continue
    }

    assertAllowedDependencySpecifier(readPackageName(packageJson), dependencyName, specifier)
    rewrittenDependencies[dependencyName] = specifier
  }

  if (Object.keys(rewrittenDependencies).length === 0) {
    delete packageJson[section]
  } else {
    packageJson[section] = rewrittenDependencies
  }
}

function assertAllowedDependencySpecifier(packageName: string, dependencyName: string, specifier: string): void {
  if (specifier === '0.0.0') {
    throw new Error(`${packageName} depends on ${dependencyName} with forbidden 0.0.0 specifier`)
  }

  if (specifier.startsWith('workspace:')) {
    throw new Error(`${packageName} depends on ${dependencyName} with forbidden workspace specifier`)
  }

  if (specifier.startsWith('file:') || specifier.startsWith('link:')) {
    throw new Error(`${packageName} depends on ${dependencyName} with forbidden local path specifier`)
  }

  if (/^(git\+|git:|github:|gitlab:|bitbucket:)/i.test(specifier) || specifier.includes('.git#')) {
    throw new Error(`${packageName} depends on ${dependencyName} with forbidden Git specifier`)
  }

  if (specifier.includes('#')) {
    throw new Error(`${packageName} depends on ${dependencyName} with forbidden branch specifier`)
  }

  if (/^(\.\.?\/|~\/|\/Users\/|\/home\/|\/private\/)/.test(specifier)) {
    throw new Error(`${packageName} depends on ${dependencyName} with forbidden checkout or home path`)
  }
}

function packStagedPackage(stagingDir: string, artifactsDir: string, packageName: string, version: string): string {
  const result = spawnSync('pnpm', ['pack', '--pack-destination', artifactsDir], {
    cwd: stagingDir,
    encoding: 'utf-8',
  })

  if (result.status !== 0) {
    throw new Error(`pnpm pack failed for ${packageName}: ${result.stdout}\n${result.stderr}`)
  }

  const tarballPath = path.join(artifactsDir, tarballFileName(packageName, version))

  if (!fs.existsSync(tarballPath)) {
    throw new Error(`pnpm pack did not produce expected tarball: ${tarballPath}`)
  }

  return tarballPath
}

function copyPackageSource(sourceDir: string, stagingDir: string): void {
  fs.cpSync(sourceDir, stagingDir, {
    recursive: true,
    filter: (sourcePath) => {
      const relative = path.relative(sourceDir, sourcePath)
      return !relative.split(path.sep).includes('node_modules') && !relative.split(path.sep).includes('.turbo')
    },
  })
}

function readSourceCommit(): string {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf-8',
  })

  if (result.status !== 0) {
    throw new Error(`git rev-parse HEAD failed: ${result.stderr.trim()}`)
  }

  return result.stdout.trim()
}

function readPackageJson(packageJsonPath: string): JsonObject {
  return parseJsonObject(fs.readFileSync(packageJsonPath, 'utf-8'))
}

function parseJsonObject(source: string): JsonObject {
  const parsed: unknown = JSON.parse(source)

  if (!isJsonObject(parsed)) {
    throw new Error('Expected a JSON object')
  }

  return parsed
}

function readPackageName(packageJson: JsonObject): string {
  if (typeof packageJson.name !== 'string') {
    throw new Error('Package metadata is missing a string name')
  }

  return packageJson.name
}

function readOptionalObject(value: unknown): JsonObject {
  return isJsonObject(value) ? value : {}
}

function readOptionalStringMap(value: unknown): Record<string, string> {
  if (value === undefined) {
    return {}
  }

  if (!isJsonObject(value)) {
    throw new Error('Expected dependency metadata to be an object')
  }

  const entries = Object.entries(value)

  if (!entries.every((entry): entry is [string, string] => typeof entry[1] === 'string')) {
    throw new Error('Expected dependency metadata values to be strings')
  }

  return Object.fromEntries(entries)
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cloneJsonObject(value: JsonObject): JsonObject {
  return parseJsonObject(JSON.stringify(value))
}

function packageSlug(packageName: string): string {
  return packageName.replace(/^@/, '').replace(/\//g, '-')
}

function tarballFileName(packageName: string, version: string): string {
  return `${packageSlug(packageName)}-${version}.tgz`
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function main(argv: string[]): void {
  const [command, registry = DEFAULT_REGISTRY_URL] = argv

  switch (command) {
    case 'build': {
      const manifest = preparePrivateReleaseCandidates(registry)
      console.log(JSON.stringify(manifest, null, 2))
      return
    }
    case 'next-version':
      console.log(selectNextPrivateRegistryVersion(registry))
      return
    default:
      throw new Error(
        'Usage: pnpm exec tsx scripts/lossless-private-release.ts ' + '[build|next-version] <approved-registry>',
      )
  }
}

if (require.main === module) {
  try {
    main(process.argv.slice(2))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    process.exit(1)
  }
}
