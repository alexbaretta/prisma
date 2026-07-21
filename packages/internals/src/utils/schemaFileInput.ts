import type { MultipleSchemas } from '@prisma-lossless/get-dmmf'

export function extractSchemaContent(multipleSchemas: MultipleSchemas): string[] {
  return multipleSchemas.map(([, content]) => content)
}
