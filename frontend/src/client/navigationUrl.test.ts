import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildCanonicalNavigationUrl,
  commitSemanticNavigation,
  getInitialActiveSurface,
  parseNavigationState,
  SemanticNavigationBrowser,
  shouldHandleSemanticLinkClick,
} from './navigationUrl'

const stateFrom = (href: string) => parseNavigationState(new URL(href))

test('semantic link clicks preserve native modified-click deep links', () => {
  const click = {
    button: 0,
    defaultPrevented: false,
    metaKey: false,
    altKey: false,
    ctrlKey: false,
    shiftKey: false,
  }
  assert.equal(shouldHandleSemanticLinkClick(click), true)
  assert.equal(shouldHandleSemanticLinkClick({ ...click, ctrlKey: true }), false)
  assert.equal(shouldHandleSemanticLinkClick({ ...click, button: 1 }), false)
})

test('legacy URL layout initializes active surface unless the URL specifies one', () => {
  const urlFor = (state: Record<string, unknown>) =>
    new URL(`https://example.org/app?state=${encodeURIComponent(JSON.stringify(state))}`)

  assert.equal(getInitialActiveSurface(urlFor({ resultLayout: 'detail' })), 'details')
  assert.equal(getInitialActiveSurface(urlFor({ resultLayout: 'full' })), 'results')
  assert.equal(getInitialActiveSurface(urlFor({ resultLayout: 'split' })), 'results')
  assert.equal(
    getInitialActiveSurface(
      urlFor({ resultLayout: 'detail', activeSurface: 'results' })
    ),
    'results'
  )
})

test('canonical new-tab URLs remove stale entity and legacy query state', () => {
  const currentState = encodeURIComponent(JSON.stringify({
    geneId: 'old-gene',
    regionId: 'old-region',
    variantId: 'old-variant',
    analysisId: 'old-analysis',
    resultIndex: 'gene-phewas',
  }))
  const href = `https://example.org/other?state=${currentState}&geneId=legacy&resultLayout=detail&experienceMode=focused&activeSurface=details#old`
  const result = buildCanonicalNavigationUrl(href, {
    geneId: 'new-gene',
    resultIndex: 'gene-phewas',
    resultLayout: 'full',
  })
  const url = new URL(result)

  assert.equal(url.pathname, '/app')
  assert.equal(url.hash, '')
  assert.equal(url.searchParams.has('geneId'), false)
  assert.equal(url.searchParams.has('resultLayout'), false)
  assert.equal(url.searchParams.has('experienceMode'), false)
  assert.equal(url.searchParams.has('activeSurface'), false)
  assert.deepEqual(stateFrom(result), {
    geneId: 'new-gene',
    resultIndex: 'gene-phewas',
    resultLayout: 'full',
  })
})

test('gene, phenotype, variant, and locus-PheWAS destinations survive URL refresh', () => {
  const cases = [
    { geneId: 'ENSG1', resultIndex: 'gene-phewas' },
    { analysisId: 'pheno-1', resultIndex: 'pheno-info' },
    { variantId: '1-10-A-G', resultIndex: 'variant-phewas' },
    { regionId: '1-1-20', resultIndex: 'locus-phewas' },
  ]

  for (const destination of cases) {
    const result = buildCanonicalNavigationUrl(
      'https://example.org/app?state=%7B%7D',
      { ...destination, resultLayout: 'full' }
    )
    assert.deepEqual(stateFrom(result), { ...destination, resultLayout: 'full' })
  }
})

test('canonical URLs preserve an explicit experience mode and active surface', () => {
  const result = buildCanonicalNavigationUrl(
    'https://example.org/app?state=%7B%22experienceMode%22%3A%22sideBySide%22%7D',
    {
      geneId: 'ENSG1',
      experienceMode: 'focused',
      activeSurface: 'details',
      resultLayout: 'detail',
    }
  )

  assert.deepEqual(stateFrom(result), {
    geneId: 'ENSG1',
    experienceMode: 'focused',
    activeSurface: 'details',
    resultLayout: 'detail',
  })
})

test('detail links preserve analysis context only when explicitly requested', () => {
  const current = buildCanonicalNavigationUrl('https://example.org/app', {
    analysisId: 'pheno-1',
    geneId: 'old-gene',
  })
  const result = buildCanonicalNavigationUrl(
    current,
    { regionId: '2-10-20', resultLayout: 'detail' },
    { preserveKeys: ['analysisId'] }
  )

  assert.deepEqual(stateFrom(result), {
    analysisId: 'pheno-1',
    regionId: '2-10-20',
    resultLayout: 'detail',
  })
})

