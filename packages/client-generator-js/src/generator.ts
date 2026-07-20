import fs from 'node:fs/promises'
import path from 'node:path'

import { enginesVersion } from '@prisma/engines-version'
import { Generator, GeneratorConfig, GeneratorManifest, GeneratorOptions } from '@prisma/generator'
import { BuiltInProvider, parseEnvValue } from '@prisma/internals'

import { generateClient } from './generateClient'
import { resolvePrismaClient } from './resolvePrismaClient'

const FALLBACK_CLIENT_VERSION = '0.0.0'

type PrismaClientJsGeneratorOptions = {
  shouldResolvePrismaClient?: boolean
  shouldInstallMissingPackages?: boolean
  runtimePath?: string
}

type PrismaClientPackageJson = {
  version?: unknown
}

// const MISSING_CUSTOM_OUTPUT_PATH_WARNING = `\
// ${yellow('Warning:')} You did not specify an output path for your \`generator\` in schema.prisma. \
// This behavior is deprecated and will no longer be supported in Prisma 7.0.0. To learn more \
// visit https://pris.ly/cli/output-path`

export class PrismaClientJsGenerator implements Generator {
  readonly name = BuiltInProvider.PrismaClientJs

  #shouldResolvePrismaClient: boolean
  #runtimePath?: string
  #cachedPrismaClientPath: string | undefined

  constructor({ shouldResolvePrismaClient = true, runtimePath }: PrismaClientJsGeneratorOptions = {}) {
    this.#shouldResolvePrismaClient = shouldResolvePrismaClient
    this.#runtimePath = runtimePath
  }

  async getManifest(config: GeneratorConfig): Promise<GeneratorManifest> {
    // TODO: warning disabled for now until we fixed issues around custom output paths - see ORM-976
    // if (!config.output) {
    //   console.warn(MISSING_CUSTOM_OUTPUT_PATH_WARNING)
    // }

    // If `this.#shouldResolvePrismaClient` is true, which is normally the case,
    // we find the default output path by resolving the path to the
    // client package. While we resolve the absolute path to the
    // package itself, the generator will rewrite it to replace
    // `.../@prisma-lossless/client` with `.../.prisma/client`, as long as
    // `config.isCustomOutput` is false.
    //
    // If a custom output path is provided, then the default output path doesn't
    // matter and we could use a static value here, but that unfortunately
    // wouldn't allow us to avoid resolving the client directory and would only
    // delay that until the `generate` method call because we copy the runtime
    // files if a custom output path is used, and we also copy the WASM modules
    // regardles of the output path. Not copying the runtime files is a breaking
    // change, so we can only completely get rid of this behaviour in the new
    // generator.
    //
    // If `this.#shouldResolvePrismaClient` is false, which is the case when
    // using the JSON-RPC compatibility adapter for Prisma Studio, we should use
    // a static value here.
    const defaultOutput = this.#shouldResolvePrismaClient ? await this.#getPrismaClientPath(config) : '.prisma/client'
    const clientVersion = this.#shouldResolvePrismaClient
      ? await this.#getPrismaClientVersion(config)
      : FALLBACK_CLIENT_VERSION

    return {
      defaultOutput,
      prettyName: 'Prisma Client',
      version: clientVersion,
      requiresEngines: [],
      requiresEngineVersion: enginesVersion,
    }
  }

  async generate(options: GeneratorOptions): Promise<void> {
    const outputDir = parseEnvValue(options.generator.output!)
    const clientVersion = await this.#getPrismaClientVersion(options.generator)

    await generateClient({
      datamodel: options.datamodel,
      schemaPath: options.schemaPath,
      binaryPaths: options.binaryPaths!,
      datasources: options.datasources,
      outputDir,
      copyRuntime: Boolean(options.generator.config.copyRuntime),
      copyRuntimeSourceMaps: Boolean(process.env.PRISMA_COPY_RUNTIME_SOURCEMAPS),
      runtimeSourcePath: await this.#getRuntimePath(options.generator),
      dmmf: options.dmmf,
      generator: options.generator,
      engineVersion: options.version,
      clientVersion,
      activeProvider: options.datasources[0]?.activeProvider,
      typedSql: options.typedSql,
      compilerBuild: parseCompilerBuildFromUnknown(options.generator.config.compilerBuild),
    })
  }

  async #getPrismaClientPath(config: GeneratorConfig): Promise<string> {
    if (this.#cachedPrismaClientPath) {
      return this.#cachedPrismaClientPath
    }

    this.#cachedPrismaClientPath = await resolvePrismaClient(path.dirname(config.sourceFilePath))
    return this.#cachedPrismaClientPath
  }

  async #getRuntimePath(config: GeneratorConfig): Promise<string> {
    if (this.#runtimePath) {
      return this.#runtimePath
    }

    this.#runtimePath = path.join(await this.#getPrismaClientPath(config), 'runtime')
    return this.#runtimePath
  }

  async #getPrismaClientVersion(config: GeneratorConfig): Promise<string> {
    const clientPath = await this.#getPrismaClientPath(config)
    const packageJson = JSON.parse(
      await fs.readFile(path.join(clientPath, 'package.json'), 'utf-8'),
    ) as PrismaClientPackageJson

    return typeof packageJson.version === 'string' ? packageJson.version : FALLBACK_CLIENT_VERSION
  }
}

function parseCompilerBuildFromUnknown(value: unknown): 'fast' | 'small' {
  if (value === undefined) {
    return 'fast'
  }
  if (value === 'small' || value === 'fast') {
    return value
  }
  throw new Error(`Invalid compiler build: ${JSON.stringify(value)}, expected one of: "fast", "small"`)
}
