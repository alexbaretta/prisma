import type { GeneratorConfig } from '@prisma-lossless/generator'

import { BuiltInProvider } from '../built-in-provider'
import { parseEnvValue } from './parseEnvValue'

export function extractPreviewFeatures(generators: GeneratorConfig[]): string[] {
  return generators.find((g) => parseEnvValue(g.provider) === BuiltInProvider.PrismaClientJs)?.previewFeatures || []
}
