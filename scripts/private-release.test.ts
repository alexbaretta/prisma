import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, test } from 'vitest'

import {
  assertAvailablePrivateReleaseIdentity,
  assertNoStockPrismaPackageIdentitiesInPnpmLock,
  assertPinnedReleaseVersion,
  assertReleaseGraphDependencyOrder,
  assertReleaseSourcesMatchCommit,
  calculateTarballIntegrity,
  prepareBuiltPrivateReleaseCandidates,
  preparePinnedPrivateReleaseCandidates,
  PRIVATE_RELEASE_SOURCE_DIRS,
  PRIVATE_RELEASE_VERSION_PREFIX,
  readPnpmLockPackageIdentities,
  readPrivateReleaseIdentity,
  RELEASE_PACKAGE_BUGS_URL,
  RELEASE_PACKAGE_HOMEPAGE_URL,
  RELEASE_PACKAGE_REPOSITORY_URL,
  RELEASE_PACKAGES,
  selectNextReleaseVersion,
  validatePrivateReleaseIdentity,
  validateReleaseManifestIntegrity,
  validateReleasePackageMetadata,
} from './private-release'
import { readIndependentPrivateReleaseFixture } from './private-release-fixtures'

const releaseVersion = `${PRIVATE_RELEASE_VERSION_PREFIX}.17`
const sourceCommit = '0123456789abcdef0123456789abcdef01234567'

