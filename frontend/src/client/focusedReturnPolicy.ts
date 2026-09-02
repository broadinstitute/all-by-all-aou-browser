import type { NavigationState } from './navigationUrl'

export type AppReturnOrigin =
  | 'phenotype-results'
  | 'gene-results'
  | 'variant-results'
  | 'locus-results'
  | 'top-results'
  | 'app-results'

export const APP_RETURN_ORIGIN_STATE_KEY = '__axaouReturnOrigin'

export type AppHistoryState = {
  [APP_RETURN_ORIGIN_STATE_KEY]?: AppReturnOrigin
}

export const getAppReturnOrigin = (
  state: NavigationState
): AppReturnOrigin => {
  switch (state.resultIndex) {
    case 'pheno-info':
    case 'gene-manhattan':
    case 'variant-manhattan':
      return 'phenotype-results'
    case 'gene-phewas':
      return 'gene-results'
    case 'variant-phewas':
      return 'variant-results'
    case 'locus-phewas':
      return 'locus-results'
    case 'top-associations':
      return 'top-results'
    default:
      return 'app-results'
  }
}

export type FocusedReturnPolicy =
  | { action: 'history-back'; label: string }
  | { action: 'phenotype-fallback'; label: string; analysisId: string }
  | { action: 'top-results-fallback'; label: string }

const labelForOrigin = (origin: AppReturnOrigin): string => {
  if (origin === 'phenotype-results') return 'Back to phenotype results'
  if (origin === 'gene-results') return 'Back to gene results'
  if (origin === 'variant-results') return 'Back to variant results'
  if (origin === 'locus-results') return 'Back to locus results'
  return 'Back to results'
}

/** A true Back is used only when an in-app semantic PUSH recorded its origin. */
export const getFocusedReturnPolicy = ({
  origin,
  analysisId,
}: {
  origin?: AppReturnOrigin | null
  analysisId?: string | null
}): FocusedReturnPolicy => {
  if (origin) return { action: 'history-back', label: labelForOrigin(origin) }
  if (analysisId) {
    return {
      action: 'phenotype-fallback',
      label: 'Back to phenotype results',
      analysisId,
    }
  }
  return { action: 'top-results-fallback', label: 'Back to results' }
}
