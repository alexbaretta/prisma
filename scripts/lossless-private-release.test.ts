import { describe, expect, test } from 'vitest'

import {
  assertReleaseGraphDependencyOrder,
  buildPrivateReleasePackageJsons,
  PRIVATE_RELEASE_VERSION_PREFIX,
  RELEASE_PACKAGES,
  rewritePackageJsonForPrivateRelease,
  selectNextReleaseVersion,
  validateReleasePackageMetadata,
} from './lossless-private-release'

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

  test('keeps the runtime closure in publish dependency order', () => {
    expect(RELEASE_PACKAGES.map((releasePackage) => releasePackage.name)).toEqual([
      '@prisma-lossless/debug',
      '@prisma-lossless/driver-adapter-utils',
      '@prisma-lossless/get-platform',
      '@prisma-lossless/fetch-engine',
      '@prisma-lossless/engines',
      '@prisma-lossless/config',
      '@prisma-lossless/client-runtime-utils',
      '@prisma-lossless/adapter-pg',
      '@prisma-lossless/client',
      'prisma-lossless',
    ])
    expect(() => assertReleaseGraphDependencyOrder()).not.toThrow()
  })

  test('rewrites workspace metadata to an exact private version', () => {
    const rewritten = rewritePackageJsonForPrivateRelease(
      {
        name: '@prisma/get-platform',
        version: '0.0.0',
        dependencies: {
          '@prisma/debug': 'workspace:*',
          kleur: '4.1.5',
        },
        devDependencies: {
          typescript: '5.4.5',
        },
      },
      releaseVersion,
      sourceCommit,
    )

    expect(rewritten).toMatchObject({
      name: '@prisma-lossless/get-platform',
      version: releaseVersion,
      dependencies: {
        '@prisma/debug': `npm:@prisma-lossless/debug@${releaseVersion}`,
        kleur: '4.1.5',
      },
      prismaLosslessRelease: {
        version: releaseVersion,
        sourceCommit,
      },
    })
    expect(rewritten).not.toHaveProperty('devDependencies')
    expect(() => validateReleasePackageMetadata(rewritten, releaseVersion, sourceCommit)).not.toThrow()
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
            name: '@prisma/debug',
            version: releaseVersion,
            dependencies: {
              bad: specifier,
            },
            prismaLosslessRelease: {
              version: releaseVersion,
              sourceCommit,
            },
          },
          releaseVersion,
          sourceCommit,
        ),
      ).toThrow()
    }
  })

  test('rewrites the lossless client dependency on the runtime closure', () => {
    const packageJsons = buildPrivateReleasePackageJsons(releaseVersion, sourceCommit)
    const clientPackageJson = packageJsons.get('@prisma-lossless/client')
    const cliPackageJson = packageJsons.get('prisma-lossless')

    expect(clientPackageJson).toMatchObject({
      version: releaseVersion,
      dependencies: {
        '@prisma/client-runtime-utils': `npm:@prisma-lossless/client-runtime-utils@${releaseVersion}`,
      },
      peerDependencies: {
        'prisma-lossless': releaseVersion,
      },
      prismaLosslessRelease: {
        version: releaseVersion,
        sourceCommit,
      },
    })
    expect(cliPackageJson).toMatchObject({
      version: releaseVersion,
      dependencies: {
        '@prisma/config': `npm:@prisma-lossless/config@${releaseVersion}`,
        '@prisma/engines': `npm:@prisma-lossless/engines@${releaseVersion}`,
      },
      prisma: {
        prismaCommit: sourceCommit,
      },
      prismaLosslessRelease: {
        version: releaseVersion,
        sourceCommit,
      },
    })

    expect(packageJsons.get('@prisma-lossless/adapter-pg')).toMatchObject({
      name: '@prisma-lossless/adapter-pg',
      version: releaseVersion,
      dependencies: {
        '@prisma/driver-adapter-utils': `npm:@prisma-lossless/driver-adapter-utils@${releaseVersion}`,
      },
      prismaLosslessRelease: {
        version: releaseVersion,
        sourceCommit,
      },
    })
  })
})
