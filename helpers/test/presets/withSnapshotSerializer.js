'use strict'
module.exports = {
  ...require('./default'),
  snapshotSerializers: ['@prisma-lossless/get-platform/src/test-utils/jestSnapshotSerializer'],
}
