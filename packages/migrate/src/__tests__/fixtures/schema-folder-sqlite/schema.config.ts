import path from 'node:path'

import { defineConfig } from '@prisma-lossless/config'

const basePath = process.cwd()

export default defineConfig({
  datasource: {
    url: 'file:prisma/dev.db',
  },
  schema: path.join(basePath, 'prisma', 'schema'),
})
