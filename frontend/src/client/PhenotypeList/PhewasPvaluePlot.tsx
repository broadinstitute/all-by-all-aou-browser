import React, { useEffect, useMemo, useRef } from 'react'
import styled, { useTheme } from 'styled-components'
import { scaleLog, scaleLinear, scalePoint, ScaleLinear, ScaleLogarithmic } from 'd3-scale'
import { withSize } from 'react-sizeme'

import { pValueTypeToPValueKeyName, P_VALUE_SKAT, P_VALUE_BURDEN, P_VALUE_SKAT_O } from './Utils'
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
  pValueType: typeof P_VALUE_SKAT_O | typeof P_VALUE_BURDEN | typeof P_VALUE_SKAT
  logLogEnabled?: boolean
  activeAnalyses?: string[]
  activeGene?: string
  primaryAnalysisId?: string
  size: { height: number; width: number }
  pointRadius?: number
  showStroke?: boolean
  height?: number
  onClickPoint?: (d: Analysis) => void
  pointColor?: (d: Analysis) => string
  pointLabel?: (d: Analysis) => string
  selectedPhenotype?: Analysis | null
  thresholds?: threshold[]
  xLabel?: string
  yLabel?: string
  hideLegend?: boolean
  phewasType?: string
}

const PlotWrapper = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
`

const PhewasPvaluePlot = ({
  analyses = [],
  pValueType,
  activeAnalyses,
  activeGene,
  primaryAnalysisId,
  pointRadius = 4,
  showStroke,
  logLogEnabled = true,
  size,
  height = 400,
  onClickPoint = (d) => console.log(JSON.stringify(d)),
  pointColor = (d) => d.color,
  pointLabel = (d) => d.description || '',
  selectedPhenotype,
  thresholds = [{ color: '#c62828', label: '', value: 2.5e-6 }],
  xLabel = '',
  yLabel = '-log10(p)',
  phewasType = 'gene',
}: Props) => {
  const theme = useTheme() as any;
  const pValueKeyName = pValueTypeToPValueKeyName[pValueType]

  const width = size.width || 1100

  const margin = {
    bottom: 25,
    left: 50,
    right: 30,
    top: 30,
  }

  const pointPadding = 10

  // Standardize the linear scale up to 15 for normal view
  const maxNegLogP = 350
  const yScaleNormal = scaleLinear()
    .domain([0, 15])
    .range([height - margin.top - margin.bottom, 0])

  // LogLog Plot scale (matches Manhattan layout)
  const yScaleLogThreshold = 10
  const linearFraction = 0.6 // Same as Manhattan layout

  const plotHeight = height - margin.top - margin.bottom

  const yScale = scaleLinear()
    .domain([0, yScaleLogThreshold])
    .range([plotHeight, plotHeight * (1 - linearFraction)])

  const yScaleLog = scaleLog()
    .domain([yScaleLogThreshold, maxNegLogP])
    .range([plotHeight * (1 - linearFraction), 0])

  const yWithLogLogScale = (log10PValue: number) => {
    if (log10PValue < yScaleLogThreshold) {
      return yScale(log10PValue)
    } else {
      // Math.min bounds it up to 350 to prevent overflow
      return yScaleLog(Math.min(log10PValue, maxNegLogP))
    }
  }

  const yScaleLogLog = yWithLogLogScale

  const xScale = scalePoint()
    .domain(analyses.map((_: any, i: number) => `${i}`))
    .range([margin.left, width - margin.right])

  // Map category groups for alternating background bands
  const categoryBands: { name: string; startX: number; endX: number; colorIndex: number }[] = []
  if (analyses.length > 0) {
    let currentCategory = analyses[0].group
    let startIndex = 0
    let colorIndex = 0

    for (let i = 1; i <= analyses.length; i++) {
      if (i === analyses.length || analyses[i].group !== currentCategory) {
        const startX = xScale(`${startIndex}`) || margin.left
        const endX = xScale(`${i - 1}`) || width - margin.right

        categoryBands.push({
          name: currentCategory,
          startX: startX - (i > 1 ? pointPadding : 0),
          endX: endX + pointPadding,
          colorIndex,
        })

        if (i < analyses.length) {
          currentCategory = analyses[i].group
          startIndex = i
          colorIndex++
        }
      }
    }
  }

  const points = analyses.map((d, i) => {
    const pValue = d[pValueKeyName] as number
    let y
    const value = pValue <= 0 ? maxNegLogP : -Math.log10(pValue)

    if (logLogEnabled) {
      y = yScaleLogLog(value) || 0
    } else {
      y = yScaleNormal(value) || 0
    }

    return {
      data: d,
      x: (xScale(`${i}`) as number) || 0,
      y,
      logp: value
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

    // Background Category Bands
    // ====================================================
    ctx.save()
    categoryBands.forEach((band) => {
      if (band.colorIndex % 2 === 0) {
        ctx.fillStyle = theme.surfaceAlt || '#f5f5f5'
        ctx.fillRect(band.startX + pointPadding, margin.top, band.endX - band.startX, h)
      }
    })
    ctx.restore()

    // Y Axis
    // ====================================================

    ctx.save()
    ctx.transform(1, 0, 0, 1, margin.left, margin.top)

    let ticks
    if (logLogEnabled) {
      // Dynamic ticks based on plot height - show fewer ticks for smaller plots
      const allTicks = [0, 2, 4, 6, 8, 10, 20, 50, 100, 200, 300]
      const minTickSpacing = 18 // Minimum pixels between ticks
      const maxTicks = Math.floor(h / minTickSpacing)

      if (maxTicks >= allTicks.length) {
        ticks = allTicks
      } else if (maxTicks >= 7) {
        ticks = [0, 4, 8, 10, 20, 50, 100, 200]
      } else if (maxTicks >= 5) {
        ticks = [0, 5, 10, 50, 100]
      } else {
        ticks = [0, 10, 50, 100]
      }
    } else {
      const numTicks = Math.max(2, Math.floor(h / 30))
      ticks = yScaleNormal.ticks(numTicks)
    }

    const yScaleVersion = logLogEnabled ? yScaleLogLog : yScaleNormal

    for (let i = 0; i < ticks.length; i += 1) {
      const t = ticks[i]
      const y = yScaleVersion(t) || 0

      ctx.beginPath()
      ctx.moveTo(-5, y)
      ctx.lineTo(0, y)
      ctx.strokeStyle = theme.border || '#333'
      ctx.stroke()

      ctx.font = '10px sans-serif'
      ctx.fillStyle = theme.text || '#000'
      const { width: tickLabelWidth } = ctx.measureText(`${t}`)
      ctx.fillText(`${t}`, -(9 + tickLabelWidth), y + 3)
    }

    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(0, h)
    ctx.strokeStyle = theme.border || '#333'
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
    ctx.strokeStyle = theme.border || '#333'
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

      // if (activeAnalyses && activeAnalyses.includes(point.data.analysis_id)) {
      //   ctx.beginPath();
      //   ctx.arc(point.x, point.y, 10, 0, 2 * Math.PI, false);
      //   ctx.strokeStyle = "blue";
      //   ctx.lineWidth = 1.5;
      //   ctx.stroke();

      //   ctx.strokeStyle = "black";

      //   // ctx.font = "11px sans-serif";
      //   // const label = point.data.description || '';
      //   // const { width: textWidth } = ctx.measureText(label);

      //   // const labelX =
      //   //   point.x < width / 2 ? point.x : point.x - textWidth - 10;
      //   // const labelY = point.y < 30 ? point.y : point.y - 24;

      //   // ctx.beginPath();
      //   // ctx.fillStyle = "black";
      //   // ctx.fillText(label, labelX + 6, labelY + 16);
      // }

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
        ctx.fillStyle = theme.text || '#000'
        ctx.fillText(threshold.label, 2, thresholdY - 4)
      }
    })

    ctx.restore()

    // Top Hit Labels
    // ====================================================
    ctx.save()
    ctx.transform(1, 0, 0, 1, pointPadding, margin.top)
    ctx.font = '10px sans-serif'
    ctx.textBaseline = 'middle'

    // Always include primary (URL) analysis and selected analyses in labels, plus top hits
    const primaryPoint = points.find((p) => p.data.analysis_id === primaryAnalysisId)
    const selectedPoints = points.filter((p) =>
      p.data.analysis_id !== primaryAnalysisId && activeAnalyses && activeAnalyses.includes(p.data.analysis_id)
    )
    const alreadyLabeledIds = new Set([primaryAnalysisId, ...(activeAnalyses || [])])
    const topHitPoints = [...points]
      .filter((p) => p.logp > -Math.log10(1e-6) && !alreadyLabeledIds.has(p.data.analysis_id))
      .sort((a, b) => b.logp - a.logp)
      .slice(0, 15 - selectedPoints.length - (primaryPoint ? 1 : 0))

    const pointsToLabel = [...(primaryPoint ? [primaryPoint] : []), ...selectedPoints, ...topHitPoints]

    const labelRects: Array<{ x: number; y: number; w: number; h: number }> = []

    pointsToLabel.forEach((p) => {
      let labelText = p.data.description || p.data.gene_symbol || ''
      if (phewasType === 'topHit') labelText = `${p.data.gene_symbol} - ${p.data.description}`
      if (labelText.length > 25) labelText = labelText.substring(0, 25) + '...'

      const textWidth = ctx.measureText(labelText).width
      const labelHeight = 12
      const pad = 2

      // Positions to test for collision: Right, Left, Top, Bottom
      const positions = [
        { x: p.x + 8, y: p.y },
        { x: p.x - 8 - textWidth, y: p.y },
        { x: p.x - textWidth / 2, y: p.y - 12 },
        { x: p.x - textWidth / 2, y: p.y + 12 },
      ]

      let bestPos = positions[0]
      let foundSpot = false

      for (const pos of positions) {
        const rect = {
          x: pos.x - pad,
          y: pos.y - labelHeight / 2 - pad,
          w: textWidth + pad * 2,
          h: labelHeight + pad * 2,
        }

        // Inside bounds check
        if (rect.x < margin.left || rect.x + rect.w > width - margin.right) continue
        if (rect.y < 0 || rect.y + rect.h > h) continue

        // Collision check
        const overlaps = labelRects.some(
          (r) =>
            rect.x < r.x + r.w &&
            rect.x + rect.w > r.x &&
            rect.y < r.y + r.h &&
            rect.y + rect.h > r.y
        )

        if (!overlaps) {
          bestPos = pos
          labelRects.push(rect)
          foundSpot = true
          break
        }
      }

      if (foundSpot) {
        ctx.fillStyle = theme.tooltipBg || 'rgba(255, 255, 255, 0.95)'
        ctx.fillRect(bestPos.x - 1, bestPos.y - 6, textWidth + 2, 12)
        ctx.fillStyle = theme.text || '#333'
        ctx.textAlign = 'left'
        ctx.fillText(labelText, bestPos.x, bestPos.y)
      }
    })

    ctx.restore()

    // ====================================================

    return canvas
  }, [analyses, height, pointColor, width, xLabel, yLabel, thresholds, theme, logLogEnabled, phewasType, scale, categoryBands, points, margin, pointPadding, yScaleLogLog, yScaleNormal, showStroke, pointRadius, activeAnalyses, activeGene, selectedPhenotype, primaryAnalysisId])

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

        const categoryLabel = nearestPoint.data.category || 'Unknown'
        const fullLabel = `${label} | ${categoryLabel}`
        const { width: fullTextWidth } = ctx.measureText(fullLabel)

        const labelX = x < width / 2 ? nearestPoint.x : nearestPoint.x - fullTextWidth - 10
        const labelY = y < 30 ? nearestPoint.y : nearestPoint.y - 24

        ctx.beginPath()
        ctx.rect(labelX, labelY, fullTextWidth + 12, 24)
        ctx.fillStyle = theme.tooltipBg || 'rgba(255, 255, 255, 0.95)'
        ctx.fill()

        ctx.strokeStyle = theme.border || '#333'
        ctx.strokeRect(labelX, labelY, fullTextWidth + 12, 24)

        ctx.fillStyle = theme.text || '#fff'
        ctx.fillText(fullLabel, labelX + 6, labelY + 16)

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

export default withSize()(PhewasPvaluePlot)
