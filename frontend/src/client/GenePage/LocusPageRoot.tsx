import styled from 'styled-components'

import { LocusPageDataContainer } from './LocusPageData'
import { GenePageControls } from './GenePageControls'
import { useRecoilValue } from 'recoil'
import { hideGeneOptsAtom } from '../sharedState'

const Container = styled.div`
  display: flex;
  flex-direction: row;
  width: 100%;
  height: 100%;
  min-height: 100%;
  max-width: 100%;
  overflow: hidden;
`

export const LocusPageRoot: React.FC = () => {
  const hideGeneOptions = useRecoilValue(hideGeneOptsAtom)
  return (
    <Container>
      <LocusPageDataContainer />
      {!hideGeneOptions && <GenePageControls />}
    </Container>
  )
}
