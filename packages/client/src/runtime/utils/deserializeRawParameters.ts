import type { PrismaValue } from '@prisma/client-engine-runtime'
import { parseJsonFieldValue } from '@prisma/client-runtime-utils'
import type { ArgScalarType, ArgType } from '@prisma/driver-adapter-utils'

type RawParameters = {
  args: PrismaValue[]
  argTypes: ArgType[]
}

const tagToArgScalarType: Record<string, ArgScalarType> = {
  bigint: 'bigint',
  date: 'datetime',
  decimal: 'decimal',
  bytes: 'bytes',
  json: 'json',
}

export function deserializeRawParameters(serializedParameters: string): RawParameters {
  let parsed: unknown
  try {
    parsed = JSON.parse(serializedParameters)
  } catch (err) {
    throw new Error(`Received invalid serialized parameters: ${err.message}`)
  }
  if (!Array.isArray(parsed)) {
    throw new Error('Received invalid serialized parameters: expected an array')
  }
  const args = parsed.map((parameter: unknown) => decodeParameter(parameter))
  const argTypes = parsed.map((parameter: unknown) => getArgType(parameter))
  return { args, argTypes }
}

function decodeParameter(parameter: unknown): PrismaValue {
  if (Array.isArray(parameter)) {
    return parameter.map((item) => decodeParameter(item))
  }

  if (typeof parameter === 'object' && parameter !== null && 'prisma__value' in parameter) {
    if (!('prisma__type' in parameter)) {
      throw new Error('Invalid serialized parameter, prisma__type should be present when prisma__value is present')
    }
    if (parameter.prisma__type === 'json') {
      return decodeJsonParameter(parameter.prisma__value)
    }
    return `${parameter.prisma__value}`
  }

  if (typeof parameter === 'object' && parameter !== null) {
    return JSON.stringify(parameter)
  }

  return parameter as PrismaValue
}

function decodeJsonParameter(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('Invalid serialized JSON parameter: prisma__value must be a string')
  }

  try {
    parseJsonFieldValue(value)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Invalid serialized JSON parameter: ${message}`)
  }

  return value
}

function getArgType(parameter: unknown): ArgType {
  if (Array.isArray(parameter)) {
    return { scalarType: parameter.length > 0 ? getScalarType(parameter[0]) : 'unknown', arity: 'list' }
  }

  return { scalarType: getScalarType(parameter), arity: 'scalar' }
}

function getScalarType(parameter: unknown): ArgScalarType {
  if (
    typeof parameter === 'object' &&
    parameter !== null &&
    'prisma__type' in parameter &&
    typeof parameter.prisma__type === 'string' &&
    parameter.prisma__type in tagToArgScalarType
  ) {
    return tagToArgScalarType[parameter.prisma__type]
  }

  if (typeof parameter === 'number') {
    return 'decimal'
  }

  if (typeof parameter === 'string') {
    return 'string'
  }

  return 'unknown'
}
