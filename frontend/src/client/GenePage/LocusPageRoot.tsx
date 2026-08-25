import styled from 'styled-components'

import { LocusPageDataContainer } from './LocusPageData'
import { GenePageControls } from './GenePageControls'
import { useRecoilState, useRecoilValue } from 'recoil'
import {
  analysisIdAtom,
  geneIdAtom,
  hideGeneOptsAtom,
  regionIdAtom,
  variantIdAtom,
} from '../sharedState'
import { ShowControlsButton } from '../UserInterface'

const EmptyState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 2rem;
  color: ${(props) => props.theme.text};
  text-align: center;
`

const Container = styled.div`
  display: flex;
  flex-direction: row;
  width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 100%;
  max-width: 100%;
  overflow: hidden;
  position: relative;

  & > :first-child {
    flex: 1 1 auto;
    min-width: 0;
  }

  @media (max-width: 600px) {
    flex-direction: column;
    overflow-y: auto;

    & > :first-child {
      order: 2;
      flex: 1 1 auto;
      width: 100%;
      min-height: 320px;
    }

    & > :not(:first-child) {
      order: 1;
    }
  }
`

export const LocusPageRoot: React.FC = () => {
  const [hideGeneOptions, setHideGeneOptions] = useRecoilState(hideGeneOptsAtom)
  const analysisId = useRecoilValue(analysisIdAtom)
  const geneId = useRecoilValue(geneIdAtom)
  const regionId = useRecoilValue(regionIdAtom)
  const variantId = useRecoilValue(variantIdAtom)

  if (!analysisId) {
    return <EmptyState>Choose a phenotype to see association details.</EmptyState>
  }

  if (!geneId && !regionId && !variantId) {
    return <EmptyState>Choose a gene, locus, or variant to see details.</EmptyState>
  }

  return (
    <Container>
      <LocusPageDataContainer />
      {!hideGeneOptions && <GenePageControls />}
      {hideGeneOptions && (
        <ShowControlsButton type="button" $right onClick={() => setHideGeneOptions(false)} aria-label="Show controls">
          Controls
        </ShowControlsButton>
      )}
    </Container>
  )
}
