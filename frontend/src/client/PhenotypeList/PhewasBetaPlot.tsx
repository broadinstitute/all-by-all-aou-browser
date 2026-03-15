import React, { useEffect, useMemo, useRef } from 'react'
import styled, { useTheme } from 'styled-components'
import { scaleLinear, scalePoint } from 'd3-scale'
import { withSize } from 'react-sizeme'

import { GeneAssociations } from '../types'
import { PhewasLabelsOverlay } from './PhewasLabelsOverlay'

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
  activeAnalyses?: string[]
  activeGene?: string
  primaryAnalysisId?: string
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
  phewasType?: string
  labeledPhenoIds?: Set<string>
  labelOverrides?: Record<string, { x: number; y: number }>
  onLabelDragEnd?: (id: string, x: number, y: number) => void
}

const PlotWrapper = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  position: relative;
`

const PhewasBetaPlot = ({
  analyses = [],
  activeAnalyses,
  activeGene,
  primaryAnalysisId,
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
  phewasType = 'gene',
  labeledPhenoIds,
  labelOverrides,
  onLabelDragEnd,
}: Props) => {
  const theme = useTheme() as any;
  const width = size.width || 1100

  const margin = {
    bottom: 25,
    left: 50,
    right: 30,
    top: 30,
  }

  const pointPadding = 10

  // Calculate maximum absolute beta to create a symmetric scale around 0
  const maxAbsBeta = analyses.reduce((max, d) => {
    const beta = Math.abs(d.BETA_Burden || d.BETA || 0)
    return beta > max ? beta : max
  }, 0)

  // Anchor the plot so it doesn't zoom in uncomfortably tight on noise
  const limit = Math.max(0.5, maxAbsBeta * 1.1)

  const yScale = scaleLinear()
    .domain([-limit, limit])
    .range([height - margin.top - margin.bottom, 0])
    .nice()

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

    // Dynamic ticks based on plot height
    const numTicks = Math.max(2, Math.floor(h / 25))
    const ticks = yScale.ticks(numTicks)

    for (let i = 0; i < ticks.length; i += 1) {
      const t = ticks[i]
      const y = yScale(t) || 0

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

    // Fade alpha adapts to point count: more points → more aggressive fading
    const fadeAlpha = Math.max(0.3, Math.min(0.8, 0.8 - (points.length - 50) * (0.5 / 1950)))

    for (let i = 0; i < points.length; i += 1) {
      const point = points[i]

      if (selectedPhenotype) {
        ctx.beginPath()
        ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI, false)
        ctx.fillStyle = 'blue'
        ctx.fill()
      }

      let isActiveGene = true
      if (phewasType === 'topHit' && point.data.gene_id) {
        isActiveGene = point.data.gene_id === activeGene
      } else if (point.data.gene_id) {
        isActiveGene = point.data.gene_id === activeGene
      }
      const isActiveAnalysis = !!(activeAnalyses && activeAnalyses.includes(point.data.analysis_id))
      const isSelected = isActiveGene && isActiveAnalysis

      const hasSelection = !!(activeAnalyses && activeAnalyses.length > 0 && (phewasType !== 'topHit' || activeGene))

      ctx.globalAlpha = (hasSelection && !isSelected) ? fadeAlpha : 1.0;

      ctx.beginPath()

      ctx.arc(point.x, point.y, pointRadius, 0, 2 * Math.PI, false)
      ctx.fillStyle = pointColor(point.data)
      ctx.fill()

      if (isSelected) {
        ctx.beginPath()
        ctx.arc(point.x, point.y, 10, 0, 2 * Math.PI, false)
        ctx.strokeStyle = '#c62828' // Red highlight
        ctx.lineWidth = 1.5
        ctx.stroke()
      } else if (showStroke) {
        ctx.beginPath()
        ctx.arc(point.x, point.y, pointRadius, 0, 2 * Math.PI, false)
        ctx.strokeStyle = 'black'
        ctx.lineWidth = 0.1
        ctx.stroke()
      }
    }

    ctx.globalAlpha = 1.0;

    ctx.restore()

    // Zero Line Anchor
    // ====================================================
    ctx.save()
    ctx.transform(1, 0, 0, 1, margin.left + pointPadding, margin.top)
    const zeroY = yScale(0) || 0
    ctx.beginPath()
    ctx.moveTo(0, zeroY)
    ctx.lineTo(w, zeroY)
    ctx.setLineDash([4, 4])
    ctx.strokeStyle = theme.textMuted || '#999'
    ctx.stroke()
    ctx.restore()

    // Labels are now handled by PhewasLabelsOverlay

    return canvas
  }, [analyses, height, pointColor, width, xLabel, yLabel, thresholds, theme, phewasType, scale, categoryBands, points, margin, pointPadding, yScale, showStroke, pointRadius, activeAnalyses, activeGene, selectedPhenotype, limit, primaryAnalysisId])

  const overlayPoints = useMemo(() => {
    return points.map(p => {
      let labelText = p.data.description || p.data.gene_symbol || ''
      if (phewasType === 'topHit') labelText = `${p.data.gene_symbol} - ${p.data.description}`
      // Use composite ID for topHit mode to match individual gene-phenotype pairs
      const id = (phewasType === 'topHit' && p.data.gene_id)
        ? `${p.data.gene_id}:${p.data.analysis_id}`
        : p.data.analysis_id
      return {
        id,
        targetX: p.x + pointPadding,
        targetY: p.y + margin.top,
        label: labelText,
        color: pointColor(p.data)
      }
    })
  }, [points, phewasType, pointPadding, margin.top, pointColor])

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
      {labeledPhenoIds && (
        <PhewasLabelsOverlay
          points={overlayPoints}
          labeledPhenoIds={labeledPhenoIds}
          labelOverrides={labelOverrides || {}}
          onLabelDragEnd={onLabelDragEnd || (() => {})}
          width={width}
          height={height}
        />
      )}
    </PlotWrapper>
  )
}

export default withSize()(PhewasBetaPlot)
