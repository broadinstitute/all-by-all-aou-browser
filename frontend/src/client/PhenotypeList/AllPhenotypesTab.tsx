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
  flex-wrap: wrap;
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

const Select = styled.select`
  padding: 6px 28px 6px 12px;
  border: 1px solid var(--theme-border, #ddd);
  border-radius: 4px;
  font-size: 13px;
  background-color: var(--theme-surface);
  color: var(--theme-text);
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23888'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  cursor: pointer;
`

interface PhenotypeSummaryRow {
  analysis_id: string
  description: string
  category: string
  n_cases: number
  n_controls: number
  sig_variants_count: number
  sig_loci_count: number
  sig_genes_count: number
}

interface Data {
  summary: PhenotypeSummaryRow[]
}

const AllPhenotypesTab = () => {
  const { openInNewTab } = useAppNavigation()
  const [searchText, setSearchText] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [sortKey, setSortKey] = useState('sig_loci_count')
  const [sortOrder, setSortOrder] = useState<'ascending' | 'descending'>('descending')

  const { queryStates, anyLoading } = useQuery<Data>({
    dbName: pouchDbName,
    queries: [{ url: `${axaouDevUrl}/phenotypes/summary`, name: 'summary' }],
    deps: [],
    cacheEnabled,
  })

  const { data, error } = queryStates.summary || {}

  const categories = useMemo(() => {
    if (!data) return []
    const cats = new Set(data.map((r: PhenotypeSummaryRow) => r.category))
    return Array.from(cats).sort()
  }, [data])

  const filteredData = useMemo(() => {
    if (!data) return []
    let result = data
    if (selectedCategory !== 'All') {
      result = result.filter((r: PhenotypeSummaryRow) => r.category === selectedCategory)
    }
    if (searchText) {
      const q = searchText.toLowerCase()
      result = result.filter(
        (r: PhenotypeSummaryRow) =>
          r.analysis_id.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)
      )
    }

    return [...result].sort((a: PhenotypeSummaryRow, b: PhenotypeSummaryRow) => {
      const valA = a[sortKey as keyof PhenotypeSummaryRow]
      const valB = b[sortKey as keyof PhenotypeSummaryRow]
      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortOrder === 'ascending' ? valA.localeCompare(valB) : valB.localeCompare(valA)
      }
      return sortOrder === 'ascending'
        ? (valA as number) - (valB as number)
        : (valB as number) - (valA as number)
    })
  }, [data, searchText, selectedCategory, sortKey, sortOrder])

  const handleRowClick = (row: PhenotypeSummaryRow) => {
    openInNewTab({
      analysisId: row.analysis_id,
      resultIndex: 'pheno-info',
      resultLayout: 'full',
    })
  }

  const columns = [
    {
      key: 'description',
      heading: 'Phenotype Description',
      isSortable: true,
      minWidth: 250,
      grow: 1,
      render: (row: PhenotypeSummaryRow) => (
        <span
          className="grid-cell-content"
          style={{ cursor: 'pointer', fontWeight: 500, color: 'var(--theme-primary, #262262)' }}
          onClick={() => handleRowClick(row)}
        >
          {row.description}
        </span>
      ),
    },
    { key: 'analysis_id', heading: 'Phenotype ID', isSortable: true, minWidth: 120, grow: 0 },
    { key: 'category', heading: 'Category', isSortable: true, minWidth: 150, grow: 0 },
    {
      key: 'n_cases',
      heading: 'Cases',
      isSortable: true,
      minWidth: 80,
      grow: 0,
      render: (row: PhenotypeSummaryRow) => row.n_cases.toLocaleString(),
    },
    {
      key: 'n_controls',
      heading: 'Controls',
      isSortable: true,
      minWidth: 80,
      grow: 0,
      render: (row: PhenotypeSummaryRow) => row.n_controls.toLocaleString(),
    },
    {
      key: 'sig_loci_count',
      heading: 'Sig Loci',
      isSortable: true,
      minWidth: 100,
      grow: 0,
      render: (row: PhenotypeSummaryRow) => row.sig_loci_count.toLocaleString(),
    },
    {
      key: 'sig_variants_count',
      heading: 'Sig Variants',
      isSortable: true,
      minWidth: 100,
      grow: 0,
      render: (row: PhenotypeSummaryRow) => row.sig_variants_count.toLocaleString(),
    },
    {
      key: 'sig_genes_count',
      heading: 'Sig Genes (Burden)',
      isSortable: true,
      minWidth: 140,
      grow: 0,
      render: (row: PhenotypeSummaryRow) => row.sig_genes_count.toLocaleString(),
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
        <strong>All Phenotypes Directory</strong>
      </h3>
      <ControlsRow>
        <SearchInput
          placeholder="Search description or ID..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <Select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
          <option value="All">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <div style={{ marginLeft: 'auto', fontSize: '13px', color: 'var(--theme-text-muted)' }}>
          Showing {filteredData.length} phenotypes
        </div>
      </ControlsRow>
      <div style={{ height: 'calc(100vh - 230px)' }}>
        {/* @ts-expect-error Grid typing issue with sortKey/sortOrder */}
        <Grid
          columns={columns}
          data={filteredData}
          numRowsRendered={20}
          rowKey={(r: PhenotypeSummaryRow) => r.analysis_id}
          sortKey={sortKey}
          sortOrder={sortOrder}
          onRequestSort={handleRequestSort}
        />
      </div>
    </Container>
  )
}

export default AllPhenotypesTab
