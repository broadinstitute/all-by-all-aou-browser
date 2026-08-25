import { atom, RecoilValue, selector } from 'recoil'
import { nullable, stringLiterals } from '@recoiljs/refine'
import { urlSyncEffect } from 'recoil-sync'

import {
  ExperienceMode,
  loadInitialExperienceMode,
  persistExperienceMode,
  resolveExperienceModeForVisit,
} from './experienceNavigation'

const experienceModeChecker = stringLiterals<ExperienceMode>({
  focused: 'focused',
  sideBySide: 'sideBySide',
})

export const experienceModePreferenceAtom = atom<ExperienceMode>({
  key: 'experienceModePreference',
  default: 'sideBySide',
  effects: [
    ({ setSelf, onSet }) => {
      if (typeof window !== 'undefined') {
        setSelf(loadInitialExperienceMode(localStorage))
      }

      onSet((newValue) => {
        if (typeof window !== 'undefined') {
          persistExperienceMode(localStorage, newValue)
        }
      })
    },
  ],
})

// URL mode is a visit-level override. Keeping it separate prevents a shared
// link or Back/Forward navigation from silently replacing the saved choice.
export const experienceModeUrlOverrideAtom = atom<
  ExperienceMode | null | undefined
>({
  key: 'experienceModeUrlOverride',
  default: null,
  effects: [
    urlSyncEffect({
      itemKey: 'experienceMode',
      refine: nullable(experienceModeChecker),
      history: 'push',
    }),
  ],
})

export const getExperienceModeFromAtoms = (
  get: <T>(state: RecoilValue<T>) => T
): ExperienceMode =>
  resolveExperienceModeForVisit(
    get(experienceModePreferenceAtom),
    get(experienceModeUrlOverrideAtom)
  )

export const experienceModeAtom = selector<ExperienceMode>({
  key: 'experienceMode',
  get: ({ get }) => getExperienceModeFromAtoms(get),
  set: ({ set, reset }, newValue) => {
    if (newValue === 'focused' || newValue === 'sideBySide') {
      // Writes only happen for deliberate UI actions. Update both the durable
      // preference and this visit's URL state.
      set(experienceModePreferenceAtom, newValue)
      set(experienceModeUrlOverrideAtom, newValue)
    } else {
      reset(experienceModePreferenceAtom)
      reset(experienceModeUrlOverrideAtom)
    }
  },
})
