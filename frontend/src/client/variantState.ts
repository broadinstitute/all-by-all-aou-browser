import { atom, selector, useRecoilState, useResetRecoilState } from 'recoil'
import { getCountColumns } from './VariantList/variantTableColumns'
import { MultiAnalysisVariantSummary } from './GenePage/GenePageVariantTable'
import { removeItemAtIndex } from './sharedState'
import { VariantAssociations } from './types'
import { ScaleDiverging } from 'd3-scale'

const defaultVariantFilter = {
  includeCategories: {
    lof: true,
    missense: true,
    synonymous: true,
    other: true,
  },
  includeFilteredVariants: false,
  includeSNVs: true,
  includeIndels: true,
}

export const variantFilterAtom = atom({
  key: 'variantFilter',
  default: defaultVariantFilter,
})

export const variantSearchTextAtom = atom({
  key: 'variantSearchText',
  default: '',
})

export const sortStateAtom = atom<{ sortKey: string; sortOrder: 'ascending' | 'descending' }>({
  key: 'sortState',
  default: { sortKey: 'pvalue', sortOrder: 'ascending' },
})

export const selectedVariantAtom = atom<string | null>({
  key: 'selectedVariant',
  default: null,
})

export const multiAnalysisVariantDetailsAtom = atom<MultiAnalysisVariantSummary | null>({
  key: 'multiAnalysisVariantDetails',
  default: null,
})

export const multiAnalysisColorByAtom = atom<
  'consequence' | 'pvalue' | 'beta' | 'analysis' | 'homozygote' | 'correlation'
>({
  key: 'multiAnalysisColorBy',
  default: 'consequence',
})

export const hoveredVariantAtom = atom<string | null>({
  key: 'hoveredVariant',
  default: null,
})

export type MembershipFilterOptions = {
  pLoF: boolean
  missense: boolean
  synonymous: boolean
  'non-coding': boolean
}

export const membershipFiltersAtom = atom<MembershipFilterOptions>({
  key: 'membershipFilter',
  default: {
    pLoF: false,
    missense: false,
    synonymous: false,
    'non-coding': false,
  },
})

export const variantLogPvalueFilterAtom = atom<[number, number]>({
  key: 'variantPvalueFilter',
  default: [0, 100],
})

export const variantPvalueFilterSelector = selector({
  key: 'variantPvalueFilterLogSelector',
  get: ({ get }) => {
    const [lower, upper] = get(variantLogPvalueFilterAtom)
    return [10 ** -upper, 10 ** -lower]
  },
})

export const autoPvalFilter = atom<number | null>({
  key: 'autoVariantPvalueFilter',
  default: null,
})

export const alleleFrequencyFilterAtom = atom<[number, number]>({
  key: 'alleleFrequencyFilter',
  default: [1e-7, 1],
})
export const multiAnalysisTransparencyAtom = atom<[number, number]>({
  key: 'multiAnalysisTransparency',
  default: [0, 0.05],
})

export const useClearVariantState = () => {
  const clearVariantFilter = useResetRecoilState(variantFilterAtom)
  // const clearMembershipFilters = useResetRecoilState(membershipFiltersAtom)
  const clearMultiAnalysisVariantDetails = useResetRecoilState(multiAnalysisVariantDetailsAtom)

  return () => {
    clearVariantFilter()
    // clearMembershipFilters()
    clearMultiAnalysisVariantDetails()
  }
}

export const variantAssociationsByAnalysisState = atom<Record<string, VariantAssociations[]>>({
  key: 'variantsByAnalysis',
  default: {},
})

export type VariantFieldGroup =
  | 'counts'
  | 'freq'
  | 'pop'
  | 'all'
  | 'none'
  | 'stat'
  | 'categorical_default'
  | 'continuous_default'

export const variantFieldGroupState = atom<VariantFieldGroup>({
  key: 'variantColumnGroup',
  default: 'pop',
})

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
// | 'gwas_catalog'

export const selectedVariantFieldsOptions: VariantFieldType[] = [
  // 'rsid',
  'consequence',
  // 'ancestry_group',
  'analysis',
  'hgvsp',
  'hgvsc',
  'hgvs',
  'pvalue',
  'beta',
  'ac_cases',
  'an_cases',
  'ac_controls',
  'an_controls',
  'af_cases',
  'af_controls',
  'association_ac',
  'association_af',
  'association_an',
  'allele_count',
  'allele_number',
  'allele_frequency',
  'homozygote_count',
  // 'gwas_catalog',
]

export const selectedVariantFieldsAtom = atom<VariantFieldType[]>({
  key: 'selectedVariantFields',
  default: [
    'consequence',
    'hgvs',
    'pvalue',
    'beta',
    'allele_count',
    'allele_number',
    'allele_frequency',
    'homozygote_count',
  ],
})

export const useSelectedVariantFieldsPreset = () => {
  const [selectedVariantFields, setSelectedVariantFields] =
    useRecoilState(selectedVariantFieldsAtom)

  return (preset: VariantFieldGroup) => {
    const allColumns = getCountColumns('all')
    if (preset === 'none') {
      setSelectedVariantFields([])
    } else if (preset === 'all') {
      setSelectedVariantFields([
        // 'rsid',
        'consequence',
        'hgvsp',
        'hgvsc',
        'pvalue',
        'beta',
        ...(allColumns as VariantFieldType[]),
      ])
    } else if (preset === 'stat') {
      setSelectedVariantFields(['consequence', 'hgvsp', 'pvalue', 'beta'])
    } else {
      const columns = getCountColumns(preset)
      const nonPresetSelected = selectedVariantFields.filter((f) => !allColumns.includes(f))
      setSelectedVariantFields([...nonPresetSelected, ...(columns as VariantFieldType[])])
    }
  }
}

export const useToggleSelectedVariantField = () => {
  const [selectedVariantFields, setSelectedVariantFields] =
    useRecoilState(selectedVariantFieldsAtom)

  return (field: VariantFieldType) => {
    if (selectedVariantFields.includes(field)) {
      const index = selectedVariantFields.findIndex((item: string) => item === field)
      const updatedList = removeItemAtIndex<VariantFieldType>(selectedVariantFields, index)
      setSelectedVariantFields(updatedList)
    } else {
      setSelectedVariantFields([...selectedVariantFields, field])
    }
  }
}

type MultiAnalysisVariantTableFormat = 'wide' | 'long'

export const multiAnalysisVariantTableFormatAtom = atom<MultiAnalysisVariantTableFormat>({
  key: 'multiAnalysisVariantTableFormat',
  default: 'long',
})

export const showCaseControlTracksAtom = atom({
  key: 'showCaseControlTracks',
  default: false,
})

export type GwasCatalogOption = 'highlight' | 'filter' | 'hide'

export const gwasCatalogOptionsAtom = atom<GwasCatalogOption>({
  key: 'gwasCatalogOptions',
  default: 'hide',
})

type BetaScaleType = ScaleDiverging<string> | ((_: number) => string)

export const variantBetaScaleAtom = atom<{ betaScale: BetaScaleType }>({
  key: 'variantBetaScale',
  default: { betaScale: (_: number) => 'white' },
})
