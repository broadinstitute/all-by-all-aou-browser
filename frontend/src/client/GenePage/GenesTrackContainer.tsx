import React, { useContext } from 'react'
import styled from 'styled-components'

import { GenesTrack, RegionViewerContext } from '@axaou/ui'

import { GeneAssociations, GeneModels } from '../types'
import { useRecoilValue, useSetRecoilState } from 'recoil'
import { analysisIdAtom, geneIdAtom, regionIdAtom, resultIndexAtom } from '../sharedState'
import { LocusGeneContextMenu } from '../Manhattan/components/LocusGeneContextMenu'

const Container = styled.div``

interface Props {
  geneModelsInRegion: GeneModels[]
  geneAssociations?: GeneAssociations[]
  locusMaf?: number
}

const GenesTrackContainer: React.FC<Props> = ({ geneModelsInRegion, geneAssociations = [], locusMaf }) => {
  const setGeneId = useSetRecoilState(geneIdAtom)
  const setRegionId = useSetRecoilState(regionIdAtom)
  const setResultsIndex = useSetRecoilState(resultIndexAtom)
  const currentAnalysisId = useRecoilValue(analysisIdAtom)

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

  const [contextMenu, setContextMenu] = React.useState<{x: number, y: number, gene: any} | null>(null);

  // Build gene burden map to highlight significant burden associations
  const SIG_THRESHOLD = 2.5e-6
  const geneBurdenMap: Record<string, string[]> = {}

  geneAssociations.forEach((assoc) => {
    // Filter by MAF if locusMaf is specified
    if (locusMaf !== undefined && assoc.max_maf !== locusMaf) {
      return
    }

    const hasSig =
      (assoc.pvalue && assoc.pvalue < SIG_THRESHOLD) ||
      (assoc.pvalue_burden && assoc.pvalue_burden < SIG_THRESHOLD) ||
      (assoc.pvalue_skat && assoc.pvalue_skat < SIG_THRESHOLD)

    if (hasSig && assoc.gene_id) {
      if (!geneBurdenMap[assoc.gene_id]) {
        geneBurdenMap[assoc.gene_id] = []
      }
      if (!geneBurdenMap[assoc.gene_id].includes(assoc.annotation)) {
        geneBurdenMap[assoc.gene_id].push(assoc.annotation)
      }
    }
  })

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
        onGeneContextMenu={(gene, e) => {
          setContextMenu({ x: e.clientX, y: e.clientY, gene });
        }}
        geneBurdenMap={geneBurdenMap}
      />
      {contextMenu && (
        <LocusGeneContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          gene={{
            geneId: contextMenu.gene.gene_id,
            geneSymbol: contextMenu.gene.symbol,
            contig: contextMenu.gene.contig,
            start: contextMenu.gene.start,
            stop: contextMenu.gene.stop
          }}
          currentPhenotypeDescription={currentAnalysisId || undefined}
          onClose={() => setContextMenu(null)}
        />
      )}
    </Container>
  )
}

export default GenesTrackContainer
