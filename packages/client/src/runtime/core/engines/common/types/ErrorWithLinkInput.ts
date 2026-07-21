import type { ConnectorType } from '@prisma-lossless/generator'

export interface ErrorWithLinkInput {
  version: string
  engineVersion?: string
  database?: ConnectorType
  query?: string
  binaryTarget?: string
  title: string
  description?: string
}
