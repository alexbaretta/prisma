import { Decimal } from '@prisma/client-runtime-utils'
import { describe, expect, test } from 'vitest'

import { deserializeJsonObject } from './json-protocol'

describe('deserializeJsonObject', () => {
  test('primitives', () => {
    expect(deserializeJsonObject(1)).toBe(1)
    expect(deserializeJsonObject('foo')).toBe('foo')
    expect(deserializeJsonObject(null)).toBe(null)
    expect(deserializeJsonObject(false)).toBe(false)
  })

  test('Date', () => {
    const value = deserializeJsonObject({ $type: 'DateTime', value: '1980-01-02T00:00:00.000Z' })
    expect(value).toBeInstanceOf(Date)
    expect(value).toEqual(new Date('1980-01-02T00:00:00.000Z'))
  })

  test('BigInt', () => {
    const value = deserializeJsonObject({ $type: 'BigInt', value: '123' })
    expect(value).toBe(123n)
  })

  test('Bytes', () => {
    const value = deserializeJsonObject({ $type: 'Bytes', value: 'aGVsbG8gd29ybGQ=' })
    expect(value).toBeInstanceOf(Uint8Array)
    expect(value).toEqual(new Uint8Array(Buffer.from('hello world')))
  })

  test('Decimal', () => {
    const value = deserializeJsonObject({ $type: 'Decimal', value: '123.45' })
    expect(value).toBeInstanceOf(Decimal)
    expect(value).toEqual(new Decimal('123.45'))
  })

  test('Json', () => {
    const value = deserializeJsonObject({ $type: 'Json', value: '{"foo":123}' })
    expect(value).toEqual({ foo: 123 })
  })

  test('Json preserves loss-sensitive numeric tokens', () => {
    const value = deserializeJsonObject({
      $type: 'Json',
      value: '{"large":9007199254740993,"decimal":0.12345678901234567890123456789,"nested":[9007199254740995,null]}',
    }) as {
      large: unknown
      decimal: unknown
      nested: [unknown, null]
    }

    expect(String(value.large)).toBe('9007199254740993')
    expect(String(value.decimal)).toBe('0.12345678901234567890123456789')
    expect(String(value.nested[0])).toBe('9007199254740995')
    expect(value.nested[1]).toBeNull()
  })

  test('object', () => {
    expect(
      deserializeJsonObject({
        name: 'John',
        height: 173.45,
        money: { $type: 'Decimal', value: '123.45' },
        profile: {
          birthday: { $type: 'DateTime', value: '1980-01-02T00:00:00.000Z' },
        },
      }),
    ).toEqual({
      name: 'John',
      height: 173.45,
      money: new Decimal('123.45'),
      profile: {
        birthday: new Date('1980-01-02T00:00:00.000Z'),
      },
    })
  })

  test('array', () => {
    expect(deserializeJsonObject(['foo', 123, { $type: 'BigInt', value: '123' }])).toEqual(['foo', 123, 123n])
  })
})
