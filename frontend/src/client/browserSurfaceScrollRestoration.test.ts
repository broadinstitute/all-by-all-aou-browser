import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import {
  getRememberedBrowserSurfaceScroll,
  rememberBrowserSurfaceScroll,
} from './browserSurfaceScrollRestoration'

const splitScreenSource = readFileSync(join(__dirname, 'SplitScreenViewer.tsx'), 'utf8')

test('custom browser-surface scrolling is remembered by history entry', () => {
  rememberBrowserSurfaceScroll('visit-results-1', { top: 1840, left: 24 })

  assert.deepEqual(getRememberedBrowserSurfaceScroll('visit-results-1'), {
    top: 1840,
    left: 24,
  })
  assert.equal(getRememberedBrowserSurfaceScroll('different-visit'), undefined)
})

test('focused and side-by-side result scroll owners use restoration', () => {
  assert.match(splitScreenSource, /<FocusedVariantDocument\s+ref=\{resultsScrollRef\}/)
  assert.match(
    splitScreenSource,
    /ref=\{resultsScrollRef\}\s+data-browser-experience=\{experienceMode === 'focused'/
  )
  assert.match(
    splitScreenSource,
    /ref=\{resultsScrollRef\}\s+data-browser-experience="side-by-side"\s+data-pane-render-mode="results-only"/
  )
  assert.match(
    splitScreenSource,
    /<div ref=\{resultsScrollRef\} className="resizable-inner-container">/
  )
})
