import { defineConfig } from '@prisma-lossless/config'

export default defineConfig({
  datasource: {
    url: 'file:./dev-tmp.db',
  },
})
