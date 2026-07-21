import { PrismaBetterSqlite3 } from '@prisma-lossless/adapter-better-sqlite3'
import { PrismaClient } from '@prisma-lossless/client'
import { Prisma } from '@prisma-lossless/client/extension'
import { simpleExtension } from 'simple-ext'

test('prisma versions', () => {
  expect(Prisma.prismaVersion.client).toMatch(/^\d+\.\d+\.\d+/)
  expect(Prisma.prismaVersion.engine).toMatch(/^[a-f0-9]{40}/)
})

test('simple extension', () => {
  const adapter = new PrismaBetterSqlite3({
    url: './dev.db',
  })
  const prisma = new PrismaClient({ adapter }).$extends(simpleExtension)

  prisma.user.simpleCall({
    where: {
      email: 'a',
      // @ts-expect-error
      nonExistentField: 2,
    },
  })
})
