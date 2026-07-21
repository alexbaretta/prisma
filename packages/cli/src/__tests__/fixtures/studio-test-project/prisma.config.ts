import { defineConfig } from '@prisma-lossless/config'

export default defineConfig({
  datasource: {
    url: 'file:./dev_tmp.db',
  },
})
