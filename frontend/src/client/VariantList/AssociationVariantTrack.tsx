// @ts-nocheck
/* eslint-disable */
// will be deleted soon
import { extent } from 'd3-array'
import { scaleLinear, scaleLog } from 'd3-scale'
import React, { Component, PureComponent } from 'react'
import { transparentize } from 'polished'
import { throttle } from 'lodash'
import { getCategoryFromConsequence } from '../vepConsequences'

import { Track } from '@axaou/ui'

const exacClassicColors = {
  lof: transparentize(0.3, '#FF583F'),
  missense: transparentize(0.3, '#F0C94D'),
  synonymous: transparentize(0.3, 'green'),
  other: transparentize(0.3, '#757575'),
}

const alleleFrequencyScale = scaleLog().domain([0.00001, 1]).range([4, 12])

const CANVAS_SCALE = window.devicePixelRatio || 1

type VariantGWASPlotProps = {
  height: number
  scalePosition: (...args: any[]) => any
  scaleAf?: boolean
  pointLabel?: (...args: any[]) => any
  onClickPoint?: (...args: any[]) => any
  variants: {
    allele_freq?: number
    consequence?: string
    pos: number
    variant_id: string
  }[]
  vPadding: number
  width: number
}

export class VariantGWASPlot extends Component<VariantGWASPlotProps> {
  constructor(props: VariantGWASPlotProps) {
    super(props)
    this.onMouseMove = this.onMouseMove.bind(this)
    this.onMouseEnter = this.onMouseEnter.bind(this)
    this.onMouseLeave = this.onMouseLeave.bind(this)
    this.onClick = this.onClick.bind(this)
    this.throttledDraw = throttle(this.draw, 100).bind(this)
  }

  componentDidMount() {
    this.draw()
  }

  componentDidUpdate() {
    this.draw()
  }

  rememberCanvasEl = (el) => {
    this.canvasEl = el
  }

  scaleVariantsToGraph({ variants, height, vPadding, scalePosition, scaleAf }) {
    const yExtent = extent(variants, (v) => v.logp)
    const logpScale = scaleLinear()
      .domain(yExtent)
      .range([height - vPadding, vPadding])
      .nice()

    return variants.map((variant) => {
      const markerX = scalePosition(variant.pos)
      const markerY = logpScale(variant.logp)
      let fill
      let rx
      let ry

      if (!variant.allele_frequency) {
        fill = 'white'
        rx = 1
        ry = 1
      } else {
        const category = getCategoryFromConsequence(variant.consequence) || 'other'
        fill = exacClassicColors[category]
        rx = 3
        ry = scaleAf ? alleleFrequencyScale(variant.allele_frequency) : 2.5
      }
      return {
        fill,
        rx,
        ry,
        markerX,
        markerY,
        data: variant,
      }
    })
  }

  findClosestVariant({
    canvas,
    mouseClientX,
    mouseClientY,
    variants,
    height,
    vPadding,
    scalePosition,
    scaleAf,
    distanceThreshold = 5,
  }) {
    const { top, left } = canvas.getBoundingClientRect()
    const relativeX = mouseClientX - left
    const relativeY = mouseClientY - top

    const scaledVariants = this.scaleVariantsToGraph({
      variants,
      height,
      vPadding,
      scalePosition,
      scaleAf,
    })
    let minDistance = Infinity
    let nearestVariant
    for (const variant of scaledVariants) {
      const distance = Math.sqrt(
        (variant.markerX - relativeX) ** 2 + (variant.markerY - relativeY) ** 2
      )
      if (distance < minDistance) {
        minDistance = distance
        nearestVariant = variant
      }
    }
    return minDistance < distanceThreshold ? nearestVariant : undefined
  }

