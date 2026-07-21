import { PrismaClient } from '@prisma-lossless/client'

export class MyPrisma {
  prisma: PrismaClient

  constructor() {
    this.prisma = new PrismaClient()
  }
}
