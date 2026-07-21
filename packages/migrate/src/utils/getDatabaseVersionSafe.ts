import { PrismaConfigInternal } from '@prisma-lossless/config'
import Debug from '@prisma-lossless/debug'
import { MigrateTypes } from '@prisma-lossless/internals'

import { Migrate } from '../Migrate'

const debug = Debug('prisma:cli')

/**
 * Retrieve the database version from the given schema or url.
 * This function never throws, and was introduced to prevent circular dependencies in `@prisma-lossless/internals`.
 */
export async function getDatabaseVersionSafe(
  args: MigrateTypes.GetDatabaseVersionParams | undefined,
  config: PrismaConfigInternal,
  baseDir: string,
): Promise<string | undefined> {
  let migrate: Migrate | undefined
  let dbVersion: string | undefined
  try {
    migrate = await Migrate.setup({ schemaEngineConfig: config, baseDir })
    dbVersion = await migrate.engine.getDatabaseVersion(args)
  } catch (e) {
    debug(e)
  } finally {
    if (migrate && migrate.engine.isRunning) {
      await migrate.stop()
    }
  }

  return dbVersion
}
