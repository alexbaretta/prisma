import path from 'node:path'

import { describe, expect, test } from 'vitest'

import {
  assertApprovedPublishRegistry,
  assertOutsideCheckout,
  buildCommandPlan,
  buildVerdaccioConfig,
  DEFAULT_REGISTRY_URL,
  getRegistryRuntimePaths,
  normalizeRegistryUrl,
  PRIVATE_REGISTRY_MAX_BODY_SIZE,
  PRIVATE_RELEASE_DIST_TAG,
  VERDACCIO_VERSION,
} from './private-registry'

describe('lossless private registry contract', () => {
  test('approves only the private local publish endpoint', () => {
    expect(assertApprovedPublishRegistry(DEFAULT_REGISTRY_URL)).toBe(DEFAULT_REGISTRY_URL)
    expect(assertApprovedPublishRegistry('http://localhost:4873')).toBe('http://localhost:4873/')
    expect(assertApprovedPublishRegistry('http://127.0.0.1:57321')).toBe('http://127.0.0.1:57321/')
  })

  test('rejects public, missing, malformed, and remote endpoints', () => {
    expect(() => assertApprovedPublishRegistry('https://registry.npmjs.org/')).toThrow(/public registry/)
    expect(() => assertApprovedPublishRegistry('')).toThrow(/malformed/)
    expect(() => assertApprovedPublishRegistry('not-a-url')).toThrow(/malformed/)
    expect(() => assertApprovedPublishRegistry('https://example.com:4873/')).toThrow(/not an approved/)
    expect(() => assertApprovedPublishRegistry('http://host.docker.internal:4873/')).toThrow(/not an approved/)
    expect(() => assertApprovedPublishRegistry('http://127.0.0.1:80/')).toThrow(/not an approved/)
    expect(() => assertApprovedPublishRegistry('http://127.0.0.1/')).toThrow(/not an approved/)
  })

  test('normalizes safe registry URLs without credentials', () => {
    expect(normalizeRegistryUrl('http://127.0.0.1:4873')).toBe(DEFAULT_REGISTRY_URL)
    expect(() => normalizeRegistryUrl('http://user:secret@127.0.0.1:4873')).toThrow(/credentials/)
  })

  test('keeps runtime paths outside the checkout', () => {
    const paths = getRegistryRuntimePaths('/private/tmp/prisma-lossless-test-registry')

    expect(paths.root).toBe('/private/tmp/prisma-lossless-test-registry')
    expect(() => assertOutsideCheckout(path.join(process.cwd(), 'tmp/private-registry'))).toThrow(/outside/)
  })

  test('pins Verdaccio and never prints a credential-bearing command', () => {
    const commands = buildCommandPlan()

    expect(commands.start).toContain(`verdaccio@${VERDACCIO_VERSION}`)
    for (const command of Object.values(commands)) {
      expect(command.join(' ')).not.toContain('registry.npmjs.org')
      expect(command.join(' ')).not.toContain('_authToken')
    }
    expect(commands.publish).toContain('--tag')
    expect(commands.publish).toContain(PRIVATE_RELEASE_DIST_TAG)
  })

  test('keeps lossless public packages private in Verdaccio config', () => {
    const config = buildVerdaccioConfig(getRegistryRuntimePaths('/private/tmp/prisma-lossless-test-registry'))

    expect(config).toContain("'@prisma-lossless/*':")
    expect(config).not.toContain("'prisma-lossless':")
    expect(config).toContain(`max_body_size: ${PRIVATE_REGISTRY_MAX_BODY_SIZE}`)
    expect(config).toMatch(
      /'@prisma-lossless\/\*':\n {4}access: \$all\n {4}publish: \$authenticated\n {4}unpublish: \$authenticated\n {2}'@prisma\/\*':/,
    )
  })
})
