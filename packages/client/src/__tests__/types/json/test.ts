import { Prisma, PrismaClient } from '@prisma-lossless/client'

// This file will not be executed, just compiled to check if the typings are valid
async function main() {
  const prisma = new PrismaClient()

  const x = await prisma.user.findMany()
  const info: Prisma.JsonValue = x[0].info
  const losslessNumber = new Prisma.LosslessNumber('9007199254740993')
  const losslessJsonValue: Prisma.JsonValue = losslessNumber
  const losslessJsonObject: Prisma.JsonObject = { value: losslessNumber }
  const losslessJsonArray: Prisma.JsonArray = [losslessNumber]
  const losslessInput: Prisma.InputJsonValue = losslessNumber
  const numberInput: Prisma.InputJsonValue = 1

  type OptionalObject = {
    value?: string | undefined
  }
  const y: OptionalObject = {
    value: undefined,
  }

  await prisma.user.create({
    data: {
      info: y,
      email: '...',
    },
  })

  await prisma.user.create({
    data: {
      info: {
        large: losslessInput,
        ordinary: numberInput,
      },
      email: 'lossless@example.org',
    },
  })

  await prisma.user.update({
    where: {
      id: '123',
    },
    data: {
      info: y,
    },
  })

  {
    const info: {
      readonly a: string[]
      readonly b: ReadonlyArray<string>
      c: string[]
      d: ReadonlyArray<string>
      e: {
        readonly a: {
          b: {}
        }
      }
    } = {
      a: [],
      b: [],
      c: [],
      d: [],
      e: { a: { b: {} } },
    }

    const result = await prisma.user.create({
      data: {
        email: 'user@example.org',
        info,
      },
    })

    await prisma.user.update({
      where: { id: '0' },
      data: { info },
    })

    await prisma.user.update({
      where: { id: '1' },
      data: {
        info: result.info === null ? Prisma.JsonNull : result.info,
      },
    })
  }

  {
    const array: ReadonlyArray<string> = []

    await prisma.user.update({
      where: { id: '0' },
      data: { info: array },
    })
  }

  {
    const array: string[] = []

    await prisma.user.update({
      where: { id: '0' },
      data: { info: array },
    })
  }
}

main().catch((e) => {
  console.error(e)
})
