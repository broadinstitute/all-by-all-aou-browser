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

  const topBinValue = 50

  const yScaleNormal = scaleLinear().domain(dataYExtent).range([plotHeight, 0]).nice()

  const yExtent = [0, topBinValue]
  const yScaleLogThreshold = 10
  const linearPlotFraction = 1 / 3

  const yScaleExtent = [yExtent[0], yScaleLogThreshold]
  const yScaleLogExtent = [yScaleLogThreshold, yExtent[1]]

  const yScale = scaleLinear()
    .domain(yScaleExtent)
    .range([plotHeight, plotHeight * linearPlotFraction])
    .nice()

  const yScaleLog = scaleLog()
    .domain(yScaleLogExtent)
    .range([plotHeight * linearPlotFraction, 0])
    .nice()

  const yWithLogLogScale =
    (yScale: ScaleLinear<number, number>, yScaleLog: ScaleLogarithmic<number, number>) =>
    (log10PValue: number) => {
      let yScaled
      if (log10PValue < yScaleLogThreshold) {
        yScaled = yScale(log10PValue)
      } else {
        yScaled = yScaleLog(log10PValue)
      }
      return yScaled
    }

  const yScaleLogLog = yWithLogLogScale(yScale, yScaleLog)

  return (value: number) => {
    let y = 0
    if (logLogEnabled) {
      if (value < topBinValue) {
        y = yScaleLogLog(value) || 0
      } else {
        y = -(margin.top / 2 + 5)
      }
    } else {
      y = yScaleNormal(value) || 0
    }
    return y
  }
}
