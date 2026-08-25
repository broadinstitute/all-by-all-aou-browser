import { Resizable } from 're-resizable'
import { withSize } from 'react-sizeme'
import { useRecoilValue, useSetRecoilState } from 'recoil'
import styled from 'styled-components'
import GenePhewas from './GenePage/GenePhewas'
import GeneResultsPage from './GeneResults/GeneResultsPage'
import VariantResultsPage from './VariantResults/VariantResultsPage'
import {
  activeSurfaceAtom,
  experienceModeAtom,
  resultLayoutAtom,
  firstItemWidthSelector,
  resizableWidthAtom,
  useGetActiveItems,
  windowSizeAtom,
} from './sharedState'
import VariantPhewas from './VariantPage/VariantPhewas'
import PhenotypePageLayout from './PhenotypeList/PhenotypePageLayout'
import TopResultsLayout from './TopResultsLayout'
import { LocusPageRoot } from './GenePage/LocusPageRoot'
import LocusPhewas from './GenePage/LocusPhewas'
import AvailableAnalyses from './PhenotypeList/AvailableAnalyses'
import {
  canCompareSideBySide,
  getBackToResultsLabel,
  getBrowserShellRenderMode,
  getDetailsContextLabel,
} from './browserShell'
import { useAppNavigation } from './hooks/useAppNavigation'

type SurfaceSize = { width: number; height: number }

export const ResultsSurface = ({ size }: { size: SurfaceSize }) => {
  const { resultIndex, variantId } = useGetActiveItems()
  let ResultIndexComponent = GenePhewas

  if (resultIndex === 'top-associations') ResultIndexComponent = TopResultsLayout
  if (resultIndex === 'gene-manhattan') ResultIndexComponent = GeneResultsPage
  if (resultIndex === 'variant-manhattan') ResultIndexComponent = VariantResultsPage
  if (resultIndex === 'variant-phewas' && variantId) ResultIndexComponent = VariantPhewas
  if (resultIndex === 'locus-phewas') ResultIndexComponent = LocusPhewas
  if (resultIndex === 'pheno-info') ResultIndexComponent = PhenotypePageLayout
  if (resultIndex === 'analyses') ResultIndexComponent = AvailableAnalyses

  return (
    <div data-browser-surface="results" style={{ height: '100%' }}>
      <ResultIndexComponent size={size} />
    </div>
  )
}

const FocusedDetails = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
`

const FocusedDetailsHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 0 0 auto;
  padding: 10px 18px;
  border-bottom: 1px solid var(--theme-border, #ddd);
  background: var(--theme-surface-alt, #f5f5f5);

  button {
    padding: 8px 14px;
    cursor: pointer;
    font-weight: 600;
  }

  .back-to-results {
    border-color: #262262;
    background: #262262;
    color: white;
  }

  .details-context {
    min-width: 0;
    overflow: hidden;
    color: var(--theme-text-muted, #555);
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .compare-surfaces {
    margin-left: auto;
  }
`

const FocusedDetailsBody = styled.div`
  flex: 1 1 auto;
  min-height: 0;
`

export const DetailsSurface = ({
  focused = false,
  width,
}: {
  focused?: boolean
  width?: number
}) => {
  const { analysisId, geneId, regionId, variantId, resultIndex } = useGetActiveItems()
  const { compareSideBySide, openResultsPane } = useAppNavigation()

  if (!focused) {
    return (
      <div data-browser-surface="details" style={{ height: '100%', width: '100%' }}>
        <LocusPageRoot />
      </div>
    )
  }

  const showCompare = canCompareSideBySide({
    width,
    analysisId,
    geneId,
    regionId,
    variantId,
  })

  return (
    <FocusedDetails data-browser-surface="details">
      <FocusedDetailsHeader aria-label="Focused details navigation">
        <button
          type="button"
          className="back-to-results"
          onClick={openResultsPane}
          title="Return to the results page you came from"
        >
          ← {getBackToResultsLabel(resultIndex)}
        </button>
        <div className="details-context" aria-live="polite">
          {getDetailsContextLabel({ analysisId, geneId, regionId, variantId })}
        </div>
        {showCompare && (
          <button
            type="button"
            className="compare-surfaces"
            onClick={compareSideBySide}
          >
            Compare side by side
          </button>
        )}
      </FocusedDetailsHeader>
      <FocusedDetailsBody>
        <LocusPageRoot />
      </FocusedDetailsBody>
    </FocusedDetails>
  )
}

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
    const experienceMode = useRecoilValue(experienceModeAtom)
    const activeSurface = useRecoilValue(activeSurfaceAtom)
    const resultsLayout = useRecoilValue(resultLayoutAtom)

    size = size || { width: undefined, height: undefined }

    const defaultWidth = useRecoilValue(
      firstItemWidthSelector({
        containerWidth: size.width,
      })
    )
    const windowSize = useRecoilValue(windowSizeAtom)
    const setResizableWidth = useSetRecoilState(resizableWidthAtom)

    const containerHeight = size.height || windowSize.height
    const leftPanelSize = { width: defaultWidth, height: containerHeight }
    const shellRenderMode = getBrowserShellRenderMode(
      experienceMode,
      activeSurface,
      resultsLayout
    )

    if (experienceMode === 'focused') {
      return (
        <div
          data-browser-experience="focused"
          data-pane-render-mode={shellRenderMode}
          style={{ height: '100%', width: '100%', overflow: 'auto' }}
        >
          {shellRenderMode === 'results-only' ? (
            <div style={{ height: '100%', padding: '10px 100px 0' }}>
              <ResultsSurface size={{ width: size.width, height: containerHeight }} />
            </div>
          ) : (
            <DetailsSurface focused width={size.width} />
          )}
        </div>
      )
    }

    if (shellRenderMode === 'results-only') {
      return (
        <div
          data-browser-experience="side-by-side"
          data-pane-render-mode="results-only"
          style={{ height: '100%', overflow: 'auto', padding: '10px 100px 0' }}
        >
          <ResultsSurface size={leftPanelSize} />
        </div>
      )
    }

    if (shellRenderMode === 'details-only') {
      return (
        <div
          data-browser-experience="side-by-side"
          data-pane-render-mode="details-only"
          style={{ height: '100%', width: '100%' }}
        >
          <DetailsSurface />
        </div>
      )
    }

    return (
      <div className="resizable-items" data-browser-experience="side-by-side">
        <Resizable
          defaultSize={{
            width: defaultWidth,
            height: containerHeight,
          }}
          size={{ width: defaultWidth, height: containerHeight }}
          minWidth={item1MinSize}
          maxWidth={size.width - item2MinSize}
          style={{
            borderRight: '1px dashed var(--theme-border, black)',
            paddingRight: '15px',
          }}
          onResizeStop={(_, _2, _3, d) => {
            setResizableWidth(defaultWidth + d.width)
          }}
        >
          <div className="resizable-grid-item1">
            <div className="resizable-inner-container">
              <ResultsSurface size={leftPanelSize} />
            </div>
          </div>
        </Resizable>
        <div className="resizable-grid-item2">
          <div className="resizable-inner-container">
            <DetailsSurface />
          </div>
        </div>
      </div>
    )
  }
)

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
    padding: 0 0 20px 10px;
    overflow-y: auto;
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
