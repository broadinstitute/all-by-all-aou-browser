import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_CACHE_ENABLED,
  getQueryCacheName,
  resolveCacheEnabled,
} from './queryCachePolicy'

test('query cache is enabled by default and only explicitly false disables it', () => {
  assert.equal(DEFAULT_CACHE_ENABLED, true)
  assert.equal(resolveCacheEnabled(undefined), true)
  assert.equal(resolveCacheEnabled('true'), true)
  assert.equal(resolveCacheEnabled('FALSE'), false)
  assert.equal(resolveCacheEnabled(' false '), false)
})

test('query cache naming uses only its explicit schema version', () => {
  assert.equal(getQueryCacheName(), 'axaou-query-cache-v1')
  assert.equal(getQueryCacheName(1), 'axaou-query-cache-v1')
  assert.equal(getQueryCacheName(2), 'axaou-query-cache-v2')
})
