import React, { useState } from 'react'
import styled from 'styled-components'

import { Link, ExternalLink } from '@gnomad/ui'
import { useQuery } from '@axaou/ui'
import { useRecoilState, useSetRecoilState } from 'recoil'
import { axaouDevUrl, cacheEnabled, pouchDbName } from './Query'
import {
  resultIndexAtom,
  resultLayoutAtom,
  useGetActiveItems
} from './sharedState'
import { AnalysisMetadata, GeneModels } from './types'
import { ColorMarker, TogglePaneButton } from './UserInterface'
import { getAnalysisDisplayTitle } from './utils'
import AriaModal from "react-aria-modal";

const Container = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  min-height: 2.5em;
  width: 100%;
  background-color: whitesmoke;
  border-bottom: 1px dashed black;
  padding-left: 20px;
  font: black;
  font-size: 16px;

  .status-bar-item {
    margin-right: 20px;
  }

  strong {
    margin-right: 3px;
  }
`

const NoticeContainer = styled.div`
  padding: 20px;
  background-color: white;
  border-radius: 5px;
  width: 50%;
  margin: 0 auto;
  font-size: 16px;

  h1 {
    font-size: 24px;
    margin-bottom: 20px;
  }

  p {
    margin-bottom: 1em;
    line-height: 1.4;
  }

  button {
    float: right;
    margin-top: -10px;
    margin-right: -10px;
    background-color: #262262;
    color: white;
    border: none;
    padding: 8px 12px;
    border-radius: 4px;
    cursor: pointer;
  }
`;

const DataUpdateNotice: React.FC = () => {
  const [isModalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div
        className="status-bar-item"
        onClick={() => setModalOpen(true)}
        style={{ cursor: "pointer", marginLeft: 20, fontSize: 16 }}
      >
        ℹ️ Data Update Notice
      </div>
      {isModalOpen && (
        <AriaModal
          titleText="Data Update Notice"
          onExit={() => setModalOpen(false)}
          initialFocus="#close-button"
        >
          <NoticeContainer>
            <button
              id="close-button"
              onClick={() => setModalOpen(false)}
            >
              Close
            </button>
            <h1>Data Update Notice</h1>
            <p>
              The <em>All of Us</em> Researcher Workbench team released an incremental update for the All by All tables related to the Personal and Family Health History (PFHH) and Phecode phenotypes to align with data processing and quality assurance. <ExternalLink href="https://support.researchallofus.org/hc/en-us/articles/34401312793748">Visit the User Support Hub for more information</ExternalLink>.

            </p>
          </NoticeContainer>
        </AriaModal>
      )}
    </>
  );
};

interface Data {
  geneModels: GeneModels[] | null
  analysisMetadata: AnalysisMetadata[] | null
}

const Message: React.FC<{ message: string }> = ({ message }) => <Container>{message}</Container>

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


  const { geneId, analysisId, regionId, variantId, burdenSet, selectedAnalyses } = useGetActiveItems()

  const setResultIndex = useSetRecoilState(resultIndexAtom)
  const [resultsLayout, setResultsLayout] = useRecoilState(resultLayoutAtom)

  const { queryStates } = useQuery<Data>({
    dbName: pouchDbName,
    queries: [
      { url: `${axaouDevUrl}/analyses/${analysisId}`, name: 'analysisMetadata' },
      {
        url: `${axaouDevUrl}/genes/model/${geneId}`,
        name: 'geneModels',
      },
    ],
    deps: [geneId, analysisId],
    cacheEnabled,
  })

  const isAnyLoading = Object.values(queryStates).some((state) => state.isLoading)
  if (isAnyLoading) return <Container />

  const isAnyError = Object.values(queryStates).some((state) => state.error)
  if (isAnyError) {
    const errorMessage = Object.values(queryStates)
      .filter((state) => state.error)
      .map((state) => state.error?.message)
      .join(', ')
    return <Message message={`An error has occurred: ${errorMessage}`} />
  }

  const { geneModels, analysisMetadata } = queryStates

  if (!geneModels.data) return <Message message='Could not fetch gene model' />
  if (!analysisMetadata.data) return <Message message='Could not fetch analysis metadata' />

  const geneModel = geneModels.data[0]

  let burdenMarkerColor = 'grey'

  if (burdenSet === 'pLoF') {
    burdenMarkerColor = '#FF583F'
  } else if (burdenSet === 'missenseLC') {
    burdenMarkerColor = '#F0C94D'
  } else {
    burdenMarkerColor = '#757575'
  }

  return (
    <Container>
      <div className="status-bar-item">
        <TogglePaneButton
          paneIsClosed={resultsLayout === 'hidden'}
          tooltip={resultsLayout === 'hidden' ? "Expand left-hand panel" : "Collapse left-hand panel"}
          onClick={() =>
            setResultsLayout(resultsLayout === 'hidden' ? 'half' : 'hidden')
          }
        />
      </div>
      {analysisId && (
        <div className='status-bar-item'>
          <strong>Phenotype:</strong>
          <Link onClick={() => {
            setResultIndex('pheno-info')
            setResultsLayout('half')
          }
          } style={{ cursor: 'pointer' }}>
            {getAnalysisDisplayTitle(analysisMetadata.data[0])}
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
              setResultsLayout('half')
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
              setResultsLayout('half')
            }}
          >
            {variantId}
          </Link>
        </div>
      )}
      {/* <div className='status-bar-item'> */}
      {/*   <strong>Ancestry group:</strong> */}
      {/*   <select */}
      {/*     value={ancestryGroup} */}
      {/*     onChange={(e) => setAncestryGroup(e.target.value as AncestryGroupCodes)} */}
      {/*   > */}
      {/*     <option value='afr'>AFR</option> */}
      {/*     <option value='amr'>AMR</option> */}
      {/*     <option value='eas'>EAS</option> */}
      {/*     <option value='eur'>EUR</option> */}
      {/*     <option value='mid'>MID</option> */}
      {/*     <option value='sas'>SAS</option> */}
      {/*     <option value='meta'>META</option> */}
      {/*   </select> */}
      {/* </div> */}
      {/* <div className='status-bar-item'> */}
      {/*   <strong>Sequencing type:</strong> */}
      {/*   <select */}
      {/*     value={sequencingType} */}
      {/*     onChange={(e) => setSequencingType(e.target.value as SequencingType)} */}
      {/*   > */}
      {/*     <option value='genomes'>WGS</option> */}
      {/*     <option value='exomes'>WES</option> */}
      {/*     <option value='exomes_and_genomes'>WES + WGS</option> */}
      {/*     {/* <option value='genomes'>WES + WGS</option> */}
      {/*   </select> */}
      {/* </div> */}
      <div className='status-bar-item'>
        <strong>Burden set:</strong>
        <ColorMarker color={burdenMarkerColor} />
        {burdenSet}
      </div>
      <DataUpdateNotice />
      {/* <Link */}
      {/*   style={{ cursor: 'pointer' }} */}
      {/*   onClick={() => { */}
      {/*     setResultIndex('analyses') */}
      {/*     setResultsLayout('half') */}
      {/*   }} */}
      {/* > */}
      {/*   Analyses */}
      {/* </Link> */}
      <div className='status-bar-item' style={{ marginLeft: 'auto', marginRight: 50 }}>
        <TogglePaneButton
          paneIsClosed={resultsLayout === 'full'}
          direction="right"
          tooltip={resultsLayout === 'full' ? "Expand right-hand panel" : "Collapse right-hand panel"}
          onClick={() =>
            setResultsLayout(resultsLayout === 'full' ? 'half' : 'full')
          }
        />
      </div>
    </Container>
  )
}
