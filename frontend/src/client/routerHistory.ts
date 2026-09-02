import { BrowserInterface } from 'recoil-sync'

export interface RouterLocationDescriptor {
  pathname: string
  search: string
  hash: string
  state?: unknown
}

export interface AppRouterHistory {
  push: (location: RouterLocationDescriptor) => void
  replace: (location: RouterLocationDescriptor) => void
  listen: (listener: () => void) => () => void
  location?: { state?: unknown }
}

/** Convert an absolute canonical URL into the location shape expected by history@4. */
export const routerLocationFromUrl = (
  url: string,
  state?: unknown
): RouterLocationDescriptor => {
  const parsed = new URL(url)
  return {
    pathname: parsed.pathname,
    search: parsed.search,
    hash: parsed.hash,
    ...(state === undefined ? {} : { state }),
  }
}

/**
 * Keep recoil-sync on React Router's history instance. URL atom effects are a
 * replace-only projection of the current visit; semantic commands own PUSH.
 */
export const createRecoilRouterBrowserInterface = (
  history: AppRouterHistory,
  getCurrentHref: () => string = () => window.location.href
): BrowserInterface => {
  const replaceProjection = (url: string) =>
    history.replace(routerLocationFromUrl(url, history.location?.state))

  return {
    getURL: getCurrentHref,
    // Preserve semantic origin metadata while atom projections replace URL state.
    replaceURL: replaceProjection,
    // Deliberately replace even if a future atom is accidentally marked push.
    pushURL: replaceProjection,
    listenChangeURL: (handler) => history.listen(handler),
  }
}
