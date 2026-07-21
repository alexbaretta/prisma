import { defineConfig } from '@prisma-lossless/config'

// @ts-expect-error — intentionally missing datasource block
export default defineConfig({
  schema: './prisma/schema.prisma',
})
