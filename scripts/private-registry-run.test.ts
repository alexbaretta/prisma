import { type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, test, vi } from 'vitest'

import { RegistryPortUnavailableError, type RegistryRuntimePaths, type StartedRegistry } from './private-registry'
import {
  buildChildEnvironment,
  buildRegistryUrls,
  type BuiltReleaseRunnerDependencies,
  loadPrivateReleaseManifest,
  parseArguments,
  type PrivateReleaseManifest,
  type RegistryRunnerDependencies,
  resolveConsumerDirectory,
  runWithBuiltRelease,
  runWithEphemeralRegistry,
  startEphemeralRegistry,
} from './private-registry-run'

const MANIFEST: PrivateReleaseManifest = {
  version: '7.8.0-lossless.99',
  sourceCommit: '0123456789abcdef',
  packages: [
    {
      name: 'prisma-lossless',
      version: '7.8.0-lossless.99',
      sourceCommit: '0123456789abcdef',
      tarballPath: '/private/tmp/prisma-lossless.tgz',
    },
  ],
}

function runtimePaths(root: string): RegistryRuntimePaths {
  return {
    root,
    configFile: path.join(root, 'verdaccio.yaml'),
    storageDir: path.join(root, 'storage'),
    authDir: path.join(root, 'auth'),
    logFile: path.join(root, 'verdaccio.log'),
    pidFile: path.join(root, 'verdaccio.pid'),
    npmUserConfigFile: path.join(root, 'npm-userconfig'),
  }
}

function startedRegistry(paths: RegistryRuntimePaths, registry: string): StartedRegistry {
  return { child: {} as ChildProcess, paths, registry }
}

function dependencies(overrides: Partial<RegistryRunnerDependencies> = {}): RegistryRunnerDependencies {
  let runtimeNumber = 0

  return {
    reservePort: vi.fn(() => Promise.resolve({ port: 51_000, release: vi.fn(() => Promise.resolve(undefined)) })),
    makeRuntimePaths: vi.fn(() => runtimePaths(`/private/tmp/registry-${++runtimeNumber}`)),
    start: vi.fn((paths: RegistryRuntimePaths, registry: string) => Promise.resolve(startedRegistry(paths, registry))),
    stop: vi.fn(() => Promise.resolve(undefined)),
    authenticate: vi.fn(() => Promise.resolve(undefined)),
    publish: vi.fn(),
    removeRuntime: vi.fn(),
    runChild: vi.fn(() => Promise.resolve(0)),
    ...overrides,
  }
}

function createConsumerDir(): string {
  const consumerDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-lossless-consumer-'))
  fs.writeFileSync(path.join(consumerDir, 'package.json'), JSON.stringify({ name: 'consumer', version: '1.0.0' }))
  return consumerDir
}

