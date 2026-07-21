import fs from 'fs'
import os from 'os'
import path from 'path'
import { describe, expect, test } from 'vitest'

import { build, type BuildOptions, cleanBuildOutputDirectoriesOnce, cleanBuildOutputDirectoryOnce } from './build'

describe('compile build output cleanup', () => {
  test('cleans a build output directory once', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-compile-clean-'))

    try {
      const outputDir = path.join(root, 'dist')
      const staleFile = path.join(outputDir, 'chunk-stale.js')
      const currentFile = path.join(outputDir, 'index.js')
      const cleaned = new Set<string>()
      const options = { outdir: outputDir } satisfies BuildOptions

      fs.mkdirSync(outputDir, { recursive: true })
      fs.writeFileSync(staleFile, 'stale')

      expect(cleanBuildOutputDirectoryOnce(options, cleaned)).toBe(options)
      expect(fs.existsSync(staleFile)).toBe(false)

      fs.mkdirSync(outputDir, { recursive: true })
      fs.writeFileSync(currentFile, 'current')

      expect(cleanBuildOutputDirectoryOnce(options, cleaned)).toBe(options)
      expect(fs.readFileSync(currentFile, 'utf-8')).toBe('current')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('resolves outfile builds to their parent output directory', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-compile-outfile-clean-'))

    try {
      const outputDir = path.join(root, 'runtime')
      const staleFile = path.join(outputDir, 'old-map.js')
      const cleaned = new Set<string>()

      fs.mkdirSync(outputDir, { recursive: true })
      fs.writeFileSync(staleFile, 'stale')

      cleanBuildOutputDirectoryOnce({ outfile: path.join(outputDir, 'client.js') }, cleaned)
      expect(fs.existsSync(staleFile)).toBe(false)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('cleans parent output once for nested generated outputs', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-compile-nested-clean-'))

    try {
      const outputDir = path.join(root, 'dist')
      const scriptsDir = path.join(outputDir, 'scripts')
      const staleScript = path.join(scriptsDir, 'stale.js')
      const staleIndex = path.join(outputDir, 'stale-index.js')
      const cleaned = new Set<string>()

      fs.mkdirSync(scriptsDir, { recursive: true })
      fs.writeFileSync(staleScript, 'stale')
      fs.writeFileSync(staleIndex, 'stale')

      const cleanedDirectories = cleanBuildOutputDirectoriesOnce(
        [
          { outfile: path.join(scriptsDir, 'postinstall.js') },
          { outfile: path.join(scriptsDir, 'localinstall.js') },
          { outfile: path.join(outputDir, 'index.js') },
        ],
        cleaned,
      )

      expect(cleanedDirectories).toEqual([outputDir])
      expect([...cleaned]).toEqual([outputDir])
      expect(fs.existsSync(outputDir)).toBe(false)

      fs.mkdirSync(scriptsDir, { recursive: true })
      fs.writeFileSync(path.join(scriptsDir, 'postinstall.js'), 'current')

      cleanBuildOutputDirectoriesOnce(
        [
          { outfile: path.join(scriptsDir, 'postinstall.js') },
          { outfile: path.join(scriptsDir, 'localinstall.js') },
          { outfile: path.join(outputDir, 'index.js') },
        ],
        cleaned,
      )

      expect(fs.readFileSync(path.join(scriptsDir, 'postinstall.js'), 'utf-8')).toBe('current')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('preserves nested outputs written before a parent output build', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-compile-nested-build-'))
    const originalCwd = process.cwd()

    try {
      fs.mkdirSync(path.join(root, 'src', 'scripts'), { recursive: true })
      fs.writeFileSync(
        path.join(root, 'package.json'),
        JSON.stringify({ name: 'nested-output-build-fixture', version: '1.0.0' }),
      )
      fs.writeFileSync(
        path.join(root, 'tsconfig.build.json'),
        JSON.stringify({
          compilerOptions: {
            esModuleInterop: true,
            module: 'ESNext',
            moduleResolution: 'Node',
            skipLibCheck: true,
            strict: true,
            target: 'ES2022',
          },
          include: ['src/**/*'],
        }),
      )
      fs.writeFileSync(path.join(root, 'src', 'scripts', 'postinstall.ts'), 'export const name = "postinstall"')
      fs.writeFileSync(path.join(root, 'src', 'scripts', 'localinstall.ts'), 'export const name = "localinstall"')
      fs.writeFileSync(path.join(root, 'src', 'index.ts'), 'export const name = "index"')

      process.chdir(root)

      await build([
        {
          name: 'postinstall',
          absWorkingDir: root,
          entryPoints: ['./src/scripts/postinstall.ts'],
          outfile: 'dist/scripts/postinstall',
          bundle: true,
          emitTypes: false,
        },
        {
          name: 'localinstall',
          absWorkingDir: root,
          entryPoints: ['./src/scripts/localinstall.ts'],
          outfile: 'dist/scripts/localinstall',
          bundle: true,
          emitTypes: false,
        },
        {
          name: 'default',
          absWorkingDir: root,
          entryPoints: ['./src/index.ts'],
          outfile: 'dist/index',
          bundle: true,
          emitTypes: false,
        },
      ])

      expect(fs.existsSync(path.join(root, 'dist', 'scripts', 'postinstall.js'))).toBe(true)
      expect(fs.existsSync(path.join(root, 'dist', 'scripts', 'localinstall.js'))).toBe(true)
      expect(fs.existsSync(path.join(root, 'dist', 'index.js'))).toBe(true)
    } finally {
      process.chdir(originalCwd)
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('does not clean package root output directories', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-compile-root-clean-'))

    try {
      const sourceFile = path.join(root, 'package.json')
      const cleaned = new Set<string>()

      fs.writeFileSync(sourceFile, '{}')

      cleanBuildOutputDirectoryOnce({ outdir: root }, cleaned)
      expect(fs.readFileSync(sourceFile, 'utf-8')).toBe('{}')
      expect(cleaned.size).toBe(0)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('does not clean source-owned scripts output directories', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-compile-scripts-clean-'))

    try {
      const outputDir = path.join(root, 'scripts')
      const sourceFile = path.join(outputDir, 'colors.js')
      const cleaned = new Set<string>()

      fs.mkdirSync(outputDir, { recursive: true })
      fs.writeFileSync(sourceFile, 'source')

      cleanBuildOutputDirectoryOnce({ outfile: path.join(outputDir, 'default-index.js') }, cleaned)
      expect(fs.readFileSync(sourceFile, 'utf-8')).toBe('source')
      expect(cleaned.size).toBe(0)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('does not clean output directories in watch mode', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-compile-watch-clean-'))

    try {
      const outputDir = path.join(root, 'dist')
      const staleFile = path.join(outputDir, 'chunk-stale.js')
      const cleaned = new Set<string>()

      fs.mkdirSync(outputDir, { recursive: true })
      fs.writeFileSync(staleFile, 'stale')

      cleanBuildOutputDirectoryOnce({ outdir: outputDir }, cleaned, true)
      expect(fs.readFileSync(staleFile, 'utf-8')).toBe('stale')
      expect(cleaned.size).toBe(0)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
