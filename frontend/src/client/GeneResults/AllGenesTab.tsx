import React, { useState, useMemo } from 'react'
import { Grid } from '@axaou/ui'
import { useQuery } from '@axaou/ui'
import styled from 'styled-components'
import { scaleLinear, scaleBand } from 'd3-scale'
import { max } from 'd3-array'
import { useRecoilValue } from 'recoil'

import { axaouDevUrl, cacheEnabled, pouchDbName } from '../Query'
import { Spinner, StatusMessage } from '../UserInterface'
import { useAppNavigation } from '../hooks/useAppNavigation'
import RangeSlider from '../PhenotypeList/RangeSlider'
import { ChromosomeSelector } from '../Shared/ChromosomeSelector'
import { selectedContigAtom } from '../sharedState'

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

const PlotCard = styled.div`
  background: var(--theme-surface, #fff);
  border: 1px solid var(--theme-border, #ddd);
  border-radius: 6px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  margin-bottom: 20px;
  height: 280px;
`

const PlotTabs = styled.div`
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--theme-border, #ddd);
  margin-bottom: 10px;
`

const PlotTab = styled.button<{ $active: boolean }>`
  padding: 6px 16px;
  font-size: 12px;
  font-weight: ${(props) => props.$active ? '600' : '400'};
  color: ${(props) => props.$active ? 'var(--theme-primary, #262262)' : 'var(--theme-text-muted, #888)'};
  background: none;
  border: none;
  border-bottom: 2px solid ${(props) => props.$active ? 'var(--theme-primary, #262262)' : 'transparent'};
  cursor: pointer;
  &:hover { color: var(--theme-primary, #262262); }
`

