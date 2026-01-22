/* eslint-disable no-restricted-syntax */
/* eslint-disable one-var */
import { min, max } from 'd3-array'
import { scaleLinear, scalePoint } from 'd3-scale'
import { useCallback, useRef, useEffect, useMemo, useState } from 'react'
import { withSize } from 'react-sizeme'
import styled from 'styled-components'
import Konva from 'konva'
import {
  Container as TooltipContainer,
  Arrow as TooltipArrow,
  // @ts-expect-error ts-migrate(7016) FIXME: Could not find a declaration file for module '@gno... Remove this comment to see the full error message
} from '@gnomad/ui/lib/cjs/tooltip/tooltipStyles'
import throttle from 'lodash/throttle'
import partition from 'lodash/partition'
import { P_VALUE_BURDEN, P_VALUE_SKAT, pValueTypeToPValueKeyName } from './Utils'

// The 100% width/height container is necessary the component
// to size to fit its container vs staying at its initial size.
const GraphWrapper = styled.div`
  height: 100%; /* stylelint-disable-line unit-whitelist */
  position: relative;
`
const CanvasContainer = styled.div`
  position: absolute;
`
const Tooltip = styled.div`
  position: absolute;
  transform: translateX(-50%) translateY(calc(-100% - 8px));
`

const newPlotPval = (hits: any, width: any, height: any, margin: any, pValueType: any) => {
  // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const pValueKeyName = pValueTypeToPValueKeyName[pValueType]
  const data = hits
    .filter((d: any) => d[pValueKeyName] !== 0)
    .filter((d: any) => d.visible)
    .map((d: any) => ({
      log10p: -Math.log10(d[pValueKeyName]),
      ...d,
    }))

  const xScale = scalePoint()
    .domain(data.map((d: any) => d.phenotype_id))
    .range([margin.left, width - margin.right])

  const yScale = scaleLinear()
    // @ts-expect-error ts-migrate(2345) FIXME: Argument of type '(string | number | undefined)[]'... Remove this comment to see the full error message
    .domain([0, max(data, (d) => (d as any).log10p)])
    .range([height - margin.bottom, margin.top])
    .nice()

  const points = data.map((d: any) => ({
    data: d,
    x: xScale(d.phenotype_id),
    y: yScale(d.log10p),
  }))
  return {
    xScale,
    yScale,
    points,
  }
}
const newPlotBeta = (hits: any, width: any, height: any, margin: any, pValueType: any) => {
  // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const pValueKeyName = pValueTypeToPValueKeyName[pValueType]
  const data = hits.filter((d: any) => d[pValueKeyName] !== 0).filter((d: any) => d.visible)
  const xScale = scalePoint()
    .domain(data.map((d: any) => d.phenotype_id))
    .range([margin.left, width - margin.right])
  const yScale = scaleLinear()
    // @ts-expect-error ts-migrate(2345) FIXME: Argument of type '(string | undefined)[]' is not a... Remove this comment to see the full error message
    .domain([min(data, (d) => (d as any).BETA), max(data, (d) => (d as any).BETA)])
    .range([height - margin.bottom, margin.top])
    .nice()
  const points = data.map((d: any) => ({
    data: d,
    x: xScale(d.phenotype_id),
    y: yScale(d.BETA),
  }))
  return {
    xScale,
    yScale,
    points,
  }
}

const getCorrectlyOrientedRect = (pointOne: any, pointTwo: any) => {
  let topLeftX, topLeftY, bottomRightX, bottomRightY
  if (pointOne.clientX < pointTwo.clientX) {
    topLeftX = pointOne.clientX
    bottomRightX = pointTwo.clientX
  } else {
    topLeftX = pointTwo.clientX
    bottomRightX = pointOne.clientX
  }
  if (pointOne.clientY < pointTwo.clientY) {
    topLeftY = pointOne.clientY
    bottomRightY = pointTwo.clientY
  } else {
    topLeftY = pointTwo.clientY
    bottomRightY = pointOne.clientY
  }
  return {
    topLeftX,
    topLeftY,
    bottomRightX,
    bottomRightY,
  }
}

