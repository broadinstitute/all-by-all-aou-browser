import { ActiveSurface, ExperienceMode } from './experienceNavigation'
import { PaneRenderMode, getPaneRenderMode } from './paneLayout'

type ResultLayout = 'detail' | 'split' | 'full'
type ResultIndex =
  | 'top-associations'
  | 'analyses'
  | 'gene-manhattan'
  | 'variant-manhattan'
  | 'gene-phewas'
  | 'variant-phewas'
  | 'locus-phewas'
  | 'pheno-info'

export const TWO_PANE_MIN_WIDTH = 1100

export const canFitTwoPanes = (width?: number | null): boolean =>
  Number.isFinite(width) && (width as number) >= TWO_PANE_MIN_WIDTH

export const shouldShowLayoutControls = (
  experienceMode: ExperienceMode,
  width?: number | null
): boolean => experienceMode === 'sideBySide' && canFitTwoPanes(width)

export const getBrowserShellRenderMode = (
  experienceMode: ExperienceMode,
  activeSurface: ActiveSurface,
  resultLayout: ResultLayout
): PaneRenderMode =>
  experienceMode === 'focused'
    ? activeSurface === 'results'
      ? 'results-only'
      : 'details-only'
    : getPaneRenderMode(resultLayout)

/**
 * Narrow containers temporarily use the active surface without changing the
 * saved experience preference or Side-by-side layout.
 */
export const getResponsiveBrowserShellRenderMode = (
  experienceMode: ExperienceMode,
  activeSurface: ActiveSurface,
  resultLayout: ResultLayout,
  width?: number | null
): PaneRenderMode =>
  experienceMode === 'focused' || !canFitTwoPanes(width)
    ? activeSurface === 'results'
      ? 'results-only'
      : 'details-only'
    : getPaneRenderMode(resultLayout)

export const getResponsivePagePadding = (width?: number | null): number => {
  if (!Number.isFinite(width)) return 12
  return Math.round(Math.min(100, Math.max(12, (width as number) * 0.04)))
}

export type BrowserSurface = 'results' | 'details'
export type BrowserShellRenderPolicy =
  | { kind: 'stacked-variant'; renderMode: 'stacked-variant' }
  | { kind: 'single-surface'; renderMode: 'results-only' | 'details-only' }
  | { kind: 'wide'; renderMode: PaneRenderMode }

/**
 * Focused variants are one composed task document at every width. Other
 * Focused destinations and narrow Side-by-side views retain the existing
 * one-surface-at-a-time behavior.
 */
export const getResponsiveBrowserShellRenderPolicy = ({
  experienceMode,
  activeSurface,
  resultLayout,
  width,
  variantId,
}: {
  experienceMode: ExperienceMode
  activeSurface: ActiveSurface
  resultLayout: ResultLayout
  width?: number | null
  variantId?: string | null
}): BrowserShellRenderPolicy => {
  if (experienceMode === 'focused' && variantId) {
    return { kind: 'stacked-variant', renderMode: 'stacked-variant' }
  }

  if (experienceMode === 'focused' || !canFitTwoPanes(width)) {
    return {
      kind: 'single-surface',
      renderMode: activeSurface === 'results' ? 'results-only' : 'details-only',
    }
  }

  return { kind: 'wide', renderMode: getPaneRenderMode(resultLayout) }
}

export type RetainedSurfaceMounts = Record<BrowserSurface, boolean>

/**
 * Retain Results after it has been shown, while mounting Details only when it
 * is active. Thus a direct Details URL does not start hidden Results queries,
 * Results -> Details -> Back keeps the original Results tree, and a hidden
 * Details page cannot continue fetching as Results context changes.
 */
export const getRetainedSurfaceMounts = (
  previous: RetainedSurfaceMounts,
  activeSurface: BrowserSurface
): RetainedSurfaceMounts => ({
  results: previous.results || activeSurface === 'results',
  details: activeSurface === 'details',
})

/** Native `hidden` is the accessibility fallback; `inert` also prevents focus. */
export const getRetainedSurfaceVisibility = (active: boolean) => ({
  hidden: !active,
  ariaHidden: active ? undefined : true,
  inert: !active,
})

export const getBackToResultsLabel = (resultIndex: ResultIndex): string => {
  if (resultIndex === 'gene-phewas') return 'Back to gene results'
  if (resultIndex === 'variant-phewas') return 'Back to variant results'
  if (resultIndex === 'locus-phewas') return 'Back to locus results'
  if (
    resultIndex === 'gene-manhattan' ||
    resultIndex === 'variant-manhattan' ||
    resultIndex === 'pheno-info'
  ) {
    return 'Back to phenotype results'
  }
  return 'Back to results'
}

export const getDetailsContextLabel = ({
  analysisId,
  geneId,
  regionId,
  variantId,
}: {
  analysisId?: string | null
  geneId?: string | null
  regionId?: string | null
  variantId?: string | null
}): string => {
  const context = [
    analysisId && `phenotype ${analysisId}`,
    geneId && `gene ${geneId}`,
    regionId && `locus chr${regionId.replace('-', ':')}`,
    variantId && `variant ${variantId}`,
  ].filter(Boolean)

  return context.length > 0 ? `Details for ${context.join(' · ')}` : 'Association details'
}

export const canCompareSideBySide = ({
  width,
  analysisId,
  geneId,
  regionId,
  variantId,
}: {
  width?: number
  analysisId?: string | null
  geneId?: string | null
  regionId?: string | null
  variantId?: string | null
}): boolean =>
  canFitTwoPanes(width) &&
  Boolean(analysisId && (geneId || regionId || variantId))
