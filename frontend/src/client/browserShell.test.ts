import assert from 'node:assert/strict'
import test from 'node:test'

import {
  canCompareSideBySide,
  canFitTwoPanes,
  getBackToResultsLabel,
  getBrowserShellRenderMode,
  getDetailsContextLabel,
  getResponsiveBrowserShellRenderMode,
  getResponsiveBrowserShellRenderPolicy,
  getResponsivePagePadding,
  getRetainedSurfaceMounts,
  getRetainedSurfaceVisibility,
  shouldShowLayoutControls,
} from './browserShell'

test('Focused selects its active surface while Side by side honors its layout', () => {
  assert.equal(getBrowserShellRenderMode('focused', 'results', 'split'), 'results-only')
  assert.equal(getBrowserShellRenderMode('focused', 'details', 'full'), 'details-only')
  assert.equal(getBrowserShellRenderMode('sideBySide', 'details', 'full'), 'results-only')
  assert.equal(getBrowserShellRenderMode('sideBySide', 'results', 'detail'), 'details-only')
  assert.equal(getBrowserShellRenderMode('sideBySide', 'results', 'split'), 'split')
})

test('narrow containers temporarily use one active surface without changing layout inputs', () => {
  assert.equal(
    getResponsiveBrowserShellRenderMode('sideBySide', 'results', 'split', 1099),
    'results-only'
  )
  assert.equal(
    getResponsiveBrowserShellRenderMode('sideBySide', 'details', 'split', 600),
    'details-only'
  )
  assert.equal(
    getResponsiveBrowserShellRenderMode('sideBySide', 'details', 'split', 1100),
    'split'
  )
  assert.equal(
    getResponsiveBrowserShellRenderMode('focused', 'details', 'full', 1600),
    'details-only'
  )
  assert.equal(canFitTwoPanes(undefined), false)
  assert.equal(canFitTwoPanes(1100), true)
  assert.equal(shouldShowLayoutControls('sideBySide', 1099), false)
  assert.equal(shouldShowLayoutControls('sideBySide', 1100), true)
  assert.equal(shouldShowLayoutControls('focused', 1600), false)
})

test('Focused variant policy composes one stacked workspace at every width', () => {
  for (const width of [480, 1600]) {
    assert.deepEqual(
      getResponsiveBrowserShellRenderPolicy({
        experienceMode: 'focused',
        activeSurface: 'details',
        resultLayout: 'split',
        width,
        variantId: 'chr17-43057062-T-TG',
      }),
      { kind: 'stacked-variant', renderMode: 'stacked-variant' }
    )
  }
})

test('Focused without a variant retains its active single surface', () => {
  assert.deepEqual(
    getResponsiveBrowserShellRenderPolicy({
      experienceMode: 'focused',
      activeSurface: 'results',
      resultLayout: 'split',
      width: 1600,
      variantId: null,
    }),
    { kind: 'single-surface', renderMode: 'results-only' }
  )
})

test('Side by side with a variant retains wide and responsive behavior', () => {
  const input = {
    experienceMode: 'sideBySide' as const,
    activeSurface: 'details' as const,
    resultLayout: 'split' as const,
    variantId: 'chr17-43057062-T-TG',
  }

  assert.deepEqual(
    getResponsiveBrowserShellRenderPolicy({ ...input, width: 1600 }),
    { kind: 'wide', renderMode: 'split' }
  )
  assert.deepEqual(
    getResponsiveBrowserShellRenderPolicy({ ...input, width: 480 }),
    { kind: 'single-surface', renderMode: 'details-only' }
  )
})

test('single-surface Results stays mounted across Details and Back', () => {
  let mounted = getRetainedSurfaceMounts(
    { results: false, details: false },
    'results'
  )
  assert.deepEqual(mounted, { results: true, details: false })

  mounted = getRetainedSurfaceMounts(mounted, 'details')
  assert.deepEqual(mounted, { results: true, details: true })

  mounted = getRetainedSurfaceMounts(mounted, 'results')
  assert.deepEqual(mounted, { results: true, details: false })
})

test('a direct Details visit does not eagerly mount hidden Results', () => {
  assert.deepEqual(
    getRetainedSurfaceMounts({ results: false, details: false }, 'details'),
    { results: false, details: true }
  )
})

test('inactive retained surfaces are hidden from layout, focus, and assistive tech', () => {
  assert.deepEqual(getRetainedSurfaceVisibility(false), {
    hidden: true,
    ariaHidden: true,
    inert: true,
  })
  assert.deepEqual(getRetainedSurfaceVisibility(true), {
    hidden: false,
    ariaHidden: undefined,
    inert: false,
  })
})

test('results gutters scale with measured available width', () => {
  assert.equal(getResponsivePagePadding(undefined), 12)
  assert.equal(getResponsivePagePadding(320), 13)
  assert.equal(getResponsivePagePadding(1100), 44)
  assert.equal(getResponsivePagePadding(4000), 100)
})

test('Focused details provides a context-aware return label', () => {
  assert.equal(getBackToResultsLabel('gene-phewas'), 'Back to gene results')
  assert.equal(getBackToResultsLabel('variant-phewas'), 'Back to variant results')
  assert.equal(getBackToResultsLabel('gene-manhattan'), 'Back to phenotype results')
  assert.equal(getBackToResultsLabel('top-associations'), 'Back to results')
  assert.equal(
    getDetailsContextLabel({ analysisId: 'pheno-1', geneId: 'ENSG1' }),
    'Details for phenotype pheno-1 · gene ENSG1'
  )
})

test('comparison is offered only when both valid surfaces fit', () => {
  assert.equal(
    canCompareSideBySide({ width: 1200, analysisId: 'p1', variantId: '1-10-A-G' }),
    true
  )
  assert.equal(
    canCompareSideBySide({ width: 900, analysisId: 'p1', variantId: '1-10-A-G' }),
    false
  )
  assert.equal(canCompareSideBySide({ width: 1200, analysisId: 'p1' }), false)
})
