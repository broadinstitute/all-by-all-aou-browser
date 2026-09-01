import { BrowserInterface } from 'recoil-sync'

export interface RouterLocationDescriptor {
  pathname: string
  search: string
  hash: string
}

export interface AppRouterHistory {
  push: (location: RouterLocationDescriptor) => void
  replace: (location: RouterLocationDescriptor) => void
  listen: (listener: () => void) => () => void
}

/** Convert an absolute canonical URL into the location shape expected by history@4. */
export const routerLocationFromUrl = (url: string): RouterLocationDescriptor => {
  const parsed = new URL(url)
  return {
    pathname: parsed.pathname,
    search: parsed.search,
    hash: parsed.hash,
  }
}

/**
 * Keep recoil-sync on React Router's history instance. URL atom effects are a
 * replace-only projection of the current visit; semantic commands own PUSH.
 */
export const createRecoilRouterBrowserInterface = (
  history: AppRouterHistory,
  getCurrentHref: () => string = () => window.location.href
): BrowserInterface => ({
  getURL: getCurrentHref,
  replaceURL: (url) => history.replace(routerLocationFromUrl(url)),
  // Deliberately replace even if a future atom is accidentally marked push.
  pushURL: (url) => history.replace(routerLocationFromUrl(url)),
  listenChangeURL: (handler) => history.listen(handler),
})
