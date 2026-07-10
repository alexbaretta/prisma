import { isLosslessNumber, LosslessNumber, parse, stringify } from 'lossless-json'

export { LosslessNumber }

export function isLosslessJsonNumber(value: unknown): value is LosslessNumber {
  return isLosslessNumber(value)
}

export function parseJsonFieldValue(text: string): unknown {
  return parse(text)
}

export function stringifyJsonFieldValue(value: unknown): string {
  const json = stringify(value, jsonFieldReplacer)

  if (json === undefined) {
    throw new TypeError(`Cannot serialize ${typeof value} as a JSON field value`)
  }

  return json
}

export function normalizeJsonFieldText(text: string): string {
  return stringifyJsonFieldValue(parseJsonFieldValue(text))
}

function jsonFieldReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString()
  }

  if (ArrayBuffer.isView(value)) {
    return bytesToBase64(value)
  }

  return value
}

function bytesToBase64(value: ArrayBufferView): string {
  const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength)

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64')
  }

  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}
