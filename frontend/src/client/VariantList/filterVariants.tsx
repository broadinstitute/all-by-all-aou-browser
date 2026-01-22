import { getCategoryFromConsequence, getLabelForConsequenceTerm } from '../vepConsequences'
import { VariantJoined } from '../types'
import { MembershipFilterOptions } from '../variantState'

const filterVariants = (
  variants: VariantJoined[],
  filter: any,
  membershipFilters: MembershipFilterOptions
) => {
  let filteredVariants = variants

  const isEveryConsequenceCategorySelected =
    filter.includeCategories.lof &&
    filter.includeCategories.missense &&
    filter.includeCategories.synonymous &&
    filter.includeCategories.other

  if (!isEveryConsequenceCategorySelected) {
    filteredVariants = variants.filter((variant) => {
      if (variant.consequence) {
        const category = getCategoryFromConsequence(variant.consequence) || 'other'
        return filter.includeCategories[category]
      }
      return false
    })
  }

  if (filter.searchText) {
    const query = filter.searchText.toLowerCase()
    filteredVariants = filteredVariants.filter(
      (v) => {
        return (
          (v.variant_id || '').toLowerCase().includes(query) ||
          (v.hgvsc || '').toLowerCase().includes(query) ||
          (v.analysis_description || '').toLowerCase().includes(query) ||
          (v.hgvsp || '').toLowerCase().includes(query) ||
          (v.gene_symbol || '').toLowerCase().includes(query) ||
          (v.gene_id || '').toLowerCase().includes(query) ||
          getLabelForConsequenceTerm(v.consequence || 'N/A')
            .toLowerCase()
            .includes(query)
        )
      }

      // v.variant_id.toLowerCase().includes(query) ||
      // (v.rsid || '').toLowerCase().includes(query) ||
      // (v.hgvs || '').toLowerCase().includes(query)
    )
  }

  if (membershipFilters && !Object.values(membershipFilters).every((item) => !item)) {
    filteredVariants = filteredVariants.filter((v) => {
      return v.annotation && membershipFilters[v.annotation as keyof MembershipFilterOptions]
    })
  }

  return filteredVariants
}

export default filterVariants
