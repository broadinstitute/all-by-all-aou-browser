import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import {
  createRecoilRouterBrowserInterface,
  routerLocationFromUrl,
} from './routerHistory'

test('recoil URL writes can only replace the current Router visit', () => {
  const calls: Array<{ action: string; pathname: string }> = []
  const history = {
    push: (location: { pathname: string; search: string; hash: string }) => calls.push({ action: 'push', pathname: location.pathname }),
    replace: (location: { pathname: string; search: string; hash: string }) => calls.push({ action: 'replace', pathname: location.pathname }),
    listen: (_listener: () => void) => () => undefined,
  }
  const browser = createRecoilRouterBrowserInterface(
    history,
    () => 'https://example.org/app?state=%7B%7D'
  )

  browser.replaceURL?.('https://example.org/app?state=%7B%22a%22%3A1%7D')
  browser.pushURL?.('https://example.org/about')

  assert.deepEqual(calls, [
    { action: 'replace', pathname: '/app' },
    { action: 'replace', pathname: '/about' },
  ])
})

test('recoil URL projections retain semantic return-origin history state', () => {
  const locations: unknown[] = []
  const originState = { __axaouReturnOrigin: 'phenotype-results' }
  const history = {
    location: { state: originState },
    push: (_location: unknown) => undefined,
    replace: (location: unknown) => locations.push(location),
    listen: (_listener: () => void) => () => undefined,
  }
  const browser = createRecoilRouterBrowserInterface(history)

  browser.replaceURL?.('https://example.org/app?state=%7B%7D')

  assert.deepEqual(locations, [{
    pathname: '/app',
    search: '?state=%7B%7D',
    hash: '',
    state: originState,
  }])
})

test('all shared URL atoms are replace-only so lazy defaults cannot create visits', () => {
  const source = readFileSync(join(__dirname, 'sharedState.ts'), 'utf8')
  assert.equal(source.includes("history: 'push'"), false)
})

test('absolute canonical URLs retain Router pathname, search, and hash', () => {
  assert.deepEqual(
    routerLocationFromUrl('https://example.org/app?state=%7B%7D#result'),
    { pathname: '/app', search: '?state=%7B%7D', hash: '#result' }
  )
})
