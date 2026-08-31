import assert from 'node:assert/strict'
import test from 'node:test'

import {
  burdenDirectionSign,
  directionFromFiniteNumber,
  formatBurdenDirection,
  geneBetaForAncestry,
  geneBurdenDirection,
  geneMacColumnMode,
  shouldShowMacCaseControlColumns,
} from './geneAssociationSemantics'

test('selected phenotype MAC columns recognize current and legacy trait names', () => {
  assert.equal(geneMacColumnMode('binary'), 'case-control')
  assert.equal(geneMacColumnMode(' CATEGORICAL '), 'case-control')
  assert.equal(geneMacColumnMode('continuous'), 'total')
  assert.equal(shouldShowMacCaseControlColumns('Binary'), true)
})

test('selected phenotype MAC columns fail closed for unknown metadata', () => {
  assert.equal(geneMacColumnMode('unknown'), 'none')
  assert.equal(geneMacColumnMode(''), 'none')
  assert.equal(geneMacColumnMode(undefined), 'none')
  assert.equal(shouldShowMacCaseControlColumns(null), false)
})

test('META direction uses only the explicit enum and never a legacy beta magnitude', () => {
  assert.equal(geneBetaForAncestry('meta', 87.25), null)
  assert.equal(geneBurdenDirection('meta', 'negative', 87.25), 'negative')
  assert.equal(geneBurdenDirection('META', 'zero', 87.25), 'zero')
  assert.equal(geneBurdenDirection('meta', null, -87.25), null)
  assert.equal(geneBurdenDirection('meta', 'invalid' as never, -87.25), null)
})

test('ancestry-specific direction comes from a finite genuine beta', () => {
  assert.equal(geneBetaForAncestry('afr', 0.25), 0.25)
  assert.equal(geneBurdenDirection('afr', null, 0.25), 'positive')
  assert.equal(geneBurdenDirection('afr', null, -0.25), 'negative')
  assert.equal(geneBurdenDirection('afr', null, 0), 'zero')
  assert.equal(geneBurdenDirection('afr', null, Number.NaN), null)
  assert.equal(geneBurdenDirection('afr', null, Number.POSITIVE_INFINITY), null)
})

test('generic finite effects preserve directional shapes outside gene META', () => {
  assert.equal(directionFromFiniteNumber(0.25), 'positive')
  assert.equal(directionFromFiniteNumber(-0.25), 'negative')
  assert.equal(directionFromFiniteNumber(-0), 'zero')
  assert.equal(directionFromFiniteNumber(Number.NaN), null)
  assert.equal(directionFromFiniteNumber(Number.NEGATIVE_INFINITY), null)
})

test('direction labels are explicit and magnitude-free', () => {
  assert.equal(burdenDirectionSign('positive'), '+')
  assert.equal(burdenDirectionSign('negative'), '−')
  assert.equal(burdenDirectionSign('zero'), '0')
  assert.equal(formatBurdenDirection('positive'), 'Positive (+)')
  assert.equal(formatBurdenDirection('negative'), 'Negative (−)')
  assert.equal(formatBurdenDirection('zero'), 'Zero (0)')
  assert.equal(formatBurdenDirection(null), '—')
})
