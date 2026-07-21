import fs from 'node:fs/promises'
import path from 'node:path'

import { Command, detect, getCommand } from '@antfu/ni'
import { Debug } from '@prisma-lossless/debug'
import { resolvePkg } from '@prisma-lossless/internals'
import { bold, green } from 'kleur/colors'

import clientPkg from '../../client/package.json'

export const debug = Debug('prisma:generator')

const PRISMA_CLI_PACKAGE_NAME = 'prisma-lossless'
const PRISMA_GENERATE_COMMAND = `${PRISMA_CLI_PACKAGE_NAME} generate`

/**
 * Resolves the path to the Prisma Client to determine the default output directory.
 */
export async function resolvePrismaClient(baseDir: string): Promise<string> {
  const prismaClientDir = await findPrismaClientDir(baseDir)

  debug('baseDir', baseDir)

  if (!prismaClientDir) {
    throw new Error(
      `Could not resolve ${clientPkg.name}.
Please try to install it with ${bold(
        green(await getPackageCmd(baseDir, 'install', clientPkg.name)),
      )} and rerun ${bold(await getPackageCmd(baseDir, 'execute', PRISMA_GENERATE_COMMAND))} 🙏.`,
    )
  }

  return prismaClientDir
}

/**
 * Tries to find a Prisma Client package that is next to the CLI package.
 * @param baseDir from where to start looking from
 * @returns Prisma Client package location
 */
async function findPrismaClientDir(baseDir: string) {
  const resolveOpts = { basedir: baseDir, preserveSymlinks: true }
  const cliDir = await resolvePkg(PRISMA_CLI_PACKAGE_NAME, resolveOpts)
  const clientDir = await resolvePkg(clientPkg.name, resolveOpts)
  const resolvedClientDir = clientDir && (await fs.realpath(clientDir))

  debug('prismaCliDir', cliDir)
  debug('prismaClientDir', clientDir)

  // If CLI not found, we can only continue forward, likely a test
  if (cliDir === undefined) return resolvedClientDir
  if (clientDir === undefined) return resolvedClientDir

  // for everything to work well we expect `../<client-dir>`
  const relDir = path.relative(cliDir, clientDir).split(path.sep)

  // if the client is not near `prisma`, in parent folder => fail
  if (relDir[0] !== '..' || relDir[1] === '..') return undefined

  // we return the resolved location as pnpm users will want that
  return resolvedClientDir
}

/**
 * Get the command to run for the given package manager in the given directory.
 */
async function getPackageCmd(cwd: string, cmd: Command, ...args: string[]): Promise<string> {
  const agent = await detect({ cwd, autoInstall: false, programmatic: true })
  return getCommand(agent ?? 'npm', cmd, args)
}