class MemorySemanticBrowser implements SemanticNavigationBrowser {
  entries: string[]
  index = 0
  restored = { pathname: '', state: {} as Record<string, unknown> }

  constructor(initialHref: string) {
    this.entries = [initialHref]
    this.notifyUrlChange()
  }

  getCurrentHref = () => this.entries[this.index]

  pushUrl = (url: string) => {
    this.entries.splice(this.index + 1)
    this.entries.push(url)
    this.index += 1
  }

  notifyUrlChange = () => {
    const url = new URL(this.getCurrentHref())
    this.restored = {
      pathname: url.pathname,
      state: parseNavigationState(url),
    }
  }

  back() {
    this.index = Math.max(0, this.index - 1)
    this.notifyUrlChange()
  }

  forward() {
    this.index = Math.min(this.entries.length - 1, this.index + 1)
    this.notifyUrlChange()
  }
}

const appUrl = (state: Record<string, unknown>) =>
  buildCanonicalNavigationUrl('https://example.org/app', state)

test('Results to Details is one atomic entry and Back/Forward restores presentation', () => {
  const resultsState = {
    geneId: null,
    regionId: null,
    variantId: null,
    analysisId: null,
    resultIndex: 'top-associations',
    experienceMode: 'focused',
    activeSurface: 'results',
    resultLayout: 'full',
  }
  const browser = new MemorySemanticBrowser(appUrl(resultsState))

  commitSemanticNavigation(browser, {
    geneId: 'ENSG1',
    regionId: null,
    variantId: null,
    analysisId: null,
    resultIndex: 'gene-phewas',
    experienceMode: 'focused',
    activeSurface: 'details',
    resultLayout: 'full',
  })

  assert.equal(browser.entries.length, 2)
  assert.deepEqual(browser.restored, {
    pathname: '/app',
    state: {
      geneId: 'ENSG1',
      regionId: null,
      variantId: null,
      analysisId: null,
      resultIndex: 'gene-phewas',
      experienceMode: 'focused',
      activeSurface: 'details',
      resultLayout: 'full',
    },
  })
  browser.back()
  assert.deepEqual(browser.restored, { pathname: '/app', state: resultsState })
  browser.forward()
  const forwardState = parseNavigationState(new URL(browser.getCurrentHref()))
  assert.equal(forwardState.activeSurface, 'details')
  assert.equal(forwardState.resultLayout, 'full')
})

test('Home and About search push no intermediate /app entry and Back restores route', () => {
  for (const route of ['/', '/about']) {
    const browser = new MemorySemanticBrowser(`https://example.org${route}`)
    commitSemanticNavigation(browser, {
      geneId: 'ENSG1',
      regionId: null,
      variantId: null,
      analysisId: null,
      resultIndex: 'gene-phewas',
      experienceMode: 'sideBySide',
      activeSurface: 'results',
      resultLayout: 'full',
    })

    assert.equal(browser.entries.length, 2)
    assert.equal(browser.restored.pathname, '/app')
    browser.back()
    assert.deepEqual(browser.restored, { pathname: route, state: {} })
  }
})

test('header Results navigation pushes one complete destination', () => {
  const detailState = {
    geneId: 'ENSG1',
    resultIndex: 'gene-phewas',
    experienceMode: 'sideBySide',
    activeSurface: 'details',
    resultLayout: 'split',
  }
  const browser = new MemorySemanticBrowser(appUrl(detailState))

  commitSemanticNavigation(browser, {
    geneId: null,
    regionId: null,
    variantId: null,
    analysisId: null,
    resultIndex: 'top-associations',
    topResultsTab: 'all-genes',
    experienceMode: 'sideBySide',
    activeSurface: 'results',
    resultLayout: 'full',
  })

  assert.equal(browser.entries.length, 2)
  assert.deepEqual(browser.restored.state, {
    geneId: null,
    resultIndex: 'top-associations',
    experienceMode: 'sideBySide',
    activeSurface: 'results',
    resultLayout: 'full',
    regionId: null,
    variantId: null,
    analysisId: null,
    topResultsTab: 'all-genes',
  })
  browser.back()
  assert.deepEqual(browser.restored, { pathname: '/app', state: detailState })
})
