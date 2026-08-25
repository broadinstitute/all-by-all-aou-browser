const mergeResponseFields = (
  annotation: Record<string, any>,
  association: Record<string, any>
): Record<string, any> => {
  const merged = { ...annotation }
  const dummyZeroFields = new Set(['af', 'beta', 'se', 'ac', 'an', 'hom'])

  Object.entries(association).forEach(([key, value]) => {
    if (value === null || value === undefined) return
    if (
      dummyZeroFields.has(key) &&
      value === 0 &&
      merged[key] !== undefined &&
      merged[key] !== null &&
      merged[key] !== 0
    ) {
      return
    }
    if (
      key === 'consequence' &&
      (value === 'unknown' || value === '') &&
      merged[key]
    ) {
      return
    }
    merged[key] = value
  })

  return merged
}

export const mergeGeneVariantResponses = (
  annotations: Array<Record<string, any>>,
  associations: Array<Record<string, any>>
): Array<Record<string, any>> => {
  const annotationsById = new Map(annotations.map((variant) => [variant.variant_id, variant]))
  const associationsById = new Map(associations.map((variant) => [variant.variant_id, variant]))
  const variantIds = new Set([...annotationsById.keys(), ...associationsById.keys()])

  return Array.from(variantIds, (variantId) =>
    mergeResponseFields(
      annotationsById.get(variantId) || {},
      associationsById.get(variantId) || {}
    )
  )
}

export const hasAssociationPvalue = (pvalue: number | null | undefined): pvalue is number =>
  pvalue !== null && pvalue !== undefined

export const associationPvalueSortValue = (pvalue: number | null | undefined): number =>
  pvalue ?? 1

export const MISSING_ASSOCIATION_RESULT_LABEL = 'No association result'
export const MISSING_ASSOCIATION_RESULT_DESCRIPTION =
  'No association result was returned; this may reflect association filtering or incomplete coverage.'

export const associationNegLog10P = (pvalue: number | null | undefined): number => {
  if (!hasAssociationPvalue(pvalue)) return 0
  if (pvalue === 0) return Number.POSITIVE_INFINITY
  return -Math.log10(pvalue)
}

export const associationPointY = (
  pvalue: number | null | undefined,
  pvalueY: number,
  noPvalueY: number
): number => (hasAssociationPvalue(pvalue) ? pvalueY : noPvalueY)
