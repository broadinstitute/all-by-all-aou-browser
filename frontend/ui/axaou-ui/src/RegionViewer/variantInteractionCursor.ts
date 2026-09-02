export type VariantPlotFallbackCursor = 'default' | 'crosshair'

/**
 * Use a pointer only when the pointer is over a variant that has a click action.
 * Plot backgrounds retain the interaction cursor chosen by the plot.
 */
export const getVariantInteractionCursor = (
  hasVariantHit: boolean,
  hasClickHandler: boolean,
  fallbackCursor: VariantPlotFallbackCursor = 'default'
): 'pointer' | VariantPlotFallbackCursor =>
  hasVariantHit && hasClickHandler ? 'pointer' : fallbackCursor
