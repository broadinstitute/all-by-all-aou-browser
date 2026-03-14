import React, { useState, useMemo, useCallback, useRef } from 'react'
import { Grid } from '@axaou/ui'
import { useQuery } from '@axaou/ui'
import styled from 'styled-components'
import { scaleLinear, scaleLog } from 'd3-scale'
import { max, sum } from 'd3-array'

import { axaouDevUrl, cacheEnabled, pouchDbName } from '../Query'
import { Spinner, StatusMessage } from '../UserInterface'
import { useAppNavigation } from '../hooks/useAppNavigation'
import { getChromosomeLayout } from '../Manhattan/layout'

const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
`

const CompactHeader = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px 20px;
  margin-bottom: 8px;
  font-size: 14px;
`

const DetailItem = styled.div`
  display: flex;
  align-items: baseline;
  gap: 6px;

  .label {
    color: var(--theme-text-muted, #888);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .value {
    color: var(--theme-text, #333);
    font-weight: 500;
  }
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

const MinInput = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--theme-text, #333);

  input {
    width: 60px;
    padding: 4px 8px;
    border: 1px solid var(--theme-border, #ddd);
    border-radius: 4px;
    font-size: 13px;
    text-align: center;
    background: var(--theme-surface, #fff);
    color: var(--theme-text, #333);
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
  min-height: 280px;
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

const PlotContainer = styled.div`
  position: relative;
  flex: 1;
`

const BrushRect = styled.div`
  position: absolute;
  border: 2px solid rgba(38, 34, 98, 0.7);
  background: rgba(38, 34, 98, 0.1);
  pointer-events: none;
  z-index: 500;
