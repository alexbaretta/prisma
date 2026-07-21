import { defineConfig } from '@prisma-lossless/config'

export default defineConfig({
  datasource: {
    url: 'postgres://prisma:prisma@localhost:5444/tests)',
  },
})
