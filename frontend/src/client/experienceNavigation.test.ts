import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildDestinationState,
  getNavigationPresentation,
  parseExperienceMode,
} from './experienceNavigation'

test('experience preference accepts only persisted focused and side-by-side modes', () => {
  assert.equal(parseExperienceMode(JSON.stringify('focused')), 'focused')
  assert.equal(parseExperienceMode(JSON.stringify('sideBySide')), 'sideBySide')
  assert.equal(parseExperienceMode('focused'), 'focused')
  assert.equal(parseExperienceMode(JSON.stringify('invalid')), null)
  assert.equal(parseExperienceMode(null), null)
})

test('focused navigation projects each destination to one visible surface', () => {
  assert.deepEqual(getNavigationPresentation('focused', 'split', 'results'), {
    experienceMode: 'focused',
    activeSurface: 'results',
    resultLayout: 'full',
  })
  assert.deepEqual(getNavigationPresentation('focused', 'full', 'details'), {
    experienceMode: 'focused',
    activeSurface: 'details',
    resultLayout: 'detail',
  })
})

test('side-by-side navigation reveals a destination without hiding valid context', () => {
  assert.equal(
    getNavigationPresentation('sideBySide', 'full', 'details').resultLayout,
    'split'
  )
  assert.equal(
    getNavigationPresentation('sideBySide', 'detail', 'results').resultLayout,
    'split'
  )
  assert.equal(
    getNavigationPresentation('sideBySide', 'split', 'results', {
      resultsOnly: true,
    }).resultLayout,
    'full'
  )
})

test('gene, variant, phenotype, and region destinations retain their entity state', () => {
  const cases = [
    { updates: { geneId: 'ENSG1' }, destination: 'details' as const },
    { updates: { variantId: '1-10-A-G' }, destination: 'details' as const },
    { updates: { analysisId: 'pheno-1' }, destination: 'results' as const },
    { updates: { regionId: '1-1-20' }, destination: 'details' as const },
  ]

  for (const { updates, destination } of cases) {
    const state = buildDestinationState(
      updates,
      getNavigationPresentation('focused', 'split', destination)
    )
    assert.deepEqual(
      Object.fromEntries(Object.entries(state).filter(([key]) => key in updates)),
      updates
    )
    assert.equal(state.activeSurface, destination)
  }
})

test('destination state overrides stale pane state for canonical URLs', () => {
  const presentation = getNavigationPresentation(
    'focused',
    'split',
    'details'
  )
  assert.deepEqual(
    buildDestinationState(
      { geneId: 'ENSG1', resultLayout: 'full', activeSurface: 'results' },
      presentation
    ),
    {
      geneId: 'ENSG1',
      resultLayout: 'detail',
      activeSurface: 'details',
      experienceMode: 'focused',
    }
  )
})
