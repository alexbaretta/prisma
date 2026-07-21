import { defineConfig } from '@prisma-lossless/config'

export default defineConfig({
  datasource: {
    url: 'postgres://user:password@randomhost:5432',
  },
})
