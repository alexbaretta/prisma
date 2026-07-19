import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import {
  loadPrivateReleaseManifest,
  type PrivateReleaseManifest,
  runWithEphemeralRegistry,
} from './lossless-private-registry-run'
import { RELEASE_PACKAGES } from './lossless-private-release'

const RUN_INTEGRATION = process.env.PRISMA_LOSSLESS_RUN_REGISTRY_INTEGRATION === '1'
const VERSION = '7.8.0-lossless.999999'
const SOURCE_COMMIT = '0123456789abcdef0123456789abcdef01234567'

describe.skipIf(!RUN_INTEGRATION)('ephemeral private registry integration', () => {
  let root: string
  let manifest: PrivateReleaseManifest

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-lossless-registry-integration-'))
    manifest = createFixtureRelease(root)
  })

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  test('runs concurrent isolated registries and stops both', async () => {
    const firstOutput = path.join(root, 'first.json')
    const secondOutput = path.join(root, 'second.json')

    const [firstExitCode, secondExitCode] = await Promise.all([
      runWithEphemeralRegistry(manifest, fixtureConsumerCommand(firstOutput)),
      runWithEphemeralRegistry(manifest, fixtureConsumerCommand(secondOutput)),
    ])

    expect(firstExitCode).toBe(0)
    expect(secondExitCode).toBe(0)

    const first = readResult(firstOutput)
    const second = readResult(secondOutput)

    expect(first.version).toBe(VERSION)
    expect(second.version).toBe(VERSION)
    expect(first.registry).not.toBe(second.registry)
    await expect(fetch(new URL('/-/ping', first.registry))).rejects.toThrow()
    await expect(fetch(new URL('/-/ping', second.registry))).rejects.toThrow()
  }, 120_000)
})

function createFixtureRelease(root: string): PrivateReleaseManifest {
  const artifactsDir = path.join(root, 'artifacts')
  fs.mkdirSync(artifactsDir)

  const packages = RELEASE_PACKAGES.map((releasePackage, index) => {
    const packageRoot = path.join(root, `package-${index}`)
    const packageDir = path.join(packageRoot, 'package')
    const tarballPath = path.join(artifactsDir, `${index}.tgz`)
    fs.mkdirSync(packageDir, { recursive: true })
    fs.writeFileSync(
      path.join(packageDir, 'package.json'),
      JSON.stringify({
        name: releasePackage.name,
        version: VERSION,
        prismaLosslessRelease: { version: VERSION, sourceCommit: SOURCE_COMMIT },
      }),
    )

    const packed = spawnSync('tar', ['-czf', tarballPath, '-C', packageRoot, 'package'], { encoding: 'utf-8' })
    if (packed.status !== 0) {
      throw new Error(`Could not create fixture tarball: ${packed.stderr}`)
    }

    return {
      name: releasePackage.name,
      version: VERSION,
      sourceCommit: SOURCE_COMMIT,
      sourceDir: packageRoot,
      stagingDir: packageDir,
      tarballPath,
    }
  })
  const manifestPath = path.join(root, 'private-release-manifest.json')
  fs.writeFileSync(
    manifestPath,
    JSON.stringify({
      registry: 'http://127.0.0.1:4873/',
      version: VERSION,
      sourceCommit: SOURCE_COMMIT,
      runDir: root,
      artifactsDir,
      packages,
    }),
  )

  return loadPrivateReleaseManifest(manifestPath)
}

function fixtureConsumerCommand(outputPath: string): string[] {
  const source = `
    const { spawnSync } = require('node:child_process');
    const fs = require('node:fs');
    const result = spawnSync(
      'npm',
      ['view', 'prisma-lossless@${VERSION}', 'version', '--json'],
      { encoding: 'utf-8', env: process.env },
    );
    if (result.status !== 0) {
      process.stderr.write(result.stderr);
      process.exit(result.status ?? 1);
    }
    fs.writeFileSync(
      ${JSON.stringify(outputPath)},
      JSON.stringify({
        registry: process.env.PRISMA_LOSSLESS_REGISTRY_URL,
        version: JSON.parse(result.stdout),
      }),
    );
  `

  return [process.execPath, '-e', source]
}

function readResult(resultPath: string): { registry: string; version: string } {
  return JSON.parse(fs.readFileSync(resultPath, 'utf-8')) as { registry: string; version: string }
}
