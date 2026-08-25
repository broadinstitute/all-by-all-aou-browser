export type ExperienceMode = 'focused' | 'sideBySide'
export type ActiveSurface = 'results' | 'details'
export type NavigationDestination = ActiveSurface
export type ResultLayout = 'detail' | 'split' | 'full'

export const EXPERIENCE_MODE_STORAGE_KEY = 'experienceMode'

export const parseExperienceMode = (value: string | null): ExperienceMode | null => {
  if (value == null) return null

  try {
    const parsed = JSON.parse(value)
    return parsed === 'focused' || parsed === 'sideBySide' ? parsed : null
  } catch (_error) {
    return value === 'focused' || value === 'sideBySide' ? value : null
  }
}

export interface NavigationPresentation {
  experienceMode: ExperienceMode
  activeSurface: ActiveSurface
  resultLayout: ResultLayout
}

/**
 * Resolve the visible surface and the legacy pane layout together. resultLayout
 * remains as a compatibility projection until Focused gets its own shell.
 */
export const getNavigationPresentation = (
  experienceMode: ExperienceMode,
  currentLayout: ResultLayout,
  destination: NavigationDestination,
  options: { resultsOnly?: boolean } = {}
): NavigationPresentation => {
  if (experienceMode === 'focused') {
    return {
      experienceMode,
      activeSurface: destination,
      resultLayout: destination === 'results' ? 'full' : 'detail',
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
