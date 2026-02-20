import { transparentize } from 'polished'

import { VariantJoined } from '../../types'
import { GwasCatalogOption } from '../../variantState'

interface Margin {
  top: number
  bottom: number
}

interface RenderPointArgs {
  ctx: CanvasRenderingContext2D
  margin: Margin
  point: { data: VariantJoined; x: number; y: number }
  selectedVariant: VariantJoined | null | undefined
  activeVariant?: string | null
  activeAnalysis?: string | null
  alleleFrequencyScale: any
  getAfField?: (d: VariantJoined) => number
  applyStroke?: boolean
  pointColor: any
  transparency: [number, number]
  betaScale: any
  height: number
  gwasCatalogOption?: GwasCatalogOption
}

export const renderPoint = ({
  ctx,
  point,
  selectedVariant,
  activeVariant,
  activeAnalysis,
  margin,
  applyStroke = false,
  pointColor,
  alleleFrequencyScale,
  transparency,
  betaScale,
  getAfField = (variant) =>
    variant.allele_frequency || variant.association_af || variant.af_cases || 0,
  height,
  gwasCatalogOption,
}: RenderPointArgs) => {
  if (selectedVariant && point.data.locus.position == selectedVariant.locus.position) {
    ctx.beginPath()
    ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI, false)
    ctx.fillStyle = 'red'
    ctx.fill()
  }

  if (point.data.annotation == "pLoF" || point.data.annotation == "missense") {
    applyStroke = true
  }

  const singleVariantSelected = activeAnalysis && activeVariant

  ctx.beginPath()

  const h = height - margin.top - margin.bottom

  // Calculate radius with fallback for NaN/Infinity (happens when af=0 with log scale)
  const rawRadius = Math.abs(alleleFrequencyScale(getAfField(point.data)))
  const radius = Number.isFinite(rawRadius) ? rawRadius : 3

  let yValue = h + margin.top + margin.bottom - 50

  if (point.data.pvalue) {
    yValue = point.y
  }
  ctx.arc(point.x, yValue, radius, 0, 2 * Math.PI, false)

  if (applyStroke) {
    ctx.fillStyle = pointColor(point.data, betaScale)
    ctx.strokeStyle = 'black'
    ctx.lineWidth = 1
    ctx.stroke()
  } else if (point.data.analysis_id === activeAnalysis && point.data.variant_id === activeVariant) {
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = pointColor(point.data, betaScale)
  } else if (
    !singleVariantSelected &&
    (point.data.analysis_id === activeAnalysis || point.data.variant_id === activeVariant)
  ) {
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = pointColor(point.data, betaScale)
    ctx.strokeStyle = 'black'
    ctx.lineWidth = 1.5
    ctx.stroke()
  } else {
    ctx.globalCompositeOperation = 'destination-over'
    ctx.fillStyle = transparentize(transparency[1], pointColor(point.data, betaScale) || 'black')
  }

  ctx.fill()

  if (gwasCatalogOption === 'highlight') {
    if (point.data.gwas_catalog) {
      ctx.beginPath()
      ctx.arc(point.x, yValue, radius, 0, 2 * Math.PI, false)
      ctx.strokeStyle = 'purple'
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }
}
