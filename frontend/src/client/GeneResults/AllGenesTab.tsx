import React, { useState, useMemo } from 'react'
import { Grid } from '@axaou/ui'
import { useQuery } from '@axaou/ui'
import styled from 'styled-components'

import { axaouDevUrl, cacheEnabled, pouchDbName } from '../Query'
import { Spinner, StatusMessage } from '../UserInterface'
import { useAppNavigation } from '../hooks/useAppNavigation'

const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
`

const ControlsRow = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  width: 100%;
  margin-bottom: 12px;
`

const SearchInput = styled.input`
  padding: 6px 12px;
  border: 1px solid var(--theme-border, #ddd);
  border-radius: 4px;
  font-size: 13px;
  min-width: 250px;
  background: var(--theme-surface, #fff);
  color: var(--theme-text, #333);
  &:focus {
    outline: none;
    border-color: var(--theme-primary, #262262);
  }
`

interface GeneSummaryRow {
  gene_id: string
  gene_symbol: string
  chrom: string
  sig_phenos_variant_count: number
  sig_phenos_burden_count: number
  sig_phenos_total: number
}

interface Data {
  summary: GeneSummaryRow[]
}

const AllGenesTab = () => {
  const { openInNewTab } = useAppNavigation()
  const [searchText, setSearchText] = useState('')
  const [sortKey, setSortKey] = useState('sig_phenos_total')
  const [sortOrder, setSortOrder] = useState<'ascending' | 'descending'>('descending')

  const { queryStates, anyLoading } = useQuery<Data>({
    dbName: pouchDbName,
    queries: [{ url: `${axaouDevUrl}/genes/summary`, name: 'summary' }],
    deps: [],
    cacheEnabled,
  })

  const { data, error } = queryStates.summary || {}

  const filteredData = useMemo(() => {
    if (!data) return []
    let result = data.map((r: any) => ({ ...r, sig_phenos_total: r.sig_phenos_variant_count + r.sig_phenos_burden_count })) as GeneSummaryRow[]
    if (searchText) {
      const q = searchText.toLowerCase()
      result = result.filter(
        (r: GeneSummaryRow) =>
          r.gene_symbol.toLowerCase().includes(q) || r.gene_id.toLowerCase().includes(q)
      )
    }

    return [...result].sort((a: GeneSummaryRow, b: GeneSummaryRow) => {
      const valA = a[sortKey as keyof GeneSummaryRow]
      const valB = b[sortKey as keyof GeneSummaryRow]
      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortOrder === 'ascending' ? valA.localeCompare(valB) : valB.localeCompare(valA)
      }
      return sortOrder === 'ascending'
        ? (valA as number) - (valB as number)
        : (valB as number) - (valA as number)
    })
  }, [data, searchText, sortKey, sortOrder])

  const handleRowClick = (row: GeneSummaryRow) => {
    openInNewTab({
      geneId: row.gene_id,
      regionId: null,
      resultIndex: 'gene-phewas',
      resultLayout: 'full',
    })
  }

  const columns = [
    {
      key: 'gene_symbol',
      heading: 'Gene Symbol',
      isSortable: true,
      minWidth: 150,
      grow: 1,
      render: (row: GeneSummaryRow) => (
        <span
          className="grid-cell-content"
          style={{ cursor: 'pointer', fontWeight: 500, color: 'var(--theme-primary, #262262)' }}
          onClick={() => handleRowClick(row)}
        >
          {row.gene_symbol}
        </span>
      ),
    },
    { key: 'gene_id', heading: 'Gene ID', isSortable: true, minWidth: 150, grow: 0 },
    {
      key: 'chrom',
      heading: 'Chromosome',
      isSortable: true,
      minWidth: 100,
      grow: 0,
      render: (row: GeneSummaryRow) => `chr${row.chrom}`,
    },
    {
      key: 'sig_phenos_total',
      heading: 'Sig Phenotypes',
      isSortable: true,
      minWidth: 140,
      grow: 0,
      render: (row: GeneSummaryRow) => row.sig_phenos_total.toLocaleString(),
    },
    {
      key: 'sig_phenos_variant_count',
      heading: 'Sig Phenotypes (Variants)',
      isSortable: true,
      minWidth: 180,
      grow: 0,
      render: (row: GeneSummaryRow) => row.sig_phenos_variant_count.toLocaleString(),
    },
    {
      key: 'sig_phenos_burden_count',
      heading: 'Sig Phenotypes (Burden)',
      isSortable: true,
      minWidth: 180,
      grow: 0,
      render: (row: GeneSummaryRow) => row.sig_phenos_burden_count.toLocaleString(),
    },
  ]

  const handleRequestSort = (newSortKey: string) => {
    if (newSortKey === sortKey)
      setSortOrder(sortOrder === 'ascending' ? 'descending' : 'ascending')
    else {
      setSortKey(newSortKey)
      setSortOrder('descending')
    }
  }

  if (anyLoading() && !data)
    return (
      <Container>
        <Spinner />
      </Container>
    )
  if (error)
    return (
      <Container>
        <StatusMessage>Error loading summary data.</StatusMessage>
      </Container>
    )

  return (
    <Container>
      <h3 className="app-section-title" style={{ marginTop: 0, marginBottom: 12 }}>
        <strong>All Genes Directory</strong>
      </h3>
      <ControlsRow>
        <SearchInput
          placeholder="Search gene symbol or ID..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <div style={{ marginLeft: 'auto', fontSize: '13px', color: 'var(--theme-text-muted)' }}>
          Showing {filteredData.length} implicated genes
        </div>
      </ControlsRow>
      <div style={{ height: 'calc(100vh - 230px)' }}>
        {/* @ts-expect-error Grid typing issue with sortKey/sortOrder */}
        <Grid
          columns={columns}
          data={filteredData}
          numRowsRendered={20}
          rowKey={(r: GeneSummaryRow) => r.gene_id}
          sortKey={sortKey}
          sortOrder={sortOrder}
          onRequestSort={handleRequestSort}
        />
      </div>
    </Container>
  )
}

export default AllGenesTab
