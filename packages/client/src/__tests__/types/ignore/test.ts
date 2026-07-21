import { PrismaClient } from '@prisma-lossless/client'

// just make sure the client types compile
async function main() {
  const prisma = new PrismaClient()
}

main().catch((e) => {
  console.error(e)
})
