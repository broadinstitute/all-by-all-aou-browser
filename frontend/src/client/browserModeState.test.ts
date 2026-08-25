import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { RecoilRoot, useRecoilTransaction_UNSTABLE } from 'recoil'

import { getExperienceModeFromAtoms } from './browserModeState'
import type { ExperienceMode } from './experienceNavigation'

test('a mounted Recoil 0.7 transaction resolves mode from atoms without reading a selector', () => {
  let observedMode: ExperienceMode | undefined
  let readMode: (() => void) | undefined

  const Harness = () => {
    readMode = useRecoilTransaction_UNSTABLE(
      ({ get }) => () => {
        observedMode = getExperienceModeFromAtoms(get)
      },
      []
    )
    return null
  }

  renderToString(
    React.createElement(RecoilRoot, null, React.createElement(Harness))
  )

  readMode?.()
  assert.equal(observedMode, 'sideBySide')
})
