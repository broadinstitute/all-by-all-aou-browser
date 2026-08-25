import React from 'react'
import styled from 'styled-components'

import { useQuery } from '@axaou/ui'
import { useRecoilState, useRecoilValue, useResetRecoilState } from 'recoil'
import { axaouDevUrl, cacheEnabled, pouchDbName } from './Query'
import {
  browserContainerWidthAtom,
  experienceModeAtom,
  resultLayoutAtom,
  resizableWidthAtom,
  themeModeAtom,
  useGetActiveItems
} from './sharedState'
import { AnalysisMetadata, GeneModels } from './types'
import {
  ExperienceModeToggle,
  LayoutToggle,
  LayoutMode,
  ThemeToggle,
} from './UserInterface'
import { getAnalysisDisplayTitle } from './utils'
import { useAppNavigation } from './hooks/useAppNavigation'
import { canFitTwoPanes, shouldShowLayoutControls } from './browserShell'

const Container = styled.div<{ $compact?: boolean }>`
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 20px;
  box-sizing: border-box;
  min-height: 2.5em;
  width: 100%;
  background-color: ${(props) => props.theme.surfaceAlt};
  border-bottom: 1px dashed ${(props) => props.theme.border};
  padding: 6px clamp(10px, 2vw, 20px);
  color: ${(props) => props.theme.text};
  font-size: 16px;

  .status-bar-item {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .narrow-mode-note {
    color: var(--theme-text-muted, #666);
    font-size: 12px;
    white-space: normal;
  }

  ${({ $compact }) => $compact && `
    align-items: flex-start;
    font-size: 14px;

    .mode-option-description {
      display: none;
    }

    .narrow-mode-note {
      flex-basis: 100%;
      order: 3;
    }
  `}

  strong {
    margin-right: 3px;
  }
`

const StatusControls = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-left: auto;

  @media (max-width: 700px) {
    flex-basis: 100%;
    margin-left: 0;
  }
`

const StatusLink = styled.button`
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--theme-primary, #262262);
  cursor: pointer;
  font: inherit;
  text-decoration: underline;

  &:hover {
    background: transparent;
  }

  &:focus-visible {
    outline: 3px solid var(--theme-primary, #4f46e5);
    outline-offset: 2px;
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

  const experienceMode = useRecoilValue(experienceModeAtom)
  const resultsLayout = useRecoilValue(resultLayoutAtom)
  const browserContainerWidth = useRecoilValue(browserContainerWidthAtom)
  const twoPanesFit = canFitTwoPanes(browserContainerWidth)
  const showLayoutControls = shouldShowLayoutControls(
    experienceMode,
    browserContainerWidth
  )
  const {
    goToGene,
    goToPhenotype,
    goToVariant,
    setExperienceMode,
    setSideBySideLayout,
  } = useAppNavigation()
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
    <Container $compact={!twoPanesFit}>
      {analysisId && analysisMetadataData && analysisMetadataData[0] && (
        <div className='status-bar-item'>
          <strong>Phenotype:</strong>
          <StatusLink type="button" onClick={() => {
            goToPhenotype(analysisId, {
              destination: 'overview',
              keepContext: true,
              resultIndex: 'pheno-info',
            })
          }} aria-label={`Open phenotype ${getAnalysisDisplayTitle(analysisMetadataData[0])}`}>
            {getAnalysisDisplayTitle(analysisMetadataData[0])}
          </StatusLink>
          {selectedAnalyses.length > 1 ? ` + ${selectedAnalyses.length - 1} more selected` : ''}
        </div>
      )}
      {geneModel && geneId && geneId !== 'undefined' && (
        <div className='status-bar-item'>
          <strong>Gene:</strong>
          <StatusLink
            type="button"
            aria-label={`Open gene results for ${geneModel.symbol}`}
            onClick={() => {
              goToGene(geneId, {
                destination: 'phewas',
                fromPhenotype: true,
                resultIndex: 'gene-phewas',
              })
            }}
          >
            {`${geneModel.symbol} `} ({geneId})
          </StatusLink>
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
          <StatusLink
            type="button"
            aria-label={`Open variant results for ${variantId}`}
            onClick={() => {
              goToVariant(variantId, {
                destination: 'phewas',
                resultIndex: 'variant-phewas',
              })
            }}
          >
            {variantId}
          </StatusLink>
        </div>
      )}
      <StatusControls className="status-bar-item">
        <ExperienceModeToggle
          value={experienceMode}
          onChange={setExperienceMode}
        />
        {showLayoutControls && (
          <LayoutToggle
            value={resultsLayout as LayoutMode}
            onChange={(mode) => {
              setSideBySideLayout(mode)
              resetResizableWidth()
            }}
            rightLabel={rightLabel}
          />
        )}
        <ThemeToggleWrapper />
      </StatusControls>
      {experienceMode === 'sideBySide' && !twoPanesFit && (
        <span className="narrow-mode-note" role="status">
          One page at a time at this width; your Side-by-side layout is preserved.
        </span>
      )}
    </Container>
  )
}
