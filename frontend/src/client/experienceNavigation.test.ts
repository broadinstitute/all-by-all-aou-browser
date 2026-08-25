import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildDestinationState,
  getFocusedSurfaceForLayout,
  getNavigationPresentation,
  getSideBySideLayoutForSurface,
  loadInitialExperienceMode,
  parseExperienceMode,
  persistExperienceMode,
  resolveExperienceModeForVisit,
  resolveInitialActiveSurface,
} from './experienceNavigation'

test('experience preference accepts only persisted focused and side-by-side modes', () => {
  assert.equal(parseExperienceMode(JSON.stringify('focused')), 'focused')
  assert.equal(parseExperienceMode(JSON.stringify('sideBySide')), 'sideBySide')
  assert.equal(parseExperienceMode('focused'), 'focused')
  assert.equal(parseExperienceMode(JSON.stringify('invalid')), null)
  assert.equal(parseExperienceMode(null), null)
})

test('one-time mode migration distinguishes explicit, existing, fresh, and corrupt profiles', () => {
  const makeStorage = (entries: Record<string, string> = {}) => {
    const values = new Map(Object.entries(entries))
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      value: (key: string) => values.get(key) ?? null,
    }
  }

  const explicit = makeStorage({
    experienceMode: JSON.stringify('focused'),
    axaou_data_version: 'old-profile',
  })
  assert.equal(loadInitialExperienceMode(explicit), 'focused')

  const existing = makeStorage({ axaou_data_version: 'old-profile' })
  assert.equal(loadInitialExperienceMode(existing), 'sideBySide')
  assert.equal(existing.value('experienceMode'), JSON.stringify('sideBySide'))

  const fresh = makeStorage()
  assert.equal(loadInitialExperienceMode(fresh), 'focused')
  assert.equal(fresh.value('experienceMode'), JSON.stringify('focused'))

  const corrupt = makeStorage({ experienceMode: '{not valid json' })
  assert.equal(loadInitialExperienceMode(corrupt), 'sideBySide')
  assert.equal(corrupt.value('experienceMode'), JSON.stringify('sideBySide'))
})

test('a URL visit override is transient and leaves the saved preference unchanged', () => {
  const savedPreference = 'sideBySide' as const
  assert.equal(resolveExperienceModeForVisit(savedPreference, 'focused'), 'focused')
  assert.equal(savedPreference, 'sideBySide')
  assert.equal(resolveExperienceModeForVisit(savedPreference, null), 'sideBySide')
})

test('storage failures fall back safely and deliberate choices remain writable', () => {
  const deniedStorage = {
    getItem: (_key: string): string | null => {
      throw new Error('storage denied')
    },
    setItem: (_key: string, _value: string) => {
      throw new Error('storage denied')
    },
    removeItem: (_key: string) => {
      throw new Error('storage denied')
    },
  }
  assert.equal(loadInitialExperienceMode(deniedStorage), 'sideBySide')
  assert.doesNotThrow(() => persistExperienceMode(deniedStorage, 'focused'))
})

test('focused navigation selects one surface without losing the prior Side-by-side layout', () => {
  assert.deepEqual(getNavigationPresentation('focused', 'split', 'results'), {
    experienceMode: 'focused',
    activeSurface: 'results',
    resultLayout: 'split',
  })
  assert.deepEqual(getNavigationPresentation('focused', 'full', 'details'), {
    experienceMode: 'focused',
    activeSurface: 'details',
    resultLayout: 'full',
  })
})

test('narrow navigation changes only the active surface and remembers the wide layout', () => {
  assert.deepEqual(
    getNavigationPresentation('sideBySide', 'full', 'details', {
      singleSurface: true,
    }),
    {
      experienceMode: 'sideBySide',
      activeSurface: 'details',
      resultLayout: 'full',
    }
  )
  assert.deepEqual(
    getNavigationPresentation('sideBySide', 'detail', 'results', {
      resultsOnly: true,
      singleSurface: true,
    }),
    {
      experienceMode: 'sideBySide',
      activeSurface: 'results',
      resultLayout: 'detail',
    }
  )
})

test('legacy layouts initialize a surface while an explicit surface wins', () => {
  assert.equal(resolveInitialActiveSurface(undefined, 'detail'), 'details')
  assert.equal(resolveInitialActiveSurface(undefined, 'full'), 'results')
  assert.equal(resolveInitialActiveSurface(undefined, 'split'), 'results')
  assert.equal(resolveInitialActiveSurface('results', 'detail'), 'results')
  assert.equal(resolveInitialActiveSurface('details', 'full'), 'details')
})

test('switching to Focused starts on the surface visible in a single-pane Side-by-side layout', () => {
  assert.equal(getFocusedSurfaceForLayout('details', 'full'), 'results')
  assert.equal(getFocusedSurfaceForLayout('results', 'detail'), 'details')
  assert.equal(getFocusedSurfaceForLayout('details', 'split'), 'details')
})

test('returning to Side by side preserves layout unless it would hide the active surface', () => {
  assert.equal(getSideBySideLayoutForSurface('details', 'detail'), 'detail')
  assert.equal(getSideBySideLayoutForSurface('results', 'full'), 'full')
  assert.equal(getSideBySideLayoutForSurface('results', 'detail'), 'split')
  assert.equal(getSideBySideLayoutForSurface('details', 'full'), 'split')
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

test('destination state overrides stale active-surface state for canonical URLs', () => {
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
      resultLayout: 'split',
      activeSurface: 'details',
      experienceMode: 'focused',
    }
  )
})
