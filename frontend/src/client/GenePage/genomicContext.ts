export type GenomicContext =
  | {
      kind: 'gene'
      geneId: string
      /** Retained URL provenance; it does not override the explicit variant gene. */
      preservedRegionId: string | null
    }
  | {
      kind: 'locus'
      regionId: string | null
      source: 'explicit' | 'variant-window' | 'unavailable'
    }

export const normalizeVariantId = (variantId: string): string =>
  variantId.replace(/^chr(?=[^-]+-\d+-)/i, '')

export const variantIdsEqual = (
  left?: string | null,
  right?: string | null
): boolean =>
  Boolean(left && right && normalizeVariantId(left) === normalizeVariantId(right))

export type ParsedVariantLocus = { contig: string; position: number }

/** Parse only canonical contig-position-ref-alt IDs; never fuzzy-match alleles. */
export const parseVariantLocus = (
  variantId?: string | null
): ParsedVariantLocus | null => {
  if (!variantId) return null
  const match = normalizeVariantId(variantId).match(/^([^-]+)-(\d+)-([^-]+)-(.+)$/)
  if (!match) return null

  const position = Number.parseInt(match[2], 10)
  if (!Number.isSafeInteger(position) || position < 1) return null
  return { contig: match[1], position }
}

export const inferVariantWindow = (
  variantId?: string | null,
  flank = 500_000
): string | null => {
  const locus = parseVariantLocus(variantId)
  if (!locus) return null
  return `${locus.contig}-${Math.max(1, locus.position - flank)}-${locus.position + flank}`
}

/**
 * Variant navigation gives an explicit source gene precedence over a retained
 * containing region. Non-variant pages retain their historical region-first
 * precedence.
 */
export const resolveGenomicContext = ({
  variantId,
  geneId,
  regionId,
}: {
  variantId?: string | null
  geneId?: string | null
  regionId?: string | null
}): GenomicContext => {
  if (variantId && geneId) {
    return { kind: 'gene', geneId, preservedRegionId: regionId ?? null }
  }

  if (regionId) {
    return { kind: 'locus', regionId, source: 'explicit' }
  }

  if (variantId) {
    const inferredRegion = inferVariantWindow(variantId)
    return inferredRegion
      ? { kind: 'locus', regionId: inferredRegion, source: 'variant-window' }
      : { kind: 'locus', regionId: null, source: 'unavailable' }
  }

  if (geneId) {
    return { kind: 'gene', geneId, preservedRegionId: null }
  }

  return { kind: 'locus', regionId: null, source: 'unavailable' }
}

export const findVariantById = <T extends { variant_id?: string | null }>(
  variants: readonly T[],
  variantId?: string | null
): T | undefined => variants.find((variant) => variantIdsEqual(variant.variant_id, variantId))

export const includeSelectedVariant = <T extends { variant_id?: string | null }>(
  visible: readonly T[],
  source: readonly T[],
  selectedVariantId?: string | null
): T[] => {
  if (!selectedVariantId || findVariantById(visible, selectedVariantId)) return [...visible]
  const selected = findVariantById(source, selectedVariantId)
  return selected ? [...visible, selected] : [...visible]
}

export type SelectedVariantMarkerPolicy<T> =
  | {
      kind: 'marker'
      renderPath: 'canvas' | 'server-overlay'
      position: number
      variant: T | null
      source: 'exact-row' | 'canonical-id'
    }
  | {
      kind: 'unavailable'
      renderPath: 'canvas' | 'server-overlay'
    }

export const resolveSelectedVariantMarker = <
  T extends { variant_id?: string | null; locus?: { position?: number | null } | null },
>({
  variants,
  selectedVariantId,
  isLargeRegion,
}: {
  variants: readonly T[]
  selectedVariantId?: string | null
  isLargeRegion: boolean
}): SelectedVariantMarkerPolicy<T> => {
  const renderPath = isLargeRegion ? 'server-overlay' : 'canvas'
  const exact = findVariantById(variants, selectedVariantId)
  if (exact?.locus?.position != null) {
    return {
      kind: 'marker',
      renderPath,
      position: exact.locus.position,
      variant: exact,
      source: 'exact-row',
    }
  }

  const parsed = parseVariantLocus(selectedVariantId)
  return parsed
    ? {
        kind: 'marker',
        renderPath,
        position: parsed.position,
        variant: null,
        source: 'canonical-id',
      }
    : { kind: 'unavailable', renderPath }
}
