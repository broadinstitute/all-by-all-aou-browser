import assert from 'node:assert/strict'
import test from 'node:test'

import {
  browsingModeControlContract,
  getDetailOptionsLabel,
  mobileControlContract,
  optionPanelContract,
} from './browserUiContracts'

test('browser mode control is concise and keeps an accessible group name', () => {
  assert.equal(browsingModeControlContract.groupLabel, 'Browsing mode')
  assert.deepEqual(browsingModeControlContract.options, [
    { value: 'focused', label: 'Focused' },
    { value: 'sideBySide', label: 'Side by side' },
  ])
  assert.equal('description' in browsingModeControlContract.options[0], false)
})

test('mobile controls remain touch-sized entry points at their layout breakpoints', () => {
  assert.deepEqual(mobileControlContract.globalSearch, {
    breakpoint: 750,
    triggerLabel: 'Open global search',
    controlsId: 'search-results',
  })
  assert.equal(mobileControlContract.phewasOptions.breakpoint, 700)
})

test('option panels and restore controls share unambiguous names', () => {
  assert.equal(optionPanelContract.phewas.label, 'PheWAS options')
  assert.equal(optionPanelContract.phewas.id, 'phewas-options-panel')
  assert.equal(getDetailOptionsLabel({ variantId: '1-10-A-G' }), 'Variant options')
  assert.equal(getDetailOptionsLabel({ regionId: '1-1-20' }), 'Locus options')
  assert.equal(getDetailOptionsLabel({}), 'Gene options')
})
