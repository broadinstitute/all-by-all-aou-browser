export const GENE_DETAIL_INLINE_GUTTER_PX = 16

export const geneDetailGridContract = {
  intrinsicRowSizing: 'max-content',
  regionRowWithoutVariantDetails: 'region-viewer region-viewer region-viewer',
  inlineGutterPx: GENE_DETAIL_INLINE_GUTTER_PX,
} as const

const MIN_REGION_VIEWER_WIDTH = 90

/**
 * Normalize the width measured from the region-viewer grid slot. Returning zero
 * until the slot can accommodate both side panels keeps RegionViewer from
 * constructing a negative-width genomic scale during initial layout.
 */
export const normalizeRegionViewerWidth = (measuredWidth?: number | null): number => {
  if (!Number.isFinite(measuredWidth) || (measuredWidth as number) <= MIN_REGION_VIEWER_WIDTH) {
    return 0
  }

  return Math.floor(measuredWidth as number)
}
