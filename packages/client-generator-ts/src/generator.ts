import fs from 'node:fs'
import path from 'node:path'

import { enginesVersion } from '@prisma-lossless/engines-version'
import { Generator, GeneratorConfig, GeneratorManifest, GeneratorOptions } from '@prisma-lossless/generator'
import { parseEnvValue } from '@prisma-lossless/internals'
import { getTsconfig } from 'get-tsconfig'
import { bold, dim, green } from 'kleur/colors'

import { inferImportFileExtension, parseGeneratedFileExtension, parseImportFileExtension } from './file-extensions'
import { generateClient } from './generateClient'
import { inferModuleFormat, parseModuleFormatFromUnknown } from './module-format'
import { parseRuntimeTargetFromUnknown, RuntimeTargetInternal } from './runtime-targets'

const FALLBACK_CLIENT_VERSION = '0.0.0'
const PRISMA_CLIENT_PACKAGE_NAME = '@prisma-lossless/client'
const PRISMA_CLIENT_RUNTIME_BASE = `${PRISMA_CLIENT_PACKAGE_NAME}/runtime`

type PrismaClientPackageJson = {
  version?: unknown
}

const missingOutputErrorMessage = `An output path is required for the \`prisma-client\` generator. Please provide an output path in your schema file:

${dim(`generator client {
  provider = "prisma-client"`)}
${green('  output   = "../src/generated"')}
${dim('}')}

${bold('Note:')} the output path is relative to the schema directory.
`

function getOutputPath(config: GeneratorConfig): string {
  if (!config.output) {
    throw new Error(missingOutputErrorMessage)
  }
  return parseEnvValue(config.output)
}

export class PrismaClientTsGenerator implements Generator {
  readonly name = 'prisma-client-ts'

  getManifest(config: GeneratorConfig): Promise<GeneratorManifest> {
    const clientVersion = readInstalledPrismaClientVersion(config.sourceFilePath)

    return Promise.resolve({
      defaultOutput: getOutputPath(config),
      prettyName: 'Prisma Client',
      version: clientVersion,
      requiresEngines: [],
      requiresEngineVersion: enginesVersion,
    })
  }

  async generate(options: GeneratorOptions): Promise<void> {
    const { config } = options.generator
    const outputDir = getOutputPath(options.generator)
    const tsconfig = getTsconfig(outputDir)?.config
    const clientVersion = readInstalledPrismaClientVersion(options.schemaPath)

    const target = config.runtime !== undefined ? parseRuntimeTargetFromUnknown(config.runtime) : 'nodejs'

    const generatedFileExtension =
      config.generatedFileExtension !== undefined ? parseGeneratedFileExtension(config.generatedFileExtension) : 'ts'

    const importFileExtension =
      config.importFileExtension !== undefined
        ? parseImportFileExtension(config.importFileExtension)
        : inferImportFileExtension({
            tsconfig,
            generatedFileExtension,
            target,
          })

    const moduleFormat =
      config.moduleFormat !== undefined
        ? parseModuleFormatFromUnknown(config.moduleFormat)
        : inferModuleFormat({
            tsconfig,
            generatedFileExtension,
            importFileExtension,
          })

    await generateClient({
      datamodel: options.datamodel,
      schemaPath: options.schemaPath,
      binaryPaths: options.binaryPaths!,
      datasources: options.datasources,
      outputDir,
      runtimeBase: PRISMA_CLIENT_RUNTIME_BASE,
      dmmf: options.dmmf,
      generator: options.generator,
      engineVersion: options.version,
      clientVersion,
      activeProvider: options.datasources[0]?.activeProvider,
      typedSql: options.typedSql,
      target,
      generatedFileExtension,
      importFileExtension,
      moduleFormat,
      tsNoCheckPreamble: true, // Set to false only during internal tests
      compilerBuild: parseCompilerBuildFromUnknown(options.generator.config.compilerBuild, target),
    })
  }
}

function readInstalledPrismaClientVersion(baseFilePath: string): string {
  try {
    const packageJsonPath = require.resolve(`${PRISMA_CLIENT_PACKAGE_NAME}/package.json`, {
      paths: [path.dirname(baseFilePath)],
    })
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as PrismaClientPackageJson

    return typeof packageJson.version === 'string' ? packageJson.version : FALLBACK_CLIENT_VERSION
  } catch {
    return FALLBACK_CLIENT_VERSION
  }
}

function parseCompilerBuildFromUnknown(value: unknown, target: RuntimeTargetInternal): 'fast' | 'small' {
  if (value === undefined) {
    // using the 'small' build for 'vercel-edge' target to fit within their free tier limits
    return target === 'vercel-edge' ? 'small' : 'fast'
  }
  if (value === 'small' || value === 'fast') {
    return value
  }
  throw new Error(`Invalid compiler build: ${JSON.stringify(value)}, expected one of: "fast", "small"`)
}
