import React, { useEffect, useMemo, useRef } from 'react'
import styled from 'styled-components'

import { VariantPlotProps } from './GenePagePlots'

import { renderPoint } from './genePageUtils/renderPoint'

const PlotWrapper = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
`

export const GenePageFreqVariantTrack = ({
  variantDatasets = [[]],
  activeAnalysis,
  activeVariant,
  transparency,
  alleleFrequencyScale,
  scalePosition,
  leftPanelWidth,
  rightPanelWidth,
  height = 400,
  width = 1100,
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
  betaScale,
  thresholds = [],
  getAfField = (variant) =>
    variant.allele_frequency || variant.association_af || variant.af_cases || 0,

  xLabel = '',
  yLabel = '-log10(p)',
  applyStroke,
  gwasCatalogOption = 'hide',
}: VariantPlotProps) => {
  const margin = {
    bottom: 10,
    left: leftPanelWidth,
    right: rightPanelWidth,
    top: 10,
  }

  const variants = variantDatasets[0]

  const points = variants.map((d) => ({
    data: d,
    x: (scalePosition(d.locus.position) as number) || 0,
    y: 5,
  }))

  const scale = window.devicePixelRatio || 2

  const plotCanvas = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.height = height * scale
    canvas.width = width * scale

    const ctx = canvas.getContext('2d')!

    ctx.setTransform(scale, 0, 0, scale, 0, 0)

    ctx.globalCompositeOperation = 'source-over'

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
        getAfField,
        applyStroke,
        gwasCatalogOption,
      })
    }

    ctx.restore()

    return canvas
  }, [variants, height, pointColor, width, xLabel, yLabel, thresholds])

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

        ctx.transform(1, 0, 0, 1, margin.left, 0)

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
