import React, { useState, useMemo, useCallback, useRef } from 'react'
import { Grid } from '@axaou/ui'
import { useQuery } from '@axaou/ui'
import styled from 'styled-components'
import { scaleLinear } from 'd3-scale'
import { max, sum } from 'd3-array'

import { axaouDevUrl, cacheEnabled, pouchDbName } from '../Query'
import { Spinner, StatusMessage } from '../UserInterface'
import { useAppNavigation } from '../hooks/useAppNavigation'
import { modifyCategoryColor, CategoriesResponse } from './phenotypeUtils'
import CategoryFilter from '../Shared/CategoryFilter'

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

const PlotWithSidebar = styled.div`
  display: flex;
  flex-direction: row;
  gap: 0;
  margin-bottom: 20px;
  border: 1px solid var(--theme-border, #ddd);
  border-radius: 6px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  overflow: hidden;
`

const PlotArea = styled.div`
  flex: 1;
  padding: 12px;
  display: flex;
  flex-direction: column;
  min-width: 0;
`

const SidebarArea = styled.div`
  width: 220px;
  min-width: 220px;
  border-left: 1px solid var(--theme-border, #ddd);
  background: var(--theme-surface, #fff);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
`

const PlotControls = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
  border-bottom: 1px solid var(--theme-border, #ddd);
  padding-bottom: 8px;
`

const AxisSelect = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;

  label {
    color: var(--theme-text-muted, #888);
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  select {
    font-size: 11px;
    padding: 2px 4px;
    border: 1px solid var(--theme-border, #ddd);
    border-radius: 3px;
    background: var(--theme-surface, #fff);
    color: var(--theme-text, #333);
  }
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

type XAxisField = 'n_cases' | 'n_controls'
type YAxisField = 'sig_loci_count' | 'sig_variants_count' | 'sig_genes_count' | 'lambda_gc_exome'
type ColorByField = 'category' | 'trait_type'

const X_AXIS_OPTIONS: { value: XAxisField; label: string }[] = [
  { value: 'n_cases', label: 'Cases' },
  { value: 'n_controls', label: 'Controls' },
]

const Y_AXIS_OPTIONS: { value: YAxisField; label: string }[] = [
  { value: 'sig_loci_count', label: 'Sig Loci' },
  { value: 'sig_variants_count', label: 'Sig Variants' },
  { value: 'sig_genes_count', label: 'Sig Genes' },
  { value: 'lambda_gc_exome', label: 'Lambda GC' },
]

const COLOR_BY_OPTIONS: { value: ColorByField; label: string }[] = [
  { value: 'category', label: 'Category' },
  { value: 'trait_type', label: 'Trait Type' },
]

const SEX_COLORS: Record<string, string> = {
  both_sexes: '#666',
  females: '#e377c2',
  males: '#1f77b4',
}

const TRAIT_TYPE_COLORS: Record<string, string> = {
  continuous: '#4363d8',
  binary: '#e6194b',
  categorical: '#f58231',
}

interface PhenotypeSummaryRow {
  analysis_id: string
  description: string
  category: string
  trait_type: string
  pheno_sex: string
  lambda_gc_exome: number | null
  n_cases: number
  n_controls: number
  sig_variants_count: number
  sig_loci_count: number
  sig_genes_count: number
}

interface Data {
  summary: PhenotypeSummaryRow[]
  categories: CategoriesResponse[]
}

interface Viewport {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
}

const AllPhenotypesTab = () => {
  const { openInNewTab } = useAppNavigation()
  const [searchText, setSearchText] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set())
  const [selectedTraitTypes, setSelectedTraitTypes] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState('sig_loci_count')
  const [sortOrder, setSortOrder] = useState<'ascending' | 'descending'>('descending')

  const [xAxis, setXAxis] = useState<XAxisField>('n_cases')
  const [yAxis, setYAxis] = useState<YAxisField>('sig_loci_count')
  const [colorBy, setColorBy] = useState<ColorByField>('category')

  const [viewport, setViewport] = useState<Viewport | null>(null)
  const [brushStart, setBrushStart] = useState<{ x: number; y: number } | null>(null)
  const [brushEnd, setBrushEnd] = useState<{ x: number; y: number } | null>(null)
  const isDragging = useRef(false)
  const plotContainerRef = useRef<HTMLDivElement>(null)

  const { queryStates, anyLoading } = useQuery<Data>({
    dbName: pouchDbName,
    queries: [
      { url: `${axaouDevUrl}/phenotypes/summary`, name: 'summary' },
      { url: `${axaouDevUrl}/categories`, name: 'categories' },
    ],
    deps: [],
    cacheEnabled,
  })

  const { data, error } = queryStates.summary || {}
  const { data: categoriesData } = queryStates.categories || {}

  const categories = useMemo(() => {
    if (!categoriesData) return []
    return (categoriesData as CategoriesResponse[]).map(modifyCategoryColor)
  }, [categoriesData])

  const categoryColorMap = useMemo(() => {
    const map = new Map<string, string>()
    categories.forEach((c) => map.set(c.category, c.color))
    return map
  }, [categories])

  const categoryFilterItems = useMemo(() => {
    return categories.map((c) => ({
      category: c.category,
      color: c.color,
      count: c.analysisCount,
    }))
  }, [categories])

  React.useEffect(() => {
    if (categories.length > 0 && selectedCategories.size === 0) {
      setSelectedCategories(new Set(categories.map(c => c.category)))
    }
  }, [categories])

  const traitTypeFilterItems = useMemo(() => {
    if (!data) return []
    const counts: Record<string, number> = {}
    data.forEach((d: PhenotypeSummaryRow) => {
      counts[d.trait_type] = (counts[d.trait_type] || 0) + 1
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([tt, count]) => ({
        category: tt,
        color: TRAIT_TYPE_COLORS[tt] || '#999',
        count,
      }))
  }, [data])

  React.useEffect(() => {
    if (traitTypeFilterItems.length > 0 && selectedTraitTypes.size === 0) {
      setSelectedTraitTypes(new Set(traitTypeFilterItems.map(t => t.category)))
    }
  }, [traitTypeFilterItems])

  // Reset viewport when axes change
  React.useEffect(() => {
    setViewport(null)
  }, [xAxis, yAxis])

  const aggregates = useMemo(() => {
    if (!data || data.length === 0) return null
    return {
      totalPhenotypes: data.length,
      totalCases: sum(data, (d: PhenotypeSummaryRow) => d.n_cases),
      totalSigVariants: sum(data, (d: PhenotypeSummaryRow) => d.sig_variants_count),
      totalSigLoci: sum(data, (d: PhenotypeSummaryRow) => d.sig_loci_count),
      totalSigGenes: sum(data, (d: PhenotypeSummaryRow) => d.sig_genes_count),
    }
  }, [data])

  const filteredData = useMemo(() => {
    if (!data) return []
    let result = data

    result = result.filter((r: PhenotypeSummaryRow) => selectedCategories.has(r.category))
    result = result.filter((r: PhenotypeSummaryRow) => selectedTraitTypes.has(r.trait_type))

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
  }, [data, searchText, selectedCategories, selectedTraitTypes, sortKey, sortOrder])

  const handleRowClick = (row: PhenotypeSummaryRow) => {
    openInNewTab({
      analysisId: row.analysis_id,
      resultIndex: 'pheno-info',
      resultLayout: 'full',
    })
  }

  const getFieldValue = (d: PhenotypeSummaryRow, field: XAxisField | YAxisField): number | null => {
    if (field === 'lambda_gc_exome') return d.lambda_gc_exome
    return d[field] as number
  }

  const getColor = (d: PhenotypeSummaryRow): string => {
    if (colorBy === 'category') return categoryColorMap.get(d.category) || '#999'
    if (colorBy === 'trait_type') return TRAIT_TYPE_COLORS[d.trait_type] || '#999'
    return '#999'
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

  const handleMouseUp = useCallback(() => {
    if (!isDragging.current || !brushStart || !brushEnd) {
      isDragging.current = false
      setBrushStart(null)
      setBrushEnd(null)
      return
    }
    isDragging.current = false

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

    // SVG viewBox dimensions
    const svgW = 600, svgH = 230
    const pad = { top: 10, right: 20, bottom: 45, left: 60 }
    const innerW = svgW - pad.left - pad.right
    const innerH = svgH - pad.top - pad.bottom

    // Convert pixel positions to SVG coordinates
    const scaleX = svgW / containerW
    const scaleY = svgH / containerH

    const svgX1 = Math.min(brushStart.x, brushEnd.x) * scaleX - pad.left
    const svgX2 = Math.max(brushStart.x, brushEnd.x) * scaleX - pad.left
    const svgY1 = Math.min(brushStart.y, brushEnd.y) * scaleY - pad.top
    const svgY2 = Math.max(brushStart.y, brushEnd.y) * scaleY - pad.top

    // We need the current scale domains to invert
    const plotData = filteredData.filter((d: PhenotypeSummaryRow) => {
      const xv = getFieldValue(d, xAxis)
      const yv = getFieldValue(d, yAxis)
      return xv !== null && yv !== null
    })

    const xValues = plotData.map((d: PhenotypeSummaryRow) => getFieldValue(d, xAxis)!)
    const yValues = plotData.map((d: PhenotypeSummaryRow) => getFieldValue(d, yAxis)!)

    const currentXMin = viewport?.xMin ?? 0
    const currentXMax = viewport?.xMax ?? Math.max(10, max(xValues) || 10)
    const currentYMin = viewport?.yMin ?? Math.min(0, ...(yAxis === 'lambda_gc_exome' ? yValues : [0]))
    const currentYMax = viewport?.yMax ?? Math.max(10, max(yValues) || 10)

    const xScale = scaleLinear().domain([currentXMin, currentXMax]).range([0, innerW])
    const yScale = scaleLinear().domain([currentYMin, currentYMax]).range([innerH, 0])

    const newXMin = xScale.invert(Math.max(0, svgX1))
    const newXMax = xScale.invert(Math.min(innerW, svgX2))
    const newYMin = yScale.invert(Math.min(innerH, svgY2))
    const newYMax = yScale.invert(Math.max(0, svgY1))

    setViewport({ xMin: newXMin, xMax: newXMax, yMin: newYMin, yMax: newYMax })
    setBrushStart(null)
    setBrushEnd(null)
  }, [brushStart, brushEnd, filteredData, xAxis, yAxis, viewport])

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
      key: 'trait_type',
      heading: 'Trait Type',
      isSortable: true,
      minWidth: 100,
      grow: 0,
    },
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
    {
      key: 'lambda_gc_exome',
      heading: 'Lambda GC',
      isSortable: true,
      minWidth: 100,
      grow: 0,
      render: (row: PhenotypeSummaryRow) => row.lambda_gc_exome != null ? row.lambda_gc_exome.toFixed(3) : '-',
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
          <DetailItem><span className="label">Phenotypes</span><span className="value">{aggregates.totalPhenotypes.toLocaleString()}</span></DetailItem>
          <DetailItem><span className="label">Total Cases</span><span className="value">{aggregates.totalCases.toLocaleString()}</span></DetailItem>
          <DetailItem><span className="label">Sig Variants</span><span className="value">{aggregates.totalSigVariants.toLocaleString()}</span></DetailItem>
          <DetailItem><span className="label">Sig Loci</span><span className="value">{aggregates.totalSigLoci.toLocaleString()}</span></DetailItem>
          <DetailItem><span className="label">Sig Genes</span><span className="value">{aggregates.totalSigGenes.toLocaleString()}</span></DetailItem>
        </CompactHeader>
      )}

      <ControlsRow>
        <SearchInput
          placeholder="Search description or ID..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <div style={{ marginLeft: 'auto', fontSize: '13px', color: 'var(--theme-text-muted)' }}>
          Showing {filteredData.length} phenotypes
        </div>
      </ControlsRow>

      <PlotWithSidebar>
        <PlotArea>
          <PlotControls>
            <AxisSelect>
              <label>X:</label>
              <select value={xAxis} onChange={(e) => setXAxis(e.target.value as XAxisField)}>
                {X_AXIS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </AxisSelect>
            <AxisSelect>
              <label>Y:</label>
              <select value={yAxis} onChange={(e) => setYAxis(e.target.value as YAxisField)}>
                {Y_AXIS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </AxisSelect>
            <AxisSelect>
              <label>Color:</label>
              <select value={colorBy} onChange={(e) => setColorBy(e.target.value as ColorByField)}>
                {COLOR_BY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </AxisSelect>
          </PlotControls>

          <PlotContainer
            ref={plotContainerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
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

          {(() => {
            if (!filteredData.length) return <div style={{color: '#999', fontSize: 11}}>No data</div>

            const plotData = filteredData.filter((d: PhenotypeSummaryRow) => {
              const xv = getFieldValue(d, xAxis)
              const yv = getFieldValue(d, yAxis)
              return xv !== null && yv !== null
            })

            const w = 600, h = 230, pad = {top: 10, right: 20, bottom: 45, left: 60}
            const innerW = w - pad.left - pad.right
            const innerH = h - pad.top - pad.bottom

            const xValues = plotData.map((d: PhenotypeSummaryRow) => getFieldValue(d, xAxis)!)
            const yValues = plotData.map((d: PhenotypeSummaryRow) => getFieldValue(d, yAxis)!)

            const dataXMin = yAxis === 'lambda_gc_exome' ? 0 : 0
            const dataXMax = Math.max(10, max(xValues) || 10)
            const dataYMin = yAxis === 'lambda_gc_exome' ? Math.min(0.5, ...yValues) : 0
            const dataYMax = Math.max(1, max(yValues) || 10)

            const xMin = viewport?.xMin ?? dataXMin
            const xMax = viewport?.xMax ?? dataXMax
            const yMin = viewport?.yMin ?? dataYMin
            const yMax = viewport?.yMax ?? dataYMax

            const xScale = scaleLinear().domain([xMin, xMax]).range([0, innerW]).nice()
            const yScale = scaleLinear().domain([yMin, yMax]).range([innerH, 0]).nice()

            const xTicks = xScale.ticks(6)
            const yTicks = yScale.ticks(5)

            const xLabel = X_AXIS_OPTIONS.find(o => o.value === xAxis)?.label || ''
            const yLabel = Y_AXIS_OPTIONS.find(o => o.value === yAxis)?.label || ''

            return (
              <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: '100%', overflow: 'visible', userSelect: 'none' }}>
                <g transform={`translate(${pad.left},${pad.top})`}>
                  {yTicks.map(t => (
                    <line key={`yg-${t}`} x1={0} y1={yScale(t)} x2={innerW} y2={yScale(t)} stroke="#eee" />
                  ))}

                  <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#ccc" />
                  <line x1={0} y1={0} x2={0} y2={innerH} stroke="#ccc" />

                  {xTicks.map(t => (
                    <g key={`xt-${t}`}>
                      <line x1={xScale(t)} y1={innerH} x2={xScale(t)} y2={innerH + 4} stroke="#999" />
                      <text x={xScale(t)} y={innerH + 15} fontSize="9" textAnchor="middle" fill="#666">{t >= 1000 ? `${(t/1000).toLocaleString()}k` : t}</text>
                    </g>
                  ))}
                  {yTicks.map(t => (
                    <g key={`yt-${t}`}>
                      <line x1={-4} y1={yScale(t)} x2={0} y2={yScale(t)} stroke="#999" />
                      <text x={-8} y={yScale(t) + 3} fontSize="9" textAnchor="end" fill="#666">
                        {yAxis === 'lambda_gc_exome' ? t.toFixed(2) : t.toLocaleString()}
                      </text>
                    </g>
                  ))}

                  <text x={innerW / 2} y={innerH + 36} fontSize="11" textAnchor="middle" fill="var(--theme-text, #333)">{xLabel}</text>
                  <text transform="rotate(-90)" x={-innerH / 2} y={-45} fontSize="11" textAnchor="middle" fill="var(--theme-text, #333)">{yLabel}</text>

                  {plotData.map((d: PhenotypeSummaryRow) => {
                    const xv = getFieldValue(d, xAxis)!
                    const yv = getFieldValue(d, yAxis)!
                    const cx = xScale(xv)
                    const cy = yScale(yv)
                    if (cx < 0 || cx > innerW || cy < 0 || cy > innerH) return null
                    const color = getColor(d)
                    return (
                      <circle
                        key={d.analysis_id}
                        cx={cx} cy={cy} r={3}
                        fill={color} opacity={0.6}
                        style={{ cursor: 'pointer' }}
                        onClick={(e) => { e.stopPropagation(); handleRowClick(d) }}
                      >
                        <title>{d.description} ({yLabel}: {yAxis === 'lambda_gc_exome' && yv != null ? yv.toFixed(3) : yv?.toLocaleString()}, {xLabel}: {xv.toLocaleString()})</title>
                      </circle>
                    )
                  })}
                </g>
              </svg>
            )
          })()}
          </PlotContainer>
        </PlotArea>

        <SidebarArea>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', padding: '6px 8px', color: 'var(--theme-text-muted, #888)', borderBottom: '1px solid var(--theme-border, #ddd)' }}>Category</div>
          <CategoryFilter
            categories={categoryFilterItems}
            selectedCategories={selectedCategories}
            onToggleCategory={(cat) => {
              setSelectedCategories(prev => {
                const next = new Set(prev)
                if (next.has(cat)) next.delete(cat)
                else next.add(cat)
                return next
              })
            }}
            onSelectAll={() => setSelectedCategories(new Set(categories.map(c => c.category)))}
            onSelectNone={() => setSelectedCategories(new Set())}
          />
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', padding: '6px 8px', color: 'var(--theme-text-muted, #888)', borderTop: '2px solid var(--theme-border, #ddd)', borderBottom: '1px solid var(--theme-border, #ddd)' }}>Trait Type</div>
          <CategoryFilter
            categories={traitTypeFilterItems}
            selectedCategories={selectedTraitTypes}
            onToggleCategory={(tt) => {
              setSelectedTraitTypes(prev => {
                const next = new Set(prev)
                if (next.has(tt)) next.delete(tt)
                else next.add(tt)
                return next
              })
            }}
            onSelectAll={() => setSelectedTraitTypes(new Set(traitTypeFilterItems.map(t => t.category)))}
            onSelectNone={() => setSelectedTraitTypes(new Set())}
          />
        </SidebarArea>
      </PlotWithSidebar>

      <div style={{ height: 'calc(100vh - 450px)' }}>
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