const getRectInChartCoords = (pointOne: any, pointTwo: any, containerEl: any) => {
  const { top, left } = containerEl.getBoundingClientRect()
  const { topLeftX, topLeftY, bottomRightX, bottomRightY } = getCorrectlyOrientedRect(
    pointOne,
    pointTwo
  )
  const chartTopLeftX = topLeftX - left
  const chartTopLeftY = topLeftY - top
  const chartBottomRightX = bottomRightX - left
  const chartBottomRightY = bottomRightY - top
  return {
    topLeft: { x: chartTopLeftX, y: chartTopLeftY },
    bottomRight: { x: chartBottomRightX, y: chartBottomRightY },
  }
}

// How far the user must have moved the mouse to be considered deliberate movement:
const mouseMoveThreshold = 2

const NewPlotPane = ({
  hits,
  size,
  height,
  yLabel,
  xLabel,
  onPointClick,
  plotType,
  marginBottom,
  phenotypeId,
  setPlotSelectionBoundary,
  plotSelectionBoundary,
  pValueType,
}: any) => {
  const [hoveredPhenotypeId, setHoveredPhenotypeId] = useState(undefined)

  const margin = useMemo(() => {
    return {
      bottom: marginBottom,
      left: 60,
      right: 10,
      top: 10,
    }
  }, [marginBottom])

  const { width } = size

  const { xScale, yScale, points } = useMemo(() => {
    return plotType === 'pvalue'
      ? newPlotPval(hits, width, height, margin, pValueType)
      : newPlotBeta(hits, width, height, margin, pValueType)
  }, [hits, width, height, margin, plotType])

  let tooltip

  if (hoveredPhenotypeId === undefined) {
    tooltip = null
  } else {
    const hoveredPoint = points.find((point: any) => point.data.phenotype_id === hoveredPhenotypeId)
    tooltip = (
      <Tooltip style={{ left: `${hoveredPoint.x}px`, top: `${hoveredPoint.y}px` }}>
        <TooltipContainer>{hoveredPoint.data.description}</TooltipContainer>
        <TooltipArrow
          data-placement='top'
          style={{ left: '50%', transform: 'translateX(-50%) translateY(-100%)' }}
        />
      </Tooltip>
    )
  }

  const konvaInfoRef = useRef(undefined)
  const mouseDownInfoRef = useRef({ isMouseDown: false })
  const selectionRectInfoRef = useRef({ doesExist: false })

  const drawSelectionRef = useRef(
    throttle(() => {
      const { current: selectionRectInfo } = selectionRectInfoRef
      const { current: konvaInfo } = konvaInfoRef
      if (konvaInfo !== undefined) {
        const { selectionRectLayer } = konvaInfo as any
        if (selectionRectInfo.doesExist === true && konvaInfo !== undefined) {
          // @ts-expect-error ts-migrate(2339) FIXME: Property 'topLeftX' does not exist on type '{ does... Remove this comment to see the full error message
          const { topLeftX, topLeftY, selectionWidth, selectionHeight } = selectionRectInfo
          selectionRectLayer.clear()
          selectionRectLayer.removeChildren()
          selectionRectLayer.destroyChildren()
          const rect = new Konva.Rect({
            x: topLeftX,
            y: topLeftY,
            width: selectionWidth,
            height: selectionHeight,
            stroke: 'black',
            strokeWidth: 1,
          })
          selectionRectLayer.add(rect)
          selectionRectLayer.draw()
        } else {
          selectionRectLayer.clear()
          selectionRectLayer.removeChildren()
          selectionRectLayer.destroyChildren()
        }
      }
    }, 17)
  )

  const drawPoints = useCallback(() => {
    const { current: konvaInfo } = konvaInfoRef
    const { current: drawSelection } = drawSelectionRef
    if (konvaInfo !== undefined) {
      const { pointsLayer } = konvaInfo as any
      pointsLayer.removeChildren()
      pointsLayer.destroyChildren()
      pointsLayer.clear()
      const axes = new Konva.Line({
        points: [
          margin.left,
          margin.top,
          margin.left,
          height - margin.bottom,
          width - margin.right,
          height - margin.bottom,
        ],
        stroke: 'black',
        strokeWidth: 1,
      })
      const tickValues = yScale.ticks(5)
      const formatTick = yScale.tickFormat(5)
      const tickLength = 10
      const tickToLabelSeparation = 5
      const axisToAxisLabelSeparation = 50

      tickValues.forEach((tickValue) => {
        const yCoord = yScale(tickValue)
        const tick = new Konva.Line({
          points: [margin.left - tickLength, yCoord || 0, margin.left, yCoord || 0],
          stroke: 'black',
          strokeWidth: 1,
        })

        const tickLabel = new Konva.Text({
          text: formatTick(tickValue),
          x: margin.left - tickLength - tickToLabelSeparation,
          y: yCoord,
        })
        if (tickValue !== 0) {
          pointsLayer.add(tick)
        }
        pointsLayer.add(tickLabel)
        tickLabel.offsetX(tickLabel.width())
        tickLabel.offsetY(tickLabel.height() / 2)
      })

      const yLabelText = new Konva.Text({
        text: yLabel,
        x: margin.left - tickLength - axisToAxisLabelSeparation,
        y: margin.top + (height - margin.top - margin.bottom) / 2,
        rotation: -90,
      })

      const { height: yLabelTextHeight } = yLabelText.getClientRect()

      const yLabelTextYCoord =
        margin.top + (height - margin.top - margin.bottom) / 2 + yLabelTextHeight / 2
      yLabelText.y(yLabelTextYCoord)

      const xLabelText = new Konva.Text({
        text: xLabel,
        x: margin.left + (width - margin.left - margin.right) / 2,
        y: height - margin.bottom / 2,
      })

      pointsLayer.add(yLabelText)
      pointsLayer.add(xLabelText)
      pointsLayer.add(axes)

      const [selectedPoints, unselectedPoints] = partition(
        points,
        (point) => phenotypeId !== undefined && point.data.phenotype_id === phenotypeId
      )
      unselectedPoints.forEach((point) => {
        const circle = new Konva.Circle({
          x: point.x,
          y: point.y,
          radius: 4,
          fill: point.data.color,
          stroke: 'black',
          strokeWidth: 0.1,
        })
        circle.on('click', (e) => {
          e.cancelBubble = true
          onPointClick(point.data.phenotype_id)
        })
        circle.on('mouseenter', () => {
          setHoveredPhenotypeId(point.data.phenotype_id)
        })
        circle.on('mouseleave', () => {
          setHoveredPhenotypeId(undefined)
        })
        pointsLayer.add(circle)
      })

      selectedPoints.forEach((point) => {
        const circle = new Konva.Circle({
          x: point.x,
          y: point.y,
          radius: 8,
          fill: 'none',
          stroke: 'red',
          strokeWidth: 3,
        })
        circle.on('click', (e) => {
          e.cancelBubble = true
          onPointClick(point.data.phenotype_id)
        })
        circle.on('mouseenter', () => {
          setHoveredPhenotypeId(point.data.phenotype_id)
        })
        circle.on('mouseleave', () => {
          setHoveredPhenotypeId(undefined)
        })
        pointsLayer.add(circle)
      })
      pointsLayer.draw()
      drawSelection()
    }
  }, [points, margin, xScale, yScale, height, onPointClick, phenotypeId, width, xLabel, yLabel])

  const setupKonvaStage = useCallback(
    (containerEl: any) => {
      if (containerEl === null) {
        konvaInfoRef.current = undefined
      } else {
        const stage = new Konva.Stage({
          container: containerEl,
          width,
          height,
        })

        const pointsLayer = new Konva.Layer()
        const selectionRectLayer = new Konva.Layer()
        stage.add(pointsLayer)
        stage.add(selectionRectLayer)
        pointsLayer.draw()
        // @ts-expect-error ts-migrate(2322) FIXME: Type '{ stage: Stage; pointsLayer: Layer; selectio... Remove this comment to see the full error message
        konvaInfoRef.current = {
          stage,
          pointsLayer,
          selectionRectLayer,
          containerEl,
          width,
          height,
        }
        drawPoints()
      }
    },
    [width, height, drawPoints]
  )

  const prevPlotSelectionBoundaryRef = useRef(plotSelectionBoundary)

  useEffect(() => {
    if (plotSelectionBoundary === undefined && prevPlotSelectionBoundaryRef.current !== undefined) {
      selectionRectInfoRef.current = {
        doesExist: false,
      }
      drawSelectionRef.current()
    }
  }, [plotSelectionBoundary])

  useEffect(() => {
    prevPlotSelectionBoundaryRef.current = plotSelectionBoundary
  }, [plotSelectionBoundary])

  const onMouseMove = useCallback(({ clientX, clientY }: any) => {
    const { current: mouseDownInfo } = mouseDownInfoRef
    const { current: konvaInfo } = konvaInfoRef
    const { current: drawSelection } = drawSelectionRef

    if (mouseDownInfo.isMouseDown === true && konvaInfo !== undefined) {
      const { containerEl } = konvaInfo
      const { topLeft, bottomRight } = getRectInChartCoords(
        { clientX: (mouseDownInfo as any).clientX, clientY: (mouseDownInfo as any).clientY },
        { clientX, clientY },
        containerEl
      )

      const selectionWidth = bottomRight.x - topLeft.x
      const selectionHeight = bottomRight.y - topLeft.y

      if (selectionWidth > mouseMoveThreshold || selectionHeight > mouseMoveThreshold) {
        selectionRectInfoRef.current = {
          doesExist: true,
          // @ts-expect-error ts-migrate(2322) FIXME: Type '{ doesExist: true; topLeftX: number; topLeft... Remove this comment to see the full error message
          topLeftX: topLeft.x,
          topLeftY: topLeft.y,
          selectionWidth,
          selectionHeight,
        }
        drawSelection()
      }
    }
  }, [])

  const onMouseUp = useCallback(
    ({ clientX, clientY }: any) => {
      const { current: mouseDownInfo } = mouseDownInfoRef
      const { current: konvaInfo } = konvaInfoRef
      const { current: drawSelection } = drawSelectionRef
      if (mouseDownInfo.isMouseDown === true && konvaInfo !== undefined) {
        const { containerEl } = konvaInfo
        const { topLeft, bottomRight } = getRectInChartCoords(
          { clientX: (mouseDownInfo as any).clientX, clientY: (mouseDownInfo as any).clientY },
          { clientX, clientY },
          containerEl
        )
        const selectionWidth = bottomRight.x - topLeft.x
        const selectionHeight = bottomRight.y - topLeft.y
        if (selectionWidth > mouseMoveThreshold || selectionHeight > mouseMoveThreshold) {
          const yUpperLimit = yScale.invert(topLeft.y)
          const yLowerLimit = yScale.invert(bottomRight.y)
          const lowerXWithoutMargin = topLeft.x
          const upperXWithoutMargin = bottomRight.x
          let hasFoundFirstPhenotypeIdInsideSelection = false
          let firstPhenotypeIdInsideSelection
          let lastPhenotypeIdInsideSelection
          for (const {
            data: { phenotype_id },
            x,
          } of points) {
            if (x < upperXWithoutMargin) {
              lastPhenotypeIdInsideSelection = phenotype_id
            }
            if (x > upperXWithoutMargin) {
              break
            }
            if (hasFoundFirstPhenotypeIdInsideSelection === false && x > lowerXWithoutMargin) {
              firstPhenotypeIdInsideSelection = phenotype_id
              hasFoundFirstPhenotypeIdInsideSelection = true
            }
          }
          let firstPhenotypeId, lastPhenotypeId
          if (
            firstPhenotypeIdInsideSelection === undefined ||
            lastPhenotypeIdInsideSelection === undefined
          ) {
            firstPhenotypeId = undefined
            lastPhenotypeId = undefined
          } else {
            firstPhenotypeId = firstPhenotypeIdInsideSelection
            lastPhenotypeId = lastPhenotypeIdInsideSelection
          }
          setPlotSelectionBoundary({ yUpperLimit, yLowerLimit, firstPhenotypeId, lastPhenotypeId })
          mouseDownInfoRef.current = { isMouseDown: false }
        } else {
          setPlotSelectionBoundary(undefined)
          selectionRectInfoRef.current = { doesExist: false }
          drawSelection()
          mouseDownInfoRef.current = { isMouseDown: false }
        }
      }
    },
    [yScale, points, setPlotSelectionBoundary]
  )

  useEffect(() => {
    drawPoints()
  }, [drawPoints])

  return (
    <GraphWrapper style={{ height: `${height}px` }}>
      <CanvasContainer
        ref={setupKonvaStage}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseDown={({ clientX, clientY }) =>
          (mouseDownInfoRef.current = {
            isMouseDown: true,
            // @ts-expect-error ts-migrate(2322) FIXME: Type '{ isMouseDown: true; clientX: number; client... Remove this comment to see the full error message
            clientX,
            clientY,
          })
        }
        onMouseLeave={() => setHoveredPhenotypeId(undefined)}
      />
      {tooltip}
    </GraphWrapper>
  )
}

