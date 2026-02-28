import { extent } from 'd3-array'
import { scaleLog, scaleLinear, ScaleLinear, ScaleLogarithmic } from 'd3-scale'
import { VariantJoined } from '../types'

interface Margin {
  top: number
  bottom: number
}

interface Args {
  variants: VariantJoined[]
  height: number
  margin: Margin
  logLogEnabled?: boolean
}

export const createLogLogScaleY = ({ variants, height, margin, logLogEnabled = true }: Args) => {
  const dataYExtent = (extent(variants, (d) => d.pvalue) as Array<number>)
    .map((p) => -Math.log10(p))
    .reverse()

  const plotHeight = height - margin.top - margin.bottom

  const yScaleNormal = scaleLinear().domain(dataYExtent).range([plotHeight, 0]).nice()

  // Hybrid linear-log scale constants (matching Manhattan/layout.ts)
  const LOG_THRESHOLD = 10
  const LINEAR_FRACTION = 0.6
  const MAX_NEG_LOG_P = 300

  const yScaleLogLog = (log10PValue: number) => {
    let positionFromBottom: number
    if (log10PValue <= LOG_THRESHOLD) {
      positionFromBottom = (log10PValue / LOG_THRESHOLD) * LINEAR_FRACTION
    } else {
      const logVal = Math.log(log10PValue / LOG_THRESHOLD)
      const logMax = Math.log(MAX_NEG_LOG_P / LOG_THRESHOLD)
      const logPosition = Math.min(logVal / logMax, 1.0)
      positionFromBottom = LINEAR_FRACTION + logPosition * (1 - LINEAR_FRACTION)
    }
    return plotHeight * (1 - positionFromBottom)
  }

  return (value: number) => {
    let y = 0
    if (logLogEnabled) {
      if (value <= MAX_NEG_LOG_P) {
        y = yScaleLogLog(value) || 0
      } else {
        // Place extremely significant variants just above the plot area (at y = -10)
        // This keeps them visible at the top without bleeding into the label zone
        y = -10
      }
    } else {
      y = yScaleNormal(value) || 0
    }
    return y
  }
}
