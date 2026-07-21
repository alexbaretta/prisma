import { PrismaClientJsGenerator } from '@prisma-lossless/client-generator-js'
import { PrismaClientTsGenerator } from '@prisma-lossless/client-generator-ts'

import { GeneratorRegistry } from './registry'

export const defaultRegistry = new GeneratorRegistry()

defaultRegistry.add(new PrismaClientJsGenerator())

const tsGenerator = new PrismaClientTsGenerator()
defaultRegistry.add(tsGenerator)
defaultRegistry.addAliased('prisma-client', tsGenerator)
