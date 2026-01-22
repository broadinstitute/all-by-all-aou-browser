import { Resizable } from 're-resizable'
import { withSize } from 'react-sizeme'
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil'
import styled from 'styled-components'
import GenePhewas from './GenePage/GenePhewas'
import GeneResultsPage from './GeneResults/GeneResultsPage'
import VariantResultsPage from './VariantResults/VariantResultsPage'
import {
  resultLayoutAtom,
  firstItemWidthSelector,
  resizableWidthAtom,
  useGetActiveItems,
  windowSizeAtom,
} from './sharedState'
import VariantPhewas from './VariantPage/VariantPhewas'
import PhenotypeInfo from './PhenotypeList/PhenotypeInfo'
import TopHitPhewas from './PhenotypeList/TopHitPhewas'
import { LocusPageRoot } from './GenePage/LocusPageRoot'
import LocusPhewas from './GenePage/LocusPhewas'
import AvailableAnalyses from './PhenotypeList/AvailableAnalyses'

const ResizableItems = withSize({
  refreshMode: 'debounce',
  refreshRate: 500,
})(
  ({
    size,
    item1MinSize,
    item2MinSize,
  }: {
    size: { width: number; height: number }
    item1MinSize: number
    item2MinSize: number
  }) => {
    const { resultIndex, variantId } = useGetActiveItems()
    const [resultsLayout, setResultsLayout] = useRecoilState(resultLayoutAtom)

    size = size || { width: undefined, height: undefined }

    const defaultWidth = useRecoilValue(
      firstItemWidthSelector({
        containerWidth: size.width,
      })
    )
    const windowSize = useRecoilValue(windowSizeAtom)
    const setResizableWidth = useSetRecoilState(resizableWidthAtom)

    const leftPanelSize = { width: defaultWidth, height: size.height }

    let borderStyles = {}

    if (resultsLayout !== 'hidden' && resultsLayout !== 'full') {
      borderStyles = { borderRight: '1px dashed black' }
    }

    const closeRightPanel = () => {
      setResultsLayout("hidden")
    }

    const resizableStyles = {
      ...borderStyles,
      paddingRight: '15px',
    }

    let ResultIndexComponent = GenePhewas

    let hideRightPanel = false

    if (resultsLayout === 'full') {
      hideRightPanel = true
    }

    if (resultIndex === 'top-associations') {
      ResultIndexComponent = TopHitPhewas
    }

    if (resultIndex === 'gene-manhattan') {
      ResultIndexComponent = GeneResultsPage
    }

    if (resultIndex === 'variant-manhattan') {
      ResultIndexComponent = VariantResultsPage
    }

    if (resultIndex === 'variant-phewas') {
      if (variantId) ResultIndexComponent = VariantPhewas
    }

    if (resultIndex === 'locus-phewas') {
      ResultIndexComponent = LocusPhewas
    }

    if (resultIndex === 'pheno-info') {
      ResultIndexComponent = PhenotypeInfo
    }

    if (resultIndex === 'analyses') {
      ResultIndexComponent = AvailableAnalyses
    }

    if (hideRightPanel) {
      return (
        <div
          style={{
            height: '100vh',
            overflow: 'scroll',
            paddingRight: 100,
            paddingLeft: 100,
            paddingTop: 40,
          }}
        >
          <ResultIndexComponent size={leftPanelSize} />
        </div>
      )
    }


    return (
      <div className="resizable-items">
        <Resizable
          defaultSize={{
            width: defaultWidth,
            height: windowSize.height,
          }}
          size={{ width: defaultWidth, height: windowSize.height }}
          minWidth={item1MinSize}
          maxWidth={size.width - item2MinSize}
          style={resizableStyles}
          onResizeStop={(_, _2, _3, d) => {
            setResizableWidth(defaultWidth + d.width)
          }}
        >
          <div className="resizable-grid-item1">
            <div className="resizable-inner-container">
              {resultsLayout !== 'hidden' && <FloatingContent><CloseIcon onClick={closeRightPanel}>&times;</CloseIcon></FloatingContent>}
              {resultsLayout !== 'hidden' ? <ResultIndexComponent size={leftPanelSize} /> : null}

            </div>
          </div>
        </Resizable>
        {!hideRightPanel ? (
          <div className="resizable-grid-item2">
            <div className="resizable-inner-container">
              <LocusPageRoot />
            </div>
          </div>
        ) : null}
      </div>
    )
  }
)

const FloatingContent = styled.div`
  position: sticky;
  top: 0;

  display: flex;
  justify-content: flex-end;
  padding-right: 10px;
`

const CloseIcon = styled.div`
  max-width: 50px;
  font-size: 24px;
  cursor: pointer;
  color: black;
  z-index: 10; 
  &:hover {
    color: grey;
  }

`

const Container = styled.div<{ item1Size: number; item2Size: number }>`
  height: 100%;
  min-height: 100%;

  .resizable-items {
    display: flex;
    flex-direction: row;
    width: 100%;
    height: 100%;
  }

  .resizable-grid-item1 {
    min-height: 5em;
    height: 100%;
    width: 100%;
    min-width: ${({ item1Size }) => item1Size}px;
  }

  .resizable-grid-item2 {
    min-height: 5em;
    height: 100%;
    width: 100%;
    min-width: ${({ item2Size }) => item2Size}px;
    padding-right: 0;
  }

  .resizable-inner-container {
    width: 100%;
    height: 100%;
    padding: 10px 0 10px 10px;
    overflow-y: scroll;
    position: relative;
  }
`

export const SplitScreenViewer = () => {
  const item1MinSize = 5
  const item2MinSize = 1

  return (
    <Container item1Size={item1MinSize} item2Size={item2MinSize}>
      <ResizableItems item1MinSize={item1MinSize} item2MinSize={item2MinSize} />
    </Container>
  )
}

