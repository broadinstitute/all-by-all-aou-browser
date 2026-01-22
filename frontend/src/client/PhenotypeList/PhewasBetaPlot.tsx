import React, { useEffect, useMemo, useRef } from 'react'
import styled from 'styled-components'
// import { Select, MenuItem } from "@material-ui/core";
import { extent } from 'd3-array'
import { scaleLinear, scalePoint } from 'd3-scale'
import { withSize } from 'react-sizeme'

import { GeneAssociations } from '../types'

type threshold = {
  color: string
  label: string
  value: number
}

interface Analysis extends GeneAssociations {
  color: string
  [key: string]: any
}

interface Props {
  analyses: Analysis[]
  logLogEnabled?: boolean
  yExtent: [number, number]
  activeAnalyses?: string[]
  activeGene?: string
  pointRadius?: number
  showStroke?: boolean
  size: { height: number; width: number }
  height: number
  onClickPoint?: (d: Analysis) => void
  pointColor?: (d: Analysis) => string
  pointLabel?: (d: Analysis) => string
  selectedPhenotype?: Analysis | null
  thresholds?: threshold[]
  xLabel?: string
  yLabel?: string
  hideLegend?: boolean
}

const PlotWrapper = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
`

const PhewasBetaPlot = ({
  analyses = [],
  // yExtent,
  activeAnalyses,
  activeGene,
  pointRadius = 4,
  showStroke,
  size,
  height = 200,
  onClickPoint = (d) => console.log(JSON.stringify(d)),
  pointColor = (d) => d.color,
  pointLabel = (d) => d.description || '',
  selectedPhenotype,
  thresholds = [],
  xLabel = '',
  yLabel = 'Beta',
}: Props) => {
  const width = size.width || 1100

  const margin = {
    bottom: 15,
    left: 50,
    right: 30,
    top: 30,
  }

  const pointPadding = 10

  const yExtent = extent(analyses, (d) => d.BETA_Burden || d.BETA) as Array<number>

  const yScale = scaleLinear()
    .domain(yExtent)
    .range([height - margin.top - margin.bottom, 0])
    .nice()

  const xScale = scalePoint()
    .domain(analyses.map((_: any, i: number) => `${i}`))
    .range([margin.left, width - margin.right])

  const points = analyses.map((d, i) => {
    const beta = d.BETA_Burden || (d.BETA as number)
    const y = yScale(beta) || 0

    return {
      data: d,
      x: (xScale(`${i}`) as number) || 0,
      y,
    }
  })

  const scale = window.devicePixelRatio || 2

  const plotCanvas = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.height = height * scale
    canvas.width = width * scale

    const ctx = canvas.getContext('2d')!

    ctx.setTransform(scale, 0, 0, scale, 0, 0)

    ctx.lineWidth = 1

    const w = width - margin.left - margin.right
    const h = height - margin.top - margin.bottom

    // Y Axis
    // ====================================================

    ctx.save()

    ctx.transform(1, 0, 0, 1, margin.left, margin.top)

    const ticks = yScale.ticks(2)

    for (let i = 0; i < ticks.length; i += 1) {
      const t = ticks[i]
      const y = yScale(t) || 0

      ctx.beginPath()
      ctx.moveTo(-5, y)
      ctx.lineTo(0, y)
      ctx.strokeStyle = 'yellow:'
      ctx.stroke()

      ctx.font = '10px sans-serif'
      ctx.fillStyle = '#000'
      const { width: tickLabelWidth } = ctx.measureText(`${t}`)
      ctx.fillText(`${t}`, -(9 + tickLabelWidth), y + 3)
    }

    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(0, h)
    ctx.strokeStyle = '#333'
    ctx.stroke()

    ctx.font = '12px sans-serif'
    const { width: yLabelWidth } = ctx.measureText(yLabel)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText(yLabel, -(h + yLabelWidth) / 2, -37)

    ctx.restore()

    // X Axis
    // ====================================================

    ctx.save()

    ctx.transform(1, 0, 0, 1, margin.left + pointPadding, height - 5)

    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(w, 0)
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.restore()

    // Points
    // ====================================================

    ctx.save()

    ctx.transform(1, 0, 0, 1, pointPadding, margin.top)

    for (let i = 0; i < points.length; i += 1) {
      const point = points[i]

      if (selectedPhenotype) {
        ctx.beginPath()
        ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI, false)
        ctx.fillStyle = 'blue'
        ctx.fill()
      }

      ctx.beginPath()

      ctx.arc(point.x, point.y, pointRadius, 0, 2 * Math.PI, false)
      ctx.fillStyle = pointColor(point.data)
      ctx.fill()

      let isActiveGene = true
      if (point.data.gene_id) {
        isActiveGene = point.data.gene_id === activeGene
      }

      if (isActiveGene && activeAnalyses && activeAnalyses.includes(point.data.analysis_id)) {
        ctx.beginPath()
        ctx.arc(point.x, point.y, 10, 0, 2 * Math.PI, false)
        ctx.strokeStyle = 'blue'
        ctx.lineWidth = 1.5
        ctx.stroke()

        ctx.strokeStyle = 'black'
      }
      ctx.lineWidth = 0.1
      showStroke && ctx.stroke()
    }

    ctx.restore()

    // Significance thresholds
    // ====================================================

    ctx.save()

    ctx.transform(1, 0, 0, 1, margin.left, margin.top)

    thresholds.forEach((threshold) => {
      const thresholdY = yScale(-Math.log10(threshold.value)) || 0
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
  }, [analyses, height, pointColor, width, xLabel, yLabel, thresholds])

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

        ctx.transform(1, 0, 0, 1, +pointPadding + 5, margin.top)

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
    const mouseX = event.clientX - bounds.left - pointPadding
    const mouseY = event.clientY - bounds.top - margin.top
    updateHoveredPoint(mouseX, mouseY)
  }

  const onClick = (event: React.MouseEvent) => {
    const bounds = (event.target as HTMLElement).getBoundingClientRect()
    const clickX = event.clientX - bounds.left - pointPadding
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
        width={width * scale}
        style={{
          height: `${height}px`,
          width: `${width}px`,
        }}
        onClick={onClick}
        onMouseLeave={drawPlot}
        onMouseMove={onMouseMove}
      />
    </PlotWrapper>
  )
}

export default withSize()(PhewasBetaPlot)
