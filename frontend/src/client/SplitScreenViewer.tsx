import { ReactNode, useEffect, useRef } from 'react'
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
  canFitTwoPanes,
  getResponsiveBrowserShellRenderPolicy,
  getResponsivePagePadding,
  getRetainedSurfaceMounts,
  getRetainedSurfaceVisibility,
} from './browserShell'
import { FocusedWorkspaceHeader } from './FocusedWorkspaceHeader'
import { useBrowserSurfaceScrollRestoration } from './browserSurfaceScrollRestoration'

type SurfaceSize = { width: number; height: number }

const SurfaceViewport = styled.div`
  width: 100%;
  height: 100%;
  min-width: 0;
  overflow: visible;

  /* The browser shell or split pane owns vertical scrolling. Keeping this
     surface non-scrolling puts the page scrollbar at the viewport edge rather
     than inset inside the results content padding. */
`

const RetainedSurface = styled.div`
  width: 100%;
  height: 100%;

  &[hidden] {
    display: none !important;
  }
`

const KeepAliveSurface = ({
  active,
  mounted,
  surface,
  children,
}: {
  active: boolean
  mounted: boolean
  surface: 'results' | 'details'
  children: ReactNode
}) => {
  if (!mounted) return null

  const visibility = getRetainedSurfaceVisibility(active)
  return (
    <RetainedSurface
      data-retained-browser-surface={surface}
      hidden={visibility.hidden}
      aria-hidden={visibility.ariaHidden}
      ref={(node) => {
        node?.toggleAttribute('inert', visibility.inert)
      }}
    >
      {children}
    </RetainedSurface>
  )
}

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

const FocusedDetailsBody = styled.div`
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
`

export const DetailsSurface = ({
  focused = false,
  width,
}: {
  focused?: boolean
  width?: number
}) => {
  const { analysisId, geneId, regionId, variantId } = useGetActiveItems()

  if (!focused) {
    return (
      <div data-browser-surface="details" style={{ height: '100%', width: '100%' }}>
        <LocusPageRoot />
      </div>
    )
  }

  return (
    <FocusedDetails data-browser-surface="details">
      <FocusedWorkspaceHeader
        analysisId={analysisId}
        geneId={geneId}
        regionId={regionId}
        variantId={variantId}
        width={width}
      />
      <FocusedDetailsBody>
        <LocusPageRoot />
      </FocusedDetailsBody>
    </FocusedDetails>
  )
}

const FocusedVariantDocument = styled.article`
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-width: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scroll-behavior: smooth;
`

const FocusedVariantContent = styled.div<{ $padding: number }>`
  box-sizing: border-box;
  width: 100%;
  max-width: 1800px;
  margin: 0 auto;
  padding: 12px ${({ $padding }) => $padding}px 48px;
`

const GenomicContextSection = styled.section`
  width: 100%;
  min-width: 0;
  margin-top: 15px;
  padding-top: 8px;
  border-top: 1px solid var(--theme-border, #ddd);

  & > h2 {
    margin: 0 0 16px;
  }
`

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
    const { analysisId, geneId, regionId, variantId } = useGetActiveItems()

    const measuredWidth = Number.isFinite(size?.width) ? size?.width : undefined
    const setBrowserContainerWidth = useSetRecoilState(browserContainerWidthAtom)
    const resultsScrollRef = useBrowserSurfaceScrollRestoration<HTMLElement>()

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
    const renderPolicy = getResponsiveBrowserShellRenderPolicy({
      experienceMode,
      activeSurface,
      resultLayout: resultsLayout,
      width: measuredWidth,
      variantId,
    })
    const twoPanesFit = canFitTwoPanes(measuredWidth)
    const pagePadding = getResponsivePagePadding(measuredWidth)
    const resultsSurfaceSize = {
      width: Math.max(0, (measuredWidth ?? 0) - pagePadding * 2),
      height: containerHeight,
    }
    const retainedSurfaceMounts = useRef({ results: false, details: false })

    if (renderPolicy.kind === 'stacked-variant') {
      return (
        <FocusedVariantDocument
          ref={resultsScrollRef}
          aria-labelledby="focused-variant-title"
          data-browser-experience="focused"
          data-focused-variant-workspace="stacked"
          data-pane-render-mode="stacked-variant"
          data-responsive-layout="single-document"
        >
          <FocusedWorkspaceHeader
            analysisId={analysisId}
            geneId={geneId}
            regionId={regionId}
            variantId={variantId}
            width={measuredWidth}
          />
          <FocusedVariantContent $padding={pagePadding}>
            <VariantPhewas layout="composed" size={resultsSurfaceSize} />
            <GenomicContextSection
              aria-labelledby="genomic-context-heading"
              data-focused-variant-section="genomic-context"
            >
              <h2 id="genomic-context-heading">Genomic context</h2>
              <LocusPageRoot embedded />
            </GenomicContextSection>
          </FocusedVariantContent>
        </FocusedVariantDocument>
      )
    }

    const shellRenderMode = renderPolicy.renderMode

    if (renderPolicy.kind === 'single-surface') {
      const activeSingleSurface = shellRenderMode === 'results-only' ? 'results' : 'details'
      retainedSurfaceMounts.current = getRetainedSurfaceMounts(
        retainedSurfaceMounts.current,
        activeSingleSurface
      )

      return (
        <div
          ref={resultsScrollRef}
          data-browser-experience={experienceMode === 'focused' ? 'focused' : 'side-by-side'}
          data-responsive-layout="single-surface"
          data-pane-render-mode={shellRenderMode}
          style={{
            height: '100%',
            width: '100%',
            overflow: shellRenderMode === 'results-only' ? 'auto' : 'hidden',
          }}
        >
          <KeepAliveSurface
            active={activeSingleSurface === 'results'}
            mounted={retainedSurfaceMounts.current.results}
            surface="results"
          >
            <div
              style={{
                boxSizing: 'border-box',
                height: '100%',
                padding: `10px ${pagePadding}px 0`,
              }}
            >
              <ResultsSurface size={resultsSurfaceSize} />
            </div>
          </KeepAliveSurface>
          <KeepAliveSurface
            active={activeSingleSurface === 'details'}
            mounted={retainedSurfaceMounts.current.details}
            surface="details"
          >
            <DetailsSurface focused width={measuredWidth} />
          </KeepAliveSurface>
        </div>
      )
    }

    if (shellRenderMode === 'results-only') {
      return (
        <div
          ref={resultsScrollRef}
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
            <div ref={resultsScrollRef} className="resizable-inner-container">
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

  .resizable-grid-item2 .resizable-inner-container {
    box-sizing: border-box;
    padding: 0;
    overflow: hidden;
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
