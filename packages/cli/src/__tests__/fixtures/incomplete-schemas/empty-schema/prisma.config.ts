import { defineConfig } from '@prisma-lossless/config'

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: 'file:dev.db',
  },
})
