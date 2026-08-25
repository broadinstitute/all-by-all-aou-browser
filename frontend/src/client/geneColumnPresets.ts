export type VariantFieldGroup =
  | 'counts'
  | 'freq'
  | 'pop'
  | 'all'
  | 'none'
  | 'stat'
  | 'categorical_default'
  | 'continuous_default'

export type TraitDefaultVariantFieldGroup = 'categorical_default' | 'continuous_default'

export type VariantFieldType =
  | 'variant_id'
  // | 'rsid'
  | 'consequence'
  // | 'ancestry_group'
  | 'analysis'
  | 'hgvsp'
  | 'hgvsc'
  | 'hgvs'
  | 'pvalue'
  | 'beta'
  | 'ac_cases'
  | 'an_cases'
  | 'ac_controls'
  | 'an_controls'
  | 'af_cases'
  | 'af_controls'
  | 'association_ac'
  | 'association_af'
  | 'association_an'
  | 'allele_count'
  | 'allele_number'
  | 'allele_frequency'
  | 'homozygote_count'
  | 'show_label'
  | 'label'
// | 'gwas_catalog'

/**
 * API metadata currently uses binary/continuous, while older UI data calls
 * binary traits categorical. Unknown values deliberately have no default.
 */
export const variantFieldGroupForTraitType = (
  traitType: string | null | undefined
): TraitDefaultVariantFieldGroup | null => {
  const normalizedTraitType = traitType?.trim().toLowerCase()
  if (normalizedTraitType === 'continuous') return 'continuous_default'
  if (normalizedTraitType === 'binary' || normalizedTraitType === 'categorical') {
    return 'categorical_default'
  }
  return null
}

export function getCountColumns(
  variantColumnGroup: VariantFieldGroup,
  traitType: string = 'categorical'
): VariantFieldType[] {
  const baseCountColumns: VariantFieldType[] = [
    'association_ac',
    'association_af',
    'association_an',
    'allele_count',
    'allele_number',
    'allele_frequency',
    'homozygote_count',
  ]

  const nonContinuousTraitColumns: VariantFieldType[] =
    traitType.trim().toLowerCase() !== 'continuous'
      ? ['ac_cases', 'an_cases', 'ac_controls', 'an_controls', 'af_cases', 'af_controls']
      : []

  const countColumns = [...baseCountColumns, ...nonContinuousTraitColumns]

  return countColumns.filter((column) => {
    if (variantColumnGroup === 'pop') {
      return ['allele_count', 'allele_number', 'allele_frequency', 'homozygote_count'].includes(
        column
      )
    }
    if (variantColumnGroup === 'freq') {
      return ['af_cases', 'af_controls', 'association_af', 'allele_frequency'].includes(column)
    }
    if (variantColumnGroup === 'counts') {
      return [
        'ac_cases',
        'an_cases',
        'ac_controls',
        'an_controls',
        'association_ac',
        'association_an',
      ].includes(column)
    }
    if (variantColumnGroup === 'categorical_default') {
      return [
        'pvalue',
        'beta',
        'homozygote_count',
        'ac_cases',
        'an_cases',
        'ac_controls',
        'an_controls',
        'af_cases',
        'af_controls',
        'association_ac',
        'association_an',
      ].includes(column)
    }
    if (variantColumnGroup === 'continuous_default') {
      return [
        'pvalue',
        'beta',
        'association_ac',
        'association_af',
        'homozygote_count',
        'association_an',
      ].includes(column)
    }
    return true
  })
}

const deduplicateFields = (fields: VariantFieldType[]): VariantFieldType[] => [...new Set(fields)]

/** Build a preset from the current selection while retaining non-count customizations. */
export const selectedVariantFieldsForPreset = (
  selectedFields: VariantFieldType[],
  preset: VariantFieldGroup
): VariantFieldType[] => {
  const allCountColumns = getCountColumns('all')

  if (preset === 'none') return []
  if (preset === 'all') {
    return deduplicateFields([
      'consequence',
      'hgvsp',
      'hgvsc',
      'pvalue',
      'beta',
      ...allCountColumns,
    ])
  }
  if (preset === 'stat') return ['consequence', 'hgvsp', 'pvalue', 'beta']

  const retainedFields = selectedFields.filter((field) => !allCountColumns.includes(field))
  return deduplicateFields([...retainedFields, ...getCountColumns(preset)])
}

export type AutomaticGeneColumnPresetState = {
  analysisId: string | null
  appliedPreset: TraitDefaultVariantFieldGroup | null
}

export const initialAutomaticGeneColumnPresetState: AutomaticGeneColumnPresetState = {
  analysisId: null,
  appliedPreset: null,
}

/**
 * Each mounted gene page applies a recognized trait default once per primary
 * analysis. Manual changes remain stable until the primary analysis (or its
 * recognized trait type) changes. Revisiting/remounting an analysis reapplies
 * that analysis's default.
 */
export const resolveAutomaticGeneColumnPreset = (
  previous: AutomaticGeneColumnPresetState,
  analysisId: string,
  traitType: string | null | undefined
): {
  state: AutomaticGeneColumnPresetState
  presetToApply: TraitDefaultVariantFieldGroup | null
} => {
  const preset = variantFieldGroupForTraitType(traitType)
  const stateForAnalysis =
    previous.analysisId === analysisId
      ? previous
      : { analysisId, appliedPreset: null }

  if (!preset || stateForAnalysis.appliedPreset === preset) {
    return { state: stateForAnalysis, presetToApply: null }
  }

  return {
    state: { analysisId, appliedPreset: preset },
    presetToApply: preset,
  }
}
