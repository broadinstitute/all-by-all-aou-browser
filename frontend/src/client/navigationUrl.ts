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

// recoil-sync 0.2 first writes changed replace-history items into the prior
// entry, then pushes changed push-history items. Semantic pushes are therefore
// owned by commitSemanticNavigation(); atom writes replace so local derivations
// (for example locus zoom) cannot create partial destinations on their own.
export const SEMANTIC_STATE_URL_HISTORY = 'replace' as const

export interface SemanticNavigationBrowser {
  getCurrentHref: () => string
  pushUrl: (url: string) => void
}

export interface SemanticLinkActivation {
  button: number
  defaultPrevented: boolean
  metaKey: boolean
  altKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
}

/** Leave modified and non-primary clicks to the link so deep links still work. */
export const shouldHandleSemanticLinkClick = (
  event: SemanticLinkActivation
): boolean =>
  !event.defaultPrevented &&
  event.button === 0 &&
  !event.metaKey &&
  !event.altKey &&
  !event.ctrlKey &&
  !event.shiftKey

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

/**
 * Push one complete browser destination through React Router's history.
 * Router and recoil-sync observe that single history notification, so the
 * prior URL is never partially rewritten and no intermediate /app entry is
 * needed when navigation begins on Home, About, or another route.
 */
export const commitSemanticNavigation = (
  browser: SemanticNavigationBrowser,
  stateUpdates: NavigationState
): string => {
  const currentHref = browser.getCurrentHref()
  const completeState = {
    ...parseNavigationState(new URL(currentHref)),
    ...stateUpdates,
  }
  const destinationUrl = buildCanonicalNavigationUrl(currentHref, completeState)

  browser.pushUrl(destinationUrl)
  return destinationUrl
}

export const buildStateUrl = (
  stateUpdates: Record<string, string | null>
): { pathname: string; search: string } => ({
  pathname: '/app',
  search: `?state=${encodeURIComponent(JSON.stringify(stateUpdates))}`,
})
