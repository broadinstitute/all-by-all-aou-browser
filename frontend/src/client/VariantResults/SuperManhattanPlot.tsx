import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react'
import styled, { useTheme } from 'styled-components'
import { getChromosomeLayout } from '../Manhattan/layout'
import { ChromosomeLabels } from '../Manhattan/components/ChromosomeLabels'
import { consequenceCategoryColors } from '../GenePage/LocusPagePlots'

const Container = styled.div`
  width: 100%;
  margin-bottom: 20px;
`

const PlotArea = styled.div`
  display: flex;
  position: relative;
`

const YAxisContainer = styled.div`
  width: 50px;
  flex-shrink: 0;
  position: relative;
`

const CanvasContainer = styled.div`
  flex: 1;
  position: relative;
`

const Tooltip = styled.div<{ x: number; y: number }>`
  position: absolute;
  left: ${(props) => props.x}px;
  top: ${(props) => props.y}px;
  background: rgba(0, 0, 0, 0.85);
  color: white;
  border-radius: 4px;
  padding: 8px 12px;
  font-size: 12px;
  pointer-events: none;
  z-index: 1000;
  transform: translate(-50%, -100%);
  margin-top: -10px;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
`

const BrushRect = styled.div`
  position: absolute;
  border: 2px solid rgba(38, 34, 98, 0.7);
  background: rgba(38, 34, 98, 0.1);
  pointer-events: none;
  z-index: 500;
`

const ResetButton = styled.button`
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 600;
  padding: 4px 10px;
  font-size: 11px;
  background: rgba(38, 34, 98, 0.85);
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  &:hover { background: rgba(38, 34, 98, 1); }
`

const LegendContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;
  margin-left: 50px;
  margin-top: 10px;
  font-size: 12px;
  color: var(--theme-text-muted, #666);
`

const LegendItem = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`

interface SuperManhattanPlotProps {
  variants: any[]
  categories: any[]
  colorBy: 'consequence' | 'category' | 'keyword'
  highlightKeyword: string
  onVariantClick: (variant: any) => void
}

const PLOT_HEIGHT = 400
const PLOT_PAD_X = 6
const MIN_BRUSH_PX = 10

// Hybrid linear-log Y scale matching the standard Manhattan plots.
// Linear from 0 to LOG_THRESHOLD (-log10(p)=10), then ln() compression above.
const LOG_THRESHOLD = 10
const LINEAR_FRACTION = 0.6
const MAX_NEG_LOG_P = 400

/** Map -log10(p) to a normalized position from bottom (0=least significant, 1=most significant) */
function negLogToNorm(negLogP: number): number {
  if (negLogP <= LOG_THRESHOLD) {
    return (negLogP / LOG_THRESHOLD) * LINEAR_FRACTION
  }
  const logVal = Math.log(negLogP / LOG_THRESHOLD)
  const logMax = Math.log(MAX_NEG_LOG_P / LOG_THRESHOLD)
  const logPosition = Math.min(logVal / logMax, 1.0)
  return LINEAR_FRACTION + logPosition * (1 - LINEAR_FRACTION)
}

/** Inverse: normalized position from bottom (0-1) back to -log10(p) */
function normToNegLog(norm: number): number {
  if (norm <= LINEAR_FRACTION) {
    return (norm / LINEAR_FRACTION) * LOG_THRESHOLD
  }
  const logMax = Math.log(MAX_NEG_LOG_P / LOG_THRESHOLD)
  const logPosition = (norm - LINEAR_FRACTION) / (1 - LINEAR_FRACTION)
  return LOG_THRESHOLD * Math.exp(logPosition * logMax)
}

interface Viewport {
  xMin: number // normalized 0-1 genomic position
  xMax: number
  // Y stored as normalized scale positions (0=bottom, 1=top) for correct brush behavior
  yNormMin: number
  yNormMax: number
}

export const SuperManhattanPlot: React.FC<SuperManhattanPlotProps> = ({
  variants,
  categories,
  colorBy,
  highlightKeyword,
  onVariantClick
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const theme = useTheme() as any
  const [dimensions, setDimensions] = useState({ width: 0, height: PLOT_HEIGHT })
  const [hoveredVariant, setHoveredVariant] = useState<any | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  // Brush state
  const [brushStart, setBrushStart] = useState<{ x: number; y: number } | null>(null)
  const [brushEnd, setBrushEnd] = useState<{ x: number; y: number } | null>(null)
  const isDragging = useRef(false)

  // Viewport for zoom (null = full view)
  const [viewport, setViewport] = useState<Viewport | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    if (rect.width > 0) {
      setDimensions({ width: rect.width, height: PLOT_HEIGHT })
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry && entry.contentRect.width > 0) {
        setDimensions({ width: entry.contentRect.width, height: PLOT_HEIGHT })
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const categoryColorMap = useMemo(() => {
    const map = new Map<string, string>()
    if (categories) {
      categories.forEach((c) => map.set(c.category, c.color))
    }
    return map
  }, [categories])

  // Fixed Y range: 1e-7 to 1e-350 in norm space
  const fullYNormRange = useMemo(() => {
    return { min: negLogToNorm(7), max: negLogToNorm(MAX_NEG_LOG_P) }
  }, [])

  // Active Y norm range (respects viewport zoom)
  const yNormRange = useMemo(() => {
    if (viewport) return { min: viewport.yNormMin, max: viewport.yNormMax }
    return fullYNormRange
  }, [viewport, fullYNormRange])

  // Active X range (respects viewport zoom)
  const xRange = useMemo(() => {
    if (viewport) return { min: viewport.xMin, max: viewport.xMax }
    return { min: 0, max: 1 }
  }, [viewport])

  const plottedPoints = useMemo(() => {
    if (dimensions.width === 0 || variants.length === 0) return []
    const layout = getChromosomeLayout('all')

    return variants.map((v) => {
      const xNorm = layout.getX(v.locus?.contig, v.locus?.position)

      if (xNorm === null) return null

      const negLogP = (v.top_neg_log10_p > 0 ? v.top_neg_log10_p : null) ?? (v.top_pvalue > 0 ? -Math.log10(v.top_pvalue) : MAX_NEG_LOG_P)
      const yNorm = negLogToNorm(negLogP)

      // Map through current viewport
      const xViewNorm = (xNorm - xRange.min) / (xRange.max - xRange.min)
      // yNormRange.max = top (most significant), yNormRange.min = bottom
      const yViewNorm = 1 - (yNorm - yNormRange.min) / (yNormRange.max - yNormRange.min)

      const plotWidth = dimensions.width - PLOT_PAD_X * 2
      const x = PLOT_PAD_X + xViewNorm * plotWidth
      const PLOT_PAD_Y = 8
      const y = Math.max(PLOT_PAD_Y, Math.min(dimensions.height - PLOT_PAD_Y, yViewNorm * dimensions.height))
      const radius = 1.5 + Math.sqrt(v.num_associations) * 0.5

      // Skip points far outside the viewport (with margin for radius)
      const margin = radius + 2
      if (x < -margin || x > dimensions.width + margin || y < -margin || y > dimensions.height + margin) {
        return null
      }

      let color = '#999'
      if (colorBy === 'consequence') {
        const cat = v.consequence_category || 'other'
        color = (consequenceCategoryColors as any)[cat] || consequenceCategoryColors.other
      } else if (colorBy === 'category') {
        color = categoryColorMap.get(v.top_phenotype_category) || '#999'
      } else if (colorBy === 'keyword') {
        const keyword = highlightKeyword.trim().toLowerCase()
        if (keyword) {
          const fields = [
            v.top_phenotype_description,
            v.matched_phenotype_description,
            v.variant_id,
            v.gene_symbol,
            v.top_phenotype_category,
          ]
          const matches = fields.some((f) => f && String(f).toLowerCase().includes(keyword))
          if (matches) {
            color = '#e91e63'
          } else {
            color = 'rgba(200, 200, 200, 0.3)'
          }
        } else {
          color = 'rgba(200, 200, 200, 0.8)'
        }
      }

      return { variant: v, x, y, radius, color }
    }).filter(Boolean) as { variant: any, x: number, y: number, radius: number, color: string }[]
  }, [variants, dimensions, colorBy, highlightKeyword, categoryColorMap, xRange, yNormRange])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || dimensions.width === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = dimensions.width * dpr
    canvas.height = dimensions.height * dpr
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, dimensions.width, dimensions.height)

    // Draw background bands for chromosomes
    const layout = getChromosomeLayout('all')
    const plotWidth = dimensions.width - PLOT_PAD_X * 2
    let isAlt = false
    for (const chrom of layout.chromosomes) {
      if (isAlt) {
        ctx.fillStyle = theme.surfaceAlt || '#f5f5f5'
        const xStart = PLOT_PAD_X + ((chrom.startNormalized - xRange.min) / (xRange.max - xRange.min)) * plotWidth
        const xEnd = PLOT_PAD_X + ((chrom.endNormalized - xRange.min) / (xRange.max - xRange.min)) * plotWidth
        const width = xEnd - xStart
        if (xEnd > 0 && xStart < dimensions.width) {
          ctx.fillRect(Math.max(0, xStart), 0, Math.min(width, dimensions.width - Math.max(0, xStart)), dimensions.height)
        }
      }
      isAlt = !isAlt
    }

    // Draw points — pLoF always on top, then missense, then synonymous
    const catOrder: Record<string, number> = { other: 0, synonymous: 1, missense: 2, lof: 3 }
    const sortedPoints = [...plottedPoints].sort((a, b) => {
      if (colorBy === 'keyword' && highlightKeyword) {
        const aHigh = a.color === '#e91e63'
        const bHigh = b.color === '#e91e63'
        if (aHigh && !bHigh) return 1
        if (!aHigh && bHigh) return -1
      }
      const aCat = catOrder[a.variant.consequence_category] ?? 0
      const bCat = catOrder[b.variant.consequence_category] ?? 0
      if (aCat !== bCat) return aCat - bCat
      return a.radius - b.radius
    })

    for (const p of sortedPoints) {
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
      ctx.fillStyle = p.color
      ctx.fill()

      if (p.radius > 5 || p.color === '#e91e63') {
        ctx.strokeStyle = theme.background === '#fafafa' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)'
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }
  }, [plottedPoints, dimensions, theme, colorBy, highlightKeyword, xRange])

  // --- Brush handlers ---
  const getCanvasXY = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(dimensions.width, e.clientX - rect.left)),
      y: Math.max(0, Math.min(dimensions.height, e.clientY - rect.top)),
    }
  }, [dimensions])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Only left button
    if (e.button !== 0) return
    const pos = getCanvasXY(e)
    isDragging.current = true
    setBrushStart(pos)
    setBrushEnd(pos)
    setHoveredVariant(null)
  }, [getCanvasXY])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasXY(e)

    if (isDragging.current) {
      setBrushEnd(pos)
      return
    }

    setMousePos(pos)

    let nearest = null
    let minDist = 15

    for (const p of plottedPoints) {
      const hitRadius = Math.max(p.radius + 2, 8)
      const dist = Math.sqrt((p.x - pos.x) ** 2 + (p.y - pos.y) ** 2)
      if (dist < minDist && dist <= hitRadius) {
        minDist = dist
        nearest = p
      }
    }
    setHoveredVariant(nearest)
  }, [plottedPoints, getCanvasXY])

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging.current || !brushStart) {
      isDragging.current = false
      setBrushStart(null)
      setBrushEnd(null)
      return
    }
    isDragging.current = false

    const end = getCanvasXY(e)
    const dx = Math.abs(end.x - brushStart.x)
    const dy = Math.abs(end.y - brushStart.y)

    if (dx < MIN_BRUSH_PX && dy < MIN_BRUSH_PX) {
      // Too small — treat as click; find nearest point at click position
      setBrushStart(null)
      setBrushEnd(null)
      let nearest = null
      let minDist = 15
      for (const p of plottedPoints) {
        const hitRadius = Math.max(p.radius + 2, 8)
        const dist = Math.sqrt((p.x - end.x) ** 2 + (p.y - end.y) ** 2)
        if (dist < minDist && dist <= hitRadius) {
          minDist = dist
          nearest = p
        }
      }
      if (nearest && onVariantClick) {
        onVariantClick(nearest.variant)
      }
      return
    }

    // Convert pixel rect to data coordinates
    const left = Math.min(brushStart.x, end.x)
    const right = Math.max(brushStart.x, end.x)
    const top = Math.min(brushStart.y, end.y)
    const bottom = Math.max(brushStart.y, end.y)

    const plotWidth = dimensions.width - PLOT_PAD_X * 2
    const newXMin = xRange.min + ((left - PLOT_PAD_X) / plotWidth) * (xRange.max - xRange.min)
    const newXMax = xRange.min + ((right - PLOT_PAD_X) / plotWidth) * (xRange.max - xRange.min)
    // Y is inverted: top of canvas = high norm value
    const newYNormMax = yNormRange.min + (1 - top / dimensions.height) * (yNormRange.max - yNormRange.min)
    const newYNormMin = yNormRange.min + (1 - bottom / dimensions.height) * (yNormRange.max - yNormRange.min)

    setViewport({
      xMin: Math.max(0, newXMin),
      xMax: Math.min(1, newXMax),
      yNormMin: Math.max(fullYNormRange.min, newYNormMin),
      yNormMax: newYNormMax,
    })

    setBrushStart(null)
    setBrushEnd(null)
  }, [brushStart, getCanvasXY, xRange, yNormRange, dimensions, fullYNormRange, plottedPoints, onVariantClick])

  const handleMouseLeave = useCallback(() => {
    setHoveredVariant(null)
    if (isDragging.current) {
      isDragging.current = false
      setBrushStart(null)
      setBrushEnd(null)
    }
  }, [])

  const handleDoubleClick = useCallback(() => {
    setViewport(null)
  }, [])

  const resetZoom = useCallback(() => {
    setViewport(null)
  }, [])

  // Brush rect geometry
  const brushRect = brushStart && brushEnd ? {
    left: Math.min(brushStart.x, brushEnd.x),
    top: Math.min(brushStart.y, brushEnd.y),
    width: Math.abs(brushEnd.x - brushStart.x),
    height: Math.abs(brushEnd.y - brushStart.y),
  } : null

  return (
    <Container>
      <PlotArea>
        <YAxisContainer>
          <svg width={50} height={dimensions.height} style={{ overflow: 'visible' }}>
            <text x={14} y={dimensions.height / 2} textAnchor="middle" fontSize={11} fill="var(--theme-text-muted, #666)" transform={`rotate(-90, 14, ${dimensions.height / 2})`}>-log₁₀(p)</text>
            {(() => {
              // Fixed tick values that give good density across the hybrid linear-log scale
              const allTicks = [5, 7, 8, 10, 15, 20, 30, 50, 75, 100, 150, 200, 300, 400]
              const minNegLog = normToNegLog(yNormRange.min)
              const maxNegLog = normToNegLog(yNormRange.max)
              const ticks = allTicks.filter(t => t >= minNegLog - 0.5 && t <= maxNegLog + 0.5)
              return ticks.map((t) => {
                const tNorm = negLogToNorm(t)
                const yFrac = 1 - (tNorm - yNormRange.min) / (yNormRange.max - yNormRange.min)
                const y = yFrac * dimensions.height
                return (
                  <g key={t}>
                    <line x1={44} x2={50} y1={y} y2={y} stroke="var(--theme-text-muted, #999)" strokeWidth={1} />
                    <text x={42} y={y + 4} textAnchor="end" fontSize={10} fill="var(--theme-text-muted, #666)">{Number.isInteger(t) ? t : t.toFixed(1)}</text>
                  </g>
                )
              })
            })()}
          </svg>
        </YAxisContainer>
        <CanvasContainer ref={containerRef}>
          {viewport && <ResetButton onClick={resetZoom}>Reset zoom</ResetButton>}
          <canvas
            ref={canvasRef}
            style={{
              width: '100%',
              height: PLOT_HEIGHT,
              cursor: isDragging.current ? 'crosshair' : hoveredVariant ? 'pointer' : 'crosshair',
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onDoubleClick={handleDoubleClick}
          />
          {brushRect && brushRect.width > 2 && brushRect.height > 2 && (
            <BrushRect style={{
              left: brushRect.left,
              top: brushRect.top,
              width: brushRect.width,
              height: brushRect.height,
            }} />
          )}
          {hoveredVariant && !isDragging.current && (
            <Tooltip x={hoveredVariant.x} y={hoveredVariant.y}>
              <div style={{ fontWeight: 'bold' }}>{hoveredVariant.variant.variant_id}</div>
              <div style={{ color: '#aaa', fontSize: 11 }}>Gene: {hoveredVariant.variant.gene_symbol || '—'}</div>
              <div style={{ color: '#aaa', fontSize: 11 }}>Consequence: {hoveredVariant.variant.consequence?.replace(/_/g, ' ') || '—'}</div>
              <div style={{ marginTop: 4 }}>Top Phenotype: <span style={{ color: '#fff' }}>{hoveredVariant.variant.top_phenotype_description}</span></div>
              <div style={{ color: '#ff6b6b' }}>Top P-value: {hoveredVariant.variant.top_pvalue > 0 ? hoveredVariant.variant.top_pvalue.toExponential(2) : `< 1e-${Math.round(hoveredVariant.variant.top_neg_log10_p || MAX_NEG_LOG_P)}`}</div>
              <div style={{ color: '#66bb6a', fontWeight: 'bold', marginTop: 4 }}>
                {hoveredVariant.variant.num_associations} significant association{hoveredVariant.variant.num_associations !== 1 ? 's' : ''}
              </div>
            </Tooltip>
          )}
        </CanvasContainer>
      </PlotArea>
      <div style={{ marginLeft: 50 }}>
        {dimensions.width > 0 && <ChromosomeLabels width={dimensions.width} contig="all" />}
      </div>
      <LegendContainer>
        <span style={{ fontWeight: 500 }}>Pleiotropy:</span>
        {[1, 10, 50, 100, 250].map((n) => {
          const d = Math.round((1.5 + Math.sqrt(n) * 0.5) * 2)
          return (
            <LegendItem key={n}>
              <svg width={d} height={d} style={{ flexShrink: 0 }}>
                <circle cx={d / 2} cy={d / 2} r={d / 2} fill="#999" />
              </svg>
              <span>{n} phenotype{n !== 1 ? 's' : ''}</span>
            </LegendItem>
          )
        })}
        {viewport && (
          <span style={{ marginLeft: 'auto', fontStyle: 'italic' }}>
            Drag to zoom · Double-click to reset
          </span>
        )}
        {!viewport && (
          <span style={{ marginLeft: 'auto', fontStyle: 'italic', opacity: 0.6 }}>
            Drag to zoom
          </span>
        )}
      </LegendContainer>
    </Container>
  )
}
