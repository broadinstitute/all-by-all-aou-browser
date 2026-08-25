import assert from 'node:assert/strict'
import test from 'node:test'

import { getNextMenuItemIndex } from './contextMenuKeyboard'

test('context menu arrow keys wrap and start at the nearest edge', () => {
  assert.equal(getNextMenuItemIndex('ArrowDown', -1, 4), 0)
  assert.equal(getNextMenuItemIndex('ArrowDown', 3, 4), 0)
  assert.equal(getNextMenuItemIndex('ArrowUp', -1, 4), 3)
  assert.equal(getNextMenuItemIndex('ArrowUp', 0, 4), 3)
})

test('context menu Home and End move to boundary items', () => {
  assert.equal(getNextMenuItemIndex('Home', 2, 4), 0)
  assert.equal(getNextMenuItemIndex('End', 1, 4), 3)
  assert.equal(getNextMenuItemIndex('End', 0, 0), -1)
})