`

const ResetZoomButton = styled.button`
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 501;
  font-size: 10px;
  padding: 2px 8px;
  background: var(--theme-surface, #fff);
  border: 1px solid var(--theme-border, #ddd);
  border-radius: 3px;
  cursor: pointer;
  color: var(--theme-text, #333);
  &:hover { background: #f0f0f0; }
`

const CHROM_COLORS = ['#666', '#aaa']

interface GeneSummaryRow {
  gene_id: string
  gene_symbol: string
  chrom: string
  start: number
  xstart: number
  gnomad_oe_lof: number | null
  gnomad_pli: number | null
  sig_phenos_variant_count: number
  sig_phenos_burden_count: number
  sig_phenos_burden_plof: number
  sig_phenos_burden_missense: number
  sig_phenos_burden_synonymous: number
  sig_phenos_total: number
}

interface Data {
  summary: GeneSummaryRow[]
}

interface Viewport {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
}

type PlotMode = 'genomic' | 'constraint'

const AllGenesTab = () => {
  const { openInNewTab } = useAppNavigation()
  const [searchText, setSearchText] = useState('')
  const [sortKey, setSortKey] = useState('sig_phenos_total')
  const [sortOrder, setSortOrder] = useState<'ascending' | 'descending'>('descending')
  const [minAssociations, setMinAssociations] = useState(1)
  const [plotTab, setPlotTab] = useState<PlotMode>('genomic')

  const [viewport, setViewport] = useState<Viewport | null>(null)
  const [brushStart, setBrushStart] = useState<{ x: number; y: number } | null>(null)
  const [brushEnd, setBrushEnd] = useState<{ x: number; y: number } | null>(null)
  const isDragging = useRef(false)
  const plotContainerRef = useRef<HTMLDivElement>(null)

  const { queryStates, anyLoading } = useQuery<Data>({
    dbName: pouchDbName,
    queries: [{ url: `${axaouDevUrl}/genes/summary`, name: 'summary' }],
    deps: [],
    cacheEnabled,
  })

  const { data, error } = queryStates.summary || {}

  // Reset viewport when switching plot mode
  React.useEffect(() => {
    setViewport(null)
  }, [plotTab])

  const allGenes = useMemo(() => {
    if (!data) return []
    return data.map((r: any) => ({
      ...r,
      sig_phenos_total: r.sig_phenos_variant_count + r.sig_phenos_burden_count,
    })) as GeneSummaryRow[]
  }, [data])

  const aggregates = useMemo(() => {
    if (!allGenes.length) return null
    return {
      totalGenes: allGenes.length,
      totalVariantHits: sum(allGenes, (d: GeneSummaryRow) => d.sig_phenos_variant_count),
      totalBurdenHits: sum(allGenes, (d: GeneSummaryRow) => d.sig_phenos_burden_count),
    }
  }, [allGenes])

  const filteredData = useMemo(() => {
    let result = allGenes

    result = result.filter((r: GeneSummaryRow) => r.sig_phenos_total >= minAssociations)

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
  }, [allGenes, searchText, minAssociations, sortKey, sortOrder])

  const handleRowClick = (row: GeneSummaryRow) => {
    openInNewTab({
      geneId: row.gene_id,
      regionId: null,
      resultIndex: 'gene-phewas',
      resultLayout: 'full',
    })
  }

  const getRelativePos = useCallback((e: React.MouseEvent) => {
    const container = plotContainerRef.current
    if (!container) return { x: 0, y: 0 }
    const rect = container.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    const pos = getRelativePos(e)
    isDragging.current = true
    setBrushStart(pos)
    setBrushEnd(pos)
  }, [getRelativePos])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return
    setBrushEnd(getRelativePos(e))
  }, [getRelativePos])

  const applyBrushZoom = useCallback((
    svgW: number, svgH: number,
    pad: { top: number; right: number; bottom: number; left: number },
    xDomain: [number, number],
    yDomain: [number, number],
  ) => {
    if (!brushStart || !brushEnd) return
    const w = Math.abs(brushEnd.x - brushStart.x)
    const h = Math.abs(brushEnd.y - brushStart.y)
    if (w < 10 || h < 10) {
      setBrushStart(null)
      setBrushEnd(null)
      return
    }

    const container = plotContainerRef.current
    if (!container) return
    const containerW = container.clientWidth
    const containerH = container.clientHeight

    const innerW = svgW - pad.left - pad.right
    const innerH = svgH - pad.top - pad.bottom

    const scaleX = svgW / containerW
    const scaleY = svgH / containerH

    const svgX1 = Math.min(brushStart.x, brushEnd.x) * scaleX - pad.left
    const svgX2 = Math.max(brushStart.x, brushEnd.x) * scaleX - pad.left
    const svgY1 = Math.min(brushStart.y, brushEnd.y) * scaleY - pad.top
    const svgY2 = Math.max(brushStart.y, brushEnd.y) * scaleY - pad.top

    const xScale = scaleLinear().domain(xDomain).range([0, innerW])
    const yScale = scaleLinear().domain(yDomain).range([innerH, 0])

    const newXMin = xScale.invert(Math.max(0, svgX1))
    const newXMax = xScale.invert(Math.min(innerW, svgX2))
    const newYMin = yScale.invert(Math.min(innerH, svgY2))
    const newYMax = yScale.invert(Math.max(0, svgY1))

    setViewport({ xMin: newXMin, xMax: newXMax, yMin: newYMin, yMax: newYMax })
    setBrushStart(null)
    setBrushEnd(null)
  }, [brushStart, brushEnd])

  const handleMouseUp = useCallback(() => {
    isDragging.current = false
    if (!brushStart || !brushEnd) {
      setBrushStart(null)
      setBrushEnd(null)
      return
    }
    // Zoom logic is handled in the plot-specific render via applyBrushZoom
    // We store the info and let the next render cycle handle it
  }, [brushStart, brushEnd])

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
      heading: 'Burden (All)',
      isSortable: true,
      minWidth: 100,
      grow: 0,
      render: (row: GeneSummaryRow) => row.sig_phenos_burden_count.toLocaleString(),
    },
    {
      key: 'sig_phenos_burden_plof',
      heading: 'Burden (pLoF)',
      isSortable: true,
      minWidth: 110,
      grow: 0,
      render: (row: GeneSummaryRow) => row.sig_phenos_burden_plof.toLocaleString(),
    },
    {
      key: 'sig_phenos_burden_missense',
      heading: 'Burden (Mis)',
      isSortable: true,
      minWidth: 110,
      grow: 0,
      render: (row: GeneSummaryRow) => row.sig_phenos_burden_missense.toLocaleString(),
    },
    {
      key: 'sig_phenos_burden_synonymous',
      heading: 'Burden (Syn)',
      isSortable: true,
      minWidth: 110,
      grow: 0,
      render: (row: GeneSummaryRow) => row.sig_phenos_burden_synonymous.toLocaleString(),
    },
    {
      key: 'gnomad_oe_lof',
      heading: 'LOEUF',
      isSortable: true,
      minWidth: 80,
      grow: 0,
      render: (row: GeneSummaryRow) => row.gnomad_oe_lof != null ? row.gnomad_oe_lof.toFixed(3) : '-',
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

  const brushRect = brushStart && brushEnd ? {
    left: Math.min(brushStart.x, brushEnd.x),
    top: Math.min(brushStart.y, brushEnd.y),
    width: Math.abs(brushEnd.x - brushStart.x),
    height: Math.abs(brushEnd.y - brushStart.y),
  } : null

  return (
    <Container>
      {aggregates && (
        <CompactHeader>
          <DetailItem><span className="label">Implicated Genes</span><span className="value">{aggregates.totalGenes.toLocaleString()}</span></DetailItem>
          <DetailItem><span className="label">Variant Hits</span><span className="value">{aggregates.totalVariantHits.toLocaleString()}</span></DetailItem>
          <DetailItem><span className="label">Burden Hits</span><span className="value">{aggregates.totalBurdenHits.toLocaleString()}</span></DetailItem>
        </CompactHeader>
      )}

      <ControlsRow>
        <SearchInput
          placeholder="Search gene symbol or ID..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <MinInput>
          <span>Min associations:</span>
          <input
            type="number"
            min={1}
            value={minAssociations}
            onChange={(e) => setMinAssociations(Math.max(1, parseInt(e.target.value) || 1))}
          />
        </MinInput>
        <div style={{ marginLeft: 'auto', fontSize: '13px', color: 'var(--theme-text-muted)' }}>
          Showing {filteredData.length} implicated genes
        </div>
      </ControlsRow>

      <PlotCard>
        <PlotTabs>
          <PlotTab $active={plotTab === 'genomic'} onClick={() => setPlotTab('genomic')}>Genomic Pleiotropy</PlotTab>
          <PlotTab $active={plotTab === 'constraint'} onClick={() => setPlotTab('constraint')}>Constraint vs. Discovery</PlotTab>
        </PlotTabs>

        <PlotContainer
          ref={plotContainerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={(e) => {
            isDragging.current = false
            // Brush zoom is handled inline below
          }}
          onMouseLeave={() => {
            if (isDragging.current) {
              isDragging.current = false
              setBrushStart(null)
              setBrushEnd(null)
            }
          }}
        >
          {viewport && <ResetZoomButton onClick={() => setViewport(null)}>Reset Zoom</ResetZoomButton>}
          {brushRect && brushRect.width > 2 && brushRect.height > 2 && (
            <BrushRect style={{
              left: brushRect.left,
              top: brushRect.top,
              width: brushRect.width,
              height: brushRect.height,
            }} />
          )}

          {plotTab === 'genomic' && (() => {
            if (!filteredData.length) return <div style={{color: '#999', fontSize: 11}}>No data</div>

            const layout = getChromosomeLayout('all')
            const w = 800, h = 260, pad = {top: 10, right: 20, bottom: 45, left: 60}
            const innerW = w - pad.left - pad.right
            const innerH = h - pad.top - pad.bottom

            const genesWithX = filteredData
              .map((d: GeneSummaryRow) => {
                const x = layout.getX(d.chrom, d.start)
                return x !== null ? { ...d, xNorm: x } : null
              })
              .filter(Boolean) as (GeneSummaryRow & { xNorm: number })[]

            const yMax = Math.max(5, max(genesWithX, d => d.sig_phenos_total) || 5)

            const xMin = viewport?.xMin ?? 0
            const xMax = viewport?.xMax ?? 1
            const vpYMin = viewport?.yMin ?? 1
            const vpYMax = viewport?.yMax ?? yMax

            const xScale = scaleLinear().domain([xMin, xMax]).range([0, innerW])
            const yScale = scaleLog().domain([Math.max(1, vpYMin), vpYMax]).range([innerH, 0]).nice()

            const yTicks = yScale.ticks(6).filter(t => t >= 1)

            // Chromosome bands
            const chroms = layout.chromosomes

            return (
              <svg
                viewBox={`0 0 ${w} ${h}`}
                style={{ width: '100%', height: '100%', overflow: 'visible', userSelect: 'none' }}
                onMouseUp={() => {
                  if (brushStart && brushEnd) {
                    const bw = Math.abs(brushEnd.x - brushStart.x)
                    const bh = Math.abs(brushEnd.y - brushStart.y)
                    if (bw >= 10 && bh >= 10) {
                      const container = plotContainerRef.current
                      if (container) {
                        const containerW = container.clientWidth
                        const containerH = container.clientHeight
                        const sx = w / containerW, sy = h / containerH
                        const svgX1 = Math.min(brushStart.x, brushEnd.x) * sx - pad.left
                        const svgX2 = Math.max(brushStart.x, brushEnd.x) * sx - pad.left
                        const svgY1 = Math.min(brushStart.y, brushEnd.y) * sy - pad.top
                        const svgY2 = Math.max(brushStart.y, brushEnd.y) * sy - pad.top
                        setViewport({
                          xMin: xScale.invert(Math.max(0, svgX1)),
                          xMax: xScale.invert(Math.min(innerW, svgX2)),
                          yMin: Math.max(1, yScale.invert(Math.min(innerH, svgY2))),
                          yMax: yScale.invert(Math.max(0, svgY1)),
                        })
                      }
                    }
                  }
                  setBrushStart(null)
                  setBrushEnd(null)
                  isDragging.current = false
                }}
              >
                <g transform={`translate(${pad.left},${pad.top})`}>
                  {/* Chromosome background bands */}
                  {chroms.map((chr, i) => {
                    const x1 = xScale(chr.startNormalized)
                    const x2 = xScale(chr.endNormalized)
                    if (x2 < 0 || x1 > innerW) return null
                    return (
                      <rect
                        key={chr.name}
                        x={Math.max(0, x1)}
                        y={0}
                        width={Math.min(innerW, x2) - Math.max(0, x1)}
                        height={innerH}
                        fill={i % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'rgba(0,0,0,0.06)'}
                      />
                    )
                  })}

                  {/* Chromosome labels */}
                  {chroms.map((chr) => {
                    const midX = xScale((chr.startNormalized + chr.endNormalized) / 2)
                    if (midX < 0 || midX > innerW) return null
                    const width = xScale(chr.endNormalized) - xScale(chr.startNormalized)
                    if (width < 15) return null
                    return (
                      <text
                        key={`label-${chr.name}`}
                        x={midX}
                        y={innerH + 15}
                        fontSize="8"
                        textAnchor="middle"
                        fill="#999"
                      >
                        {chr.name}
                      </text>
                    )
                  })}

                  {/* Grid lines */}
                  {yTicks.map(t => (
                    <line key={`yg-${t}`} x1={0} y1={yScale(t)} x2={innerW} y2={yScale(t)} stroke="#eee" />
                  ))}

                  <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#ccc" />
                  <line x1={0} y1={0} x2={0} y2={innerH} stroke="#ccc" />

                  {/* Y ticks */}
                  {yTicks.map(t => (
                    <g key={`yt-${t}`}>
                      <line x1={-4} y1={yScale(t)} x2={0} y2={yScale(t)} stroke="#999" />
                      <text x={-8} y={yScale(t) + 3} fontSize="9" textAnchor="end" fill="#666">{t}</text>
                    </g>
                  ))}

                  <text transform="rotate(-90)" x={-innerH / 2} y={-45} fontSize="11" textAnchor="middle" fill="var(--theme-text, #333)">Significant Phenotypes</text>
                  <text x={innerW / 2} y={innerH + 36} fontSize="11" textAnchor="middle" fill="var(--theme-text, #333)">Genomic Position</text>

                  {genesWithX.map(d => {
                    if (d.sig_phenos_total < 1) return null
                    const cx = xScale(d.xNorm)
                    const cy = yScale(d.sig_phenos_total)
                    if (cx < 0 || cx > innerW || cy < 0 || cy > innerH) return null
                    const chromIdx = chroms.findIndex(c => c.name === d.chrom)
                    const color = CHROM_COLORS[chromIdx % 2] || '#666'
                    return (
                      <circle
                        key={d.gene_id}
                        cx={cx} cy={cy} r={2.5}
                        fill={color} opacity={0.6}
                        style={{ cursor: 'pointer' }}
                        onClick={(e) => { e.stopPropagation(); handleRowClick(d) }}
                      >
                        <title>{d.gene_symbol} (chr{d.chrom}) - {d.sig_phenos_total} sig phenotypes</title>
                      </circle>
                    )
                  })}
                </g>
              </svg>
            )
          })()}

          {plotTab === 'constraint' && (() => {
            if (!filteredData.length) return <div style={{color: '#999', fontSize: 11}}>No data</div>

            const plotData = filteredData.filter((d: GeneSummaryRow) => d.gnomad_oe_lof != null)
            if (!plotData.length) return <div style={{color: '#999', fontSize: 11}}>No constraint data available</div>

            const w = 800, h = 260, pad = {top: 10, right: 20, bottom: 45, left: 60}
            const innerW = w - pad.left - pad.right
            const innerH = h - pad.top - pad.bottom

            const oeLofMax = Math.max(1, max(plotData, (d: GeneSummaryRow) => d.gnomad_oe_lof!) || 2)
            const yMax = Math.max(5, max(plotData, (d: GeneSummaryRow) => d.sig_phenos_total) || 5)

            // X domain: 0 to max, with 0 = most constrained on left
            const xMin = viewport?.xMin ?? 0
            const xMax = viewport?.xMax ?? oeLofMax
            const vpYMin = viewport?.yMin ?? 0
            const vpYMax = viewport?.yMax ?? yMax

            const xScale = scaleLinear().domain([xMin, xMax]).range([0, innerW]).nice()
            const yScale = scaleLinear().domain([vpYMin, vpYMax]).range([innerH, 0]).nice()

            const xTicks = xScale.ticks(6)
            const yTicks = yScale.ticks(5)

            return (
              <svg
                viewBox={`0 0 ${w} ${h}`}
                style={{ width: '100%', height: '100%', overflow: 'visible', userSelect: 'none' }}
                onMouseUp={() => {
                  if (brushStart && brushEnd) {
                    applyBrushZoom(w, h, pad, [xMin, xMax], [vpYMin, vpYMax])
                  } else {
                    setBrushStart(null)
                    setBrushEnd(null)
                  }
                  isDragging.current = false
                }}
              >
                <g transform={`translate(${pad.left},${pad.top})`}>
                  {yTicks.map(t => (
                    <line key={`yg-${t}`} x1={0} y1={yScale(t)} x2={innerW} y2={yScale(t)} stroke="#eee" />
                  ))}

                  <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#ccc" />
                  <line x1={0} y1={0} x2={0} y2={innerH} stroke="#ccc" />

                  {xTicks.map(t => (
                    <g key={`xt-${t}`}>
                      <line x1={xScale(t)} y1={innerH} x2={xScale(t)} y2={innerH + 4} stroke="#999" />
                      <text x={xScale(t)} y={innerH + 15} fontSize="9" textAnchor="middle" fill="#666">{t.toFixed(1)}</text>
                    </g>
                  ))}
                  {yTicks.map(t => (
                    <g key={`yt-${t}`}>
                      <line x1={-4} y1={yScale(t)} x2={0} y2={yScale(t)} stroke="#999" />
                      <text x={-8} y={yScale(t) + 3} fontSize="9" textAnchor="end" fill="#666">{t}</text>
                    </g>
                  ))}

                  <text x={innerW / 2} y={innerH + 36} fontSize="11" textAnchor="middle" fill="var(--theme-text, #333)">LOEUF (Loss-of-Function O/E Upper Bound)</text>
                  <text transform="rotate(-90)" x={-innerH / 2} y={-45} fontSize="11" textAnchor="middle" fill="var(--theme-text, #333)">Significant Phenotypes</text>

                  {/* Constraint annotation zones */}
                  <rect x={xScale(0)} y={0} width={Math.max(0, xScale(0.35) - xScale(0))} height={innerH} fill="rgba(255, 0, 0, 0.03)" />
                  <text x={xScale(0.175)} y={12} fontSize="8" textAnchor="middle" fill="rgba(200,0,0,0.4)">Constrained</text>

                  {plotData.map((d: GeneSummaryRow) => {
                    const cx = xScale(d.gnomad_oe_lof!)
                    const cy = yScale(d.sig_phenos_total)
                    if (cx < 0 || cx > innerW || cy < 0 || cy > innerH) return null
                    return (
                      <circle
                        key={d.gene_id}
                        cx={cx} cy={cy} r={2.5}
                        fill="var(--theme-primary, #262262)" opacity={0.4}
                        style={{ cursor: 'pointer' }}
                        onClick={(e) => { e.stopPropagation(); handleRowClick(d) }}
                      >
                        <title>{d.gene_symbol} (LOEUF: {d.gnomad_oe_lof!.toFixed(3)}, {d.sig_phenos_total} sig phenotypes)</title>
                      </circle>
                    )
                  })}
                </g>
              </svg>
            )
          })()}
        </PlotContainer>
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
