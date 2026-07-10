import { describe, expect, test } from 'vitest'

import {
  isLosslessJsonNumber,
  LosslessNumber,
  normalizeJsonFieldText,
  parseJsonFieldValue,
  stringifyJsonFieldValue,
} from './json-codec'

function expectRecord(value: unknown): Record<string, unknown> {
  expect(value).not.toBeNull()
  expect(typeof value).toBe('object')
  expect(Array.isArray(value)).toBe(false)
  return value as Record<string, unknown>
}

describe('json codec', () => {
  test('parses JSON numeric tokens as lossless numbers', () => {
    const value = expectRecord(
      parseJsonFieldValue('{"large":9007199254740993,"decimal":0.12345678901234567890123456789}'),
    )

    expect(isLosslessJsonNumber(value.large)).toBe(true)
    expect(String(value.large)).toBe('9007199254740993')
    expect(isLosslessJsonNumber(value.decimal)).toBe(true)
    expect(String(value.decimal)).toBe('0.12345678901234567890123456789')
  })

  test('distinguishes parsed tokens from rounded JavaScript numbers', () => {
    const rounded = Number('9007199254740993')
    const value = expectRecord(parseJsonFieldValue('{"large":9007199254740993}'))

    expect(String(rounded)).toBe('9007199254740992')
    expect(String(value.large)).toBe('9007199254740993')
  })

  test('stringifies LosslessNumber values as numeric tokens', () => {
    const json = stringifyJsonFieldValue({
      large: new LosslessNumber('9007199254740993'),
      decimal: new LosslessNumber('0.12345678901234567890123456789'),
      ordinary: 1.5,
    })

    expect(json).toBe('{"large":9007199254740993,"decimal":0.12345678901234567890123456789,"ordinary":1.5}')
  })

  test('preserves existing BigInt and Uint8Array JSON field behavior', () => {
    const json = stringifyJsonFieldValue({
      bigint: 9007199254740993n,
      bytes: new Uint8Array([1, 2, 3]),
    })

    expect(json).toBe('{"bigint":"9007199254740993","bytes":"AQID"}')
  })

  test('normalizes JSON text without losing numeric token text', () => {
    expect(normalizeJsonFieldText('{ "large" : 9007199254740993 }')).toBe('{"large":9007199254740993}')
  })

  test('rejects unsupported top-level values', () => {
    expect(() => stringifyJsonFieldValue(undefined)).toThrow('Cannot serialize undefined as a JSON field value')
  })
})
