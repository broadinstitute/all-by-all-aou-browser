import React, { useEffect, useMemo, useRef } from 'react'
import styled from 'styled-components'
// import { Select, MenuItem } from "@material-ui/core";
import { extent } from 'd3-array'
import { scaleLog, scaleLinear } from 'd3-scale'

import type { Variant as OrigVariant } from '@axaou/types'

type threshold = {
  color: string
  label: string
  value: number
}

export interface Variant extends OrigVariant {
  af_cases: number | null
  af_controls: number | null
  allele_frequency: number | null
  consequence: string
}

interface Props {
  variants: Variant[]
  scalePosition: any
  leftPanelWidth: number
  rightPanelWidth: number
  height?: number
  width?: number
  onClickPoint?: (d: Variant) => void
  pointColor?: (d: Variant) => string
  pointLabel?: (d: Variant) => string
  selectedVariant?: Variant | null
  thresholds?: threshold[]
  xLabel?: string
  yLabel?: string
  r2PopulationId?: string
  showCorrelations?: boolean
  onChangeR2Population?: (e: React.ChangeEvent<unknown>) => void
  hideLegend?: boolean
}

const PlotWrapper = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
`

const marginBottom = 45

export const AssociationsPlot = ({
  variants = [],
  scalePosition,
  leftPanelWidth,
  rightPanelWidth,
  height = 400,
  width = 1100,
  onClickPoint = (d) => console.log(JSON.stringify(d)),
  pointColor = () => '#383838',
  pointLabel = (d) => {
    if (d.association) {
      if (d.finemapping?.cs_99) {
        return `${d.variant_id} (${d.association.pvalue}, CS99)`
      }
      return `${d.variant_id} (${d.association.pvalue.toPrecision(3)})`
    }

    return d.variant_id
  },
  selectedVariant,
  thresholds = [],
  xLabel = '',
  yLabel = '-log10(p)',
}: Props) => {
  const margin = {
    bottom: marginBottom,
    left: leftPanelWidth,
    right: rightPanelWidth,
    top: 30,
  }

  const alleleFrequencyScale = scaleLog().domain([0.00001, 1]).range([1, 7])

  const yExtent = (extent(variants, (d) => d.association && d.association.pvalue) as Array<number>)
    .map((p) => -Math.log10(p))
    .reverse()

  const yScale = scaleLinear()
    .domain(yExtent)
    .range([height - margin.top - margin.bottom, 0])
    .nice()

  const points = variants.map((d) => ({
    data: d,
    x: (scalePosition(d.locus.position) as number) || 0,
    y: (d.association && yScale(-Math.log10(d.association.pvalue))) || 0,
  }))

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

    // ctx.save();

    // ctx.transform(1, 0, 0, 1, margin.left, margin.top);

    // const ticks = yScale.ticks(3);
    // for (let i = 0; i < ticks.length; i += 1) {
    //   const t = ticks[i];
    //   const y = yScale(t) || 0;

    //   ctx.beginPath();
    //   ctx.moveTo(-5, y);
    //   ctx.lineTo(0, y);
    //   ctx.strokeStyle = "yellow:";
    //   ctx.stroke();

    //   ctx.font = "10px sans-serif";
    //   ctx.fillStyle = "#000";
    //   const { width: tickLabelWidth } = ctx.measureText(`${t}`);
    //   ctx.fillText(`${t}`, -(9 + tickLabelWidth), y + 3);
    // }

    // ctx.beginPath();
    // ctx.moveTo(0, 0);
    // ctx.lineTo(0, h);
    // ctx.strokeStyle = "#333";
    // ctx.stroke();

    // ctx.font = "12px sans-serif";
    // const { width: yLabelWidth } = ctx.measureText(yLabel);
    // ctx.rotate(-Math.PI / 2);
    // ctx.fillText(yLabel, -(h + yLabelWidth) / 2, -40);

    // const noPvalueLabel = "None"
    // const { width: noPvalueLabelWidth} = ctx.measureText(noPvalueLabel);

    // ctx.fillText(noPvalueLabel, -(h + noPvalueLabelWidth), -40);
    // ctx.rotate(Math.PI / 2);

    ctx.restore()

    // X Axis
    // ====================================================

    // ctx.save();

    // ctx.transform(1, 0, 0, 1, margin.left, height);

    // ctx.beginPath();
    // ctx.moveTo(0, 0);
    // ctx.lineTo(w, 0);
    // ctx.strokeStyle = "#333";
    // ctx.stroke();

    // ctx.restore();

    // Points
    // ====================================================

    ctx.save()

    ctx.transform(1, 0, 0, 1, margin.left, margin.top)

    for (let i = 0; i < points.length; i += 1) {
      const point = points[i]

      if (selectedVariant && point.data.locus.position == selectedVariant.locus.position) {
        ctx.beginPath()
        ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI, false)
        ctx.fillStyle = 'red'
        ctx.fill()
      }

      ctx.beginPath()

      if (point.data.association) {
        ctx.arc(
          point.x,
          point.y,
          alleleFrequencyScale(point.data.allele_frequency || 0) || 0,
          0,
          2 * Math.PI,
          false
        )
      } else {
        ctx.arc(
          point.x,
          h + margin.top + margin.bottom - marginBottom,
          alleleFrequencyScale(point.data.allele_frequency || 0) || 0,
          0,
          2 * Math.PI,
          false
        )
      }

      ctx.fillStyle = pointColor(point.data)
      ctx.fill()

      if (point.data.ui && point.data.ui.isFiltered) {
        ctx.beginPath()
        ctx.arc(point.x, point.y, 10, 0, 2 * Math.PI, false)
        ctx.strokeStyle = 'red'
        ctx.lineWidth = 1.5
        ctx.stroke()

        ctx.strokeStyle = 'black'
      }
      ctx.stroke()
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

  // console.log(width)
  // console.log(leftPanelWidth)
  // console.log(rightPanelWidth)

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
  variants: Variant[]
}

export const LeftPanel: React.FC<LeftPanelProps> = ({ height, variants, width }) => {
  const hPadding = 30
  const yExtent = (extent(variants, (d) => d.association && d.association.pvalue) as Array<number>)
    .map((p) => -Math.log10(p))
    .reverse()

  const yScale = scaleLinear()
    .domain(yExtent)
    .range([height - marginBottom, 30])
    .nice()

  const pValLabel = (
    <text x={5} y={height / 2} transform={`rotate(270 ${hPadding / 3} ${height / 2})`}>
      {'-log10(P)'}
    </text>
  )

  const yAxisTicks = (
    <g>
      {yScale.ticks(3).map((t) => {
        return (
          <g key={t}>
            <text className='yTickText' textAnchor='middle' x={hPadding - 5} y={yScale(t) || 0 + 5}>
              {t.toPrecision(2)}
            </text>
          </g>
        )
      })}
    </g>
  )

  const yAxis = (
    <g>
      <line x1={43} x2={43} y1={height - marginBottom} y2={30} stroke='black' />
      <line x1={40} x2={43} y1={height - marginBottom} y2={height - marginBottom} stroke='black' />
      <line x1={40} x2={43} y1={30} y2={30} stroke='black' />
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
      {pValLabel}
      {yAxisTicks}
      {yAxis}
      {NoPValLabel}
    </svg>
  )
}
