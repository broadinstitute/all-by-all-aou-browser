import React, { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@axaou/ui'
import { useRecoilValue } from 'recoil'
import styled from 'styled-components'

import { axaouDevUrl, cacheEnabled, pouchDbName } from '../Query'
import { ancestryGroupAtom } from '../sharedState'
import { DocumentTitle, Spinner, StatusMessage, ColorMarker } from '../UserInterface'
import { AnalysisMetadata, AggregatedVariantAssociation } from '../types'
import { TopVariantsTable } from './TopVariantsTable'
import { SuperManhattanPlot } from './SuperManhattanPlot'
import { filterValidAnalyses, getAvailableAnalysisIds } from '../utils'
import { getCategoryFromConsequence } from '../vepConsequences'
import { consequenceCategoryColors } from '../GenePage/LocusPagePlots'

const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 100%;
  max-width: 100%;
  align-items: flex-start;
`

const ControlsRow = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  width: 100%;
  flex-wrap: wrap;
  margin-bottom: 8px;
`

const FilterGroup = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 2px;
  border: 1px solid var(--theme-border, #ddd);
  border-radius: 4px;
  overflow: hidden;
`

const FilterButton = styled.button<{ $active: boolean; $color: string }>`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  font-size: 12px;
  font-family: GothamBook, sans-serif;
  background-color: ${({ $active }) => ($active ? '#262262' : 'var(--theme-surface-alt, #f5f5f5)')};
  color: ${({ $active }) => ($active ? 'white' : 'var(--theme-text, #333)')};
  border: none;
  border-right: 1px solid var(--theme-border, #ccc);
  cursor: pointer;
  transition: all 0.15s ease;

  &:last-child {
    border-right: none;
  }

  &:hover {
    background-color: ${({ $active }) => ($active ? '#262262' : 'var(--theme-border, #e0e0e0)')};
  }
`

const SearchInput = styled.input`
  padding: 6px 12px;
  border: 1px solid var(--theme-border, #ddd);
  border-radius: 4px;
  font-size: 13px;
  min-width: 250px;

  &:focus {
    outline: none;
    border-color: #262262;
  }
`

const CountBadge = styled.span`
  font-size: 12px;
  color: var(--theme-text-muted, #666);
  margin-left: auto;
`

const CONSEQUENCE_FILTERS = [
  { key: 'lof', label: 'pLoF', color: consequenceCategoryColors.lof },
  { key: 'missense', label: 'Missense', color: consequenceCategoryColors.missense },
  { key: 'synonymous', label: 'Synonymous', color: consequenceCategoryColors.synonymous },
  { key: 'other', label: 'Other', color: consequenceCategoryColors.other },
] as const

type ConsequenceCategory = typeof CONSEQUENCE_FILTERS[number]['key']

interface Data {
  topVariants: AggregatedVariantAssociation[]
  analysesMetadata: AnalysisMetadata[]
  availableAnalyses: any[]
  categories: any[]
}

const TopVariantsPhewas = () => {
  const ancestryGroup = useRecoilValue(ancestryGroupAtom)
  const [inputValue, setInputValue] = useState('')
  const [debouncedSearchText, setDebouncedSearchText] = useState('')
  const [limit, setLimit] = useState(50000)

  const [colorBy, setColorBy] = useState<'consequence' | 'category' | 'keyword'>('consequence')
  const [highlightKeyword, setHighlightKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')

  const [activeCategories, setActiveCategories] = useState<Record<ConsequenceCategory, boolean>>({
    lof: true,
    missense: true,
    synonymous: true,
    other: true,
  })

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchText(inputValue)
    }, 500)
    return () => clearTimeout(timer)
  }, [inputValue])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(highlightKeyword)
    }, 300)
    return () => clearTimeout(timer)
  }, [highlightKeyword])

  const toggleCategory = (key: ConsequenceCategory) => {
    setActiveCategories((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const activeCategoryKeys = CONSEQUENCE_FILTERS.filter(f => activeCategories[f.key]).map(f => f.key).join(',')
  const limitParam = limit

  const searchParam = debouncedSearchText ? `&search=${encodeURIComponent(debouncedSearchText)}` : ''
  const catParam = activeCategoryKeys ? `&categories=${activeCategoryKeys}` : ''

  const { queryStates, anyLoading } = useQuery<Data>({
    dbName: pouchDbName,
    queries: [
      { url: `${axaouDevUrl}/analyses?ancestry_group=${ancestryGroup}`, name: 'analysesMetadata' },
      {
        url: `${axaouDevUrl}/variants/associations/top-aggregated?ancestry=${ancestryGroup}&limit=${limitParam}${searchParam}${catParam}`,
        name: 'topVariants',
      },
      {
        url: `${axaouDevUrl}/analyses-loaded`,
        name: 'availableAnalyses',
      },
      {
        url: `${axaouDevUrl}/categories`,
        name: 'categories',
      },
    ],
    deps: [ancestryGroup, limitParam, debouncedSearchText, activeCategoryKeys],
    cacheEnabled,
  })

  const categoryColorMap = useMemo(() => {
    const m = new Map<string, string>()
    const cats = queryStates.categories?.data
    if (cats) cats.forEach((c: any) => m.set(c.category, c.color))
    return m
  }, [queryStates.categories?.data])

  const isFirstLoad = anyLoading() && !queryStates.topVariants?.data;

  if (isFirstLoad) {
    return (
      <Container>
        <Spinner />
      </Container>
    )
  }

  const { analysesMetadata, topVariants, availableAnalyses } = queryStates

  if (topVariants.error || analysesMetadata.error) {
    return (
      <Container>
        <StatusMessage>
          Error loading data: {topVariants.error?.message || analysesMetadata.error?.message}
        </StatusMessage>
      </Container>
    )
  }

  if (!topVariants.data || !analysesMetadata.data) {
    return (
      <Container>
        <StatusMessage>No Variant PheWAS Data Found</StatusMessage>
      </Container>
    )
  }

  const availableIds = getAvailableAnalysisIds(availableAnalyses.data)
  const validMetadata = filterValidAnalyses(analysesMetadata.data, availableIds)

  const annotatedVariants = topVariants.data
    .map((v: AggregatedVariantAssociation) => {
      const meta = validMetadata.find((m: AnalysisMetadata) => m.analysis_id === v.top_phenotype)
      const category = v.consequence
        ? getCategoryFromConsequence(v.consequence)
        : 'other'
      const matchedMeta = v.matched_phenotype
        ? analysesMetadata.data.find((m: AnalysisMetadata) => m.analysis_id === v.matched_phenotype)
        : null
      return {
        ...v,
        top_phenotype_description: meta ? meta.description : v.top_phenotype,
        top_phenotype_category: meta ? meta.category : 'Unknown',
        consequence_category: category,
        matched_phenotype_description: matchedMeta
          ? matchedMeta.description
          : v.matched_phenotype || null,
      }
    })
    .filter((v: any) =>
      validMetadata.some((m: AnalysisMetadata) => m.analysis_id === v.top_phenotype)
    )

  const onVariantClick = (variant: any) => {
    const params = new URLSearchParams(window.location.search)
    const stateStr = params.get('state')
    const state = stateStr ? JSON.parse(stateStr) : {}
    state.variantId = variant.variant_id
    state.analysisId = variant.top_phenotype
    state.resultIndex = 'variant-phewas'
    state.resultLayout = 'half'
    state.regionId = null
    if (variant.gene_id) state.geneId = variant.gene_id
    params.set('state', JSON.stringify(state))
    window.open(`${window.location.pathname}?${params.toString()}`, '_blank')
  }

  return (
    <Container>
      <DocumentTitle title={`Top Variants`} />
      <h3 className="app-section-title" style={{ width: '100%', marginTop: 20 }}>
        <strong>Top single variant associations</strong> (P-value &lt; 1e-6)
      </h3>
      <ControlsRow>
        <FilterGroup>
          {CONSEQUENCE_FILTERS.map((f) => (
            <FilterButton
              key={f.key}
              $active={activeCategories[f.key]}
              $color={f.color}
              onClick={() => toggleCategory(f.key)}
            >
              <ColorMarker color={f.color} />
              {f.label}
            </FilterButton>
          ))}
        </FilterGroup>
        <SearchInput
          placeholder="Search variant, gene, or phenotype..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: 'var(--theme-text)' }}>Limit:</span>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            style={{
              padding: '4px 8px',
              border: '1px solid var(--theme-border, #ddd)',
              borderRadius: '4px',
              fontSize: '13px',
              background: 'var(--theme-surface)',
              color: 'var(--theme-text)'
            }}
          >
            <option value={1000}>1,000</option>
            <option value={5000}>5,000</option>
            <option value={10000}>10,000</option>
            <option value={50000}>50,000</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
          <span style={{ fontSize: '13px', color: 'var(--theme-text)' }}>Color by:</span>
          <select
            value={colorBy}
            onChange={(e) => setColorBy(e.target.value as 'consequence' | 'category' | 'keyword')}
            style={{
              padding: '4px 8px',
              border: '1px solid var(--theme-border, #ddd)',
              borderRadius: '4px',
              fontSize: '13px',
              background: 'var(--theme-surface)',
              color: 'var(--theme-text)'
            }}
          >
            <option value="consequence">Consequence</option>
            <option value="category">Phenotype Category</option>
            <option value="keyword">Keyword Match</option>
          </select>
        </div>
        {colorBy === 'keyword' && (
          <SearchInput
            placeholder="Keyword to highlight..."
            value={highlightKeyword}
            onChange={(e) => setHighlightKeyword(e.target.value)}
            style={{ minWidth: 150 }}
          />
        )}
        <CountBadge style={{ marginLeft: 0 }}>
          {anyLoading() ? (
            <span>Loading...</span>
          ) : (
            `${annotatedVariants.length.toLocaleString()} variants`
          )}
        </CountBadge>
      </ControlsRow>

      {anyLoading() && annotatedVariants.length === 0 ? (
        <div style={{ width: '100%', height: 400 + 24 + 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--theme-surface-alt, #f9f9f9)', borderRadius: 4 }}>
          <Spinner />
        </div>
      ) : annotatedVariants.length > 0 ? (
        <div style={{ position: 'relative', width: '100%' }}>
          {anyLoading() && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.5)', zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4 }}>
              <Spinner />
            </div>
          )}
          <SuperManhattanPlot
            variants={annotatedVariants}
            categories={queryStates.categories?.data || []}
            colorBy={colorBy}
            highlightKeyword={debouncedKeyword}
            onVariantClick={onVariantClick}
          />
        </div>
      ) : null}

      <TopVariantsTable
        variants={annotatedVariants}
        onVariantClick={onVariantClick}
        categoryColors={categoryColorMap}
      />
    </Container>
  )
}

export default TopVariantsPhewas
