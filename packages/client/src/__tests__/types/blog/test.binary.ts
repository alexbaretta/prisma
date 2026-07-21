import { PrismaClient } from '@prisma-lossless/client'

async function main() {
  const prisma = new PrismaClient()

  prisma.$on('beforeExit', () => {})
}

void main()
