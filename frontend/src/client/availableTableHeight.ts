import { RefObject, useLayoutEffect, useRef, useState } from 'react'

/** Keep this many ordinary rows visible between a page-level table and the footer. */
export const AVAILABLE_TABLE_BOTTOM_RESERVE_ROWS = 3
/** Shared fallback for page tables that do not publish their measured row height. */
export const AVAILABLE_TABLE_DEFAULT_ROW_HEIGHT = 25
export const AVAILABLE_TABLE_MOBILE_BREAKPOINT = 700
export const AVAILABLE_TABLE_MOBILE_MAX_ROWS = 10
export const AVAILABLE_TABLE_MIN_ROWS = 8
export const AVAILABLE_TABLE_MIN_VIEWPORT_HEIGHT = 120
export const AVAILABLE_TABLE_BOTTOM_PADDING = 8

export type AvailableTableGeometry = {
  viewportHeight: number
  tableTop: number
  pageTop?: number
  footerTop?: number
  rowHeight?: number
  headerHeight?: number
  rowCount: number
  minRows?: number
  mobileBreakpoint?: number
  mobileMaxRows?: number
  bottomPadding?: number
}

export type AvailableTablePolicy = {
  boundary: number
  reserveHeight: number
  availableHeight: number
  capacity: number
  renderedRows: number
  viewportHeight: number
  isMobile: boolean
}

/**
 * Pure geometry policy shared by page-level tables. Sparse tables remain content-sized;
 * dense tables consume the live space above the footer while retaining a three-row gap.
 */
export const getAvailableTablePolicy = ({
  viewportHeight,
  tableTop,
  pageTop = 0,
  footerTop,
  rowHeight = AVAILABLE_TABLE_DEFAULT_ROW_HEIGHT,
  headerHeight = rowHeight,
  rowCount,
  minRows = AVAILABLE_TABLE_MIN_ROWS,
  mobileBreakpoint = AVAILABLE_TABLE_MOBILE_BREAKPOINT,
  mobileMaxRows = AVAILABLE_TABLE_MOBILE_MAX_ROWS,
  bottomPadding = AVAILABLE_TABLE_BOTTOM_PADDING,
}: AvailableTableGeometry): AvailableTablePolicy => {
  const safeViewportHeight = Math.max(0, viewportHeight)
  const boundary = footerTop != null && footerTop >= 0 && footerTop <= safeViewportHeight
    ? footerTop
    : safeViewportHeight
  const reserveHeight = AVAILABLE_TABLE_BOTTOM_RESERVE_ROWS * rowHeight
  const isMobile = viewportHeight <= mobileBreakpoint
  // Pre-size an offscreen table for the space it will own when its page scrollport
  // reaches it. Otherwise a small initial max-height becomes a self-fulfilling cap.
  const effectiveTableTop = tableTop >= boundary
    ? Math.max(0, pageTop)
    : Math.max(pageTop, tableTop)
  const desktopAvailableHeight = Math.max(
    0,
    boundary - effectiveTableTop - reserveHeight - bottomPadding
  )
  const availableHeight = isMobile
    ? Math.min(desktopAvailableHeight, headerHeight + mobileMaxRows * rowHeight)
    : desktopAvailableHeight
  const rawCapacity = Math.floor((availableHeight - headerHeight) / rowHeight)
  const responsiveCapacity = isMobile
    ? Math.min(mobileMaxRows, Math.max(1, rawCapacity))
    : Math.max(minRows, rawCapacity)
  const capacity = Math.max(1, responsiveCapacity)
  const renderedRows = Math.min(Math.max(0, rowCount), capacity)

  return {
    boundary,
    reserveHeight,
    availableHeight,
    capacity,
    renderedRows,
    viewportHeight: headerHeight + renderedRows * rowHeight,
    isMobile,
  }
}

type UseAvailableTableHeightOptions = {
  rowCount: number
  rowHeight?: number
  headerHeight?: number
  minRows?: number
  enabled?: boolean
}

const samePolicy = (a: AvailableTablePolicy, b: AvailableTablePolicy) =>
  a.boundary === b.boundary &&
  a.reserveHeight === b.reserveHeight &&
  a.availableHeight === b.availableHeight &&
  a.capacity === b.capacity &&
  a.renderedRows === b.renderedRows &&
  a.viewportHeight === b.viewportHeight &&
  a.isMobile === b.isMobile

/**
 * Measures the table's real viewport position. ResizeObserver catches controls, plot,
 * header, and responsive reflow; capture-phase scroll and viewport resize catch movement.
 */
export const useAvailableTableHeight = <T extends HTMLElement>({
  rowCount,
  rowHeight = AVAILABLE_TABLE_DEFAULT_ROW_HEIGHT,
  headerHeight = rowHeight,
  minRows = AVAILABLE_TABLE_MIN_ROWS,
  enabled = true,
}: UseAvailableTableHeightOptions): {
  ref: RefObject<T>
  policy: AvailableTablePolicy
} => {
  const ref = useRef<T>(null)
  const initialPolicy = getAvailableTablePolicy({
    viewportHeight: typeof window === 'undefined' ? 900 : window.innerHeight,
    tableTop: 0,
    rowHeight,
    headerHeight,
    rowCount,
    minRows,
  })
  const [policy, setPolicy] = useState(initialPolicy)

  useLayoutEffect(() => {
    if (!enabled || !ref.current) return undefined
    const element = ref.current
    const measure = () => {
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight
      const footer = document.querySelector('footer')
      const footerRect = footer?.getBoundingClientRect()
      const footerTop = footerRect
        ? Math.min(footerRect.top, viewportHeight - footerRect.height)
        : undefined
      const pageTop = document.querySelector('main')?.getBoundingClientRect().top ?? 0
      const next = getAvailableTablePolicy({
        viewportHeight,
        tableTop: element.getBoundingClientRect().top,
        pageTop,
        footerTop,
        rowHeight,
        headerHeight,
        rowCount,
        minRows,
      })
      setPolicy((current) => samePolicy(current, next) ? current : next)
    }

    const resizeObserver = new ResizeObserver(measure)
    let observed: HTMLElement | null = element
    while (observed) {
      resizeObserver.observe(observed)
      observed = observed.parentElement
    }
    const footer = document.querySelector('footer')
    if (footer) resizeObserver.observe(footer)

    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure)
    window.visualViewport?.addEventListener('resize', measure)
    window.visualViewport?.addEventListener('scroll', measure)
    measure()

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure)
      window.visualViewport?.removeEventListener('resize', measure)
      window.visualViewport?.removeEventListener('scroll', measure)
    }
  }, [enabled, headerHeight, minRows, rowCount, rowHeight])

  return { ref, policy }
}
