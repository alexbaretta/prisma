import { Providers } from '../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient
declare let Prisma: typeof PrismaNamespace

const losslessJsonText =
  '{"large":9007199254740993,"decimal":0.12345678901234567890123456789,"nested":{"array":[9007199254740995,null]},"jsonNull":null}'

const canonicalExponent = '1234567890123456789000000000000'

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

function rawJsonParameterInput(Prisma: typeof PrismaNamespace): PrismaNamespace.InputJsonObject {
  return {
    unsafePositive: new Prisma.LosslessNumber('9007199254740993'),
    unsafeNegative: new Prisma.LosslessNumber('-9007199254740993'),
    preciseDecimal: new Prisma.LosslessNumber('0.12345678901234567890123456789'),
    exponent: new Prisma.LosslessNumber('1.234567890123456789e+30'),
    safeInteger: new Prisma.LosslessNumber('42'),
    safeDecimal: new Prisma.LosslessNumber('1.25'),
    nested: {
      values: [new Prisma.LosslessNumber('9007199254740993'), null],
    },
    quoted: '9007199254740993',
  }
}

function expectRawJsonPrecisionPayload(value: unknown) {
  const payload = value as {
    unsafePositive: unknown
    unsafeNegative: unknown
    preciseDecimal: unknown
    exponent: unknown
    safeInteger: unknown
    safeDecimal: unknown
    nested: { values: [unknown, null] }
    quoted: string
  }

  expect(String(payload.unsafePositive)).toBe('9007199254740993')
  expect(String(payload.unsafeNegative)).toBe('-9007199254740993')
  expect(String(payload.preciseDecimal)).toBe('0.12345678901234567890123456789')
  expect(String(payload.exponent)).toBe(canonicalExponent)
  expect(String(payload.safeInteger)).toBe('42')
  expect(String(payload.safeDecimal)).toBe('1.25')
  expect(String(payload.nested.values[0])).toBe('9007199254740993')
  expect(payload.nested.values[1]).toBeNull()
  expect(payload.quoted).toBe('9007199254740993')
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
      expect(String(payload.ordinary)).toBe('1.5')
    })

    testIf(provider === Providers.POSTGRESQL)('parameterizes raw JSON objects losslessly', async () => {
      const input = rawJsonParameterInput(Prisma)

      const rows = await prisma.$queryRaw<
        Array<{
          value: PrismaNamespace.JsonValue
          unsafePositiveText: string
          unsafePositiveType: string
          unsafeNegativeText: string
          preciseDecimalText: string
          exponentText: string
          safeIntegerText: string
          safeDecimalText: string
          nestedText: string
          quotedType: string
        }>
      >`
        WITH parameter(value) AS (
          VALUES (${input}::jsonb)
        )
        SELECT
          value,
          value ->> 'unsafePositive' AS "unsafePositiveText",
          jsonb_typeof(value -> 'unsafePositive') AS "unsafePositiveType",
          value ->> 'unsafeNegative' AS "unsafeNegativeText",
          value ->> 'preciseDecimal' AS "preciseDecimalText",
          value ->> 'exponent' AS "exponentText",
          value ->> 'safeInteger' AS "safeIntegerText",
          value ->> 'safeDecimal' AS "safeDecimalText",
          value #>> '{nested,values,0}' AS "nestedText",
          jsonb_typeof(value -> 'quoted') AS "quotedType"
        FROM parameter
      `

      expect(rows[0].unsafePositiveText).toBe('9007199254740993')
      expect(rows[0].unsafePositiveType).toBe('number')
      expect(rows[0].unsafeNegativeText).toBe('-9007199254740993')
      expect(rows[0].preciseDecimalText).toBe('0.12345678901234567890123456789')
      expect(rows[0].exponentText).toBe(canonicalExponent)
      expect(rows[0].safeIntegerText).toBe('42')
      expect(rows[0].safeDecimalText).toBe('1.25')
      expect(rows[0].nestedText).toBe('9007199254740993')
      const value = rows[0].value as { unsafePositive: unknown }

      expect(rows[0].quotedType).toBe('string')
      expect(value.unsafePositive).toBeInstanceOf(Prisma.LosslessNumber)
      expectRawJsonPrecisionPayload(value)
    })

    testIf(provider === Providers.POSTGRESQL)('executes raw JSON object parameters losslessly', async () => {
      const input = rawJsonParameterInput(Prisma)

      await prisma.$executeRaw`
        INSERT INTO "Entry" ("id", "json", "requiredJson")
        VALUES (${'raw-execute'}, ${input}::jsonb, ${input}::jsonb)
      `

      const entry = await prisma.entry.findUniqueOrThrow({
        where: { id: 'raw-execute' },
      })

      expectRawJsonPrecisionPayload(entry.json)
      expectRawJsonPrecisionPayload(entry.requiredJson)

      const rows = await prisma.$queryRaw<
        Array<{
          unsafePositiveText: string
          unsafePositiveType: string
          quotedType: string
          exponentText: string
        }>
      >`
        SELECT
          "requiredJson" ->> 'unsafePositive' AS "unsafePositiveText",
          jsonb_typeof("requiredJson" -> 'unsafePositive') AS "unsafePositiveType",
          jsonb_typeof("requiredJson" -> 'quoted') AS "quotedType",
          "requiredJson" ->> 'exponent' AS "exponentText"
        FROM "Entry"
        WHERE "id" = ${'raw-execute'}
      `

      expect(rows[0].unsafePositiveText).toBe('9007199254740993')
      expect(rows[0].unsafePositiveType).toBe('number')
      expect(rows[0].quotedType).toBe('string')
      expect(rows[0].exponentText).toBe(canonicalExponent)
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
