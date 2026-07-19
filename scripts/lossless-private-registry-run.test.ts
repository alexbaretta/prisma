import { type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, test, vi } from 'vitest'

import {
  RegistryPortUnavailableError,
  type RegistryRuntimePaths,
  type StartedRegistry,
} from './lossless-private-registry'
import {
  buildChildEnvironment,
  buildRegistryUrls,
  type BuiltReleaseRunnerDependencies,
  loadPrivateReleaseManifest,
  parseArguments,
  type PrivateReleaseManifest,
  type RegistryRunnerDependencies,
  runWithBuiltRelease,
  runWithEphemeralRegistry,
  startEphemeralRegistry,
} from './lossless-private-registry-run'

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

describe('ephemeral private registry runner', () => {
  test('accepts manifest and already-built project modes', () => {
    expect(parseArguments(['release.json', '--', 'pnpm', 'install'])).toEqual({
      mode: 'manifest',
      manifestPath: 'release.json',
      command: ['pnpm', 'install'],
    })
    expect(parseArguments(['--from-built', '7.8.0-lossless.5', '--', 'pnpm', 'install'])).toEqual({
      mode: 'built',
      version: '7.8.0-lossless.5',
      command: ['pnpm', 'install'],
    })
    expect(() => parseArguments(['--from-built', '7.8.0-lossless.5'])).toThrow(/Usage/)
  })

  test('removes transient built releases after child success and failure', async () => {
    const makeReleaseRoot = vi.fn(() => '/private/tmp/prebuilt-release')
    const prepareRelease = vi.fn(() => MANIFEST)
    const runRegistry = vi.fn(() => Promise.resolve(41))
    const removeRelease = vi.fn()
    const deps: BuiltReleaseRunnerDependencies = {
      makeReleaseRoot,
      prepareRelease,
      runRegistry,
      removeRelease,
    }

    await expect(runWithBuiltRelease(MANIFEST.version, ['consumer'], deps)).resolves.toBe(41)
    expect(prepareRelease).toHaveBeenCalledWith(MANIFEST.version, '/private/tmp/prebuilt-release')
    expect(removeRelease).toHaveBeenCalledWith('/private/tmp/prebuilt-release')

    runRegistry.mockRejectedValueOnce(new Error('child failed'))
    await expect(runWithBuiltRelease(MANIFEST.version, ['consumer'], deps)).rejects.toThrow('child failed')
    expect(removeRelease).toHaveBeenCalledTimes(2)
  })

  test('builds distinct host and Docker URLs and overrides npm resolution', () => {
    const urls = buildRegistryUrls(51_234)
    const environment = buildChildEnvironment(urls, { KEEP_ME: 'yes' })

    expect(urls).toEqual({
      host: 'http://127.0.0.1:51234/',
      docker: 'http://host.docker.internal:51234/',
    })
    expect(environment).toMatchObject({
      KEEP_ME: 'yes',
      PRISMA_LOSSLESS_REGISTRY_URL: urls.host,
      PRISMA_LOSSLESS_DOCKER_REGISTRY_URL: urls.docker,
      npm_config_registry: urls.host,
      'npm_config_@prisma-lossless:registry': urls.host,
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
    const deps = dependencies({ runChild: vi.fn(() => Promise.resolve(37)) })

    const exitCode = await runWithEphemeralRegistry(MANIFEST, ['consumer-build', '--frozen'], deps)

    expect(exitCode).toBe(37)
    expect(deps.stop).toHaveBeenCalledOnce()
    expect(deps.removeRuntime).toHaveBeenCalledWith('/private/tmp/registry-1')
  })

  test('cleans up when the child cannot start', async () => {
    const deps = dependencies({
      runChild: vi.fn(() => Promise.reject(new Error('ENOENT'))),
    })

    await expect(runWithEphemeralRegistry(MANIFEST, ['missing-command'], deps)).rejects.toThrow('ENOENT')
    expect(deps.stop).toHaveBeenCalledOnce()
    expect(deps.removeRuntime).toHaveBeenCalledOnce()
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