const SliderGroup = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 250px;
  flex: 1;

  .slider-label {
    font-size: 12px;
    margin-bottom: 4px;
    font-weight: 500;
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
  const selectedContig = useRecoilValue(selectedContigAtom)
  const [searchText, setSearchText] = useState('')
  const [sortKey, setSortKey] = useState('sig_phenos_total')
  const [sortOrder, setSortOrder] = useState<'ascending' | 'descending'>('descending')

  const [pleiotropyRange, setPleiotropyRange] = useState<[number, number]>([0, 100])
  const [plotTab, setPlotTab] = useState<'scatter' | 'histogram'>('scatter')

  const { queryStates, anyLoading } = useQuery<Data>({
    dbName: pouchDbName,
    queries: [{ url: `${axaouDevUrl}/genes/summary`, name: 'summary' }],
    deps: [],
    cacheEnabled,
  })

  const { data, error } = queryStates.summary || {}

  const dataBounds = useMemo(() => {
    if (!data || data.length === 0) return { maxPleiotropy: 100 }
    const mapped = data.map((r: any) => r.sig_phenos_variant_count + r.sig_phenos_burden_count)
    return {
      maxPleiotropy: max(mapped) || 100
    }
  }, [data])

  React.useEffect(() => {
    if (data && data.length > 0) {
      setPleiotropyRange([0, dataBounds.maxPleiotropy])
    }
  }, [dataBounds, data])

  const filteredData = useMemo(() => {
    if (!data) return []
    let result = data.map((r: any) => ({ ...r, sig_phenos_total: r.sig_phenos_variant_count + r.sig_phenos_burden_count })) as GeneSummaryRow[]

    // Contig Filter
    if (selectedContig !== 'all') {
      const chromToMatch = selectedContig.replace('chr', '')
      result = result.filter((r: GeneSummaryRow) => r.chrom === chromToMatch)
    }

    // Pleiotropy filter
    result = result.filter((r: GeneSummaryRow) => r.sig_phenos_total >= pleiotropyRange[0] && r.sig_phenos_total <= pleiotropyRange[1])

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
  }, [data, searchText, selectedContig, pleiotropyRange, sortKey, sortOrder])

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

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: 'var(--theme-text)' }}>Chromosome:</span>
          <ChromosomeSelector />
        </div>

        <SliderGroup>
          <div className="slider-label">Pleiotropy (Total Sig Phenotypes)</div>
          {data && (
            <RangeSlider
              presetInterval={[0, dataBounds.maxPleiotropy]}
              initialValues={pleiotropyRange}
              onIntervalChange={setPleiotropyRange}
              step={1}
              showInputs={true}
            />
          )}
        </SliderGroup>

        <div style={{ marginLeft: 'auto', fontSize: '13px', color: 'var(--theme-text-muted)' }}>
          Showing {filteredData.length} implicated genes
        </div>
      </ControlsRow>

      <PlotCard>
        <PlotTabs>
          <PlotTab $active={plotTab === 'scatter'} onClick={() => setPlotTab('scatter')}>Burden vs. Variants</PlotTab>
          <PlotTab $active={plotTab === 'histogram'} onClick={() => setPlotTab('histogram')}>Pleiotropy Histogram</PlotTab>
        </PlotTabs>

        {plotTab === 'scatter' && (() => {
          if (!filteredData.length) return <div style={{color: '#999', fontSize: 11}}>No data</div>
          const w = 600, h = 230, pad = {top: 10, right: 20, bottom: 45, left: 60}
          const innerW = w - pad.left - pad.right
          const innerH = h - pad.top - pad.bottom

          const xMax = Math.max(5, max(filteredData, (d: GeneSummaryRow) => d.sig_phenos_variant_count) || 5)
          const xScale = scaleLinear().domain([0, xMax]).range([0, innerW]).nice()

          const yMax = Math.max(5, max(filteredData, (d: GeneSummaryRow) => d.sig_phenos_burden_count) || 5)
          const yScale = scaleLinear().domain([0, yMax]).range([innerH, 0]).nice()

          const xTicks = xScale.ticks(6)
          const yTicks = yScale.ticks(5)

          return (
            <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <g transform={`translate(${pad.left},${pad.top})`}>
                {/* Grid lines */}
                {yTicks.map(t => (
                  <line key={`yg-${t}`} x1={0} y1={yScale(t)} x2={innerW} y2={yScale(t)} stroke="#eee" />
                ))}

                {/* Axes */}
                <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#ccc" />
                <line x1={0} y1={0} x2={0} y2={innerH} stroke="#ccc" />

                {/* X ticks */}
                {xTicks.map(t => (
                  <g key={`xt-${t}`}>
                    <line x1={xScale(t)} y1={innerH} x2={xScale(t)} y2={innerH + 4} stroke="#999" />
                    <text x={xScale(t)} y={innerH + 15} fontSize="9" textAnchor="middle" fill="#666">{t}</text>
                  </g>
                ))}
                {/* Y ticks */}
                {yTicks.map(t => (
                  <g key={`yt-${t}`}>
                    <line x1={-4} y1={yScale(t)} x2={0} y2={yScale(t)} stroke="#999" />
                    <text x={-8} y={yScale(t) + 3} fontSize="9" textAnchor="end" fill="#666">{t}</text>
                  </g>
                ))}

                {/* Axis labels */}
                <text x={innerW / 2} y={innerH + 36} fontSize="11" textAnchor="middle" fill="var(--theme-text, #333)">Significant Phenotypes (Single Variant)</text>
                <text transform="rotate(-90)" x={-innerH / 2} y={-45} fontSize="11" textAnchor="middle" fill="var(--theme-text, #333)">Significant Phenotypes (Burden)</text>

                {filteredData.map((d: GeneSummaryRow) => {
                  const cx = xScale(d.sig_phenos_variant_count)
                  const cy = yScale(d.sig_phenos_burden_count)
                  return (
                    <circle
                      key={d.gene_id}
                      cx={cx} cy={cy} r={3}
                      fill="var(--theme-primary, #262262)" opacity={0.5}
                    >
                      <title>{d.gene_symbol} (Variant: {d.sig_phenos_variant_count}, Burden: {d.sig_phenos_burden_count})</title>
                    </circle>
                  )
                })}
              </g>
            </svg>
          )
        })()}

        {plotTab === 'histogram' && (() => {
          if (!filteredData.length) return <div style={{color: '#999', fontSize: 11}}>No data</div>

          const bins = Array(12).fill(0)
          filteredData.forEach((d: GeneSummaryRow) => {
            let binIndex = d.sig_phenos_total
            if (binIndex > 10) binIndex = 11
            bins[binIndex]++
          })

          const binLabels = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", ">10"]

          const w = 600, h = 230, pad = {top: 10, right: 20, bottom: 45, left: 60}
          const innerW = w - pad.left - pad.right
          const innerH = h - pad.top - pad.bottom

          const xScale = scaleBand()
            .domain(binLabels)
            .range([0, innerW])
            .paddingInner(0.1)

          const yMax = Math.max(10, ...bins)
          const yScale = scaleLinear().domain([0, yMax]).range([innerH, 0]).nice()

          const yTicks = yScale.ticks(5)

          return (
            <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <g transform={`translate(${pad.left},${pad.top})`}>
                {/* Grid lines */}
                {yTicks.map(t => (
                  <line key={`yg-${t}`} x1={0} y1={yScale(t)} x2={innerW} y2={yScale(t)} stroke="#eee" />
                ))}

                {/* Axes */}
                <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#ccc" />
                <line x1={0} y1={0} x2={0} y2={innerH} stroke="#ccc" />

                {/* Y ticks */}
                {yTicks.map(t => (
                  <g key={`yt-${t}`}>
                    <line x1={-4} y1={yScale(t)} x2={0} y2={yScale(t)} stroke="#999" />
                    <text x={-8} y={yScale(t) + 3} fontSize="9" textAnchor="end" fill="#666">{t.toLocaleString()}</text>
                  </g>
                ))}

                {/* Axis labels */}
                <text x={innerW / 2} y={innerH + 36} fontSize="11" textAnchor="middle" fill="var(--theme-text, #333)">Number of Significant Phenotypes</text>
                <text transform="rotate(-90)" x={-innerH / 2} y={-45} fontSize="11" textAnchor="middle" fill="var(--theme-text, #333)">Number of Genes</text>

                {bins.map((count, i) => {
                  if (count === 0) return null
                  const x = xScale(binLabels[i])!
                  const y = yScale(count)
                  const bw = xScale.bandwidth()
                  const bh = innerH - y
                  return (
                    <g key={i}>
                      <rect x={x} y={y} width={bw} height={bh} fill="var(--theme-primary, #262262)" opacity={0.8}>
                        <title>{binLabels[i]} phenotypes: {count.toLocaleString()} genes</title>
                      </rect>
                      <text x={x + bw/2} y={innerH + 12} fontSize="9" fill="#666" textAnchor="middle">{binLabels[i]}</text>
                    </g>
                  )
                })}
              </g>
            </svg>
          )
        })()}
      </PlotCard>

      <div style={{ height: 'calc(100vh - 450px)' }}>
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
