import { pValueTypeToPValueKeyName, P_VALUE_BURDEN, P_VALUE_SKAT, P_VALUE_SKAT_O } from './Utils'

const filterPhenotypes = ({
  phenotypes,
  searchText,
  showFilteredAnalyses,
  maxValues,
  pValueType,
  phewasType,
}: any) => {
  // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const pValueKeyName = pValueTypeToPValueKeyName[pValueType]
  let filteredPhenotypes = phenotypes

  if (searchText) {
    const query = searchText.toLowerCase()
    filteredPhenotypes = filteredPhenotypes.filter(
      (v: any) =>
        (v.phenotype_id || '').toLowerCase().includes(query) ||
        (v.phenocode || '').toLowerCase().includes(query) ||
        (v.coding || '').toLowerCase().includes(query) ||
        (v.modifier || '').toLowerCase().includes(query) ||
        (v.description || '').toLowerCase().includes(query) ||
        (v.trait_type || '').toLowerCase().includes(query) ||
        (v.description_more || '').toLowerCase().includes(query) ||
        (v.category || '').toLowerCase().includes(query) ||
        (v.gene_symbol || '').toLowerCase().includes(query)
    )
  }

  const dontFilter = ['AbbVie', 'pfe', 'BI']

  filteredPhenotypes = filteredPhenotypes.filter(
    (p: any) => !p.phenocode.includes('Touchscreen_duration_custom')
  )

  if (!showFilteredAnalyses) {
    if (pValueType == P_VALUE_SKAT_O) {
      filteredPhenotypes = filteredPhenotypes.filter(
        (p: any) =>
          p.keep_pheno_skato || dontFilter.some((w) => p.description && p.description.includes(w))
      )
    } else if (pValueType == P_VALUE_SKAT) {
      filteredPhenotypes = filteredPhenotypes.filter(
        (p: any) =>
          p.keep_pheno_skat || dontFilter.some((w) => p.description && p.description.includes(w))
      )
    } else if (pValueType == P_VALUE_BURDEN) {
      filteredPhenotypes = filteredPhenotypes.filter(
        (p: any) =>
          p.keep_pheno_burden || dontFilter.some((w) => p.description && p.description.includes(w))
      )
    }

    if (phewasType === 'topHit') {
      filteredPhenotypes = filteredPhenotypes.filter(
        (p: any) => p.keep_gene_coverage && p.keep_gene_n_var
      )
    }
  } else {
    filteredPhenotypes = filteredPhenotypes
  }

  // if (maxValues && maxValues.maxBeta !== undefined && maxValues.minBeta !== undefined) {
  //   filteredPhenotypes = filteredPhenotypes.filter(
  //     (p: any) => p.BETA >= maxValues.minBeta && p.BETA <= maxValues.maxBeta
  //   )
  // }
  // if (maxValues && maxValues.maxLogPvalue !== undefined && maxValues.minLogPValue !== undefined) {
  //   filteredPhenotypes = filteredPhenotypes.filter(
  //     (p: any) =>
  //       -Math.log10(p[pValueKeyName]) >= maxValues.minLogPValue &&
  //       -Math.log10(p[pValueKeyName]) <= maxValues.maxLogPvalue
  //   )
  // }
  return filteredPhenotypes
}

export default filterPhenotypes
