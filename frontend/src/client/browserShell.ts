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
  Number.isFinite(width) &&
  (width as number) >= 1100 &&
  Boolean(analysisId && (geneId || regionId || variantId))
