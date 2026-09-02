import assert from 'node:assert/strict'
import test from 'node:test'

import { getVariantInteractionCursor } from '../../ui/axaou-ui/src/RegionViewer/variantInteractionCursor'

test('clickable variant hit uses pointer cursor', () => {
  assert.equal(getVariantInteractionCursor(true, true), 'pointer')
})

test('plot background retains its configured cursor when no variant is hit', () => {
  assert.equal(getVariantInteractionCursor(false, true), 'default')
  assert.equal(getVariantInteractionCursor(false, true, 'crosshair'), 'crosshair')
})

test('variant hit does not imply clickability when the click handler is absent', () => {
  assert.equal(getVariantInteractionCursor(true, false), 'default')
  assert.equal(getVariantInteractionCursor(true, false, 'crosshair'), 'crosshair')
})
