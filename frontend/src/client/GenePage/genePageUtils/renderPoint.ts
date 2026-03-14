import { transparentize } from 'polished'

import { VariantJoined } from '../../types'
import { GwasCatalogOption } from '../../variantState'
import { getCategoryFromConsequence } from '../../vepConsequences'

interface Margin {
  top: number
  bottom: number
}

interface RenderPointArgs {
  ctx: CanvasRenderingContext2D
  margin: Margin
  point: { data: VariantJoined; x: number; y: number }
  selectedVariant: VariantJoined | null | undefined
  selectedVariantId?: string | null
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
  theme?: { border?: string; text?: string; textMuted?: string }
}

export const renderPoint = ({
  ctx,
  point,
  selectedVariant,
  selectedVariantId,
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
  theme,
}: RenderPointArgs) => {
  // Use textMuted for strokes - provides good contrast in both light and dark modes
  const strokeColor = theme?.textMuted || '#666666';

  // Determine if stroke should be applied based on annotation (gene plot) or consequence (variant plot)
  const annotation = point.data.annotation;
  const consequence = point.data.consequence;
  const category = consequence ? getCategoryFromConsequence(consequence) : null;

  const shouldStroke = annotation === 'pLoF' || annotation === 'missense' ||
    category === 'lof' || category === 'missense';

  if (shouldStroke) {
    applyStroke = true
  }

  const isExplicitlySelected = selectedVariantId && point.data.variant_id === selectedVariantId;
  const hasAnySelection = !!selectedVariantId;
  const isHovered = activeVariant && point.data.variant_id === activeVariant;

  const h = height - margin.top - margin.bottom
  const rawRadius = Math.abs(alleleFrequencyScale(getAfField(point.data)))
  let radius = Number.isFinite(rawRadius) ? rawRadius : 3

  let yValue = h + margin.top + margin.bottom - 50
  if (point.data.pvalue) {
    yValue = point.y
  }

  // Determine base styles
  let fillColor = pointColor(point.data, betaScale) || 'black';
  let currentStrokeColor = strokeColor;
  let currentStrokeWidth = 0.5;
  let doStroke = applyStroke && shouldStroke;
  let compositeOp: GlobalCompositeOperation = 'destination-over';

  if (isExplicitlySelected) {
    compositeOp = 'source-over';
    doStroke = true;
    currentStrokeColor = '#c62828';
    currentStrokeWidth = 2;

    // Draw a light red halo behind the selected variant
    ctx.beginPath();
    ctx.arc(point.x, yValue, radius + 4, 0, 2 * Math.PI, false);
    ctx.fillStyle = 'rgba(229, 57, 53, 0.3)';
    ctx.fill();

    radius += 1;
  } else if (hasAnySelection) {
    // Dim unselected variants when one is selected
    compositeOp = 'destination-over';
    fillColor = transparentize(0.7, fillColor);
    doStroke = false;
  } else if (activeAnalysis && activeVariant && point.data.analysis_id === activeAnalysis && point.data.variant_id === activeVariant) {
    compositeOp = 'source-over';
    if (shouldStroke) {
      doStroke = true;
      currentStrokeWidth = 1;
    }
  } else if (isHovered) {
    compositeOp = 'source-over';
    doStroke = true;
    currentStrokeColor = '#333';
    currentStrokeWidth = 1.5;
  } else {
    compositeOp = 'destination-over';
    fillColor = transparentize(transparency[1], fillColor);
    if (shouldStroke) {
      doStroke = true;
      currentStrokeWidth = 0.5;
    }
  }

  ctx.beginPath();
  ctx.arc(point.x, yValue, radius, 0, 2 * Math.PI, false);

  ctx.globalCompositeOperation = compositeOp;
  ctx.fillStyle = fillColor;
  ctx.fill();

  if (doStroke) {
    ctx.strokeStyle = currentStrokeColor;
    ctx.lineWidth = currentStrokeWidth;
    ctx.stroke();
  }

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
