import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, test } from 'vitest'

import {
  assertAvailablePrivateReleaseIdentity,
  assertPinnedReleaseVersion,
  assertReleaseGraphDependencyOrder,
  assertReleaseSourcesMatchCommit,
  buildPrivateReleasePackageJsons,
  calculateTarballIntegrity,
  prepareBuiltPrivateReleaseCandidates,
  preparePinnedPrivateReleaseCandidates,
  PRIVATE_RELEASE_SOURCE_DIRS,
  PRIVATE_RELEASE_VERSION_PREFIX,
  readPrivateReleaseIdentity,
  RELEASE_PACKAGES,
  rewritePackageJsonForPrivateRelease,
  rewriteStagedPrivateReleaseArtifacts,
  selectNextReleaseVersion,
  validatePrivateReleaseIdentity,
  validateReleaseManifestIntegrity,
  validateReleasePackageMetadata,
} from './lossless-private-release'
import { readIndependentPrivateReleaseFixture } from './lossless-private-release-fixtures'

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
    const currentIdentity = readPrivateReleaseIdentity('7.8.0-lossless.8')
    const historicalFixture = readIndependentPrivateReleaseFixture('7.8.0-lossless.5')
    const currentFixture = readIndependentPrivateReleaseFixture('7.8.0-lossless.8')

    expect(identity.sourceCommit).toBe('f98f2e0f42cd7d9d9556567f9236c98eed00da16')
    expect(identity.status).toBe('unavailable')
    expect(identity.replacementVersion).toBe('7.8.0-lossless.8')
    expect(retiredIdentity.status).toBe('unavailable')
    expect(retiredIdentity.replacementVersion).toBe('7.8.0-lossless.8')
    expect(randomMapIdentity.status).toBe('unavailable')
    expect(randomMapIdentity.replacementVersion).toBe('7.8.0-lossless.8')
    expect(identity.packages).toEqual(
      historicalFixture.packages.map(({ name, integrity }) => ({
        name,
        integrity,
      })),
    )
    expect(currentIdentity.status).toBe('available')
    expect(identity.packages).toHaveLength(RELEASE_PACKAGES.length)
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

    expect(() => assertAvailablePrivateReleaseIdentity(identity)).toThrow(
      /Private release 7\.8\.0-lossless\.5 is recorded as unavailable/,
    )
    expect(() => assertAvailablePrivateReleaseIdentity(retiredIdentity)).toThrow(
      /Private release 7\.8\.0-lossless\.6 is recorded as unavailable/,
    )
    expect(() => assertAvailablePrivateReleaseIdentity(randomMapIdentity)).toThrow(
      /Private release 7\.8\.0-lossless\.7 is recorded as unavailable/,
    )
    expect(() => prepareBuiltPrivateReleaseCandidates('7.8.0-lossless.5')).toThrow(/Use 7\.8\.0-lossless\.8/)
    expect(() => prepareBuiltPrivateReleaseCandidates('7.8.0-lossless.6')).toThrow(/Use 7\.8\.0-lossless\.8/)
    expect(() => prepareBuiltPrivateReleaseCandidates('7.8.0-lossless.7')).toThrow(/Use 7\.8\.0-lossless\.8/)
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
        replacementVersion: '^7.8.0-lossless.8',
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

  test('tracks shared compile helpers as release source inputs', () => {
    expect(PRIVATE_RELEASE_SOURCE_DIRS).toContain('helpers/compile')
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

  test('rewrites staged generated client release artifacts', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-lossless-staged-artifacts-'))

    try {
      const clientDir = path.join(root, 'client')
      const cliDir = path.join(root, 'cli')
      fs.mkdirSync(path.join(clientDir, 'runtime'), { recursive: true })
      fs.mkdirSync(path.join(clientDir, 'scripts'), { recursive: true })
      fs.mkdirSync(path.join(cliDir, 'build'), { recursive: true })
      fs.writeFileSync(path.join(clientDir, 'runtime/client.js'), 'var clientVersion = "0.0.0";\n')
      fs.writeFileSync(path.join(clientDir, 'runtime/client.mjs'), 'var clientVersion = "0.0.0";\n')
      fs.writeFileSync(path.join(clientDir, 'scripts/default-index.js'), 'client: "0.0.0"\n')
      fs.writeFileSync(
        path.join(cliDir, 'build/index.js'),
        'dependencies:{"@prisma/client-runtime-utils":clientVersion}\n',
      )

      rewriteStagedPrivateReleaseArtifacts(clientDir, '@prisma-lossless/client', releaseVersion)
      rewriteStagedPrivateReleaseArtifacts(cliDir, 'prisma-lossless', releaseVersion)

      expect(fs.readFileSync(path.join(clientDir, 'runtime/client.js'), 'utf-8')).toContain(releaseVersion)
      expect(fs.readFileSync(path.join(clientDir, 'runtime/client.mjs'), 'utf-8')).toContain(releaseVersion)
      expect(fs.readFileSync(path.join(clientDir, 'scripts/default-index.js'), 'utf-8')).toContain(releaseVersion)
      expect(fs.readFileSync(path.join(cliDir, 'build/index.js'), 'utf-8')).toContain(
        '@prisma-lossless/client-runtime-utils',
      )
      expect(fs.readFileSync(path.join(cliDir, 'build/index.js'), 'utf-8')).not.toContain(
        '@prisma/client-runtime-utils',
      )
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

function runGit(checkout: string, args: string[]): string {
  const result = spawnSync('git', args, { cwd: checkout, encoding: 'utf-8' })

  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`)
  }

  return result.stdout.trim()
}
