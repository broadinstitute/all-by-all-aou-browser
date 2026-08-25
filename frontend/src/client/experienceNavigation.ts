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
  options: { resultsOnly?: boolean } = {}
): NavigationPresentation => {
  if (experienceMode === 'focused') {
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
