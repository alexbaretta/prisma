import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient
declare let Prisma: typeof PrismaNamespace

const losslessJsonText =
  '{"large":9007199254740993,"decimal":0.12345678901234567890123456789,"nested":{"array":[9007199254740995,null]},"jsonNull":null}'

function expectLosslessPayload(value: unknown) {
  const payload = value as {
    large: unknown
    decimal: unknown
    nested: { array: [unknown, null] }
    jsonNull: null
  }

  expect(String(payload.large)).toBe('9007199254740993')
  expect(String(payload.decimal)).toBe('0.12345678901234567890123456789')
  expect(String(payload.nested.array[0])).toBe('9007199254740995')
  expect(payload.nested.array[1]).toBeNull()
  expect(payload.jsonNull).toBeNull()
}

testMatrix.setupTestSuite(() => {
  beforeEach(async () => {
    await prisma.entry.deleteMany()
  })

  test('reads JSON numeric tokens losslessly from model results', async () => {
    await prisma.$executeRaw`
      INSERT INTO "Entry" ("id", "json", "requiredJson")
      VALUES (${'read'}, ${null}, ${losslessJsonText}::jsonb)
    `

    const entry = await prisma.entry.findUniqueOrThrow({
      where: { id: 'read' },
    })

    expect(entry.json).toBeNull()
    expectLosslessPayload(entry.requiredJson)
  })

  test('reads JSON numeric tokens losslessly from raw query results', async () => {
    await prisma.$executeRaw`
      INSERT INTO "Entry" ("id", "requiredJson")
      VALUES (${'raw'}, ${losslessJsonText}::jsonb)
    `

    const jsonRows = await prisma.$queryRaw<Array<{ requiredJson: unknown }>>`
      SELECT "requiredJson" FROM "Entry" WHERE "id" = ${'raw'}
    `
    expectLosslessPayload(jsonRows[0].requiredJson)

    const textRows = await prisma.$queryRaw<Array<{ requiredJson: string }>>`
      SELECT "requiredJson"::text AS "requiredJson" FROM "Entry" WHERE "id" = ${'raw'}
    `
    expect(typeof textRows[0].requiredJson).toBe('string')
  })

  test('writes LosslessNumber JSON inputs as numeric tokens', async () => {
    const entry = await prisma.entry.create({
      data: {
        requiredJson: {
          large: new Prisma.LosslessNumber('9007199254740993'),
          decimal: new Prisma.LosslessNumber('0.12345678901234567890123456789'),
          ordinary: 1.5,
        },
      },
    })

    const payload = entry.requiredJson as {
      large: unknown
      decimal: unknown
      ordinary: unknown
    }

    expect(String(payload.large)).toBe('9007199254740993')
    expect(String(payload.decimal)).toBe('0.12345678901234567890123456789')
    expect(payload.ordinary).toBe(1.5)
  })
})
