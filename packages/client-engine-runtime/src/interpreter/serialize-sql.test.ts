import { ColumnTypeEnum } from '@prisma-lossless/driver-adapter-utils'
import { expect, test } from 'vitest'

import { serializeRawSql, serializeSql } from './serialize-sql'

test('should serialize empty rows', () => {
  const result = serializeSql({
    columnTypes: [ColumnTypeEnum.Int32, ColumnTypeEnum.Text],
    columnNames: ['id', 'name'],
    rows: [],
  })
  expect(result).toEqual([])
})

test('should serialize a flat list of rows', () => {
  const result = serializeSql({
    columnTypes: [ColumnTypeEnum.Int32, ColumnTypeEnum.Text],
    columnNames: ['id', 'name'],
    rows: [
      [1, 'Alice'],
      [2, 'Bob'],
    ],
  })
  expect(result).toEqual([
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
  ])
})

test('should preserve loss-sensitive JSON numbers in raw results', () => {
  const json = '{"large":9007199254740993,"decimal":0.12345678901234567890123456789}'

  const result = serializeRawSql({
    columnTypes: [ColumnTypeEnum.Json, ColumnTypeEnum.Text],
    columnNames: ['payload', 'payload_text'],
    rows: [[json, json]],
  })

  const [row] = result.rows as unknown[][]
  const payload = row[0] as { large: unknown; decimal: unknown }

  expect(String(payload.large)).toBe('9007199254740993')
  expect(String(payload.decimal)).toBe('0.12345678901234567890123456789')
  expect(row[1]).toBe(json)
})
