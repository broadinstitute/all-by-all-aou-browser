export type ExperienceMode = 'focused' | 'sideBySide'
export type ActiveSurface = 'results' | 'details'
export type NavigationDestination = ActiveSurface
export type ResultLayout = 'detail' | 'split' | 'full'

export const EXPERIENCE_MODE_STORAGE_KEY = 'experienceMode'
export const EXISTING_PROFILE_STORAGE_KEY = 'axaou_data_version'

export const parseExperienceMode = (value: string | null): ExperienceMode | null => {
  if (value == null) return null

  try {
    const parsed = JSON.parse(value)
    return parsed === 'focused' || parsed === 'sideBySide' ? parsed : null
  } catch (_error) {
    return value === 'focused' || value === 'sideBySide' ? value : null
  }
}

type ExperienceModeStorage = Pick<Storage, 'getItem' | 'setItem'>

/**
 * Resolve and persist the one-time browser-mode migration.
 *
 * A valid explicit preference always wins. Profiles with evidence of having
 * used the pre-Focused browser retain Side by side, while genuinely fresh
 * profiles start Focused. A malformed value or unavailable storage falls back
 * to the old Side-by-side experience rather than surprising an existing user.
 */
export const loadInitialExperienceMode = (
  storage: ExperienceModeStorage
): ExperienceMode => {
  try {
    const savedValue = storage.getItem(EXPERIENCE_MODE_STORAGE_KEY)
    const savedMode = parseExperienceMode(savedValue)
    if (savedMode) return savedMode

    const mode: ExperienceMode =
      savedValue !== null || storage.getItem(EXISTING_PROFILE_STORAGE_KEY) !== null
        ? 'sideBySide'
        : 'focused'

    storage.setItem(EXPERIENCE_MODE_STORAGE_KEY, JSON.stringify(mode))
    return mode
  } catch (_error) {
    return 'sideBySide'
  }
}

export const resolveExperienceModeForVisit = (
  preference: ExperienceMode,
  urlOverride: ExperienceMode | null | undefined
): ExperienceMode => urlOverride ?? preference

export const resolveInitialActiveSurface = (
  activeSurface: unknown,
  resultLayout: unknown
): ActiveSurface => {
  if (activeSurface === 'results' || activeSurface === 'details') {
    return activeSurface
  }
  return resultLayout === 'detail' ? 'details' : 'results'
}

export const persistExperienceMode = (
  storage: ExperienceModeStorage,
  mode: ExperienceMode
): void => {
  try {
    storage.setItem(EXPERIENCE_MODE_STORAGE_KEY, JSON.stringify(mode))
  } catch (_error) {
    // The in-memory choice still works when storage is unavailable.
  }
}

export interface NavigationPresentation {
  experienceMode: ExperienceMode
  activeSurface: ActiveSurface
  resultLayout: ResultLayout
}

export const getFocusedSurfaceForLayout = (
  activeSurface: ActiveSurface,
  resultLayout: ResultLayout
): ActiveSurface => {
  if (resultLayout === 'full') return 'results'
  if (resultLayout === 'detail') return 'details'
  return activeSurface
}

export const getSideBySideLayoutForSurface = (
  activeSurface: ActiveSurface,
  resultLayout: ResultLayout
): ResultLayout => {
  if (activeSurface === 'results' && resultLayout === 'detail') return 'split'
  if (activeSurface === 'details' && resultLayout === 'full') return 'split'
  return resultLayout
}

/**
 * Resolve the visible surface and the legacy Side-by-side pane layout together.
 * Focused has its own shell, so navigation changes only its active surface and
 * leaves the user's prior Side-by-side layout ready to restore.
 */
export const getNavigationPresentation = (
  experienceMode: ExperienceMode,
  currentLayout: ResultLayout,
  destination: NavigationDestination,
  options: { resultsOnly?: boolean; singleSurface?: boolean } = {}
): NavigationPresentation => {
  if (experienceMode === 'focused' || options.singleSurface) {
    return {
      experienceMode,
      activeSurface: destination,
      resultLayout: currentLayout,
    }
  }

  if (destination === 'results') {
    return {
      experienceMode,
      activeSurface: 'results',
      resultLayout: options.resultsOnly
        ? 'full'
        : currentLayout === 'detail'
          ? 'split'
          : currentLayout,
    }
  }

  return {
    experienceMode,
    activeSurface: 'details',
    resultLayout: currentLayout === 'full' ? 'split' : currentLayout,
  }
}

export const buildDestinationState = (
  stateUpdates: Record<string, unknown>,
  presentation: NavigationPresentation
): Record<string, unknown> => ({
  ...stateUpdates,
  experienceMode: presentation.experienceMode,
  activeSurface: presentation.activeSurface,
  resultLayout: presentation.resultLayout,
})
