import React from 'react'
import styled from 'styled-components'
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil'
import { hoveredVariantAtom, multiAnalysisVariantDetailsAtom } from '../variantState'
import { sortBy } from 'lodash'
import { hoveredAnalysisAtom } from '../sharedState'
import { renderPvalueCell } from '../PhenotypeList/Utils'

const Container = styled.div`
  margin-right: 10px;
  margin-left: 10px;

  h3 {
    font-size: 14px;
  }

  .analyses-list {
    display: flex;
    flex-direction: column;
    max-height: 250px;
    overflow-y: scroll;
    margin-top: 10px;
  }

  .analysis-item {
    display: grid;
    grid: min-content min-content / 1fr 1fr;
    grid-gap: 0.5em;
    padding-top: 0.5em;
    padding-bottom: 0.5em;
    border-top: 1px dashed black;
    border-top: 1px dashed black;
  }

  .analysis-description {
    grid-column-start: span 2;
    font-weight: bold;
  }

  .analysis-value {
    grid-column-start: span 1;
  }

  .analysis-active {
    background-color: lightgray;
  }
`

export const VariantDetails: React.FC = () => {
  const variantDetails = useRecoilValue(multiAnalysisVariantDetailsAtom)
  const [hoveredAnalysis, setHoveredAnalysis] = useRecoilState(hoveredAnalysisAtom)
  const setHoveredVariant = useSetRecoilState(hoveredVariantAtom)

  if (!variantDetails) {
    return <Container />
  }

  const { variant_id, analyses, hgvsc, hgvsp } = variantDetails
  const analysesDisplayed = sortBy(analyses, (a) => a.pvalue).map((analysis) => {
    return (
      <div
        className={`analysis-item ${hoveredAnalysis === analysis.analysis_id && 'analysis-active'}`}
        onMouseEnter={() => {
          setHoveredAnalysis(analysis.analysis_id)
          setHoveredVariant(variant_id)
        }}
        onMouseLeave={() => {
          setHoveredAnalysis(null)
          setHoveredVariant(null)
        }}
        key={`${analysis.analysis_id}`}
      >
        <div className='analysis-description'>{analysis.description}</div>
        <div className='analyses-value'>
          <strong>Pval: </strong>
          {renderPvalueCell('variant')(analysis, 'pvalue')}
        </div>
        <div className='analyses-value'>
          <strong>Beta: </strong>
          {analysis.beta.toPrecision(3)}
        </div>
      </div>
    )
  })

  return (
    <Container>
      <h3>
        <strong>{variant_id}</strong>
      </h3>
      <p>
        <strong>HGVSp: </strong>
        {hgvsp}
      </p>
      <p>
        <strong>HGVSc: </strong>
        {hgvsc}
      </p>
      <div className='analyses-list'>{analysesDisplayed}</div>
    </Container>
  )
}
