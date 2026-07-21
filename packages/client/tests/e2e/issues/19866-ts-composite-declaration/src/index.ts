import { PrismaClient } from '@prisma-lossless/client'

export function getDbClient() {
  const client = new PrismaClient().$extends({})

  return client
}
