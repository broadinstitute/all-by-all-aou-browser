import React, { useContext } from 'react'
import styled from 'styled-components'

import { GenesTrack, RegionViewerContext } from '@axaou/ui'

import { GeneModels } from '../types'
import { useSetRecoilState } from 'recoil'
import { geneIdAtom, regionIdAtom, resultIndexAtom } from '../sharedState'

const Container = styled.div``

interface Props {
  geneModelsInRegion: GeneModels[]
}

const GenesTrackContainer: React.FC<Props> = ({ geneModelsInRegion }) => {
  const setGeneId = useSetRecoilState(geneIdAtom)
  const setRegionId = useSetRecoilState(regionIdAtom)
  const setResultsIndex = useSetRecoilState(resultIndexAtom)

  const { scalePosition, centerPanelWidth, leftPanelWidth, rightPanelWidth, isPositionDefined } =
    useContext(RegionViewerContext)

  const filterGenes = (genes: GeneModels[]) => {
    return genes;
  }
  const geneModels = filterGenes(geneModelsInRegion)

  const onClickGene = (gene: any) => {
    setGeneId(gene.gene_id)
    setRegionId(null)
    setResultsIndex("gene-phewas")
  }

  return (
    <Container>
      <GenesTrack
        scalePosition={scalePosition}
        leftPanelWidth={leftPanelWidth}
        rightPanelWidth={rightPanelWidth}
        width={centerPanelWidth}
        genes={geneModels}
        title={'Genes'}
        onGeneClick={onClickGene}
      />
    </Container>
  )
}

export default GenesTrackContainer
