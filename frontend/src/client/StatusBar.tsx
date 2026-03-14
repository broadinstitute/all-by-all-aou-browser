import React from 'react'
import styled from 'styled-components'

import { Link } from '@gnomad/ui'
import { useQuery } from '@axaou/ui'
import { useRecoilState, useSetRecoilState, useResetRecoilState } from 'recoil'
import { axaouDevUrl, cacheEnabled, pouchDbName } from './Query'
import {
  resultIndexAtom,
  resultLayoutAtom,
  resizableWidthAtom,
  themeModeAtom,
  useGetActiveItems
} from './sharedState'
import { AnalysisMetadata, GeneModels } from './types'
import { LayoutToggle, LayoutMode, ThemeToggle } from './UserInterface'
import { getAnalysisDisplayTitle } from './utils'
const Container = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  min-height: 2.5em;
  width: 100%;
  background-color: ${(props) => props.theme.surfaceAlt};
  border-bottom: 1px dashed ${(props) => props.theme.border};
  padding-left: 20px;
  color: ${(props) => props.theme.text};
  font-size: 16px;

  .status-bar-item {
    margin-right: 20px;
  }

  strong {
    margin-right: 3px;
  }
`

interface Data {
  geneModels: GeneModels[] | null
  analysisMetadata: AnalysisMetadata[] | null
}

const Message: React.FC<{ message: string }> = ({ message }) => <Container>{message}</Container>

const ThemeToggleWrapper: React.FC = () => {
  const [themeMode, setThemeMode] = useRecoilState(themeModeAtom)
  return (
    <ThemeToggle
      value={themeMode}
      onChange={setThemeMode}
    />
  )
}

export const StatusBar: React.FC = () => {


  if (location.pathname === '/') {
    return null
  }

  if (location.pathname === '/about') {
    return null
  }

  if (location.pathname === '/terms') {
    return null
  }

  if (location.pathname === '/downloads') {
    return null
  }

  if (location.pathname === '/top-associations') {
    return null
  }

  if (location.pathname === '/phenotype-results') {
    return null
  }

  if (location.pathname === '/gene-results') {
    return null
  }

  if (location.pathname === '/walkthrough') {
    return null
  }


  const { geneId, analysisId, regionId, variantId, selectedAnalyses } = useGetActiveItems()

  const setResultIndex = useSetRecoilState(resultIndexAtom)
  const [resultsLayout, setResultsLayout] = useRecoilState(resultLayoutAtom)
  const resetResizableWidth = useResetRecoilState(resizableWidthAtom)

  // Build queries conditionally to prevent 404s from null/undefined IDs
  const queries: Array<{ url: string; name: string }> = []
  if (analysisId && analysisId !== 'null' && analysisId !== 'undefined') {
    queries.push({ url: `${axaouDevUrl}/analyses/${analysisId}`, name: 'analysisMetadata' })
  }
  if (geneId && geneId !== 'null' && geneId !== 'undefined') {
    queries.push({ url: `${axaouDevUrl}/genes/model/${geneId}`, name: 'geneModels' })
  }

  const { queryStates } = useQuery<Data>({
    dbName: pouchDbName,
    queries,
    deps: [geneId, analysisId],
    cacheEnabled,
  })

  const isAnyLoading = Object.values(queryStates).some((state) => state?.isLoading)
  if (isAnyLoading) return <Container />

  const isAnyError = Object.values(queryStates).some((state) => state?.error)
  if (isAnyError) {
    const errorMessage = Object.values(queryStates)
      .filter((state) => state?.error)
      .map((state) => state?.error?.message)
      .join(', ')
    return <Message message={`An error has occurred: ${errorMessage}`} />
  }

  // Get data if queries were made (queries are conditionally added)
  const geneModelsData = queryStates.geneModels?.data ?? null
  const analysisMetadataData = queryStates.analysisMetadata?.data ?? null
  const geneModel = geneModelsData?.[0] ?? null

  // Determine the right-side label based on what's active
  const rightLabel = regionId ? 'Locus' : geneId && geneId !== 'undefined' ? 'Gene' : 'Details';

  return (
    <Container>
      {analysisId && analysisMetadataData && analysisMetadataData[0] && (
        <div className='status-bar-item'>
          <strong>Phenotype:</strong>
          <Link onClick={() => {
            setResultIndex('pheno-info')
            setResultsLayout('split')
          }
          } style={{ cursor: 'pointer' }}>
            {getAnalysisDisplayTitle(analysisMetadataData[0])}
          </Link>
          {selectedAnalyses.length > 1 ? ` + ${selectedAnalyses.length - 1} more selected` : ''}
        </div>
      )}
      {geneModel && geneId && geneId !== 'undefined' && (
        <div className='status-bar-item'>
          <strong>Gene:</strong>
          <Link
            style={{ cursor: 'pointer' }}
            onClick={() => {
              setResultIndex('gene-phewas')
              setResultsLayout('split')
            }}
          >
            {`${geneModel.symbol} `} ({geneId})
          </Link>
        </div>
      )}
      {regionId && (
        <div className='status-bar-item'>
          <strong>Region:</strong>
          {`chr${regionId}`.replace("-", ":")}
        </div>
      )}
      {variantId && (
        <div className='status-bar-item'>
          <strong>Variant:</strong>
          <Link
            style={{ cursor: 'pointer' }}
            onClick={() => {
              setResultIndex('variant-phewas')
              setResultsLayout('split')
            }}
          >
            {variantId}
          </Link>
        </div>
      )}
      <div className="status-bar-item" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, marginRight: 20 }}>
        <LayoutToggle
          value={resultsLayout as LayoutMode}
          onChange={(mode) => {
            setResultsLayout(mode)
            resetResizableWidth()
          }}
          rightLabel={rightLabel}
        />
        <ThemeToggleWrapper />
      </div>
    </Container>
  )
}
