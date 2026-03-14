import React, { useState, useMemo } from 'react'
import { Grid } from '@axaou/ui'
import { useQuery } from '@axaou/ui'
import styled from 'styled-components'
import { scaleLinear, scaleBand } from 'd3-scale'
import { max } from 'd3-array'

import { axaouDevUrl, cacheEnabled, pouchDbName } from '../Query'
import { Spinner, StatusMessage } from '../UserInterface'
import { useAppNavigation } from '../hooks/useAppNavigation'
import RangeSlider from './RangeSlider'
import { modifyCategoryColor, CategoriesResponse } from './phenotypeUtils'
import CategoryFilter from '../Shared/CategoryFilter'

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
  categories: CategoriesResponse[]
}

const AllPhenotypesTab = () => {
  const { openInNewTab } = useAppNavigation()
  const [searchText, setSearchText] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState('sig_loci_count')
  const [sortOrder, setSortOrder] = useState<'ascending' | 'descending'>('descending')

  const [casesRange, setCasesRange] = useState<[number, number]>([0, 1000000])
  const [sigLociRange, setSigLociRange] = useState<[number, number]>([0, 5000])
  const [plotTab, setPlotTab] = useState<'scatter' | 'bar'>('scatter')

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

  const dataBounds = useMemo(() => {
    if (!data || data.length === 0) return { maxCases: 1000000, maxLoci: 5000 }
    return {
      maxCases: max(data, (d: PhenotypeSummaryRow) => d.n_cases) || 1000000,
      maxLoci: max(data, (d: PhenotypeSummaryRow) => d.sig_loci_count) || 5000
    }
  }, [data])

  React.useEffect(() => {
    if (data && data.length > 0) {
      setCasesRange([0, dataBounds.maxCases])
      setSigLociRange([0, dataBounds.maxLoci])
    }
  }, [dataBounds, data])

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

  // Initialize selectedCategories when categories first load
  React.useEffect(() => {
    if (categories.length > 0 && selectedCategories.size === 0) {
      setSelectedCategories(new Set(categories.map(c => c.category)))
    }
  }, [categories])

  const filteredData = useMemo(() => {
    if (!data) return []
    let result = data

    // Category Filter
    result = result.filter((r: PhenotypeSummaryRow) => selectedCategories.has(r.category))

    // Numeric Ranges
    result = result.filter((r: PhenotypeSummaryRow) =>
      r.n_cases >= casesRange[0] && r.n_cases <= casesRange[1] &&
      r.sig_loci_count >= sigLociRange[0] && r.sig_loci_count <= sigLociRange[1]
    )

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
  }, [data, searchText, selectedCategories, casesRange, sigLociRange, sortKey, sortOrder])

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
        <SliderGroup>
          <div className="slider-label">Sample Size (Cases)</div>
          {data && (
            <RangeSlider
              presetInterval={[0, dataBounds.maxCases]}
              initialValues={casesRange}
              onIntervalChange={setCasesRange}
              step={100}
              showInputs={true}
            />
          )}
        </SliderGroup>

        <SliderGroup>
          <div className="slider-label">Significant Loci</div>
          {data && (
            <RangeSlider
              presetInterval={[0, dataBounds.maxLoci]}
              initialValues={sigLociRange}
              onIntervalChange={setSigLociRange}
              step={1}
              showInputs={true}
            />
          )}
        </SliderGroup>

        <div style={{ marginLeft: 'auto', fontSize: '13px', color: 'var(--theme-text-muted)' }}>
          Showing {filteredData.length} phenotypes
        </div>
      </ControlsRow>

      <PlotWithSidebar>
        <PlotArea>
          <PlotTabs>
            <PlotTab $active={plotTab === 'scatter'} onClick={() => setPlotTab('scatter')}>Discovery Yield</PlotTab>
            <PlotTab $active={plotTab === 'bar'} onClick={() => setPlotTab('bar')}>Category Distribution</PlotTab>
          </PlotTabs>

          {plotTab === 'scatter' && (() => {
          if (!filteredData.length) return <div style={{color: '#999', fontSize: 11}}>No data</div>
          const w = 600, h = 230, pad = {top: 10, right: 20, bottom: 45, left: 60}
          const innerW = w - pad.left - pad.right
          const innerH = h - pad.top - pad.bottom

          const xMax = Math.max(10, dataBounds.maxCases)
          const xScale = scaleLinear().domain([0, xMax]).range([0, innerW]).nice()

          const yMax = Math.max(10, dataBounds.maxLoci)
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
                    <text x={xScale(t)} y={innerH + 15} fontSize="9" textAnchor="middle" fill="#666">{t >= 1000 ? `${(t/1000).toLocaleString()}k` : t}</text>
                  </g>
                ))}
                {/* Y ticks */}
                {yTicks.map(t => (
                  <g key={`yt-${t}`}>
                    <line x1={-4} y1={yScale(t)} x2={0} y2={yScale(t)} stroke="#999" />
                    <text x={-8} y={yScale(t) + 3} fontSize="9" textAnchor="end" fill="#666">{t.toLocaleString()}</text>
                  </g>
                ))}

                {/* Axis labels */}
                <text x={innerW / 2} y={innerH + 36} fontSize="11" textAnchor="middle" fill="var(--theme-text, #333)">Number of Cases</text>
                <text transform="rotate(-90)" x={-innerH / 2} y={-45} fontSize="11" textAnchor="middle" fill="var(--theme-text, #333)">Significant Loci</text>

                {filteredData.map((d: PhenotypeSummaryRow) => {
                  const cx = xScale(d.n_cases)
                  const cy = yScale(d.sig_loci_count)
                  const color = categoryColorMap.get(d.category) || '#999'
                  return (
                    <circle
                      key={d.analysis_id}
                      cx={cx} cy={cy} r={3}
                      fill={color} opacity={0.6}
                    >
                      <title>{d.description} ({d.sig_loci_count} loci, {d.n_cases.toLocaleString()} cases)</title>
                    </circle>
                  )
                })}
              </g>
            </svg>
          )
        })()}

        {plotTab === 'bar' && (() => {
          if (!filteredData.length) return <div style={{color: '#999', fontSize: 11}}>No data</div>

          const counts: Record<string, number> = {}
          filteredData.forEach((d: PhenotypeSummaryRow) => {
            counts[d.category] = (counts[d.category] || 0) + 1
          })

          const w = 600, h = 230, pad = {top: 10, right: 20, bottom: 60, left: 60}
          const innerW = w - pad.left - pad.right
          const innerH = h - pad.top - pad.bottom

          const sortedCats = Object.entries(counts).sort((a,b) => b[1] - a[1])

          const xScale = scaleBand()
            .domain(sortedCats.map(d => d[0]))
            .range([0, innerW])
            .paddingInner(0.2)

          const yMax = Math.max(10, ...sortedCats.map(d => d[1]))
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

                {/* Y axis label */}
                <text transform="rotate(-90)" x={-innerH / 2} y={-45} fontSize="11" textAnchor="middle" fill="var(--theme-text, #333)">Number of Phenotypes</text>

                {sortedCats.map(([cat, count]) => {
                  const color = categoryColorMap.get(cat) || '#999'
                  const x = xScale(cat)!
                  const y = yScale(count)
                  const bw = xScale.bandwidth()
                  const bh = innerH - y
                  const shortCat = cat.length > 14 ? cat.substring(0,12) + '...' : cat

                  return (
                    <g key={cat}>
                      <rect x={x} y={y} width={bw} height={bh} fill={color}>
                        <title>{cat}: {count}</title>
                      </rect>
                      <text
                        x={x + bw/2} y={innerH + 10}
                        fontSize="8" fill="#666" textAnchor="end"
                        transform={`rotate(-45, ${x + bw/2}, ${innerH + 10})`}
                      >
                        {shortCat}
                      </text>
                    </g>
                  )
                })}
              </g>
            </svg>
          )
        })()}
        </PlotArea>

        <SidebarArea>
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
