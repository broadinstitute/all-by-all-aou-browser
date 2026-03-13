import React, { useState } from 'react'
import styled from 'styled-components'
import { Grid } from '@gnomad/ui'
import { getConsequenceColor } from '../VariantList/variantTableColumns'
import { getLabelForConsequenceTerm } from '../vepConsequences'
import { ColorMarker, RightArrow, Link } from '../UserInterface'
import { renderPvalueCell } from '../PhenotypeList/Utils'
import { UnifiedContextMenu } from '../components/UnifiedContextMenu'
import { useContextMenuNavigation } from '../hooks/useContextMenuNavigation'

const DescriptionContainer = styled.span`
  overflow: hidden;
  max-width: 100%;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const openVariantInNewTab = (row: any) => {
  const params = new URLSearchParams(window.location.search)
  const stateStr = params.get('state')
  const state = stateStr ? JSON.parse(stateStr) : {}
  state.variantId = row.variant_id
  state.analysisId = row.top_phenotype
  state.resultIndex = 'variant-phewas'
  state.resultLayout = 'half'
  state.regionId = null
  if (row.gene_id) state.geneId = row.gene_id
  params.set('state', JSON.stringify(state))
  window.open(`${window.location.pathname}?${params.toString()}`, '_blank')
}

const VariantLinkRenderer = ({ row }: any) => {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const navigate = useContextMenuNavigation()

  return (
    <>
      <Link
        className="grid-cell-content"
        style={{ cursor: 'pointer' }}
        onClick={() => openVariantInNewTab(row)}
        onContextMenu={(e: any) => {
          e.preventDefault()
          setMenu({ x: e.clientX, y: e.clientY })
        }}
      >
        <DescriptionContainer>{row.variant_id}</DescriptionContainer>
      </Link>
      {menu && (
        <UnifiedContextMenu
          x={menu.x}
          y={menu.y}
          title={`VARIANT: ${row.variant_id}`}
          targets={[{ label: 'Variant PheWAS', resultIndex: 'variant-phewas' }]}
          onNavigate={(mode, target) => {
            navigate('variant', row.variant_id, mode, target)
            setMenu(null)
          }}
          onCopy={() => {
            navigator.clipboard.writeText(row.variant_id)
            setMenu(null)
          }}
          copyLabel="Copy Variant ID"
          onClose={() => setMenu(null)}
        />
      )}
    </>
  )
}

export const TopVariantsTable = ({ variants, onVariantClick }: any) => {
  const [sortKey, setSortKey] = useState('num_associations')
  const [sortOrder, setSortOrder] = useState<'ascending' | 'descending'>('descending')

  const columns = [
    {
      key: 'variant_id',
      heading: 'Variant ID',
      isSortable: true,
      minWidth: 150,
      grow: 1,
      render: (row: any) => <VariantLinkRenderer row={row} />,
    },
    {
      key: 'gene_symbol',
      heading: 'Gene',
      isSortable: true,
      minWidth: 100,
      grow: 0,
      render: (row: any) => row.gene_symbol || '-',
    },
    {
      key: 'consequence',
      heading: 'Consequence',
      isSortable: true,
      minWidth: 150,
      grow: 0,
      render: (row: any) => (
        <span className="grid-cell-content">
          <ColorMarker color={getConsequenceColor(row.consequence)} />
          {row.consequence ? getLabelForConsequenceTerm(row.consequence) : 'N/A'}
        </span>
      ),
    },
    {
      key: 'top_phenotype_description',
      heading: 'Top Phenotype',
      isSortable: true,
      minWidth: 250,
      grow: 1,
      render: (row: any) => (
        <DescriptionContainer title={row.top_phenotype_description}>
          {row.top_phenotype_description}
        </DescriptionContainer>
      ),
    },
    {
      key: 'top_pvalue',
      heading: 'Top P-Value',
      isSortable: true,
      minWidth: 100,
      grow: 0,
      render: renderPvalueCell('variant', 'pvalue'),
    },
    {
      key: 'num_associations',
      heading: '# Significant',
      tooltip: 'Number of phenotypes this variant is significantly associated with',
      isSortable: true,
      minWidth: 100,
      grow: 0,
      render: (row: any) => row.num_associations.toLocaleString(),
    },
    {
      key: 'show',
      heading: '',
      isRowHeader: true,
      isSortable: false,
      minWidth: 50,
      grow: 0,
      render: (row: any) => {
        return <RightArrow onClick={() => onVariantClick(row)} />
      },
    },
  ]

  const handleRequestSort = (newSortKey: string) => {
    if (newSortKey === sortKey) {
      setSortOrder(sortOrder === 'ascending' ? 'descending' : 'ascending')
    } else {
      setSortKey(newSortKey)
      setSortOrder('ascending')
    }
  }

  const sortedData = [...variants].sort((a: any, b: any) => {
    let valA = a[sortKey]
    let valB = b[sortKey]

    if (valA == null) valA = sortOrder === 'ascending' ? Infinity : -Infinity
    if (valB == null) valB = sortOrder === 'ascending' ? Infinity : -Infinity

    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortOrder === 'ascending' ? valA.localeCompare(valB) : valB.localeCompare(valA)
    }

    return sortOrder === 'ascending' ? (valA > valB ? 1 : -1) : valA < valB ? 1 : -1
  })

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 200px)' }}>
      <Grid
        columns={columns}
        data={sortedData}
        numRowsRendered={20}
        rowKey={(row: any) => row.variant_id}
        sortKey={sortKey}
        sortOrder={sortOrder}
        onRequestSort={handleRequestSort}
      />
    </div>
  )
}
