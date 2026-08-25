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
