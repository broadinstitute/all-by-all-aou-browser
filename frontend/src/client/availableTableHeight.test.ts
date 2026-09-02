import assert from 'node:assert/strict'
import test from 'node:test'

import {
  AVAILABLE_TABLE_BOTTOM_PADDING,
  AVAILABLE_TABLE_BOTTOM_RESERVE_ROWS,
  getAvailableTablePolicy,
} from './availableTableHeight'

const desktop = (overrides: Partial<Parameters<typeof getAvailableTablePolicy>[0]> = {}) =>
  getAvailableTablePolicy({
    viewportHeight: 1000,
    tableTop: 300,
    footerTop: 950,
    rowHeight: 25,
    headerHeight: 25,
    rowCount: 100,
    ...overrides,
  })

test('subtracts the footer boundary and a named three-row reserve', () => {
  const policy = desktop()
  assert.equal(policy.boundary, 950)
  assert.equal(policy.reserveHeight, AVAILABLE_TABLE_BOTTOM_RESERVE_ROWS * 25)
  assert.equal(policy.availableHeight, 950 - 300 - 75 - AVAILABLE_TABLE_BOTTOM_PADDING)
})

test('dense content fills the available capacity without entering the reserve', () => {
  const policy = desktop()
  assert.equal(policy.capacity, Math.floor((policy.availableHeight - 25) / 25))
  assert.equal(policy.renderedRows, policy.capacity)
  assert.ok(policy.viewportHeight <= policy.availableHeight)
  assert.ok(policy.availableHeight - policy.viewportHeight < 25)
})

test('sparse content stays compact instead of drawing empty rows', () => {
  const policy = desktop({ rowCount: 3 })
  assert.equal(policy.renderedRows, 3)
  assert.equal(policy.viewportHeight, 100)
})

test('an offscreen table preallocates its eventual page viewport instead of locking to its minimum', () => {
  const policy = desktop({ tableTop: 1200 })
  assert.equal(policy.availableHeight, 950 - 75 - AVAILABLE_TABLE_BOTTOM_PADDING)
  assert.ok(policy.capacity > 20)
})

test('dense desktop tables clamp to a reasonable minimum', () => {
  const policy = desktop({ tableTop: 900, footerTop: 950, rowCount: 100, minRows: 8 })
  assert.equal(policy.capacity, 8)
  assert.equal(policy.renderedRows, 8)
})

test('viewport and table-top changes recompute capacity', () => {
  const initial = desktop()
  const taller = desktop({ viewportHeight: 1200, footerTop: 1150 })
  const movedDown = desktop({ tableTop: 500 })
  assert.ok(taller.capacity > initial.capacity)
  assert.ok(movedDown.capacity < initial.capacity)
})

test('mobile tables are capped and sparse mobile tables remain compact', () => {
  const dense = desktop({ viewportHeight: 650, footerTop: 640, tableTop: 80, rowCount: 100 })
  const sparse = desktop({ viewportHeight: 650, footerTop: 640, tableTop: 80, rowCount: 2 })
  assert.equal(dense.isMobile, true)
  assert.equal(dense.capacity, 10)
  assert.equal(sparse.renderedRows, 2)
})
