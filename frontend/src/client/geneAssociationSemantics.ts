import type { AncestryGroupCodes } from './sharedState'

/**
 * META gene burden results contain a test statistic, not an effect estimate.
 * Keep this distinction centralized so cached/legacy API payloads cannot be
 * presented as directional betas.
 */
export const hasGeneEffectEstimate = (ancestry: AncestryGroupCodes | string): boolean =>
  ancestry.toLowerCase() !== 'meta'

export const geneBetaForAncestry = (
  ancestry: AncestryGroupCodes | string,
  beta: number | null | undefined
): number | null => (hasGeneEffectEstimate(ancestry) ? beta ?? null : null)
