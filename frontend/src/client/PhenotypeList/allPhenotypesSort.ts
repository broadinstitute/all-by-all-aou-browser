export type AllPhenotypesSortOrder = 'ascending' | 'descending'

export type AllPhenotypesSortState = {
  sortKey: string
  sortOrder: AllPhenotypesSortOrder
}

export const ALL_PHENOTYPES_DEFAULT_SORT: Readonly<AllPhenotypesSortState> = {
  sortKey: 'sig_genes_count',
  sortOrder: 'descending',
}

/**
 * A fresh visit uses the burden-gene count default. An explicit sort, when
 * supplied by the mounted view (or future URL restoration), always wins.
 */
export const initialAllPhenotypesSortState = (
  explicitSort?: AllPhenotypesSortState | null
): AllPhenotypesSortState => ({
  ...(explicitSort ?? ALL_PHENOTYPES_DEFAULT_SORT),
})

/** Apply a user header click without reapplying the fresh-visit default. */
export const nextAllPhenotypesSortState = (
  current: AllPhenotypesSortState,
  requestedSortKey: string
): AllPhenotypesSortState => {
  if (requestedSortKey === current.sortKey) {
    return {
      sortKey: current.sortKey,
      sortOrder: current.sortOrder === 'ascending' ? 'descending' : 'ascending',
    }
  }

  return { sortKey: requestedSortKey, sortOrder: 'descending' }
}

/**
 * Sort a copy while retaining source order for equal values. The explicit
 * source index keeps tie behavior deterministic across runtimes.
 */
export const sortAllPhenotypesRows = <Row extends object>(
  rows: readonly Row[],
  { sortKey, sortOrder }: AllPhenotypesSortState
): Row[] =>
  rows
    .map((row, sourceIndex) => ({ row, sourceIndex }))
    .sort((a, b) => {
      const valA = (a.row as Record<string, unknown>)[sortKey]
      const valB = (b.row as Record<string, unknown>)[sortKey]
      let comparison: number

      if (typeof valA === 'string' && typeof valB === 'string') {
        comparison = sortOrder === 'ascending'
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA)
      } else {
        comparison = sortOrder === 'ascending'
          ? (valA as number) - (valB as number)
          : (valB as number) - (valA as number)
      }

      return comparison || a.sourceIndex - b.sourceIndex
    })
    .map(({ row }) => row)
