import path from 'node:path'

import { defineConfig } from '@prisma-lossless/config'

export default defineConfig({
  schema: path.join(__dirname, 'schema.prisma'),
})
