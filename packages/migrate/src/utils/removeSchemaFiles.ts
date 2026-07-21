import fs from 'node:fs/promises'

import { MultipleSchemas } from '@prisma-lossless/internals'

export async function removeSchemaFiles(files: MultipleSchemas) {
  await Promise.all(files.map(([path]) => fs.rm(path)))
}
