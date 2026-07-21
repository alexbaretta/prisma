import os from 'os'
import path from 'path'
import { describe, expect, test } from 'vitest'

import { buildDeterministicLoaderFileName, buildFillPluginNamespace, type Fillers } from './fillPlugin'

describe('fillPlugin deterministic build identifiers', () => {
  test('builds a stable namespace for equivalent filler configuration', () => {
    const fillers = {
      os: { contents: '' },
      buffer: {
        globals: path.join(__dirname, 'fillers', 'buffer-small.ts'),
        imports: path.join(__dirname, 'fillers', 'buffer-small.ts'),
      },
    } satisfies Fillers
    const sameFillersDifferentOrder = {
      buffer: {
        imports: path.join(__dirname, 'fillers', 'buffer-small.ts'),
        globals: path.join(__dirname, 'fillers', 'buffer-small.ts'),
      },
      os: { contents: '' },
    } satisfies Fillers

    expect(buildFillPluginNamespace(fillers)).toBe(buildFillPluginNamespace(fillers))
    expect(buildFillPluginNamespace(fillers)).toBe(buildFillPluginNamespace(sameFillersDifferentOrder))
  })

  test('changes namespace when the effective filler configuration changes', () => {
    const smallBuffer = {
      buffer: {
        imports: path.join(__dirname, 'fillers', 'buffer-small.ts'),
      },
    } satisfies Fillers
    const fullBuffer = {
      buffer: {
        imports: path.join(__dirname, 'fillers', 'buffer.ts'),
      },
    } satisfies Fillers

    expect(buildFillPluginNamespace(smallBuffer)).not.toBe(buildFillPluginNamespace(fullBuffer))
  })

  test('normalizes source-tree paths before hashing the namespace', () => {
    const localPath = path.join(__dirname, 'fillers', 'buffer-small.ts')
    const equivalentPosixPath = localPath.split(path.sep).join(path.posix.sep)

    expect(buildFillPluginNamespace({ buffer: { imports: localPath } })).toBe(
      buildFillPluginNamespace({ buffer: { imports: equivalentPosixPath } }),
    )
  })

  test('builds stable loader filenames without random bytes', () => {
    expect(buildDeterministicLoaderFileName('buffer', '6.0.3')).toBe(
      buildDeterministicLoaderFileName('buffer', '6.0.3'),
    )
    expect(buildDeterministicLoaderFileName('buffer', '6.0.3')).not.toBe(
      buildDeterministicLoaderFileName('buffer', '6.0.4'),
    )
    expect(buildDeterministicLoaderFileName('@scope/package', '1.0.0')).toMatch(/^-scope-package-[a-f0-9]{12}\.js$/)
    expect(buildDeterministicLoaderFileName(path.join(os.tmpdir(), 'package'), '1.0.0')).toMatch(/[a-f0-9]{12}\.js$/)
  })
})
