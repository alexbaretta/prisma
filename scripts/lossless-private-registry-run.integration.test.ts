import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import {
  publishPackage,
  type RegistryRuntimePaths,
  type StartedRegistry,
  startRegistry,
  stopStartedRegistry,
} from './lossless-private-registry'
import {
  createEphemeralPublisher,
  createRuntimePaths,
  loadPrivateReleaseManifest,
  type PrivateReleaseManifest,
  type RegistryRunnerDependencies,
  reserveAvailablePort,
  runChildCommand,
  runWithBuiltRelease,
  runWithEphemeralRegistry,
} from './lossless-private-registry-run'
import {
  calculateTarballIntegrity,
  prepareBuiltPrivateReleaseCandidates,
  RELEASE_PACKAGES,
} from './lossless-private-release'

const RUN_INTEGRATION = process.env.PRISMA_LOSSLESS_RUN_REGISTRY_INTEGRATION === '1'
const VERSION = '7.8.0-lossless.999999'
const RECORDED_VERSION = '7.8.0-lossless.5'
const CONSUMER_PNPM_VERSION = '11.1.1'
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
    fs.rmSync(path.join(process.cwd(), 'tmp/lossless-json-tasklet-023-integration'), { recursive: true, force: true })
  })

  test('runs concurrent isolated registries and stops both', async () => {
    const firstOutput = path.join(root, 'first.json')
    const secondOutput = path.join(root, 'second.json')
    const firstConsumer = createConsumerDir(root, 'first-consumer')
    const secondConsumer = createConsumerDir(root, 'second-consumer')

    const [firstExitCode, secondExitCode] = await Promise.all([
      runWithEphemeralRegistry(manifest, fixtureConsumerCommand(firstOutput), firstConsumer),
      runWithEphemeralRegistry(manifest, fixtureConsumerCommand(secondOutput), secondConsumer),
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

  test('installs the recorded release through a frozen consumer lockfile', async () => {
    const consumerDir = createConsumerDir(root, 'real-consumer')
    const firstReleaseRoot = repoLocalReleaseRoot(root, 'recorded-release-first')
    const secondReleaseRoot = repoLocalReleaseRoot(root, 'recorded-release-second')

    try {
      const firstManifest = prepareBuiltPrivateReleaseCandidates(RECORDED_VERSION, firstReleaseRoot)
      const secondManifest = prepareBuiltPrivateReleaseCandidates(RECORDED_VERSION, secondReleaseRoot)

      expect(integrities(firstManifest)).toEqual(integrities(secondManifest))
    } finally {
      fs.rmSync(firstReleaseRoot, { recursive: true, force: true })
      fs.rmSync(secondReleaseRoot, { recursive: true, force: true })
    }

    writeRealConsumerPackageJson(consumerDir)

    const lockfileRoots = trackedRoots(root, 'lockfile')
    const frozenRoots = trackedRoots(root, 'frozen')
    const lockfileExitCode = await runWithBuiltRelease(
      RECORDED_VERSION,
      [process.execPath, writeInstallScript(root, 'lockfile', ['install', '--lockfile-only'])],
      consumerDir,
      builtDependencies(lockfileRoots),
    )

    expect(lockfileExitCode).toBe(0)
    expectRootsRemoved(lockfileRoots)

    const verifyOutput = path.join(root, 'real-consumer-result.json')
    const frozenExitCode = await runWithBuiltRelease(
      RECORDED_VERSION,
      [process.execPath, writeVerifyScript(root, verifyOutput, ['install', '--frozen-lockfile', '--ignore-scripts'])],
      consumerDir,
      builtDependencies(frozenRoots),
    )

    expect(frozenExitCode).toBe(0)
    expectRootsRemoved(frozenRoots)

    const result = JSON.parse(fs.readFileSync(verifyOutput, 'utf-8')) as {
      pnpmVersion: string
      losslessNumber: string
      packages: string[]
    }

    expect(result.pnpmVersion).toBe(CONSUMER_PNPM_VERSION)
    expect(result.losslessNumber).toBe('9007199254740993')
    expect(result.packages).toEqual(RELEASE_PACKAGES.map((releasePackage) => releasePackage.name))
  }, 300_000)

  test('removes registry and release roots after child failure', async () => {
    const consumerDir = createConsumerDir(root, 'failing-consumer')
    const roots = trackedRoots(root, 'failure')
    const exitCode = await runWithBuiltRelease(
      RECORDED_VERSION,
      [process.execPath, '-e', 'process.exit(42)'],
      consumerDir,
      builtDependencies(roots),
    )

    expect(exitCode).toBe(42)
    expectRootsRemoved(roots)
  }, 180_000)
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

function createConsumerDir(root: string, name: string): string {
  const consumerDir = path.join(root, name)
  fs.mkdirSync(consumerDir, { recursive: true })
  fs.writeFileSync(
    path.join(consumerDir, 'package.json'),
    JSON.stringify({ name, version: '1.0.0', private: true, packageManager: `pnpm@${CONSUMER_PNPM_VERSION}` }),
  )
  return consumerDir
}

function writeRealConsumerPackageJson(consumerDir: string): void {
  const dependencies = Object.fromEntries(
    RELEASE_PACKAGES.map((releasePackage) => [releasePackage.name, RECORDED_VERSION]),
  )

  fs.writeFileSync(
    path.join(consumerDir, 'package.json'),
    JSON.stringify(
      {
        name: 'real-consumer',
        version: '1.0.0',
        private: true,
        packageManager: `pnpm@${CONSUMER_PNPM_VERSION}`,
        dependencies,
        pnpm: {
          onlyBuiltDependencies: ['@prisma-lossless/engines', 'prisma-lossless'],
        },
      },
      null,
      2,
    ),
  )
}

function writeInstallScript(root: string, name: string, pnpmArgs: string[]): string {
  const scriptPath = path.join(root, `${name}.cjs`)
  fs.writeFileSync(
    scriptPath,
    `
      const { spawnSync } = require('node:child_process')
      const result = spawnSync('corepack', ['pnpm', ...${JSON.stringify(pnpmArgs)}], {
        cwd: process.cwd(),
        env: process.env,
        stdio: 'inherit',
      })
      process.exit(result.status ?? 1)
    `,
  )
  return scriptPath
}

function writeVerifyScript(root: string, outputPath: string, installArgs: string[]): string {
  const scriptPath = path.join(root, 'verify-consumer.cjs')
  fs.writeFileSync(
    scriptPath,
    `
      const { spawnSync } = require('node:child_process')
      const fs = require('node:fs')
      const { createRequire } = require('node:module')
      const path = require('node:path')

      function run(args) {
        const result = spawnSync('corepack', ['pnpm', ...args], {
          cwd: process.cwd(),
          env: process.env,
          encoding: 'utf-8',
        })
        if (result.status !== 0) {
          process.stderr.write(result.stdout)
          process.stderr.write(result.stderr)
          process.exit(result.status ?? 1)
        }
        return result.stdout.trim()
      }

      const pnpmVersion = run(['--version'])
      run(${JSON.stringify(installArgs)})
      const consumerRequire = createRequire(path.join(process.cwd(), 'package.json'))
      const { LosslessNumber } = consumerRequire('@prisma-lossless/client/runtime/client')
      const losslessNumber = new LosslessNumber('9007199254740993')
      const lockfile = fs.readFileSync('pnpm-lock.yaml', 'utf-8')
      const packages = ${JSON.stringify(RELEASE_PACKAGES.map((releasePackage) => releasePackage.name))}
      const missing = packages.filter((packageName) => !lockfile.includes(packageName))

      if (missing.length > 0) {
        throw new Error('Lockfile is missing packages: ' + missing.join(', '))
      }

      fs.writeFileSync(
        ${JSON.stringify(outputPath)},
        JSON.stringify({ pnpmVersion, losslessNumber: losslessNumber.toString(), packages }),
      )
    `,
  )
  return scriptPath
}

function integrities(manifest: PrivateReleaseManifest): Record<string, string> {
  return Object.fromEntries(
    manifest.packages.map((releasePackage) => [
      releasePackage.name,
      calculateTarballIntegrity(releasePackage.tarballPath),
    ]),
  )
}

type TrackedRoots = {
  release: string[]
  registry: string[]
}

function trackedRoots(root: string, label: string): TrackedRoots {
  return { release: [repoLocalReleaseRoot(root, `${label}-release`)], registry: [] }
}

function repoLocalReleaseRoot(root: string, label: string): string {
  return path.join(process.cwd(), 'tmp/lossless-json-tasklet-023-integration', path.basename(root), label)
}

function builtDependencies(roots: TrackedRoots) {
  return {
    makeReleaseRoot: () => roots.release[0],
    prepareRelease: prepareBuiltPrivateReleaseCandidates,
    runRegistry: (manifest: PrivateReleaseManifest, command: readonly string[], consumerDir: string) =>
      runWithEphemeralRegistry(manifest, command, consumerDir, registryDependencies(roots)),
    removeRelease: (releaseRoot: string) => fs.rmSync(releaseRoot, { recursive: true, force: true }),
  }
}

function registryDependencies(roots: TrackedRoots): RegistryRunnerDependencies {
  return {
    reservePort: reserveAvailablePort,
    makeRuntimePaths: () => {
      const paths = createRuntimePaths()
      roots.registry.push(paths.root)
      return paths
    },
    start: (paths: RegistryRuntimePaths, registry: string): Promise<StartedRegistry> =>
      startRegistry(paths, registry, { detached: false }),
    stop: stopStartedRegistry,
    authenticate: createEphemeralPublisher,
    publish: publishPackage,
    removeRuntime: (runtimeRoot: string) => fs.rmSync(runtimeRoot, { recursive: true, force: true }),
    runChild: runChildCommand,
  }
}

function expectRootsRemoved(roots: TrackedRoots): void {
  for (const root of [...roots.release, ...roots.registry]) {
    expect(fs.existsSync(root)).toBe(false)
  }
}

function readResult(resultPath: string): { registry: string; version: string } {
  return JSON.parse(fs.readFileSync(resultPath, 'utf-8')) as { registry: string; version: string }
}
