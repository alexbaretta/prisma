import { defineConfig, env } from '@prisma-lossless/config'

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: env('SOME_UNDEFINED_DB'),
  },
})
