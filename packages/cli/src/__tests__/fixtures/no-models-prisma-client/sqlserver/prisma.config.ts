import { defineConfig, env } from '@prisma-lossless/config'

export default defineConfig({
  datasource: {
    url: env('TEST_MSSQL_URI'),
  },
})
