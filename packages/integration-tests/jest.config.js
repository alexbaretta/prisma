const testPathIgnorePatterns = []

if (process.env.TEST_SKIP_MSSQL) {
  testPathIgnorePatterns.push('/src/__tests__/integration/mssql/')
}

module.exports = {
  preset: '../../helpers/test/presets/withSnapshotSerializer.js',
  prettierPath: '../../node_modules/prettier2',
  testPathIgnorePatterns,
}
