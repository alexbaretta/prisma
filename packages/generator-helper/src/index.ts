export { generatorHandler } from './generatorHandler'
export { GeneratorError, GeneratorProcess } from './GeneratorProcess'

/**
 * Exported for backwards compatibility only.
 *
 * @deprecated Generators using `@prisma-lossless/generator-helper` shouldn't need JSON-RPC internals.
 */
export type * as JsonRPC from './json-rpc'

/**
 * A re-export for backwards compatibility with community generators.
 *
 * @deprecated Use the `@prisma-lossless/dmmf` package instead.
 */
export type * as DMMF from '@prisma-lossless/dmmf'

/**
 * A re-export for backwards compatibility with community generators.
 *
 * @deprecated Use the `@prisma-lossless/generator` package instead.
 */
export type * from '@prisma-lossless/generator'
