import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  assertApprovedPublishRegistry,
  DEFAULT_REGISTRY_URL,
  getRegistryRuntimePaths,
  type RegistryRuntimePaths,
} from './private-registry'
import {
  PRIVATE_RELEASE_IDENTITIES,
  type PrivateReleaseIdentity,
  type PrivateReleasePackageIdentity,
} from './private-release-identities'

export const PRIVATE_RELEASE_VERSION_PREFIX = '7.8.0-lossless'
export const DEFAULT_RELEASE_OUTPUT_ROOT = path.join(os.tmpdir(), 'prisma-private-release-candidates')

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

export const RELEASE_PACKAGES: readonly ReleasePackage[] = [
  { name: '@prisma-lossless/debug', sourceDir: 'packages/debug' },
  {
    name: '@prisma-lossless/driver-adapter-utils',
    sourceDir: 'packages/driver-adapter-utils',
  },
  { name: '@prisma-lossless/get-platform', sourceDir: 'packages/get-platform' },
  { name: '@prisma-lossless/fetch-engine', sourceDir: 'packages/fetch-engine' },
  { name: '@prisma-lossless/engines', sourceDir: 'packages/engines' },
  { name: '@prisma-lossless/config', sourceDir: 'packages/config' },
  {
    name: '@prisma-lossless/client-runtime-utils',
    sourceDir: 'packages/client-runtime-utils',
  },
  { name: '@prisma-lossless/adapter-pg', sourceDir: 'packages/adapter-pg' },
  { name: '@prisma-lossless/client', sourceDir: 'packages/client' },
  { name: 'prisma-lossless', sourceDir: 'packages/cli' },
]

export const PRIVATE_RELEASE_SOURCE_DIRS: readonly string[] = [
  ...RELEASE_PACKAGES.map((releasePackage) => releasePackage.sourceDir),
  'helpers/compile',
  'packages/client-generator-js',
  'packages/client-generator-ts',
]

const RELEASE_PACKAGE_NAMES = new Set(RELEASE_PACKAGES.map((releasePackage) => releasePackage.name))
const RELEASE_PACKAGE_MTIME = new Date('1985-10-26T08:15:00.000Z')
const ROOT_LICENSE_FILE = path.join(process.cwd(), 'LICENSE')

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

export function assertPinnedReleaseVersion(version: string): void {
  const releaseVersion = new RegExp(`^${escapeRegExp(PRIVATE_RELEASE_VERSION_PREFIX)}\\.[1-9]\\d*$`)

  if (!releaseVersion.test(version)) {
    throw new Error(`Pinned private release version is invalid: ${version}`)
  }
}

export function assertReleaseSourcesMatchCommit(
  sourceCommit: string,
  checkout = process.cwd(),
  sourcePaths: readonly string[] = PRIVATE_RELEASE_SOURCE_DIRS,
): void {
  const verifyResult = spawnSync('git', ['rev-parse', '--verify', `${sourceCommit}^{commit}`], {
    cwd: checkout,
    encoding: 'utf-8',
  })

  if (verifyResult.status !== 0) {
    throw new Error(`Pinned private release source commit does not exist: ${sourceCommit}`)
  }

  const committedDiff = spawnSync('git', ['diff', '--quiet', sourceCommit, 'HEAD', '--', ...sourcePaths], {
    cwd: checkout,
    encoding: 'utf-8',
  })
  const worktreeDiff = spawnSync('git', ['diff', '--quiet', 'HEAD', '--', ...sourcePaths], {
    cwd: checkout,
    encoding: 'utf-8',
  })

  if (committedDiff.status === 1 || worktreeDiff.status === 1) {
    throw new Error(`Release package sources differ from provenance commit ${sourceCommit}`)
  }

  if (committedDiff.status !== 0 || worktreeDiff.status !== 0) {
    throw new Error(`Could not verify release package sources against ${sourceCommit}`)
  }
}