const refreshRate = 200

export const ScatterPlot = withSize({ refreshMode: 'debounce', refreshRate })(
  ({
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'plotType' does not exist on type '{ chil... Remove this comment to see the full error message
    plotType,
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'pvalPlotSelectionBoundary' does not exis... Remove this comment to see the full error message
    pvalPlotSelectionBoundary,
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'betaPlotSelectionBoundary' does not exis... Remove this comment to see the full error message
    betaPlotSelectionBoundary,
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'setPvalPlotSelectionBoundary' does not e... Remove this comment to see the full error message
    setPvalPlotSelectionBoundary,
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'setBetaPlotSelectionBoundary' does not e... Remove this comment to see the full error message
    setBetaPlotSelectionBoundary,
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'pValueType' does not exist on type '{ ch... Remove this comment to see the full error message
    pValueType,
    ...props
  }) => {
    let pvalPlotYLabel

    if (pValueType === P_VALUE_BURDEN) {
      pvalPlotYLabel = '-Log10p (Burden)'
    } else if (pValueType === P_VALUE_SKAT) {
      pvalPlotYLabel = '-Log10p (SKAT)'
    } else {
      pvalPlotYLabel = '-Log10p (SKAT-O)'
    }

    let result

    if (plotType === 'pvalue') {
      result = (
        <NewPlotPane
          height={300}
          yLabel={pvalPlotYLabel}
          marginBottom={30}
          xlabel='Phenotypes'
          plotType='pvalue'
          plotSelectionBoundary={pvalPlotSelectionBoundary}
          setPlotSelectionBoundary={setPvalPlotSelectionBoundary}
          pValueType={pValueType}
          {...props}
        />
      )
    } else if (plotType === 'beta') {
      let plotHeight, plotMarginBottom
      if (pValueType === P_VALUE_BURDEN) {
        plotHeight = 300
        plotMarginBottom = 20
      } else {
        plotHeight = 280
        plotMarginBottom = 0
      }

      result = (
        <>
          <NewPlotPane
            marginBottom={plotMarginBottom}
            height={plotHeight}
            yLabel='beta'
            xLabel=''
            plotType='beta'
            plotSelectionBoundary={betaPlotSelectionBoundary}
            setPlotSelectionBoundary={setBetaPlotSelectionBoundary}
            pValueType={pValueType}
            {...props}
          />
        </>
      )
    } else {
      let betaPlotHeight, pvalPlotHeight, betaPlotMarginBottom
      if (pValueType === P_VALUE_BURDEN) {
        betaPlotHeight = 150
        pvalPlotHeight = 150
        betaPlotMarginBottom = 20
      } else {
        betaPlotHeight = 140
        pvalPlotHeight = 150
        betaPlotMarginBottom = 30
      }

      let betaPlotElem
      // @ts-expect-error: FIXME
      if (props.hits.some((h: any) => h.BETA_Burden)) {
        betaPlotElem = (
          <NewPlotPane
            marginBottom={betaPlotMarginBottom}
            height={betaPlotHeight}
            yLabel='Beta'
            xLabel=''
            plotType='beta'
            plotSelectionBoundary={betaPlotSelectionBoundary}
            setPlotSelectionBoundary={setBetaPlotSelectionBoundary}
            pValueType={pValueType}
            {...props}
          />
        )
      }

      const pvalPlotElem = (
        <NewPlotPane
          height={pvalPlotHeight}
          yLabel={pvalPlotYLabel}
          marginBottom={30}
          xlabel='Phenotypes'
          plotType='pvalue'
          plotSelectionBoundary={pvalPlotSelectionBoundary}
          setPlotSelectionBoundary={setPvalPlotSelectionBoundary}
          pValueType={pValueType}
          {...props}
        />
      )
      result = (
        <>
          {pvalPlotElem}
          {betaPlotElem}
        </>
      )
    }
    return <GraphWrapper>{result}</GraphWrapper>
  }
)