describe('ephemeral private registry runner', () => {
  test('accepts manifest and already-built project modes with consumer cwd', () => {
    expect(parseArguments(['--consumer-dir', '/consumer', 'release.json', '--', 'pnpm', 'install'])).toEqual({
      mode: 'manifest',
      manifestPath: 'release.json',
      consumerDir: '/consumer',
      command: ['pnpm', 'install'],
    })
    expect(
      parseArguments(['--from-built', '7.8.0-lossless.5', '--consumer-dir', '/consumer', '--', 'pnpm', 'install']),
    ).toEqual({
      mode: 'built',
      version: '7.8.0-lossless.5',
      consumerDir: '/consumer',
      command: ['pnpm', 'install'],
    })
    expect(() => parseArguments(['--from-built', '7.8.0-lossless.5', '--', 'pnpm', 'install'])).toThrow(/Usage/)
    expect(() => parseArguments(['--consumer-dir', '/consumer', '--from-built', '7.8.0-lossless.5'])).toThrow(/Usage/)
  })

  test('validates the consumer working directory', () => {
    const consumerDir = createConsumerDir()
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-lossless-empty-consumer-'))

    try {
      expect(resolveConsumerDirectory(consumerDir)).toBe(path.resolve(consumerDir))
      expect(() => resolveConsumerDirectory(path.join(consumerDir, 'missing'))).toThrow(/does not exist/)
      expect(() => resolveConsumerDirectory(emptyDir)).toThrow(/must contain package\.json/)
    } finally {
      fs.rmSync(consumerDir, { recursive: true, force: true })
      fs.rmSync(emptyDir, { recursive: true, force: true })
    }
  })

  test('removes transient built releases after child success and failure', async () => {
    const consumerDir = createConsumerDir()
    const buildArtifacts = vi.fn()
    const makeReleaseRoot = vi.fn(() => '/private/tmp/prebuilt-release')
    const prepareRelease = vi.fn(() => MANIFEST)
    const runRegistry = vi.fn(() => Promise.resolve(41))
    const removeRelease = vi.fn()
    const deps: BuiltReleaseRunnerDependencies = {
      buildArtifacts,
      makeReleaseRoot,
      prepareRelease,
      runRegistry,
      removeRelease,
    }

    try {
      await expect(runWithBuiltRelease(MANIFEST.version, ['consumer'], consumerDir, deps)).resolves.toBe(41)
      expect(buildArtifacts.mock.invocationCallOrder[0]).toBeLessThan(prepareRelease.mock.invocationCallOrder[0])
      expect(prepareRelease).toHaveBeenCalledWith(MANIFEST.version, '/private/tmp/prebuilt-release')
      expect(runRegistry).toHaveBeenCalledWith(MANIFEST, ['consumer'], path.resolve(consumerDir))
      expect(removeRelease).toHaveBeenCalledWith('/private/tmp/prebuilt-release')

      runRegistry.mockRejectedValueOnce(new Error('child failed'))
      await expect(runWithBuiltRelease(MANIFEST.version, ['consumer'], consumerDir, deps)).rejects.toThrow(
        'child failed',
      )
      expect(removeRelease).toHaveBeenCalledTimes(2)
    } finally {
      fs.rmSync(consumerDir, { recursive: true, force: true })
    }
  })

  test('removes transient built releases after prepare failure', async () => {
    const consumerDir = createConsumerDir()
    const buildArtifacts = vi.fn()
    const makeReleaseRoot = vi.fn(() => '/private/tmp/prebuilt-release')
    const prepareRelease = vi.fn(() => {
      throw new Error('release unavailable')
    })
    const runRegistry = vi.fn(() => Promise.resolve(0))
    const removeRelease = vi.fn()
    const deps: BuiltReleaseRunnerDependencies = {
      buildArtifacts,
      makeReleaseRoot,
      prepareRelease,
      runRegistry,
      removeRelease,
    }

    try {
      await expect(runWithBuiltRelease(MANIFEST.version, ['consumer'], consumerDir, deps)).rejects.toThrow(
        'release unavailable',
      )
      expect(prepareRelease).toHaveBeenCalledWith(MANIFEST.version, '/private/tmp/prebuilt-release')
      expect(runRegistry).not.toHaveBeenCalled()
      expect(removeRelease).toHaveBeenCalledWith('/private/tmp/prebuilt-release')
    } finally {
      fs.rmSync(consumerDir, { recursive: true, force: true })
    }
  })

  test('stops built release preparation when the repository build fails', async () => {
    const consumerDir = createConsumerDir()
    const buildArtifacts = vi.fn(() => {
      throw new Error('build failed')
    })
    const makeReleaseRoot = vi.fn(() => '/private/tmp/prebuilt-release')
    const prepareRelease = vi.fn(() => MANIFEST)
    const runRegistry = vi.fn(() => Promise.resolve(0))
    const removeRelease = vi.fn()
    const deps: BuiltReleaseRunnerDependencies = {
      buildArtifacts,
      makeReleaseRoot,
      prepareRelease,
      runRegistry,
      removeRelease,
    }

    try {
      await expect(runWithBuiltRelease(MANIFEST.version, ['consumer'], consumerDir, deps)).rejects.toThrow(
        'build failed',
      )
      expect(makeReleaseRoot).not.toHaveBeenCalled()
      expect(prepareRelease).not.toHaveBeenCalled()
      expect(runRegistry).not.toHaveBeenCalled()
      expect(removeRelease).not.toHaveBeenCalled()
    } finally {
      fs.rmSync(consumerDir, { recursive: true, force: true })
    }
  })

  test('builds distinct host and Docker URLs and overrides npm resolution', () => {
    const urls = buildRegistryUrls(51_234)
    const environment = buildChildEnvironment(urls, { KEEP_ME: 'yes' }, '/private/tmp/npm-userconfig')

    expect(urls).toEqual({
      host: 'http://127.0.0.1:51234/',
      docker: 'http://host.docker.internal:51234/',
    })
    expect(environment).toMatchObject({
      KEEP_ME: 'yes',
      PRISMA_LOSSLESS_REGISTRY_URL: urls.host,
      PRISMA_LOSSLESS_DOCKER_REGISTRY_URL: urls.docker,
      npm_config_registry: urls.host,
      NPM_CONFIG_REGISTRY: urls.host,
      'npm_config_@prisma-lossless:registry': urls.host,
      'NPM_CONFIG_@PRISMA_LOSSLESS:REGISTRY': urls.host,
      npm_config_userconfig: '/private/tmp/npm-userconfig',
      NPM_CONFIG_USERCONFIG: '/private/tmp/npm-userconfig',
    })
  })

  test('rejects unsafe registry ports', () => {
    expect(() => buildRegistryUrls(80)).toThrow(/outside the approved range/)
    expect(() => buildRegistryUrls(65_536)).toThrow(/outside the approved range/)
  })

  test('rejects an incomplete private release manifest', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-lossless-manifest-test-'))
    const manifestPath = path.join(root, 'private-release-manifest.json')
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({ version: MANIFEST.version, sourceCommit: MANIFEST.sourceCommit, packages: [] }),
    )

    try {
      expect(() => loadPrivateReleaseManifest(manifestPath)).toThrow(/contains 0 packages/)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('retries a port collision with a new isolated runtime', async () => {
    const reservePort = vi
      .fn<RegistryRunnerDependencies['reservePort']>()
      .mockResolvedValueOnce({ port: 51_001, release: vi.fn(() => Promise.resolve(undefined)) })
      .mockResolvedValueOnce({ port: 51_002, release: vi.fn(() => Promise.resolve(undefined)) })
    const start = vi
      .fn<RegistryRunnerDependencies['start']>()
      .mockRejectedValueOnce(new RegistryPortUnavailableError('occupied'))
      .mockImplementationOnce((paths, registry) => Promise.resolve(startedRegistry(paths, registry)))
    const deps = dependencies({ reservePort, start })

    const registry = await startEphemeralRegistry(MANIFEST, deps)

    expect(registry.urls.host).toBe('http://127.0.0.1:51002/')
    expect(deps.makeRuntimePaths).toHaveBeenCalledTimes(2)
    expect(deps.removeRuntime).toHaveBeenCalledWith('/private/tmp/registry-1')
    expect(deps.publish).toHaveBeenCalledOnce()
  })

  test('preserves child failure and cleans up the owned registry', async () => {
    const consumerDir = createConsumerDir()
    const deps = dependencies({ runChild: vi.fn(() => Promise.resolve(37)) })

    try {
      const exitCode = await runWithEphemeralRegistry(MANIFEST, ['consumer-build', '--frozen'], consumerDir, deps)

      expect(exitCode).toBe(37)
      expect(deps.runChild).toHaveBeenCalledWith(
        ['consumer-build', '--frozen'],
        expect.objectContaining({
          PRISMA_LOSSLESS_REGISTRY_URL: 'http://127.0.0.1:51000/',
          NPM_CONFIG_USERCONFIG: '/private/tmp/registry-1/npm-userconfig',
        }),
        path.resolve(consumerDir),
      )
      expect(deps.stop).toHaveBeenCalledOnce()
      expect(deps.removeRuntime).toHaveBeenCalledWith('/private/tmp/registry-1')
    } finally {
      fs.rmSync(consumerDir, { recursive: true, force: true })
    }
  })

  test('cleans up when the child cannot start', async () => {
    const consumerDir = createConsumerDir()
    const deps = dependencies({
      runChild: vi.fn(() => Promise.reject(new Error('ENOENT'))),
    })

    try {
      await expect(runWithEphemeralRegistry(MANIFEST, ['missing-command'], consumerDir, deps)).rejects.toThrow('ENOENT')
      expect(deps.stop).toHaveBeenCalledOnce()
      expect(deps.removeRuntime).toHaveBeenCalledOnce()
    } finally {
      fs.rmSync(consumerDir, { recursive: true, force: true })
    }
  })

  test('rejects invalid consumer cwd before registry startup', async () => {
    const deps = dependencies()

    await expect(
      runWithEphemeralRegistry(MANIFEST, ['pnpm', 'install'], '/private/tmp/missing-consumer', deps),
    ).rejects.toThrow(/Consumer directory does not exist/)
    expect(deps.start).not.toHaveBeenCalled()
    expect(deps.runChild).not.toHaveBeenCalled()
  })

  test('cleans up a started registry when publication fails', async () => {
    const deps = dependencies({
      publish: vi.fn(() => {
        throw new Error('publish failed')
      }),
    })

    await expect(startEphemeralRegistry(MANIFEST, deps)).rejects.toThrow('publish failed')
    expect(deps.stop).toHaveBeenCalledOnce()
    expect(deps.removeRuntime).toHaveBeenCalledOnce()
  })

  test('stops a registry when termination arrives during startup', async () => {
    const deps = dependencies()

    await expect(startEphemeralRegistry(MANIFEST, deps, () => 'SIGTERM')).rejects.toThrow(/terminated by SIGTERM/)
    expect(deps.stop).toHaveBeenCalledOnce()
    expect(deps.publish).not.toHaveBeenCalled()
    expect(deps.removeRuntime).toHaveBeenCalledOnce()
  })
})
