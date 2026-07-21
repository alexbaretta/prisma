import { defineConfig } from '@prisma-lossless/config'
export default defineConfig({
  datasource: {
    url: 'postgresql://foo:bar@test.com',
  },
})
