import { BinaryType } from '@prisma-lossless/fetch-engine'
import type { EngineType } from '@prisma-lossless/generator'

export function engineTypeToBinaryType(engineType: EngineType): BinaryType {
  if (engineType === 'schemaEngine') {
    return BinaryType.SchemaEngineBinary
  }

  throw new Error(`Could not convert engine type ${engineType}`)
}
