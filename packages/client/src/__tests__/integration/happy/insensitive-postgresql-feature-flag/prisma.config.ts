import { defineConfig, env } from '@prisma-lossless/config'

const connectionString = env('TEST_POSTGRES_URI').replace('tests', 'tests-insensitive-postgresql-feature-flag')

export default defineConfig({
  datasource: {
    url: connectionString,
  },
})
