/* eslint-disable react/forbid-prop-types */
import { PureComponent } from 'react'

import { Grid } from '@gnomad/ui'

import ExportDataButton from '../ExportDataButton'
import { GeneAssociations } from '../types'

type Props = {
  results: any[]
  columns: any[]
  exportColumns: any[]
  analysisId: string
  burdenSet: string
  highlightText: string
  numRowsRendered: number
}

type State = any

class GeneResultsTable extends PureComponent<Props, State> {
  state = {
    sortKey: 'pvalue',
    sortAscending: true,
  }

  setSortKey = (sortKey: any) => {
    this.setState((state: any) => ({
      ...state,
      sortKey,
      sortAscending: sortKey === state.sortKey ? !state.sortAscending : true,
    }))
  }

  getRenderedResults() {
    const { results } = this.props
    const { sortKey, sortAscending } = this.state

    if (!results) {
      return []
    }

    const comparator =
      sortKey === 'gene_name' || sortKey === 'gene_description'
        ? (a: any, b: any) => a.localeCompare(b)
        : (a: any, b: any) => a - b

    const orderedComparator = sortAscending ? comparator : (a: any, b: any) => comparator(b, a)

    const sortedResults = results.sort((resultA, resultB) => {
      const sortValA = resultA[sortKey]
      const sortValB = resultB[sortKey]

      if (sortValA === null || sortValA === '') {
        return 1
      }

      if (sortValB === null || sortValB === '') {
        return -1
      }

      return orderedComparator(sortValA, sortValB)
    })

    return sortedResults
  }

  render() {
    const results = this.getRenderedResults()
    const { columns, exportColumns, analysisId, burdenSet } = this.props
    const { sortKey, sortAscending } = this.state

    return (
      <div className='gene-results-table'>
        {results.length === 0 ? (
          'No results found'
        ) : (
          <Grid
            columns={columns}
            data={results}
            numRowsRendered={this.props.numRowsRendered}
            rowKey={(result: GeneAssociations) => `${result.gene_symbol}-${result.gene_id}-${result.annotation}-${result.ancestry_group}`}
            sortKey={sortKey}
            sortOrder={sortAscending ? 'ascending' : 'descending'}
            onRequestSort={this.setSortKey}
          />
        )}
        <ExportDataButton
          exportFileName={`gene-burden-results-exomes_${burdenSet}_${analysisId}`}
          data={results}
          columns={exportColumns}
        />
      </div>
    )
  }
}

export default GeneResultsTable
