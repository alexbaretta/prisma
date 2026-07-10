import { Providers } from '../_utils/providers'
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

testMatrix.setupTestSuite(
  ({ provider }) => {
    beforeEach(async () => {
      await prisma.entry.deleteMany()
    })

    test('reads JSON numeric tokens losslessly from model results', async () => {
      await insertEntry(provider, 'read', losslessJsonText, null)

      const entry = await prisma.entry.findUniqueOrThrow({
        where: { id: 'read' },
      })

      expect(entry.json).toBeNull()
      expectLosslessPayload(entry.requiredJson)
    })

    test('reads JSON numeric tokens losslessly from raw query results', async () => {
      await insertEntry(provider, 'raw', losslessJsonText)

      const jsonRows = await selectRequiredJson(provider, 'raw')
      expectLosslessPayload(jsonRows[0].requiredJson)

      const textRows = await selectRequiredJsonAsText(provider, 'raw')
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
  },
  {
    optOut: {
      from: ['mysql', 'mongodb', 'cockroachdb', 'sqlserver'],
      reason: `
        mysql, mongodb, cockroachdb, sqlserver - this focused suite
        validates PostgreSQL json/jsonb text preservation and SQLite
        JSON text values. Other provider JSON semantics remain covered
        by the existing JSON functional suites.
      `,
    },
  },
)

async function insertEntry(provider: Providers, id: string, requiredJson: string, json?: string | null) {
  if (provider === Providers.POSTGRESQL) {
    await prisma.$executeRaw`
      INSERT INTO "Entry" ("id", "json", "requiredJson")
      VALUES (${id}, ${json === undefined ? null : json}::jsonb, ${requiredJson}::jsonb)
    `
    return
  }

  if (provider === Providers.SQLITE) {
    await prisma.$executeRaw`
      INSERT INTO "Entry" ("id", "json", "requiredJson")
      VALUES (${id}, ${json === undefined ? null : json}, ${requiredJson})
    `
    return
  }

  throw new Error(`Unsupported lossless JSON test provider: ${provider}`)
}

function selectRequiredJson(provider: Providers, id: string): Promise<Array<{ requiredJson: unknown }>> {
  if (provider === Providers.POSTGRESQL || provider === Providers.SQLITE) {
    return prisma.$queryRaw<Array<{ requiredJson: unknown }>>`
      SELECT "requiredJson" FROM "Entry" WHERE "id" = ${id}
    `
  }

  throw new Error(`Unsupported lossless JSON test provider: ${provider}`)
}

function selectRequiredJsonAsText(provider: Providers, id: string): Promise<Array<{ requiredJson: string }>> {
  if (provider === Providers.POSTGRESQL) {
    return prisma.$queryRaw<Array<{ requiredJson: string }>>`
      SELECT "requiredJson"::text AS "requiredJson" FROM "Entry" WHERE "id" = ${id}
    `
  }

  if (provider === Providers.SQLITE) {
    return prisma.$queryRaw<Array<{ requiredJson: string }>>`
      SELECT CAST("requiredJson" AS TEXT) AS "requiredJson" FROM "Entry" WHERE "id" = ${id}
    `
  }

  throw new Error(`Unsupported lossless JSON test provider: ${provider}`)
}
