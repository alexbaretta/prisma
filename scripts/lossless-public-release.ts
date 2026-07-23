export type LosslessPublicReleasePackage = {
  name: string
  sourceDir: string
}

type JsonObject = Record<string, unknown>
type DependencySection =
  | 'dependencies'
  | 'devDependencies'
  | 'optionalDependencies'
  | 'peerDependencies'
  | 'bundledDependencies'
  | 'bundleDependencies'

export const LOSSLESS_PUBLIC_RELEASE_PACKAGES: readonly LosslessPublicReleasePackage[] = [
  { name: '@prisma-lossless/debug', sourceDir: 'packages/debug' },
  {
    name: '@prisma-lossless/driver-adapter-utils',
    sourceDir: 'packages/driver-adapter-utils',
  },
  { name: '@prisma-lossless/get-platform', sourceDir: 'packages/get-platform' },
  { name: '@prisma-lossless/query-plan-executor', sourceDir: 'packages/query-plan-executor' },
  { name: '@prisma-lossless/streams-local', sourceDir: 'packages/streams-local' },
  { name: '@prisma-lossless/dev', sourceDir: 'packages/dev' },
  { name: '@prisma-lossless/studio-core', sourceDir: 'packages/studio-core' },
  { name: '@prisma-lossless/engines-version', sourceDir: 'packages/engines-version' },
  { name: '@prisma-lossless/fetch-engine', sourceDir: 'packages/fetch-engine' },
  { name: '@prisma-lossless/engines', sourceDir: 'packages/engines' },
  { name: '@prisma-lossless/config', sourceDir: 'packages/config' },
  {
    name: '@prisma-lossless/client-runtime-utils',
    sourceDir: 'packages/client-runtime-utils',
  },
  { name: '@prisma-lossless/adapter-pg', sourceDir: 'packages/adapter-pg' },
  { name: '@prisma-lossless/client', sourceDir: 'packages/client' },
  { name: '@prisma-lossless/cli', sourceDir: 'packages/cli' },
]

export const LOSSLESS_PUBLIC_PACKAGE_REPOSITORY_URL = 'https://github.com/alexbaretta/prisma.git'
export const LOSSLESS_PUBLIC_PACKAGE_HOMEPAGE_URL = 'https://github.com/alexbaretta/prisma#readme'
export const LOSSLESS_PUBLIC_PACKAGE_BUGS_URL = 'https://github.com/alexbaretta/prisma/issues'

const LOSSLESS_PUBLIC_PACKAGE_NAMES = new Set(
  LOSSLESS_PUBLIC_RELEASE_PACKAGES.map((releasePackage) => releasePackage.name),
)
const DEPENDENCY_SECTIONS: readonly DependencySection[] = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
  'bundledDependencies',
  'bundleDependencies',
]
const PACKAGE_GRAPH_DEPENDENCY_SECTIONS: readonly DependencySection[] = [
  'dependencies',
  'optionalDependencies',
  'peerDependencies',
  'bundledDependencies',
  'bundleDependencies',
]

export function validateLosslessPublicPackageMetadata(packageJson: JsonObject, version: string): void {
  const name = readPackageName(packageJson)

  if (!LOSSLESS_PUBLIC_PACKAGE_NAMES.has(name)) {
    throw new Error(`Unexpected lossless public package: ${name}`)
  }

  if (packageJson.version !== version) {
    throw new Error(`Package ${name} does not record release version ${version}`)
  }

  assertLosslessPublicPackageExternalMetadata(name, packageJson)
  assertNoStockPrismaPackageGraphDependencies(name, packageJson)

  for (const section of DEPENDENCY_SECTIONS) {
    const dependencies = readDependencyNames(packageJson, section)

    for (const dependencyName of dependencies) {
      if (LOSSLESS_PUBLIC_PACKAGE_NAMES.has(dependencyName)) {
        const specifier = readDependencySpecifier(packageJson, section, dependencyName)

        if (specifier !== version) {
          throw new Error(
            `${name} depends on ${dependencyName} with ${specifier}; expected exact public release ${version}`,
          )
        }
      }
    }
  }
}

function assertLosslessPublicPackageExternalMetadata(packageName: string, packageJson: JsonObject): void {
  const repositoryUrl = readRepositoryUrl(packageJson.repository)

  if (repositoryUrl !== LOSSLESS_PUBLIC_PACKAGE_REPOSITORY_URL) {
    throw new Error(
      `Package ${packageName} records repository ${repositoryUrl ?? '<missing>'}; ` +
        `expected ${LOSSLESS_PUBLIC_PACKAGE_REPOSITORY_URL}`,
    )
  }

  assertOptionalMetadataUrl(packageName, 'homepage', packageJson.homepage, LOSSLESS_PUBLIC_PACKAGE_HOMEPAGE_URL)
  assertOptionalMetadataUrl(packageName, 'bugs', readBugsUrl(packageJson.bugs), LOSSLESS_PUBLIC_PACKAGE_BUGS_URL)
}

function assertNoStockPrismaPackageGraphDependencies(packageName: string, packageJson: JsonObject): void {
  for (const section of PACKAGE_GRAPH_DEPENDENCY_SECTIONS) {
    for (const dependencyName of readDependencyNames(packageJson, section)) {
      if (isStockPrismaPackageName(dependencyName)) {
        throw new Error(
          `${packageName} has forbidden stock Prisma package identity ${dependencyName} in ${section}. ` +
            'Use a prisma-lossless package identity instead.',
        )
      }
    }
  }
}

function readDependencyNames(packageJson: JsonObject, section: DependencySection): readonly string[] {
  const value = packageJson[section]

  if (value === undefined) {
    return []
  }

  if (section === 'bundledDependencies' || section === 'bundleDependencies') {
    return readOptionalStringList(value)
  }

  return Object.keys(readOptionalStringMap(value))
}

function readDependencySpecifier(packageJson: JsonObject, section: DependencySection, dependencyName: string): string {
  const value = packageJson[section]

  if (section === 'bundledDependencies' || section === 'bundleDependencies') {
    throw new Error(`${dependencyName} is a bundled dependency without an exact version specifier`)
  }

  return readOptionalStringMap(value)[dependencyName] ?? ''
}

function readPackageName(packageJson: JsonObject): string {
  if (typeof packageJson.name !== 'string') {
    throw new Error('Package metadata is missing a string name')
  }

  return packageJson.name
}

function readRepositoryUrl(repository: unknown): string | undefined {
  if (typeof repository === 'string') {
    return repository
  }

  if (isJsonObject(repository) && typeof repository.url === 'string') {
    return repository.url
  }

  return undefined
}

function readBugsUrl(bugs: unknown): string | undefined {
  if (typeof bugs === 'string') {
    return bugs
  }

  if (isJsonObject(bugs) && typeof bugs.url === 'string') {
    return bugs.url
  }

  return undefined
}

function assertOptionalMetadataUrl(packageName: string, metadataName: string, actual: unknown, expected: string): void {
  if (actual === undefined) {
    return
  }

  if (actual !== expected) {
    throw new Error(`Package ${packageName} records ${metadataName} ${String(actual)}; expected ${expected}`)
  }
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

function readOptionalStringList(value: unknown): readonly string[] {
  if (value === undefined) {
    return []
  }

  if (!Array.isArray(value) || !value.every((entry): entry is string => typeof entry === 'string')) {
    throw new Error('Expected bundled dependency metadata to be a string array')
  }

  return value
}

function isStockPrismaPackageName(packageName: string): boolean {
  return packageName === 'prisma' || packageName.startsWith('@prisma/')
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
