import { describe, expect, test } from 'vitest'

import type { ResultNode } from '../query-plan'
import { applyDataMap } from './data-mapper'

describe('applyDataMap', () => {
  test('preserves JSON numbers losslessly when mapping a string row envelope', () => {
    const result = applyDataMap(
      '[{"id":9007199254740993,"amount":0.12345678901234567890123456789,"payload":{"large":9007199254740995}}]',
      {
        type: 'object',
        serializedName: null,
        skipNulls: false,
        fields: {
          id: {
            type: 'field',
            dbName: 'id',
            fieldType: { type: 'bigint', arity: 'scalar' },
          },
          amount: {
            type: 'field',
            dbName: 'amount',
            fieldType: { type: 'decimal', arity: 'scalar' },
          },
          payload: {
            type: 'field',
            dbName: 'payload',
            fieldType: { type: 'json', arity: 'scalar' },
          },
        },
      } satisfies ResultNode,
      {},
    ) as Array<{ id: { value: unknown }; amount: { value: unknown }; payload: { value: string } }>

    expect(result[0].id.value).toBe('9007199254740993')
    expect(String(result[0].amount.value)).toBe('0.12345678901234567890123456789')
    expect(result[0].payload.value).toBe('{"large":9007199254740995}')
  })
})
