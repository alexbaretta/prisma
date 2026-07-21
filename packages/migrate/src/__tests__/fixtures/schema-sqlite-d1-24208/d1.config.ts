import { defineConfig } from '@prisma-lossless/config'
import { listLocalDatabases } from '@prisma-lossless/adapter-d1'

export default defineConfig({
  datasource: {
    url: `file:${listLocalDatabases().pop()}`,
  },
})
