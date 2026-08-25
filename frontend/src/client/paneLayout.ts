export type PaneRenderMode = 'results-only' | 'details-only' | 'split'

type ResultLayout = 'detail' | 'split' | 'full'

export const getPaneRenderMode = (layout: ResultLayout): PaneRenderMode => {
  if (layout === 'detail') return 'details-only'
  if (layout === 'full') return 'results-only'
  return 'split'
}

export const revealDetailsPane = (layout: ResultLayout): ResultLayout =>
  layout === 'full' ? 'split' : layout

export const revealResultsPane = (layout: ResultLayout): ResultLayout =>
  layout === 'detail' ? 'split' : layout

/**
 * Keep a remembered divider position usable after its container is resized.
 * On narrow containers both panes yield equally instead of producing invalid
 * min/max bounds.
 */
export const clampSplitPaneWidth = (
  containerWidth: number,
  requestedWidth: number | null,
  minResultsWidth = 240,
  minDetailsWidth = 320
): number => {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) return 0

  const effectiveResultsMin = Math.min(minResultsWidth, containerWidth / 2)
  const effectiveDetailsMin = Math.min(
    minDetailsWidth,
    containerWidth - effectiveResultsMin
  )
  const maximumResultsWidth = containerWidth - effectiveDetailsMin
  const desiredWidth =
    requestedWidth != null && Number.isFinite(requestedWidth)
      ? requestedWidth
      : containerWidth / 2

  return Math.min(
    maximumResultsWidth,
    Math.max(effectiveResultsMin, desiredWidth)
  )
}
