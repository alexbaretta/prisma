import { defineConfig } from '@prisma-lossless/config'
export default defineConfig({
  datasource: {
    url: 'file:./dev.db',
  },
  earlyAccess: true,
  migrations: {
    seed: 'ts-node prisma/seed.ts',
  },
})
