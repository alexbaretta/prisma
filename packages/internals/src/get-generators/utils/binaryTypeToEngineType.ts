import { BinaryType } from '@prisma-lossless/fetch-engine'
import type { EngineType } from '@prisma-lossless/generator'

export function binaryTypeToEngineType(binaryType: BinaryType): EngineType {
  if (binaryType === BinaryType.SchemaEngineBinary) {
    return 'schemaEngine'
  }

  throw new Error(`Could not convert binary type ${binaryType}`)
}
