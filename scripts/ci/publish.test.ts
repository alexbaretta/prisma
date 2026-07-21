import { describe, expect, test } from 'vitest'

import {
  assertLosslessPublicPackageMetadata,
  filterPublishOrderToPackages,
  getLocalTestVersion,
  getLosslessPublicPackages,
  getPatchBranch,
  getPrismaBranch,
  LOSSLESS_PUBLIC_PACKAGE_NAMES,
  type Package,
  shouldUseLocalTestVersion,
} from './publish'

function packageFixture(name: string, version = '7.8.0-lossless.12'): Package {
  return {
    name,
    path: `packages/${name.replace(/^@prisma-lossless\//, '')}/package.json`,
    version,
    usedBy: [],
    usedByDev: [],
    uses: [],
    usesDev: [],
    packageJson: {
      name,
      version,
    },
  }
}

function losslessPublicPackageFixtures(version = '7.8.0-lossless.12'): Record<string, Package> {
  return Object.fromEntries(LOSSLESS_PUBLIC_PACKAGE_NAMES.map((name) => [name, packageFixture(name, version)]))
}

describe('publish test-only version selection', () => {
  test('uses the local package version for test-only runs', () => {
    expect(shouldUseLocalTestVersion({ '--test': true }, false)).toBe(true)
    expect(
      getLocalTestVersion({
        '@prisma-lossless/cli': {
          name: '@prisma-lossless/cli',
          path: 'packages/cli/package.json',
          version: '7.8.0-lossless.12',
          usedBy: [],
          usedByDev: [],
          uses: [],
          usesDev: [],
          packageJson: {},
        },
      }),
    ).toBe('7.8.0-lossless.12')
  })

  test('keeps publish and dry-run flows on remote version selection', () => {
    expect(shouldUseLocalTestVersion({ '--test': true, '--publish': true }, false)).toBe(false)
    expect(shouldUseLocalTestVersion({ '--test': true }, true)).toBe(false)
    expect(shouldUseLocalTestVersion({ '--publish': true }, false)).toBe(false)
  })

  test('requires a local CLI package for test-only version selection', () => {
    expect(() => getLocalTestVersion({})).toThrow(/Could not find local Prisma CLI package version/)
  })
})

describe('lossless public publish mode', () => {
  test('keeps GITHUB_REF_NAME as the publish branch source', async () => {
    const branch = await getPrismaBranch({ GITHUB_REF_NAME: 'integration/lossless' }, () =>
      Promise.reject(new Error('should not read local git branch')),
    )

    expect(branch).toBe('integration/lossless')
  })

  test('falls back to the checked out branch without GITHUB_REF_NAME', async () => {
    const branch = await getPrismaBranch({}, () => Promise.resolve('target-7.8.0-lossless'))

    expect(branch).toBe('target-7.8.0-lossless')
  })

  test('keeps local branch lookup failures non-fatal', async () => {
    const branch = await getPrismaBranch({}, () => Promise.reject(new Error('git branch lookup failed')))

    expect(branch).toBeUndefined()
  })

  test('detects patch branches from the resolved branch', () => {
    expect(getPatchBranch('7.8.x')).toBe('7.8.x')
    expect(getPatchBranch('target-7.8.0-lossless')).toBeNull()
    expect(getPatchBranch(undefined)).toBeNull()
  })

  test('selects only the validated public release package graph', () => {
    const packages = {
      ...losslessPublicPackageFixtures(),
      '@prisma-lossless/internals': packageFixture('@prisma-lossless/internals'),
    }

    expect(getLosslessPublicPackages(packages).map((releasePackage) => releasePackage.name)).toEqual(
      LOSSLESS_PUBLIC_PACKAGE_NAMES,
    )
  })

  test('rejects incomplete or private public release package graphs', () => {
    const packages = losslessPublicPackageFixtures()
    delete packages['@prisma-lossless/client']

    expect(() => getLosslessPublicPackages(packages)).toThrow(/missing from the workspace/)
    expect(() =>
      getLosslessPublicPackages({
        ...losslessPublicPackageFixtures(),
        '@prisma-lossless/client': {
          ...packageFixture('@prisma-lossless/client'),
          private: true,
        },
      }),
    ).toThrow(/marked private/)
  })

  test('validates source metadata against the immutable release identity', () => {
    expect(() =>
      assertLosslessPublicPackageMetadata(losslessPublicPackageFixtures(), '7.8.0-lossless.12'),
    ).not.toThrow()
    expect(() =>
      assertLosslessPublicPackageMetadata(losslessPublicPackageFixtures('7.8.0-lossless.10'), '7.8.0-lossless.10'),
    ).toThrow(/recorded as unavailable/)
    expect(() =>
      assertLosslessPublicPackageMetadata(
        {
          ...losslessPublicPackageFixtures(),
          '@prisma-lossless/client': packageFixture('@prisma-lossless/client', '7.8.0-lossless.10'),
        },
        '7.8.0-lossless.12',
      ),
    ).toThrow(/does not record release version/)
  })

  test('filters publish order to the lossless public graph', () => {
    expect(
      filterPublishOrderToPackages(
        [
          ['@prisma-lossless/debug', '@prisma-lossless/internals'],
          ['@prisma-lossless/client', '@prisma-lossless/integration-tests'],
          ['not-prisma'],
          ['@prisma-lossless/cli'],
        ],
        LOSSLESS_PUBLIC_PACKAGE_NAMES,
      ),
    ).toEqual([['@prisma-lossless/debug'], ['@prisma-lossless/client'], ['@prisma-lossless/cli']])
  })
})
