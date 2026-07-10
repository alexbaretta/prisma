import { describe, expect, test } from 'vitest'

import type { InMemoryOps } from '../query-plan'
import { getRecordKey, processRecords } from './in-memory-processing'

const noOpInMemoryOps: InMemoryOps = {
  pagination: null,
  distinct: null,
  reverse: false,
  linkingFields: null,
  nested: {},
}

function expectRecord(value: unknown): Record<string, unknown> {
  expect(value).not.toBeNull()
  expect(typeof value).toBe('object')
  expect(Array.isArray(value)).toBe(false)
  return value as Record<string, unknown>
}

describe('processRecords', () => {
  test('preserves loss-sensitive JSON numbers from string row envelopes', () => {
    const records = processRecords('[{"id":"a","json":{"large":9007199254740993}}]', noOpInMemoryOps) as unknown[]
    const json = expectRecord(expectRecord(records[0]).json)

    expect(String(json.large)).toBe('9007199254740993')
  })
})

describe('getRecordKey', () => {
  test('uses deterministic keys for lossless numeric values', () => {
    const [record] = processRecords('[{"id":9007199254740993}]', noOpInMemoryOps) as [Record<string, unknown>]

    expect(getRecordKey(record, ['id'])).toBe('[{"$type":"LosslessNumber","value":"9007199254740993"}]')
  })
})