  draw(mouseClientX, mouseClientY) {
    const { height, scalePosition, vPadding, variants, width, scaleAf, pointLabel } = this.props
    const shouldShowHoverTooltip = this.shouldShowHoverTooltip

    const canvas = this.canvasEl
    const ctx = canvas.getContext('2d')

    ctx.setTransform(CANVAS_SCALE, 0, 0, CANVAS_SCALE, 0, 0)
    ctx.clearRect(0, 0, width, height)
    ctx.lineWidth = 0.5
    ctx.strokeStyle = '#000'

    const scaledVariants = this.scaleVariantsToGraph({
      variants,
      height,
      vPadding,
      scalePosition,
      scaleAf,
    })

    scaledVariants.forEach(({ fill, rx, ry, markerX, markerY }) => {
      ctx.beginPath()
      ctx.arc(markerX, markerY, ry, 0, 2 * Math.PI)
      ctx.closePath()
      ctx.fillStyle = fill
      ctx.fill()
      ctx.stroke()
    })

    if (shouldShowHoverTooltip) {
      const { top, left } = canvas.getBoundingClientRect()
      const relativeX = mouseClientX - left
      const relativeY = mouseClientY - top
      const closestVariant = this.findClosestVariant({
        canvas,
        mouseClientX,
        mouseClientY,
        variants,
        height,
        vPadding,
        scalePosition,
        scaleAf,
      })
      if (closestVariant != undefined) {
        ctx.font = '14px sans-serif'
        const label = pointLabel(closestVariant.data)

        const { width: textWidth } = ctx.measureText(label)

        const labelX =
          relativeX < width / 2 ? closestVariant.markerX : closestVariant.markerX - textWidth - 10
        const labelY = relativeY < 30 ? closestVariant.markerY : closestVariant.markerY - 24

        ctx.beginPath()
        ctx.rect(labelX, labelY, textWidth + 12, 24)
        ctx.fillStyle = '#000'
        ctx.fill()

        ctx.fillStyle = '#fff'
        ctx.fillText(label, labelX + 6, labelY + 16)
      }
    }
  }

  shouldShowHoverTooltip = false

  onMouseMove(e) {
    this.throttledDraw(e.clientX, e.clientY)
  }

  onMouseEnter(e) {
    this.shouldShowHoverTooltip = true
  }

  onMouseLeave(e) {
    this.shouldShowHoverTooltip = false
  }

  onClick(e) {
    const { height, scalePosition, vPadding, variants, scaleAf, onClickPoint } = this.props
    if (this.canvasEl != null) {
      const closestVariant = this.findClosestVariant({
        canvas: this.canvasEl,
        mouseClientX: e.clientX,
        mouseClientY: e.clientY,
        variants,
        height,
        vPadding,
        scalePosition,
        scaleAf,
      })
      if (closestVariant != undefined) {
        onClickPoint(closestVariant.data)
      }
    }
  }

  render() {
    const { height, width } = this.props

    return (
      <canvas
        ref={this.rememberCanvasEl}
        onMouseMove={this.onMouseMove}
        onMouseEnter={this.onMouseEnter}
        onMouseLeave={this.onMouseLeave}
        onClick={this.onClick}
        height={height * CANVAS_SCALE}
        width={width * CANVAS_SCALE}
        style={{
          height: `${height}px`,
          width: `${width}px`,
        }}
      />
    )
  }
}

const hPadding = 98
const vPadding = 5

const leftPanel = ({ height, variants, width }) => {
  const filteredVariants = variants.filter((v) => v.logp !== Infinity)
  const yExtent = extent(filteredVariants, (d) => d.logp)
  const yScale = scaleLinear()
    .domain(yExtent)
    .range([height - vPadding, vPadding])
    .nice()

  const yAxisLabel = (
    <text x={5} y={height / 2} transform={`rotate(270 ${hPadding / 3} ${height / 2})`}>
      {'-log10(P)'}
    </text>
  )

  const yAxisTicks = (
    <g>
      {yScale.ticks(5).map((t) => {
        return (
          <g key={t}>
            <text className='yTickText' textAnchor='middle' x={hPadding - 15} y={yScale(t) + 5}>
              {t}
            </text>
          </g>
        )
      })}
    </g>
  )

  return (
    <svg width={width} height={height}>
      {yAxisLabel}
      {yAxisTicks}
    </svg>
  )
}

type OwnAssociationVariantTrackProps = {
  height?: number
  scaleAf?: boolean
  onVariantClick: any
  variants: {
    allele_freq?: number
    consequence?: string
    pos: number
    variant_id: string
  }[]
}

type AssociationVariantTrackProps = OwnAssociationVariantTrackProps &
  typeof AssociationVariantTrack.defaultProps

class AssociationVariantTrack extends PureComponent<AssociationVariantTrackProps> {
  static defaultProps = {
    height: 60,
    scaleAf: false,
  }

  render() {
    const { height, variants, scaleAf, onVariantClick } = this.props
    const pointLabel = (variant) => `${variant.variant_id} (p = ${variant.pvalue.toExponential(3)})`
    const onClickPoint = (datum) => {
      onVariantClick(datum.variant_id)
    }
    return (
      <Track renderLeftPanel={leftPanel} variants={variants} height={height}>
        <VariantGWASPlot
          scaleAf={scaleAf}
          height={height}
          pointLabel={pointLabel}
          onClickPoint={onClickPoint}
          variants={plottableVariants}
          vPadding={vPadding}
        />
      </Track>
    )
  }
}

export default AssociationVariantTrack