export function validateReleasePackageMetadata(packageJson: JsonObject, version: string, sourceCommit: string): void {
  void sourceCommit
  const name = readPackageName(packageJson)

  if (!RELEASE_PACKAGE_NAMES.has(name)) {
    throw new Error(`Unexpected release package: ${name}`)
  }

  if (packageJson.version !== version) {
    throw new Error(`Package ${name} does not record release version ${version}`)
  }

  for (const section of DEPENDENCY_SECTIONS) {
    const dependencies = readOptionalStringMap(packageJson[section])

    for (const [dependencyName, specifier] of Object.entries(dependencies)) {
      assertAllowedDependencySpecifier(name, dependencyName, specifier, version)
    }
  }
}

export function assertReleaseGraphDependencyOrder(packages = RELEASE_PACKAGES): void {
  const packageIndexes = new Map(packages.map((releasePackage, index) => [releasePackage.name, index]))

  for (const releasePackage of packages) {
    const packageJson = readPackageJson(path.join(process.cwd(), releasePackage.sourceDir, 'package.json'))
    const packageName = readPackageName(packageJson)
    const packageIndex = packageIndexes.get(releasePackage.name)

    if (packageIndex === undefined) {
      throw new Error(`Release package is missing from the graph: ${releasePackage.name}`)
    }

    if (packageName !== releasePackage.name) {
      throw new Error(
        `Release package ${releasePackage.sourceDir} is named ${packageName}; expected ${releasePackage.name}`,
      )
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

  return preparePrivateReleaseCandidatesForIdentity(approvedRegistry, version, sourceCommit, outputRoot)
}

export function preparePinnedPrivateReleaseCandidates(
  version: string,
  sourceCommit: string,
  outputRoot = DEFAULT_RELEASE_OUTPUT_ROOT,
): ReleaseManifest {
  assertPinnedReleaseVersion(version)
  assertReleaseOutputRootOutsideCheckout(outputRoot)
  assertReleaseSourcesMatchCommit(sourceCommit)

  return preparePrivateReleaseCandidatesForIdentity(DEFAULT_REGISTRY_URL, version, sourceCommit, outputRoot)
}

export function prepareBuiltPrivateReleaseCandidates(
  version: string,
  outputRoot = DEFAULT_RELEASE_OUTPUT_ROOT,
): ReleaseManifest {
  assertPinnedReleaseVersion(version)
  const releaseIdentity = readPrivateReleaseIdentity(version)
  assertAvailablePrivateReleaseIdentity(releaseIdentity)
  assertReleaseSourcesMatchCommit(releaseIdentity.sourceCommit)

  const manifest = preparePrivateReleaseCandidatesForIdentity(
    DEFAULT_REGISTRY_URL,
    version,
    releaseIdentity.sourceCommit,
    outputRoot,
  )
  validateReleaseManifestIntegrity(manifest, releaseIdentity)
  return manifest
}

export function readPrivateReleaseIdentity(
  version: string,
  identities: readonly PrivateReleaseIdentity[] = PRIVATE_RELEASE_IDENTITIES,
): PrivateReleaseIdentity {
  const releaseIdentity = identities.find((identity) => identity.version === version)

  if (!releaseIdentity) {
    throw new Error(
      `No immutable private release identity is recorded for ${version}. ` +
        `Mint a new prisma-lossless private release version before using --from-built.`,
    )
  }

  validatePrivateReleaseIdentity(releaseIdentity)
  return releaseIdentity
}

export function assertAvailablePrivateReleaseIdentity(releaseIdentity: PrivateReleaseIdentity): void {
  if (releaseIdentity.status !== 'unavailable') {
    return
  }

  const replacement = releaseIdentity.replacementVersion
    ? ` Use ${releaseIdentity.replacementVersion} or mint a new prisma-lossless private release version.`
    : ' Mint a new prisma-lossless private release version.'
  const reason = releaseIdentity.unavailableReason ? ` ${releaseIdentity.unavailableReason}` : ''

  throw new Error(
    `Private release ${releaseIdentity.version} is recorded as unavailable and cannot be reproduced.` +
      `${reason}${replacement}`,
  )
}

export function validatePrivateReleaseIdentity(releaseIdentity: PrivateReleaseIdentity): void {
  assertPinnedReleaseVersion(releaseIdentity.version)

  if (!/^[0-9a-f]{40}$/.test(releaseIdentity.sourceCommit)) {
    throw new Error(`Private release ${releaseIdentity.version} records an invalid source commit`)
  }

  if (
    releaseIdentity.status !== undefined &&
    releaseIdentity.status !== 'available' &&
    releaseIdentity.status !== 'unavailable'
  ) {
    throw new Error(`Private release ${releaseIdentity.version} records an invalid availability status`)
  }

  if (releaseIdentity.replacementVersion !== undefined) {
    assertPinnedReleaseVersion(releaseIdentity.replacementVersion)
  }

  if (releaseIdentity.packages.length !== RELEASE_PACKAGES.length) {
    throw new Error(
      `Private release ${releaseIdentity.version} records ${releaseIdentity.packages.length} packages; ` +
        `expected ${RELEASE_PACKAGES.length}`,
    )
  }

  releaseIdentity.packages.forEach((releasePackage, index) => {
    const expectedName = RELEASE_PACKAGES[index].name

    if (releasePackage.name !== expectedName) {
      throw new Error(
        `Private release ${releaseIdentity.version} package ${index} is ${releasePackage.name}; ` +
          `expected ${expectedName}`,
      )
    }

    if (!/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(releasePackage.integrity)) {
      throw new Error(`Private release ${releaseIdentity.version} package ${releasePackage.name} has bad integrity`)
    }
  })
}

export function validateReleaseManifestIntegrity(
  manifest: ReleaseManifest,
  releaseIdentity: PrivateReleaseIdentity,
): void {
  validatePrivateReleaseIdentity(releaseIdentity)

  if (manifest.version !== releaseIdentity.version || manifest.sourceCommit !== releaseIdentity.sourceCommit) {
    throw new Error(`Prepared release manifest does not match immutable release identity ${releaseIdentity.version}`)
  }

  if (manifest.packages.length !== releaseIdentity.packages.length) {
    throw new Error(`Prepared release manifest for ${manifest.version} has an incomplete package graph`)
  }

  manifest.packages.forEach((releasePackage, index) => {
    const packageIdentity: PrivateReleasePackageIdentity = releaseIdentity.packages[index]

    if (releasePackage.name !== packageIdentity.name) {
      throw new Error(`Prepared release package ${index} is ${releasePackage.name}; expected ${packageIdentity.name}`)
    }

    const actualIntegrity = calculateTarballIntegrity(releasePackage.tarballPath)

    if (actualIntegrity !== packageIdentity.integrity) {
      throw new Error(
        `Prepared release package ${releasePackage.name}@${releasePackage.version} has integrity ${actualIntegrity}; ` +
          `expected ${packageIdentity.integrity}. Refusing to mutate immutable private release ${manifest.version}.`,
      )
    }
  })
}

export function calculateTarballIntegrity(tarballPath: string): string {
  return `sha512-${createHash('sha512').update(fs.readFileSync(tarballPath)).digest('base64')}`
}

function preparePrivateReleaseCandidatesForIdentity(
  registry: string,
  version: string,
  sourceCommit: string,
  outputRoot: string,
): ReleaseManifest {
  assertReleaseOutputRootOutsideCheckout(outputRoot)

  const runDir = path.join(path.resolve(outputRoot), 'runs', `${Date.now()}-${sourceCommit.slice(0, 12)}`)
  const stagingRoot = path.join(runDir, 'staging')
  const artifactsDir = path.join(runDir, 'artifacts')

  fs.mkdirSync(stagingRoot, { recursive: true })
  fs.mkdirSync(artifactsDir, { recursive: true })

  assertReleaseGraphDependencyOrder()
  const packages = RELEASE_PACKAGES.map((releasePackage) => {
    const stagingDir = path.join(stagingRoot, packageSlug(releasePackage.name))
    const sourceDir = path.resolve(releasePackage.sourceDir)

    copyPackageSource(sourceDir, stagingDir)
    copyRootLicenseFile(stagingDir)
    normalizePackageStagingMetadata(stagingDir)

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
    registry,
    version,
    sourceCommit,
    runDir,
    artifactsDir,
    packages,
  }

  fs.writeFileSync(path.join(runDir, 'private-release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

  return manifest
}

function assertReleaseOutputRootOutsideCheckout(outputRoot: string): void {
  const resolvedOutputRoot = path.resolve(outputRoot)
  const relativeOutputRoot = path.relative(process.cwd(), resolvedOutputRoot)

  if (relativeOutputRoot === '' || (!relativeOutputRoot.startsWith('..') && !path.isAbsolute(relativeOutputRoot))) {
    throw new Error(
      `Private release output root must be outside the prisma checkout: ${resolvedOutputRoot}. ` +
        `Use an external temporary directory so npm packlist cannot apply checkout-local Git ignore rules.`,
    )
  }
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

function assertAllowedDependencySpecifier(
  packageName: string,
  dependencyName: string,
  specifier: string,
  version: string,
): void {
  if (RELEASE_PACKAGE_NAMES.has(dependencyName) && specifier !== version) {
    throw new Error(
      `${packageName} depends on ${dependencyName} with ${specifier}; expected exact private release ${version}`,
    )
  }

  if (specifier.startsWith('npm:')) {
    assertAllowedNpmAliasSpecifier(packageName, dependencyName, specifier, version)
    return
  }

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

function assertAllowedNpmAliasSpecifier(
  packageName: string,
  dependencyName: string,
  specifier: string,
  version: string,
): void {
  void version
  throw new Error(`${packageName} depends on ${dependencyName} with forbidden npm alias specifier ${specifier}`)
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

function copyRootLicenseFile(stagingDir: string): void {
  const stagedLicenseFile = path.join(stagingDir, 'LICENSE')

  if (
    !fs.statSync(stagedLicenseFile, { throwIfNoEntry: false })?.isFile() &&
    fs.statSync(ROOT_LICENSE_FILE, { throwIfNoEntry: false })?.isFile()
  ) {
    fs.copyFileSync(ROOT_LICENSE_FILE, stagedLicenseFile)
  }
}

function normalizePackageStagingMetadata(stagingDir: string): void {
  for (const entry of fs.readdirSync(stagingDir, { withFileTypes: true })) {
    const entryPath = path.join(stagingDir, entry.name)

    if (entry.isDirectory()) {
      normalizePackageStagingMetadata(entryPath)
      fs.utimesSync(entryPath, RELEASE_PACKAGE_MTIME, RELEASE_PACKAGE_MTIME)
      continue
    }

    if (entry.isSymbolicLink() && typeof fs.lutimesSync === 'function') {
      fs.lutimesSync(entryPath, RELEASE_PACKAGE_MTIME, RELEASE_PACKAGE_MTIME)
      continue
    }

    fs.utimesSync(entryPath, RELEASE_PACKAGE_MTIME, RELEASE_PACKAGE_MTIME)
  }

  fs.utimesSync(stagingDir, RELEASE_PACKAGE_MTIME, RELEASE_PACKAGE_MTIME)
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
  const [command, ...args] = argv

  switch (command) {
    case 'build': {
      const registry = args[0] ?? DEFAULT_REGISTRY_URL
      const manifest = preparePrivateReleaseCandidates(registry)
      console.log(JSON.stringify(manifest, null, 2))
      return
    }
    case 'build-pinned': {
      const [version, sourceCommit, outputRoot] = args

      if (!version || !sourceCommit) {
        throw new Error('build-pinned requires an exact version and source commit')
      }

      const manifest = preparePinnedPrivateReleaseCandidates(version, sourceCommit, outputRoot)
      console.log(path.join(manifest.runDir, 'private-release-manifest.json'))
      return
    }
    case 'next-version':
      console.log(selectNextPrivateRegistryVersion(args[0] ?? DEFAULT_REGISTRY_URL))
      return
    default:
      throw new Error(
        'Usage: pnpm exec tsx scripts/private-release.ts ' +
          '[build|next-version] <approved-registry> | ' +
          'build-pinned <version> <source-commit> [output-root]',
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
