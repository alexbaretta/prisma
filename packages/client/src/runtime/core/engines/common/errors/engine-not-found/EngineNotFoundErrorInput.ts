import { BinaryTargetsEnvValue, GeneratorConfig } from '@prisma-lossless/generator'
import { BinaryTarget } from '@prisma-lossless/get-platform'

export type EngineNotFoundErrorInput = {
  queryEngineName: string
  generator: GeneratorConfig
  generatorBinaryTargets: BinaryTargetsEnvValue[]
  runtimeBinaryTarget: BinaryTarget
  searchedLocations: string[]
  expectedLocation: string
  errorStack: string | undefined
}
