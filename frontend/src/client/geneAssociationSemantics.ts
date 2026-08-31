export type BurdenDirection = 'negative' | 'zero' | 'positive'

/**
 * META gene burden results contain a test statistic, not an effect estimate.
 * Keep this distinction centralized so cached/legacy API payloads cannot be
 * presented as directional betas.
 */
export const hasGeneEffectEstimate = (ancestry: string): boolean =>
  ancestry.toLowerCase() !== 'meta'

export type GeneMacColumnMode = 'case-control' | 'total' | 'none'

/**
 * Select the scientifically meaningful MAC representation for a page scoped to
 * one phenotype. API metadata uses binary/continuous; older payloads may call
 * binary traits categorical. Unknown values deliberately fail closed.
 */
export const geneMacColumnMode = (
  traitType: string | null | undefined
): GeneMacColumnMode => {
  const normalizedTraitType = traitType?.trim().toLowerCase()
  if (normalizedTraitType === 'binary' || normalizedTraitType === 'categorical') {
    return 'case-control'
  }
  if (normalizedTraitType === 'continuous') return 'total'
  return 'none'
}

export const shouldShowMacCaseControlColumns = (
  traitType: string | null | undefined
): boolean => geneMacColumnMode(traitType) === 'case-control'

export const isContinuousTrait = (traitType: string | null | undefined): boolean =>
  geneMacColumnMode(traitType) === 'total'

export const geneBetaForAncestry = (
  ancestry: string,
  beta: number | null | undefined
): number | null =>
  hasGeneEffectEstimate(ancestry) && beta != null && Number.isFinite(beta) ? beta : null

export const isBurdenDirection = (value: unknown): value is BurdenDirection =>
  value === 'negative' || value === 'zero' || value === 'positive'

export const directionFromFiniteNumber = (
  value: number | null | undefined
): BurdenDirection | null => {
  if (value == null || !Number.isFinite(value)) return null
  if (value > 0) return 'positive'
  if (value < 0) return 'negative'
  return 'zero'
}

/**
 * Resolve the sign displayed on gene plots without recovering a META statistic
 * from a cached/legacy beta field. META direction must come from the explicit
 * API enum; ancestry-specific direction may be derived from a genuine beta.
 */
export const geneBurdenDirection = (
  ancestry: string,
  burdenDirection: BurdenDirection | null | undefined,
  beta: number | null | undefined
): BurdenDirection | null => {
  if (!hasGeneEffectEstimate(ancestry)) {
    return isBurdenDirection(burdenDirection) ? burdenDirection : null
  }

  return directionFromFiniteNumber(geneBetaForAncestry(ancestry, beta))
}

export const burdenDirectionSign = (
  direction: BurdenDirection | null | undefined
): string => {
  if (direction === 'positive') return '+'
  if (direction === 'negative') return '\u2212'
  if (direction === 'zero') return '0'
  return '\u2014'
}

export const formatBurdenDirection = (
  direction: BurdenDirection | null | undefined
): string => {
  if (direction === 'positive') return 'Positive (+)'
  if (direction === 'negative') return 'Negative (\u2212)'
  if (direction === 'zero') return 'Zero (0)'
  return '\u2014'
}
