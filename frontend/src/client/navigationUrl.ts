import { ActiveSurface, resolveInitialActiveSurface } from './experienceNavigation'

const ENTITY_STATE_KEYS = ['geneId', 'regionId', 'variantId', 'analysisId'] as const
const LEGACY_TOP_LEVEL_STATE_KEYS = [
  ...ENTITY_STATE_KEYS,
  'resultIndex',
  'resultLayout',
  'experienceMode',
  'activeSurface',
] as const

export type NavigationState = Record<string, unknown>

export const parseNavigationState = (url: URL): NavigationState => {
  const encodedState = url.searchParams.get('state')
  if (!encodedState) return {}

  try {
    return JSON.parse(encodedState)
  } catch (_error) {
    // Support old links whose state value was encoded more than once.
    try {
      return JSON.parse(decodeURIComponent(encodedState))
    } catch (_legacyError) {
      return {}
    }
  }
}

export const getInitialActiveSurface = (url: URL): ActiveSurface => {
  const state = parseNavigationState(url)
  return resolveInitialActiveSurface(state.activeSurface, state.resultLayout)
}

/** Build a canonical /app URL without carrying unrelated entity context. */
export const buildCanonicalNavigationUrl = (
  currentHref: string,
  stateUpdates: NavigationState,
  options: { preserveKeys?: readonly (typeof ENTITY_STATE_KEYS)[number][] } = {}
): string => {
  const url = new URL(currentHref)
  const currentState = parseNavigationState(url)
  const nextState: NavigationState = { ...currentState }
  const preservedKeys = new Set(options.preserveKeys ?? [])

  for (const key of ENTITY_STATE_KEYS) {
    if (!preservedKeys.has(key)) delete nextState[key]
  }
  Object.assign(nextState, stateUpdates)

  url.pathname = '/app'
  url.hash = ''
  url.searchParams.set('state', JSON.stringify(nextState))
  for (const key of LEGACY_TOP_LEVEL_STATE_KEYS) url.searchParams.delete(key)

  return url.toString()
}

export const buildStateUrl = (
  stateUpdates: Record<string, string | null>
): { pathname: string; search: string } => ({
  pathname: '/app',
  search: `?state=${encodeURIComponent(JSON.stringify(stateUpdates))}`,
})
