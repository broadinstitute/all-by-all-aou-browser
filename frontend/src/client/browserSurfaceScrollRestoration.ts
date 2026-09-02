import { RefCallback, useCallback, useLayoutEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

type ScrollPosition = { top: number; left: number }

const positionsByHistoryEntry = new Map<string, ScrollPosition>()

export const rememberBrowserSurfaceScroll = (
  historyEntryKey: string,
  position: ScrollPosition
) => {
  positionsByHistoryEntry.set(historyEntryKey, position)
}

export const getRememberedBrowserSurfaceScroll = (
  historyEntryKey: string
): ScrollPosition | undefined => positionsByHistoryEntry.get(historyEntryKey)

const locationScrollKey = (location: {
  key?: string
  pathname: string
  search: string
  hash: string
}) => location.key || `${location.pathname}${location.search}${location.hash}`

/**
 * React Router restores window scrolling, but the browser workspace scrolls
 * inside its own elements. Remember those positions by history entry so a
 * semantic Back or native browser Back returns to the same reading position.
 */
export const useBrowserSurfaceScrollRestoration = <T extends HTMLElement>(): RefCallback<T> => {
  const ref = useRef<T | null>(null)
  const setRef = useCallback((element: T | null) => {
    ref.current = element
  }, [])
  const location = useLocation()
  const historyEntryKey = locationScrollKey(location)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return undefined

    const remembered = getRememberedBrowserSurfaceScroll(historyEntryKey)
    let frame = 0
    let observer: MutationObserver | undefined

    if (remembered) {
      const restore = () => {
        element.scrollTop = remembered.top
        element.scrollLeft = remembered.left

        // Results can populate asynchronously. Keep trying until their content
        // is tall/wide enough to accept the complete saved position.
        const topRestored = Math.abs(element.scrollTop - remembered.top) < 1
        const leftRestored = Math.abs(element.scrollLeft - remembered.left) < 1
        if (topRestored && leftRestored) observer?.disconnect()
      }

      restore()
      frame = requestAnimationFrame(restore)
      observer = new MutationObserver(restore)
      observer.observe(element, { childList: true, subtree: true })
    }

    const remember = () => {
      rememberBrowserSurfaceScroll(historyEntryKey, {
        top: element.scrollTop,
        left: element.scrollLeft,
      })
    }

    element.addEventListener('scroll', remember, { passive: true })
    return () => {
      remember()
      element.removeEventListener('scroll', remember)
      cancelAnimationFrame(frame)
      observer?.disconnect()
    }
  }, [historyEntryKey])

  return setRef
}
