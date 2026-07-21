import fs from 'fs'
import os from 'os'
import path from 'path'
import { describe, expect, test } from 'vitest'

import { type BuildOptions, cleanBuildOutputDirectoryOnce } from './build'

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
