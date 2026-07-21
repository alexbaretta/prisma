import { QueryCompilerConstructor } from '@prisma-lossless/client-common'

import { EngineConfig } from '../../common/Engine'

export type QueryCompilerLoaderConfig = Pick<EngineConfig, 'activeProvider' | 'clientVersion' | 'compilerWasm'>

export interface QueryCompilerLoader {
  loadQueryCompiler(config: QueryCompilerLoaderConfig): Promise<QueryCompilerConstructor>
}
