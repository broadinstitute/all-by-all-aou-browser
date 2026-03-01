import styled from 'styled-components'

import { LocusPageDataContainer } from './LocusPageData'
import { GenePageControls } from './GenePageControls'
import { useRecoilState } from 'recoil'
import { hideGeneOptsAtom } from '../sharedState'
import { ShowControlsButton } from '../UserInterface'

const Container = styled.div`
  display: flex;
  flex-direction: row;
  width: 100%;
  height: 100%;
  min-height: 100%;
  max-width: 100%;
  overflow: hidden;
  position: relative;
`

export const LocusPageRoot: React.FC = () => {
  const [hideGeneOptions, setHideGeneOptions] = useRecoilState(hideGeneOptsAtom)
  return (
    <Container>
      <LocusPageDataContainer />
      {!hideGeneOptions && <GenePageControls />}
      {hideGeneOptions && (
        <ShowControlsButton $right onClick={() => setHideGeneOptions(false)}>
          Controls
        </ShowControlsButton>
      )}
    </Container>
  )
}
