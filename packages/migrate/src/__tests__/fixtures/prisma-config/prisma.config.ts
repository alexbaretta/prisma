import { defineConfig } from '@prisma-lossless/config/src'
export default defineConfig({
  datasource: {
    url: 'postgresql://foo:bar@test.com',
  },
})
