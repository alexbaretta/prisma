import { build } from '../../../helpers/compile/build'
import { esmSplitCodeToCjs } from '../../../helpers/compile/plugins/esmSplitCodeToCjs'

void build([
  {
    name: 'default',
    bundle: true,
    emitTypes: true,
    splitting: true,
    format: 'esm',
    plugins: [esmSplitCodeToCjs],
    external: ['@prisma-lossless/debug', '@prisma-lossless/dmmf', '@prisma-lossless/generator'],
  },
])
