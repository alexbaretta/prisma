import { defineConfig } from '@prisma-lossless/config'

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL!,
  },
})
