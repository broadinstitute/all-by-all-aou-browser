import { useEffect } from 'react'
import { Resizable } from 're-resizable'
import { withSize } from 'react-sizeme'
import { useRecoilValue, useSetRecoilState } from 'recoil'
import styled from 'styled-components'
import GenePhewas from './GenePage/GenePhewas'
import GeneResultsPage from './GeneResults/GeneResultsPage'
import VariantResultsPage from './VariantResults/VariantResultsPage'
import {
  activeSurfaceAtom,
  browserContainerWidthAtom,
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
  canFitTwoPanes,
  getBackToResultsLabel,
  getDetailsContextLabel,
  getResponsiveBrowserShellRenderMode,
  getResponsivePagePadding,
} from './browserShell'
import { useAppNavigation } from './hooks/useAppNavigation'

type SurfaceSize = { width: number; height: number }

const SurfaceViewport = styled.div`
  width: 100%;
  height: 100%;
  min-width: 0;
  overflow: auto;
`

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
    <SurfaceViewport data-browser-surface="results">
      <ResultIndexComponent size={size} />
    </SurfaceViewport>
  )
}

const FocusedDetails = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
`

const FocusedDetailsHeader = styled.nav`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px 16px;
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

  button:focus-visible {
    outline: 3px solid var(--theme-primary, #4f46e5);
    outline-offset: 2px;
  }

  @media (max-width: 600px) {
    padding: 8px 12px;

    .details-context {
      order: 3;
      width: 100%;
    }
  }
`

const FocusedDetailsBody = styled.div`
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: auto;
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
      <FocusedDetailsHeader aria-label="Details navigation">
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
  refreshRate: 100,
})(
  ({
    size,
    item1MinSize,
    item2MinSize,
  }: {
    size?: { width?: number; height?: number }
    item1MinSize: number
    item2MinSize: number
  }) => {
    const experienceMode = useRecoilValue(experienceModeAtom)
    const activeSurface = useRecoilValue(activeSurfaceAtom)
    const resultsLayout = useRecoilValue(resultLayoutAtom)

    const measuredWidth = Number.isFinite(size?.width) ? size?.width : undefined
    const setBrowserContainerWidth = useSetRecoilState(browserContainerWidthAtom)

    useEffect(() => {
      setBrowserContainerWidth(measuredWidth ?? null)
    }, [measuredWidth, setBrowserContainerWidth])

    const defaultWidth = useRecoilValue(
      firstItemWidthSelector({
        containerWidth: measuredWidth ?? 0,
      })
    )
    const windowSize = useRecoilValue(windowSizeAtom)
    const setResizableWidth = useSetRecoilState(resizableWidthAtom)

    const containerHeight = size?.height || windowSize.height
    const leftPanelSize = { width: defaultWidth, height: containerHeight }
    const shellRenderMode = getResponsiveBrowserShellRenderMode(
      experienceMode,
      activeSurface,
      resultsLayout,
      measuredWidth
    )
    const twoPanesFit = canFitTwoPanes(measuredWidth)
    const renderSingleSurface = experienceMode === 'focused' || !twoPanesFit
    const pagePadding = getResponsivePagePadding(measuredWidth)
    const resultsSurfaceSize = {
      width: Math.max(0, (measuredWidth ?? 0) - pagePadding * 2),
      height: containerHeight,
    }

    if (renderSingleSurface) {
      return (
        <div
          data-browser-experience={experienceMode === 'focused' ? 'focused' : 'side-by-side'}
          data-responsive-layout="single-surface"
          data-pane-render-mode={shellRenderMode}
          style={{ height: '100%', width: '100%', overflow: 'auto' }}
        >
          {shellRenderMode === 'results-only' ? (
            <div
              style={{
                boxSizing: 'border-box',
                height: '100%',
                padding: `10px ${pagePadding}px 0`,
              }}
            >
              <ResultsSurface size={resultsSurfaceSize} />
            </div>
          ) : (
            <DetailsSurface focused width={measuredWidth} />
          )}
        </div>
      )
    }

    if (shellRenderMode === 'results-only') {
      return (
        <div
          data-browser-experience="side-by-side"
          data-pane-render-mode="results-only"
          data-responsive-layout="wide"
          style={{
            boxSizing: 'border-box',
            height: '100%',
            overflow: 'auto',
            padding: `10px ${pagePadding}px 0`,
          }}
        >
          <ResultsSurface size={resultsSurfaceSize} />
        </div>
      )
    }

    if (shellRenderMode === 'details-only') {
      return (
        <div
          data-browser-experience="side-by-side"
          data-pane-render-mode="details-only"
          data-responsive-layout="wide"
          style={{ height: '100%', width: '100%' }}
        >
          <DetailsSurface />
        </div>
      )
    }

    return (
      <div
        className="resizable-items"
        data-browser-experience="side-by-side"
        data-responsive-layout="wide"
      >
        <Resizable
          defaultSize={{
            width: defaultWidth,
            height: containerHeight,
          }}
          size={{ width: defaultWidth, height: containerHeight }}
          minWidth={item1MinSize}
          maxWidth={(measuredWidth as number) - item2MinSize}
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
