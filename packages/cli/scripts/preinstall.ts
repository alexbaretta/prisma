import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { drawBox } from '@prisma-lossless/internals'

type MajorMinor = `${number}.${number}`
type MajorMinorPatch = `${MajorMinor}.${number}`
type PackageJson = {
  dependencies?: Record<string, unknown>
  devDependencies?: Record<string, unknown>
  optionalDependencies?: Record<string, unknown>
  peerDependencies?: Record<string, unknown>
}

const DEPENDENCY_SECTIONS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'] as const

export function main() {
  printMessageAndExitIfStockPrismaIsDeclared(process.env.INIT_CWD)
  printMessageAndExitIfUnsupportedNodeVersion(process.versions.node as MajorMinorPatch)
}

export function printMessageAndExitIfStockPrismaIsDeclared(initCwd: string | undefined) {
  if (!initCwd) {
    return
  }

  const packageJsonPath = path.join(initCwd, 'package.json')

  if (!fs.existsSync(packageJsonPath)) {
    return
  }

  const packageJson = readPackageJson(packageJsonPath)
  const forbiddenDependencies = findStockPrismaDependencies(packageJson)

  if (forbiddenDependencies.length === 0) {
    return
  }

  const messageLines = [
    'prisma-lossless cannot be installed with stock Prisma packages.',
    `Remove ${forbiddenDependencies.join(', ')} from ${packageJsonPath}.`,
    'Use prisma-lossless and @prisma-lossless/* packages instead.',
  ]

  const message = drawBox({
    str: messageLines.join('\n'),
    height: messageLines.length,
    width: 72,
    horizontalPadding: 4,
  })

  console.error(message)
  process.exit(1)
}

export function findStockPrismaDependencies(packageJson: PackageJson): string[] {
  const dependencies = new Set<string>()

  for (const section of DEPENDENCY_SECTIONS) {
    for (const dependencyName of Object.keys(packageJson[section] ?? {})) {
      if (dependencyName === 'prisma' || dependencyName.startsWith('@prisma/')) {
        dependencies.add(dependencyName)
      }
    }
  }

  return [...dependencies].sort()
}

function readPackageJson(packageJsonPath: string): PackageJson {
  const parsed: unknown = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {}
  }

  return parsed
}

function extractSemanticVersionParts(version: MajorMinor | MajorMinorPatch) {
  return version
    .split('.')
    .slice(0, 2) // only major and minor version
    .map((v) => parseInt(v, 10)) as [number, number]
}

/**
 * Given a Node.js version (e.g. `v16.13.0`), prints an error and exits the process
 * if the Node.js version is not supported by Prisma.
 */
export function printMessageAndExitIfUnsupportedNodeVersion(nodeVersion: MajorMinorPatch) {
  const [nodeMajorVersion, nodeMinorVersion] = extractSemanticVersionParts(nodeVersion)

  // Minimum Node.js versions supported by Prisma
  const MIN_NODE_VERSION_MATRIX: Record<number, number> = {
    20: 19,
    22: 12,
    24: 0,
  }

  const minimumSupportedMinor = MIN_NODE_VERSION_MATRIX[nodeMajorVersion]
  const isNodeVersionSupported =
    typeof minimumSupportedMinor !== 'undefined' && nodeMinorVersion >= minimumSupportedMinor

  if (!isNodeVersionSupported) {
    const supportedVersions = Object.entries(MIN_NODE_VERSION_MATRIX)
      .map(([major, minor]) => `${major}.${minor}+`)
      .join(', ')
    const highestSupportedMajor = Math.max(...Object.keys(MIN_NODE_VERSION_MATRIX).map((major) => Number(major)))
    const isNodeVersionTooNew = nodeMajorVersion > highestSupportedMajor

    const messageLines = [
      `Prisma only supports Node.js versions ${supportedVersions}.`,
      isNodeVersionTooNew ? 'Please use a supported Node.js version.' : 'Please upgrade your Node.js version.',
    ]

    const message = drawBox({
      str: messageLines.join('\n'),
      height: messageLines.length,
      width: 48,
      horizontalPadding: 4,
    })

    if (isNodeVersionTooNew) {
      console.warn(message)
    } else {
      console.error(message)
      process.exit(1)
    }
  }
}
