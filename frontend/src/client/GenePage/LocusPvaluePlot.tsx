import React, { useEffect, useMemo, useRef } from 'react'
import styled from 'styled-components'

import type { VariantJoined } from '../types'

import { createLogLogScaleY } from './logLogScale'

import { renderPoint } from './genePageUtils/renderPoint'
import { VariantPlotProps } from './LocusPagePlots'
import { sortVariantsByConsequence, sortVariantsByCorrelation } from '../utils'

const PlotWrapper = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
`

const marginBottom = 40

export const LocusPvaluePlot = ({
  variantDatasets = [],
  activeAnalysis,
  activeVariant,
  transparency,
  logLogEnabled = true,
  scalePosition,
  leftPanelWidth,
  rightPanelWidth,
  height = 400,
  width = 1100,
  alleleFrequencyScale,
  betaScale,
  onClickPoint = (d) => console.log(JSON.stringify(d)),
  pointColor = () => '#383838',
  pointLabel = (d) => {
    let variantLabel = 'FIXME'
    if (d.variant_id !== null) {
      variantLabel = d.variant_id
    }
    if (d.pvalue) {
      return `${variantLabel} (${d.pvalue})`
    }

    return variantLabel
  },
  selectedVariant,
  thresholds = [],
  xLabel = '',
  yLabel = '-log10(p)',
  applyStroke,
  gwasCatalogOption = 'hide',
  // sort
}: VariantPlotProps) => {
  const margin = {
    bottom: marginBottom,
    left: leftPanelWidth,
    right: rightPanelWidth,
    top: 30,
  }

  const variantsAll = variantDatasets.flatMap((v) => v)

  const logLogScale = createLogLogScaleY({ variants: variantsAll, margin, height, logLogEnabled })

  const points = variantDatasets.flatMap((variants) =>
    variants.map((d) => {
      const pvalue = -Math.log10(d.pvalue) || 0

      return {
        data: d,
        x: (scalePosition(d.locus && d.locus.position) as number) || 0,
        y: logLogScale(pvalue),
      }
    })
  ).sort((a, b) => sortVariantsByConsequence(a.data, b.data))

  const scale = window.devicePixelRatio || 2

  const plotCanvas = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.height = height * scale
    canvas.width = width * scale

    const ctx = canvas.getContext('2d')!

    ctx.setTransform(scale, 0, 0, scale, 0, 0)

    ctx.lineWidth = 1

    const w = width - margin.left - margin.right

    ctx.restore()

    ctx.save()

    ctx.transform(1, 0, 0, 1, margin.left, margin.top)


    for (let i = 0; i < points.length; i += 1) {
      const point = points[i]

      renderPoint({
        ctx,
        point,
        selectedVariant,
        activeVariant,
        activeAnalysis,
        margin,
        alleleFrequencyScale,
        pointColor,
        transparency,
        betaScale,
        height,
        applyStroke,
        gwasCatalogOption,
      })
    }

    ctx.restore()

    // Significance thresholds
    // ====================================================

    ctx.save()

    ctx.transform(1, 0, 0, 1, margin.left, margin.top)

    ctx.globalCompositeOperation = 'destination-over'
    thresholds.forEach((threshold) => {
      const thresholdY = logLogScale(-Math.log10(threshold.value)) || 0
      ctx.beginPath()
      ctx.moveTo(0, thresholdY)
      ctx.lineTo(w, thresholdY)
      ctx.setLineDash([3, 3])
      ctx.lineWidth = 2
      ctx.strokeStyle = threshold.color || '#333'
      ctx.stroke()

      if (threshold.label) {
        ctx.font = '14px sans-serif'
        ctx.fillStyle = '#000'
        ctx.fillText(threshold.label, 2, thresholdY - 4)
      }
    })

    ctx.restore()

    // ====================================================

    return canvas
  }, [variantDatasets, height, pointColor, width, xLabel, yLabel, thresholds, activeAnalysis])

  const mainCanvas: {
    current: HTMLCanvasElement | null
  } = useRef<HTMLCanvasElement>(null)

  const drawPlot = () => {
    const canvas = mainCanvas.current
    if (canvas) {
      const ctx: CanvasRenderingContext2D = canvas.getContext('2d')!
      ctx.setTransform(scale, 0, 0, scale, 0, 0)
      ctx.clearRect(0, 0, width, height)
      ctx.drawImage(plotCanvas, 0, 0, width, height)
    }
  }

  useEffect(drawPlot)

  const findNearestPoint = (x = 0, y = 0, distanceThreshold = 5) => {
    let nearestPoint
    let minDistance = Infinity


    for (let i = 0; i < points.length; i += 1) {
      const p = points[i]
      const d = Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2)
      if (d < minDistance) {
        nearestPoint = p
        minDistance = d
      }
    }

    return minDistance <= distanceThreshold ? nearestPoint : undefined
  }

  const updateHoveredPoint = (x: number, y: number) => {
    const nearestPoint = findNearestPoint(x, y)

    drawPlot()

    if (nearestPoint) {
      const canvas = mainCanvas.current
      if (canvas) {
        const ctx = canvas.getContext('2d')!
        ctx.save()

        ctx.transform(1, 0, 0, 1, margin.left, margin.top)

        ctx.font = '14px sans-serif'
        const label = pointLabel(nearestPoint.data)
        const { width: textWidth } = ctx.measureText(label)

        const labelX = x < width / 2 ? nearestPoint.x : nearestPoint.x - textWidth - 10
        const labelY = y < 30 ? nearestPoint.y : nearestPoint.y - 24

        ctx.beginPath()
        ctx.rect(labelX, labelY, textWidth + 12, 24)
        ctx.fillStyle = '#000'
        ctx.fill()

        ctx.fillStyle = '#fff'
        ctx.fillText(label, labelX + 6, labelY + 16)

        ctx.restore()
      }
    }
  }

  const onMouseMove = (event: React.MouseEvent) => {
    const bounds = (event.target as HTMLElement).getBoundingClientRect()
    const mouseX = event.clientX - bounds.left - margin.left
    const mouseY = event.clientY - bounds.top - margin.top
    updateHoveredPoint(mouseX, mouseY)
  }

  const onClick = (event: React.MouseEvent) => {
    const bounds = (event.target as HTMLElement).getBoundingClientRect()
    const clickX = event.clientX - bounds.left - margin.left
    const clickY = event.clientY - bounds.top - margin.top

    const point = findNearestPoint(clickX, clickY)
    if (point) {
      onClickPoint(point.data)
    }
  }

  return (
    <PlotWrapper>
      <canvas
        ref={mainCanvas}
        height={height * scale}
        width={(width + leftPanelWidth) * scale}
        style={{
          height: `${height}px`,
          width: `${width + leftPanelWidth}px`,
        }}
        onClick={onClick}
        onMouseLeave={drawPlot}
        onMouseMove={onMouseMove}
      />
    </PlotWrapper>
  )
}

interface LeftPanelProps {
  height: number
  width: number
  variantDatasets: VariantJoined[][]
  axisTicks: number[]
}

export const LeftPanel: React.FC<LeftPanelProps> = ({
  height,
  variantDatasets,
  width,
  axisTicks,
}) => {
  const hPadding = 30

  const variantsAll = variantDatasets.flatMap((v) => v)

  const margin = {
    bottom: marginBottom,
    top: 30,
  }

  const logLogScale = createLogLogScaleY({
    variants: variantsAll,
    margin,
    height,
    logLogEnabled: true,
  })

  const yAxisLabel = (
    <text x={5} y={height / 2} transform={`rotate(270 ${hPadding / 3} ${height / 2})`}>
      {'-log10(P)'}
    </text>
  )

  const yAxisTicks = (
    <g>
      {axisTicks.map((t) => {
        return (
          <g key={t}>
            <text
              className='yTickText'
              textAnchor='middle'
              x={hPadding - 5}
              y={logLogScale(t) + marginBottom - 2}
            >
              {t.toFixed(0)}
            </text>
          </g>
        )
      })}
      <text className='yTickText' textAnchor='middle' x={5} y={margin.top / 2}>
        &gt;
      </text>
    </g>
  )

  const yAxisStart = logLogScale(0) + marginBottom
  const yAxisEnd = logLogScale(100) + marginBottom

  const yAxis = (
    <g>
      <line x1={43} x2={43} y1={yAxisStart} y2={yAxisEnd} stroke='black' />
      <line x1={marginBottom} x2={43} y1={yAxisEnd} y2={yAxisEnd} stroke='black' />
      <line x1={marginBottom} x2={43} y1={yAxisStart} y2={yAxisStart} stroke='black' />
    </g>
  )

  const NoPValLabel = (
    <text x={0} y={height - 10}>
      {'No P-val'}
    </text>
  )

  return (
    <svg width={width} height={height}>
      <rect fill='none' style={{ border: '1px solid black' }} />
      {yAxisLabel}
      {yAxisTicks}
      {yAxis}
      {NoPValLabel}
    </svg>
  )
}