describe('lossless private release graph', () => {
  test('selects the next unused immutable prerelease number', () => {
    expect(selectNextReleaseVersion([])).toBe(`${PRIVATE_RELEASE_VERSION_PREFIX}.1`)
    expect(
      selectNextReleaseVersion([
        '7.8.0',
        `${PRIVATE_RELEASE_VERSION_PREFIX}.1`,
        `${PRIVATE_RELEASE_VERSION_PREFIX}.4`,
        '7.8.0-lossless-canary.99',
      ]),
    ).toBe(`${PRIVATE_RELEASE_VERSION_PREFIX}.5`)
  })

  test('accepts only exact numbered lossless release versions', () => {
    expect(() => assertPinnedReleaseVersion('7.8.0-lossless.5')).not.toThrow()

    for (const version of ['7.8.0-lossless.0', '7.8.0-lossless', '7.8.0-lossless.5-next', '^7.8.0-lossless.5']) {
      expect(() => assertPinnedReleaseVersion(version)).toThrow(/version is invalid/)
    }
  })

  test('resolves recorded immutable release identity', () => {
    const identity = readPrivateReleaseIdentity('7.8.0-lossless.5')
    const retiredIdentity = readPrivateReleaseIdentity('7.8.0-lossless.6')
    const randomMapIdentity = readPrivateReleaseIdentity('7.8.0-lossless.7')
    const staleChunkIdentity = readPrivateReleaseIdentity('7.8.0-lossless.8')
    const missingLifecycleIdentity = readPrivateReleaseIdentity('7.8.0-lossless.9')
    const stagedMetadataIdentity = readPrivateReleaseIdentity('7.8.0-lossless.10')
    const unscopedPublicIdentity = readPrivateReleaseIdentity('7.8.0-lossless.11')
    const stockMetadataIdentity = readPrivateReleaseIdentity('7.8.0-lossless.12')
    const latestStockMetadataIdentity = readPrivateReleaseIdentity('7.8.0-lossless.13')
    const currentIdentity = readPrivateReleaseIdentity('7.8.0-lossless.15')
    const historicalFixture = readIndependentPrivateReleaseFixture('7.8.0-lossless.5')
    const currentFixture = readIndependentPrivateReleaseFixture('7.8.0-lossless.15')

    expect(identity.sourceCommit).toBe('f98f2e0f42cd7d9d9556567f9236c98eed00da16')
    expect(identity.status).toBe('unavailable')
    expect(identity.replacementVersion).toBe('7.8.0-lossless.15')
    expect(retiredIdentity.status).toBe('unavailable')
    expect(retiredIdentity.replacementVersion).toBe('7.8.0-lossless.15')
    expect(randomMapIdentity.status).toBe('unavailable')
    expect(randomMapIdentity.replacementVersion).toBe('7.8.0-lossless.15')
    expect(staleChunkIdentity.status).toBe('unavailable')
    expect(staleChunkIdentity.replacementVersion).toBe('7.8.0-lossless.15')
    expect(missingLifecycleIdentity.status).toBe('unavailable')
    expect(missingLifecycleIdentity.replacementVersion).toBe('7.8.0-lossless.15')
    expect(stagedMetadataIdentity.status).toBe('unavailable')
    expect(stagedMetadataIdentity.replacementVersion).toBe('7.8.0-lossless.15')
    expect(identity.packages).toEqual(
      historicalFixture.packages.map(({ name, integrity }) => ({
        name,
        integrity,
      })),
    )
    expect(unscopedPublicIdentity.status).toBe('unavailable')
    expect(unscopedPublicIdentity.replacementVersion).toBe('7.8.0-lossless.15')
    expect(stockMetadataIdentity.status).toBe('unavailable')
    expect(stockMetadataIdentity.replacementVersion).toBe('7.8.0-lossless.15')
    expect(latestStockMetadataIdentity.status).toBe('unavailable')
    expect(latestStockMetadataIdentity.replacementVersion).toBe('7.8.0-lossless.15')
    expect(currentIdentity.status).toBe('available')
    expect(identity.packages).toHaveLength(historicalFixture.packages.length)
    expect(identity.packages[1]).toEqual({
      name: '@prisma-lossless/driver-adapter-utils',
      integrity: 'sha512-Ow22QHvHic7XNSozhTgreG6/KO5ZT4PO5NjOyxQP9Es/dgbeU9QXrPWFHJgCgn1FMv1zkISBZQqU+Iw01o4XAQ==',
    })
    expect(currentIdentity.packages).toEqual(
      currentFixture.packages.map(({ name, integrity }) => ({
        name,
        integrity,
      })),
    )
    expect(() => readPrivateReleaseIdentity('7.8.0-lossless.999999')).toThrow(/No immutable private release identity/)
  })

  test('rejects unavailable historical versions before packing built artifacts', () => {
    const identity = readPrivateReleaseIdentity('7.8.0-lossless.5')
    const retiredIdentity = readPrivateReleaseIdentity('7.8.0-lossless.6')
    const randomMapIdentity = readPrivateReleaseIdentity('7.8.0-lossless.7')
    const staleChunkIdentity = readPrivateReleaseIdentity('7.8.0-lossless.8')
    const missingLifecycleIdentity = readPrivateReleaseIdentity('7.8.0-lossless.9')
    const stagedMetadataIdentity = readPrivateReleaseIdentity('7.8.0-lossless.10')
    const unscopedPublicIdentity = readPrivateReleaseIdentity('7.8.0-lossless.11')
    const stockMetadataIdentity = readPrivateReleaseIdentity('7.8.0-lossless.12')
    const latestStockMetadataIdentity = readPrivateReleaseIdentity('7.8.0-lossless.13')

    expect(() => assertAvailablePrivateReleaseIdentity(identity)).toThrow(
      /Private release 7\.8\.0-lossless\.5 is recorded as unavailable/,
    )
    expect(() => assertAvailablePrivateReleaseIdentity(retiredIdentity)).toThrow(
      /Private release 7\.8\.0-lossless\.6 is recorded as unavailable/,
    )
    expect(() => assertAvailablePrivateReleaseIdentity(randomMapIdentity)).toThrow(
      /Private release 7\.8\.0-lossless\.7 is recorded as unavailable/,
    )
    expect(() => assertAvailablePrivateReleaseIdentity(staleChunkIdentity)).toThrow(
      /Private release 7\.8\.0-lossless\.8 is recorded as unavailable/,
    )
    expect(() => assertAvailablePrivateReleaseIdentity(missingLifecycleIdentity)).toThrow(
      /Private release 7\.8\.0-lossless\.9 is recorded as unavailable/,
    )
    expect(() => assertAvailablePrivateReleaseIdentity(stagedMetadataIdentity)).toThrow(
      /Private release 7\.8\.0-lossless\.10 is recorded as unavailable/,
    )
    expect(() => assertAvailablePrivateReleaseIdentity(unscopedPublicIdentity)).toThrow(
      /Private release 7\.8\.0-lossless\.11 is recorded as unavailable/,
    )
    expect(() => assertAvailablePrivateReleaseIdentity(stockMetadataIdentity)).toThrow(
      /Private release 7\.8\.0-lossless\.12 is recorded as unavailable/,
    )
    expect(() => assertAvailablePrivateReleaseIdentity(latestStockMetadataIdentity)).toThrow(
      /Private release 7\.8\.0-lossless\.13 is recorded as unavailable/,
    )
    expect(() => prepareBuiltPrivateReleaseCandidates('7.8.0-lossless.5')).toThrow(/Use 7.8.0-lossless.15/)
    expect(() => prepareBuiltPrivateReleaseCandidates('7.8.0-lossless.6')).toThrow(/Use 7.8.0-lossless.15/)
    expect(() => prepareBuiltPrivateReleaseCandidates('7.8.0-lossless.7')).toThrow(/Use 7.8.0-lossless.15/)
    expect(() => prepareBuiltPrivateReleaseCandidates('7.8.0-lossless.8')).toThrow(/Use 7.8.0-lossless.15/)
    expect(() => prepareBuiltPrivateReleaseCandidates('7.8.0-lossless.9')).toThrow(/Use 7.8.0-lossless.15/)
    expect(() => prepareBuiltPrivateReleaseCandidates('7.8.0-lossless.10')).toThrow(/Use 7.8.0-lossless.15/)
    expect(() => prepareBuiltPrivateReleaseCandidates('7.8.0-lossless.11')).toThrow(/Use 7.8.0-lossless.15/)
    expect(() => prepareBuiltPrivateReleaseCandidates('7.8.0-lossless.12')).toThrow(/Use 7.8.0-lossless.15/)
    expect(() => prepareBuiltPrivateReleaseCandidates('7.8.0-lossless.13')).toThrow(/Use 7.8.0-lossless.15/)
  })

  test('rejects incomplete or mismatched release identities', () => {
    const identity = readPrivateReleaseIdentity('7.8.0-lossless.5')

    expect(() => validatePrivateReleaseIdentity({ ...identity, packages: identity.packages.slice(1) })).toThrow(
      /records 9 packages/,
    )
    expect(() =>
      validatePrivateReleaseIdentity({
        ...identity,
        packages: [{ ...identity.packages[0], name: '@prisma-lossless/wrong' }, ...identity.packages.slice(1)],
      }),
    ).toThrow(/expected @prisma-lossless\/debug/)
    expect(() =>
      validatePrivateReleaseIdentity({
        ...identity,
        packages: [{ ...identity.packages[0], integrity: 'sha1-nope' }, ...identity.packages.slice(1)],
      }),
    ).toThrow(/bad integrity/)
    expect(() =>
      validatePrivateReleaseIdentity({
        ...identity,
        status: 'invalid' as 'available',
      }),
    ).toThrow(/invalid availability status/)
    expect(() =>
      validatePrivateReleaseIdentity({
        ...identity,
        replacementVersion: '^7.8.0-lossless.10',
      }),
    ).toThrow(/version is invalid/)
  })

  test('validates prepared tarballs against immutable integrity metadata', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-lossless-integrity-proof-'))
    const tarballPath = path.join(root, 'package.tgz')

    try {
      fs.writeFileSync(tarballPath, 'release-bytes')
      const integrity = calculateTarballIntegrity(tarballPath)
      const packages = RELEASE_PACKAGES.map((releasePackage) => ({
        name: releasePackage.name,
        version: releaseVersion,
        sourceCommit,
        sourceDir: releasePackage.sourceDir,
        stagingDir: root,
        tarballPath,
      }))
      const identity = {
        version: releaseVersion,
        sourceCommit,
        packages: RELEASE_PACKAGES.map((releasePackage) => ({ name: releasePackage.name, integrity })),
      }
      const manifest = {
        registry: 'http://127.0.0.1:4873/',
        version: releaseVersion,
        sourceCommit,
        runDir: root,
        artifactsDir: root,
        packages,
      }

      expect(() => validateReleaseManifestIntegrity(manifest, identity)).not.toThrow()
      expect(() =>
        validateReleaseManifestIntegrity(manifest, {
          ...identity,
          packages: [{ ...identity.packages[0], integrity: 'sha512-wrong' }, ...identity.packages.slice(1)],
        }),
      ).toThrow(/Refusing to mutate immutable private release/)
      expect(() => validateReleaseManifestIntegrity({ ...manifest, packages: packages.slice(1) }, identity)).toThrow(
        /incomplete package graph/,
      )
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('does not pack unknown built versions under --from-built', () => {
    expect(() => prepareBuiltPrivateReleaseCandidates('7.8.0-lossless.999999')).toThrow(
      /No immutable private release identity/,
    )
  })

  test('rejects release output roots inside the checkout', () => {
    expect(() =>
      preparePinnedPrivateReleaseCandidates(
        '7.8.0-lossless.7',
        'de26dd06509902ef202e675bb3eb2d2ee9b7fc4a',
        path.join(process.cwd(), 'tmp/release-inside-checkout'),
      ),
    ).toThrow(/output root must be outside the prisma checkout/)
  })

  test('allows tooling changes but rejects release-source drift', () => {
    const checkout = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-lossless-source-proof-'))

    try {
      fs.mkdirSync(path.join(checkout, 'package'), { recursive: true })
      fs.mkdirSync(path.join(checkout, 'scripts'), { recursive: true })
      fs.writeFileSync(path.join(checkout, 'package', 'index.ts'), 'export const value = 1\n')
      fs.writeFileSync(path.join(checkout, 'scripts', 'runner.ts'), 'export const runner = 1\n')
      runGit(checkout, ['init'])
      runGit(checkout, ['config', 'user.email', 'test@localhost.invalid'])
      runGit(checkout, ['config', 'user.name', 'Test'])
      runGit(checkout, ['add', '.'])
      runGit(checkout, ['commit', '-m', 'Initial'])
      const sourceCommit = runGit(checkout, ['rev-parse', 'HEAD'])
      const sourcePaths = ['package']

      fs.writeFileSync(path.join(checkout, 'scripts', 'runner.ts'), 'export const runner = 2\n')
      runGit(checkout, ['add', 'scripts/runner.ts'])
      runGit(checkout, ['commit', '-m', 'Change tooling'])
      expect(() => assertReleaseSourcesMatchCommit(sourceCommit, checkout, sourcePaths)).not.toThrow()

      fs.writeFileSync(path.join(checkout, 'package', 'index.ts'), 'export const value = 2\n')
      expect(() => assertReleaseSourcesMatchCommit(sourceCommit, checkout, sourcePaths)).toThrow(/sources differ/)
      expect(() => assertReleaseSourcesMatchCommit('missing-commit', checkout, sourcePaths)).toThrow(/does not exist/)
    } finally {
      fs.rmSync(checkout, { recursive: true, force: true })
    }
  })

  test('keeps the runtime closure in publish dependency order', () => {
    expect(RELEASE_PACKAGES.map((releasePackage) => releasePackage.name)).toEqual([
      '@prisma-lossless/debug',
      '@prisma-lossless/driver-adapter-utils',
      '@prisma-lossless/get-platform',
      '@prisma-lossless/query-plan-executor',
      '@prisma-lossless/streams-local',
      '@prisma-lossless/dev',
      '@prisma-lossless/studio-core',
      '@prisma-lossless/engines-version',
      '@prisma-lossless/fetch-engine',
      '@prisma-lossless/engines',
      '@prisma-lossless/config',
      '@prisma-lossless/client-runtime-utils',
      '@prisma-lossless/adapter-pg',
      '@prisma-lossless/client',
      '@prisma-lossless/cli',
    ])
    expect(() => assertReleaseGraphDependencyOrder()).not.toThrow()
  })

  test('tracks shared compile helpers as release source inputs', () => {
    expect(PRIVATE_RELEASE_SOURCE_DIRS).toContain('helpers/compile')
  })

  test('validates source-authored private release metadata', () => {
    const packageJson = {
      ...releaseMetadataFixture('packages/get-platform'),
      name: '@prisma-lossless/get-platform',
      version: releaseVersion,
      dependencies: {
        '@prisma-lossless/debug': releaseVersion,
        kleur: '4.1.5',
      },
      devDependencies: {
        typescript: '5.4.5',
      },
    }

    expect(() => validateReleasePackageMetadata(packageJson, releaseVersion, sourceCommit)).not.toThrow()
  })

  test('rejects source metadata that requires release-time rewriting', () => {
    expect(() =>
      validateReleasePackageMetadata(
        {
          name: '@prisma-lossless/get-platform',
          version: '0.0.0',
          dependencies: {
            '@prisma-lossless/debug': releaseVersion,
          },
        },
        releaseVersion,
        sourceCommit,
      ),
    ).toThrow(/does not record release version/)

    expect(() =>
      validateReleasePackageMetadata(
        {
          ...releaseMetadataFixture('packages/get-platform'),
          name: '@prisma-lossless/get-platform',
          version: releaseVersion,
          dependencies: {
            '@prisma-lossless/debug': 'workspace:*',
          },
        },
        releaseVersion,
        sourceCommit,
      ),
    ).toThrow(/expected exact private release/)

    expect(() =>
      validateReleasePackageMetadata(
        {
          ...releaseMetadataFixture('packages/get-platform'),
          name: '@prisma-lossless/get-platform',
          version: releaseVersion,
          dependencies: {
            '@prisma-lossless/debug': '0.0.0',
          },
        },
        releaseVersion,
        sourceCommit,
      ),
    ).toThrow(/expected exact private release/)
  })

  test('rejects stock source package identities', () => {
    expect(() =>
      validateReleasePackageMetadata(
        {
          name: '@prisma/get-platform',
          version: releaseVersion,
        },
        releaseVersion,
        sourceCommit,
      ),
    ).toThrow(/Unexpected release package/)
  })

  test('rejects forbidden release dependency specifiers', () => {
    for (const specifier of [
      '0.0.0',
      'workspace:*',
      'file:../local',
      'link:../local',
      'github:prisma/prisma#main',
      'git+https://github.com/prisma/prisma.git#main',
      `npm:@prisma-lossless/debug@${PRIVATE_RELEASE_VERSION_PREFIX}.99`,
      'npm:@evil/debug@7.8.0',
      '../checkout',
      '~/checkout',
    ]) {
      expect(() =>
        validateReleasePackageMetadata(
          {
            name: '@prisma-lossless/debug',
            version: releaseVersion,
            dependencies: {
              bad: specifier,
            },
          },
          releaseVersion,
          sourceCommit,
        ),
      ).toThrow()
    }
  })

  test('rejects stock Prisma identities in package graph metadata', () => {
    for (const section of ['dependencies', 'optionalDependencies', 'peerDependencies'] as const) {
      expect(() =>
        validateReleasePackageMetadata(
          {
            ...releaseMetadataFixture('packages/debug'),
            name: '@prisma-lossless/debug',
            version: releaseVersion,
            [section]: {
              '@prisma/debug': '7.2.0',
            },
          },
          releaseVersion,
          sourceCommit,
        ),
      ).toThrow(/forbidden stock Prisma package identity @prisma\/debug/)
    }

    for (const section of ['bundledDependencies', 'bundleDependencies'] as const) {
      expect(() =>
        validateReleasePackageMetadata(
          {
            ...releaseMetadataFixture('packages/debug'),
            name: '@prisma-lossless/debug',
            version: releaseVersion,
            [section]: ['@prisma/debug'],
          },
          releaseVersion,
          sourceCommit,
        ),
      ).toThrow(/forbidden stock Prisma package identity @prisma\/debug/)
    }

    expect(() =>
      validateReleasePackageMetadata(
        {
          ...releaseMetadataFixture('packages/debug'),
          name: '@prisma-lossless/debug',
          version: releaseVersion,
          dependencies: {
            prisma: '7.8.0',
          },
        },
        releaseVersion,
        sourceCommit,
      ),
    ).toThrow(/forbidden stock Prisma package identity prisma/)
  })

  test('rejects stock Prisma identities in resolved pnpm lockfiles', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-lossless-lock-proof-'))
    const lockfilePath = path.join(root, 'pnpm-lock.yaml')

    try {
      fs.writeFileSync(
        lockfilePath,
        `lockfileVersion: '9.0'
packages:
  '@prisma/dev@0.24.14(typescript@5.4.5)':
    resolution: {integrity: sha512-test}
  '@prisma/get-platform@7.2.0':
    resolution: {integrity: sha512-test}
  '@prisma/query-plan-executor@7.2.0':
    resolution: {integrity: sha512-test}
  '@prisma/streams-local@0.1.11':
    resolution: {integrity: sha512-test}
  '@prisma/studio-core@0.27.3(@types/react@19.2.14)':
    resolution: {integrity: sha512-test}
snapshots:
  '@prisma/get-platform@7.2.0':
    dependencies:
      '@prisma/debug': 7.2.0
  prisma@7.8.0:
    resolution: {integrity: sha512-test}
`,
      )

      expect(Array.from(readPnpmLockPackageIdentities(lockfilePath)).sort()).toEqual([
        '@prisma/debug',
        '@prisma/dev',
        '@prisma/get-platform',
        '@prisma/query-plan-executor',
        '@prisma/streams-local',
        '@prisma/studio-core',
        'prisma',
      ])
      expect(() => assertNoStockPrismaPackageIdentitiesInPnpmLock(lockfilePath)).toThrow(
        /forbidden stock Prisma package identities/,
      )
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('allows lossless package identities and ignores lockfile prose', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-lossless-lock-proof-'))
    const lockfilePath = path.join(root, 'pnpm-lock.yaml')

    try {
      fs.writeFileSync(
        lockfilePath,
        `lockfileVersion: '9.0'
packages:
  '@prisma-lossless/cli@7.8.0-lossless.15':
    resolution: {integrity: sha512-test}
  '@prisma-lossless/engines-version@7.8.0-lossless.15':
    resolution: {integrity: sha512-test}
snapshots:
  '@prisma-lossless/cli@7.8.0-lossless.15':
    dependencies:
      '@prisma-lossless/engines': 7.8.0-lossless.15
    description: 'Historical text may mention @prisma/debug.'
`,
      )

      expect(Array.from(readPnpmLockPackageIdentities(lockfilePath)).sort()).toEqual([
        '@prisma-lossless/cli',
        '@prisma-lossless/engines',
        '@prisma-lossless/engines-version',
      ])
      expect(() => assertNoStockPrismaPackageIdentitiesInPnpmLock(lockfilePath)).not.toThrow()
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('rejects npm aliases for fork-owned dependencies', () => {
    expect(() =>
      validateReleasePackageMetadata(
        {
          ...releaseMetadataFixture('packages/get-platform'),
          name: '@prisma-lossless/get-platform',
          version: releaseVersion,
          dependencies: {
            '@prisma-lossless/debug': `npm:@prisma-lossless/debug@${releaseVersion}`,
          },
        },
        releaseVersion,
        sourceCommit,
      ),
    ).toThrow(/expected exact private release/)
  })

  test('rejects stock Prisma package metadata in the public release graph', () => {
    const packageJson = {
      name: '@prisma-lossless/debug',
      version: releaseVersion,
      homepage: RELEASE_PACKAGE_HOMEPAGE_URL,
      repository: {
        type: 'git',
        url: RELEASE_PACKAGE_REPOSITORY_URL,
        directory: 'packages/debug',
      },
      bugs: RELEASE_PACKAGE_BUGS_URL,
    }

    expect(() => validateReleasePackageMetadata(packageJson, releaseVersion, sourceCommit)).not.toThrow()
    expect(() =>
      validateReleasePackageMetadata(
        {
          ...packageJson,
          repository: {
            type: 'git',
            url: 'https://github.com/prisma/prisma.git',
            directory: 'packages/debug',
          },
        },
        releaseVersion,
        sourceCommit,
      ),
    ).toThrow(/expected https:\/\/github\.com\/alexbaretta\/prisma\.git/)
    expect(() =>
      validateReleasePackageMetadata(
        {
          ...packageJson,
          homepage: 'https://www.prisma.io',
        },
        releaseVersion,
        sourceCommit,
      ),
    ).toThrow(/expected https:\/\/github\.com\/alexbaretta\/prisma#readme/)
    expect(() =>
      validateReleasePackageMetadata(
        {
          ...packageJson,
          bugs: 'https://github.com/prisma/prisma/issues',
        },
        releaseVersion,
        sourceCommit,
      ),
    ).toThrow(/expected https:\/\/github\.com\/alexbaretta\/prisma\/issues/)
  })

  test('validates current source manifests without mutation', () => {
    const manifests = new Map(
      RELEASE_PACKAGES.map((releasePackage) => {
        const packageJson = JSON.parse(
          fs.readFileSync(path.join(process.cwd(), releasePackage.sourceDir, 'package.json'), 'utf-8'),
        )

        validateReleasePackageMetadata(packageJson, '7.8.0-lossless.15', sourceCommit)
        return [releasePackage.name, packageJson]
      }),
    )
    const clientPackageJson = manifests.get('@prisma-lossless/client')
    const cliPackageJson = manifests.get('@prisma-lossless/cli')
    const devPackageJson = manifests.get('@prisma-lossless/dev')
    const enginesVersionPackageJson = manifests.get('@prisma-lossless/engines-version')
    const fetchEnginePackageJson = manifests.get('@prisma-lossless/fetch-engine')
    const studioCorePackageJson = manifests.get('@prisma-lossless/studio-core')

    expect(clientPackageJson).toMatchObject({
      version: '7.8.0-lossless.15',
      dependencies: {
        '@prisma-lossless/client-runtime-utils': '7.8.0-lossless.15',
      },
      peerDependencies: {
        '@prisma-lossless/cli': '7.8.0-lossless.15',
      },
    })
    expect(cliPackageJson).toMatchObject({
      name: '@prisma-lossless/cli',
      version: '7.8.0-lossless.15',
      dependencies: {
        '@prisma-lossless/config': '7.8.0-lossless.15',
        '@prisma-lossless/dev': '7.8.0-lossless.15',
        '@prisma-lossless/engines': '7.8.0-lossless.15',
        '@prisma-lossless/studio-core': '7.8.0-lossless.15',
      },
      bin: {
        'prisma-lossless': 'build/index.js',
      },
    })
    expect(devPackageJson).toMatchObject({
      name: '@prisma-lossless/dev',
      version: '7.8.0-lossless.15',
      dependencies: {
        '@prisma-lossless/get-platform': '7.8.0-lossless.15',
        '@prisma-lossless/query-plan-executor': '7.8.0-lossless.15',
        '@prisma-lossless/streams-local': '7.8.0-lossless.15',
      },
    })
    expect(enginesVersionPackageJson).toMatchObject({
      name: '@prisma-lossless/engines-version',
      version: '7.8.0-lossless.15',
      prisma: {
        enginesVersion: '3c6e192761c0362d496ed980de936e2f3cebcd3a',
      },
    })
    expect(fetchEnginePackageJson).toMatchObject({
      dependencies: {
        '@prisma-lossless/engines-version': '7.8.0-lossless.15',
      },
    })
    expect(studioCorePackageJson).toMatchObject({
      name: '@prisma-lossless/studio-core',
      version: '7.8.0-lossless.15',
      dependencies: {
        '@radix-ui/react-toggle': '1.1.10',
        'chart.js': '4.5.1',
      },
    })

    expect(manifests.get('@prisma-lossless/adapter-pg')).toMatchObject({
      name: '@prisma-lossless/adapter-pg',
      version: '7.8.0-lossless.15',
      dependencies: {
        '@prisma-lossless/driver-adapter-utils': '7.8.0-lossless.15',
      },
    })
  })
})

function runGit(checkout: string, args: string[]): string {
  const result = spawnSync('git', args, { cwd: checkout, encoding: 'utf-8' })

  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`)
  }

  return result.stdout.trim()
}

function releaseMetadataFixture(directory: string): {
  repository: {
    type: 'git'
    url: string
    directory: string
  }
} {
  return {
    repository: {
      type: 'git',
      url: RELEASE_PACKAGE_REPOSITORY_URL,
      directory,
    },
  }
}
