import { describe, expect, test } from 'vitest'

import { getLocalTestVersion, shouldUseLocalTestVersion } from './publish'

describe('publish test-only version selection', () => {
  test('uses the local package version for test-only runs', () => {
    expect(shouldUseLocalTestVersion({ '--test': true }, false)).toBe(true)
    expect(
      getLocalTestVersion({
        'prisma-lossless': {
          name: 'prisma-lossless',
          path: 'packages/cli/package.json',
          version: '7.8.0-lossless.11',
          usedBy: [],
          usedByDev: [],
          uses: [],
          usesDev: [],
          packageJson: {},
        },
      }),
    ).toBe('7.8.0-lossless.11')
  })

  test('keeps publish and dry-run flows on remote version selection', () => {
    expect(shouldUseLocalTestVersion({ '--test': true, '--publish': true }, false)).toBe(false)
    expect(shouldUseLocalTestVersion({ '--test': true }, true)).toBe(false)
    expect(shouldUseLocalTestVersion({ '--publish': true }, false)).toBe(false)
  })

  test('requires a local CLI package for test-only version selection', () => {
    expect(() => getLocalTestVersion({})).toThrow(/Could not find local Prisma CLI package version/)
  })
})
