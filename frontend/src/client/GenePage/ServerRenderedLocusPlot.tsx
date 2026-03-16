import React, { useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react'
import styled from 'styled-components'
import { scaleLinear } from 'd3-scale'
import { RegionViewerContext, TRACK_EDGE_PADDING } from '@axaou/ui'
import type { SignificantHit } from '@axaou/ui'
import { axaouDevUrl } from '../Query'
import type { RegionOverlayResponse, LocusPlotYAxisConfig } from '../types'
import { getCategoryFromConsequence } from '../vepConsequences'
import { consequenceCategoryColorsMap } from './LocusPagePlots'

// =============================================================================
// Styled Components
// =============================================================================

const PlotContainer = styled.div<{ height: number }>`
  position: relative;
  width: 100%;
  height: ${(props) => props.height}px;
  overflow: hidden;
`

const OverlaySvg = styled.svg`
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: all;
  cursor: crosshair;
`

const TooltipContainer = styled.div<{ x: number; y: number }>`
  position: absolute;
  left: ${(props) => props.x}px;
  top: ${(props) => props.y}px;
  background: rgba(0, 0, 0, 0.85);
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  pointer-events: none;
  z-index: 1000;
  transform: translate(-50%, -100%);
  margin-top: -8px;
`

// =============================================================================
// Y-Axis Coordinate Calculation (matches LocusPlotTrack)
// =============================================================================

function computeY(pvalue: number, yAxis: LocusPlotYAxisConfig, height: number): number {
  if (pvalue <= 0 || pvalue > 1) return height

  const negLogP = -Math.log10(pvalue)
  const linearHeight = height * yAxis.linear_fraction
  const logHeight = height * (1 - yAxis.linear_fraction)

  if (negLogP <= yAxis.log_threshold) {
    const normalized = negLogP / yAxis.log_threshold
    return height - normalized * linearHeight
  } else {
    const logVal = Math.log(negLogP / yAxis.log_threshold)
    const logMax = Math.log(yAxis.max_neg_log_p / yAxis.log_threshold)
    const normalized = Math.min(logVal / logMax, 1.0)
    return Math.max(height - linearHeight - normalized * logHeight, 0)
  }
}

// =============================================================================
// Component
// =============================================================================

interface ServerRenderedLocusPlotProps {
  analysisId: string
  ancestryGroup: string
  contig: string
  regionOverlay?: RegionOverlayResponse
  height: number
  onClickVariant?: (variant: SignificantHit) => void
  marginTop?: number
  marginBottom?: number
}

export const ServerRenderedLocusPlot: React.FC<ServerRenderedLocusPlotProps> = ({
  analysisId,
  ancestryGroup,
  contig,
  regionOverlay,
  height,
  onClickVariant,
  marginTop = 0,
  marginBottom = 0,
}) => {
  const { scalePosition, centerPanelWidth } = useContext(RegionViewerContext)

  // Track debounced bounds for image fetching
  const [debouncedBounds, setDebouncedBounds] = useState<{ start: number; stop: number; width: number } | null>(null)

  // Currently loaded image
  const [loadedImage, setLoadedImage] = useState<{ src: string; start: number; stop: number } | null>(null)
  const [imageLoading, setImageLoading] = useState(false)

  // Hover state
  const [hoveredHit, setHoveredHit] = useState<(SignificantHit & { displayX: number; displayY: number }) | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  // Hidden img element for preloading
  const preloadRef = useRef<HTMLImageElement | null>(null)

  // Compute current viewport genomic bounds (inset by TRACK_EDGE_PADDING so the
  // server-rendered PNG aligns with the padded scale range, leaving visual padding
  // at each edge rather than filling edge-to-edge)
  const viewStart = scalePosition.invert ? scalePosition.invert(TRACK_EDGE_PADDING) : 0
  const viewStop = scalePosition.invert ? scalePosition.invert(centerPanelWidth - TRACK_EDGE_PADDING) : 0

  // Debounce viewport changes (150ms)
  useEffect(() => {
    if (centerPanelWidth <= 0) return

    const timer = setTimeout(() => {
      setDebouncedBounds({ start: viewStart, stop: viewStop, width: centerPanelWidth })
    }, 150)

    return () => clearTimeout(timer)
  }, [viewStart, viewStop, centerPanelWidth])

  // Build quantized image URL from debounced bounds
  const targetSrc = useMemo(() => {
    if (!debouncedBounds || debouncedBounds.width === 0) return ''

    // Quantize to 1kb boundaries for cache hits
    const qStart = Math.floor(debouncedBounds.start / 1000) * 1000
    const qStop = Math.ceil(debouncedBounds.stop / 1000) * 1000

    // Scale pixel width proportionally to quantized genomic range
    const bpPerPx = (debouncedBounds.stop - debouncedBounds.start) / debouncedBounds.width
    const qWidth = Math.ceil((qStop - qStart) / bpPerPx)
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 2) : 2

    return `${axaouDevUrl}/phenotype/${analysisId}/region/render?ancestry=${ancestryGroup}&contig=${contig}&start=${qStart}&stop=${qStop}&width=${qWidth}&height=${height}&dpr=${dpr}`
  }, [debouncedBounds, analysisId, ancestryGroup, contig, height])

  // Preload image when URL changes
  useEffect(() => {
    if (!targetSrc) return

    // Skip if already loaded
    if (loadedImage?.src === targetSrc) return

    setImageLoading(true)
    const img = new Image()
    preloadRef.current = img

    img.onload = () => {
      if (preloadRef.current !== img) return // Stale load

      const qStart = debouncedBounds ? Math.floor(debouncedBounds.start / 1000) * 1000 : 0
      const qStop = debouncedBounds ? Math.ceil(debouncedBounds.stop / 1000) * 1000 : 0
      setLoadedImage({ src: targetSrc, start: qStart, stop: qStop })
      setImageLoading(false)
    }

    img.onerror = () => {
      if (preloadRef.current !== img) return
      setImageLoading(false)
    }

    img.src = targetSrc

    return () => {
      preloadRef.current = null
    }
  }, [targetSrc, debouncedBounds, loadedImage?.src])

  // Detect when the viewport has changed from the loaded image (stale = needs blur)
  const isStale = useMemo(() => {
    if (!loadedImage) return false
    // Compare current viewport to what the loaded image covers
    const qStart = Math.floor(viewStart / 1000) * 1000
    const qStop = Math.ceil(viewStop / 1000) * 1000
    return qStart !== loadedImage.start || qStop !== loadedImage.stop
  }, [loadedImage, viewStart, viewStop])

  const staleOrLoading = isStale || imageLoading

  // Compute image CSS position using scalePosition for smooth panning
  const imageStyle = useMemo((): React.CSSProperties => {
    if (!loadedImage) return { display: 'none' }

    const pxStart = scalePosition(loadedImage.start)
    const pxStop = scalePosition(loadedImage.stop)
    const displayWidth = pxStop - pxStart

    return {
      position: 'absolute',
      left: pxStart,
      top: 0,
      width: displayWidth,
      height,
      pointerEvents: 'none',
    }
  }, [loadedImage, scalePosition, height])

  // Map significant hits to display coordinates
  const displayVariants = useMemo(() => {
    if (!regionOverlay?.significant_hits || !regionOverlay?.sidecar) return []

    const { sidecar, significant_hits } = regionOverlay
    const originalHeight = sidecar.image.height
    const yScaleFactor = height / originalHeight

    return significant_hits
      .map((v) => {
        const x = scalePosition(v.position)
        const yInOriginal = computeY(v.pvalue, sidecar.y_axis, originalHeight)
        const y = yInOriginal * yScaleFactor
        return { ...v, displayX: x, displayY: y }
      })
      .filter((v) => v.displayX >= -10 && v.displayX <= centerPanelWidth + 10)
  }, [regionOverlay, scalePosition, centerPanelWidth, height])

  // Hit detection on mouse move
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      let nearest: (typeof displayVariants)[number] | null = null
      let minDist = Infinity

      for (const v of displayVariants) {
        const dist = Math.sqrt((v.displayX - x) ** 2 + (v.displayY + marginTop - y) ** 2)
        if (dist < minDist && dist < 10) {
          minDist = dist
          nearest = v
        }
      }

      if (nearest !== hoveredHit) {
        setHoveredHit(nearest)
        if (nearest) setTooltipPos({ x: nearest.displayX, y: nearest.displayY + marginTop })
      }
    },
    [displayVariants, hoveredHit]
  )

  const handleMouseLeave = useCallback(() => {
    setHoveredHit(null)
  }, [])

  const handleClick = useCallback(() => {
    if (hoveredHit && onClickVariant) {
      onClickVariant(hoveredHit)
    }
  }, [hoveredHit, onClickVariant])

  return (
    <PlotContainer height={height + marginTop + marginBottom} style={{
      opacity: staleOrLoading ? 0.5 : 1,
      filter: staleOrLoading ? 'blur(4px)' : 'none',
      transition: staleOrLoading
        ? 'opacity 0.1s ease-out, filter 0.1s ease-out'
        : 'opacity 0.15s ease-out, filter 0.15s ease-out',
    }}>
      {/* Rendered PNG image, positioned via CSS using scalePosition */}
      {loadedImage && (
        <img
          src={loadedImage.src}
          style={{ ...imageStyle, top: marginTop }}
          alt="Locus region plot"
          draggable={false}
        />
      )}

      {/* Interactive SVG overlay for significant hits */}
      <OverlaySvg
        width={centerPanelWidth}
        height={height + marginTop + marginBottom}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        style={{ top: 0 }}
      >
        {displayVariants.map((v) => {
          const isHovered = hoveredHit?.id === v.id
          const category = getCategoryFromConsequence(v.consequence || 'unknown')
          const color = consequenceCategoryColorsMap.get(category) || 'lightgrey'

          return (
            <circle
              key={v.id}
              cx={v.displayX}
              cy={v.displayY + marginTop}
              r={isHovered ? 6 : 4}
              fill={color}
              stroke={isHovered ? '#333' : 'none'}
              strokeWidth={isHovered ? 2 : 0}
              style={{ cursor: 'pointer', opacity: 0.7 }}
            />
          )
        })}
      </OverlaySvg>

      {/* Tooltip */}
      {hoveredHit && (
        <TooltipContainer x={tooltipPos.x} y={tooltipPos.y}>
          <div style={{ fontWeight: 600 }}>{hoveredHit.id}</div>
          {hoveredHit.gene_symbol && (
            <div style={{ opacity: 0.7, fontSize: 11 }}>{hoveredHit.gene_symbol}</div>
          )}
          <div style={{ marginTop: 4 }}>
            <span style={{ opacity: 0.7 }}>P-value: </span>
            <span style={{ fontFamily: 'monospace' }}>{hoveredHit.pvalue.toExponential(2)}</span>
          </div>
          {hoveredHit.consequence && (
            <div>
              <span style={{ opacity: 0.7 }}>CSQ: </span>
              <span>{hoveredHit.consequence.replace(/_/g, ' ')}</span>
            </div>
          )}
          {(hoveredHit.hgvsp || hoveredHit.hgvsc) && (
            <div>
              <span style={{ opacity: 0.7 }}>HGVS: </span>
              <span>{hoveredHit.hgvsp?.split(':')[1] || hoveredHit.hgvsc?.split(':')[1] || '—'}</span>
            </div>
          )}
          {hoveredHit.beta !== undefined && hoveredHit.beta !== null && (
            <div>
              <span style={{ opacity: 0.7 }}>Beta: </span>
              <span style={{ fontFamily: 'monospace' }}>{hoveredHit.beta.toFixed(3)}</span>
            </div>
          )}
        </TooltipContainer>
      )}
    </PlotContainer>
  )
}
