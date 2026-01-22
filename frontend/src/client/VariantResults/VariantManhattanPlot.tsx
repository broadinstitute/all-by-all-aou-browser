import { withSize } from 'react-sizeme'
import styled from 'styled-components'

// @ts-expect-error ts-migrate(7016) FIXME: Could not find a declaration file for module '@gno... Remove this comment to see the full error message
import { ManhattanPlot } from '@gnomad/manhattan-plot'
import { VariantAssociations } from '../types'

const Wrapper = styled.div`
  overflow: hidden;
  width: 100%;
`

const chromosomes = Array.from(new Array(22), (_, i) => `${i + 1}`).concat(['X', 'Y'])

const rotateColorByChromosome = (colors: any, chromosomes: any) => {
  const chromosomeColors = chromosomes.reduce(
    (acc: any, chr: any, i: any) => ({
      ...acc,
      [chr]: colors[i % colors.length],
    }),
    {}
  )

  return (dataPoint: any) => chromosomeColors[dataPoint.chrom]
}

// @ts-expect-error ts-migrate(2339) FIXME: Property 'variants' does not exist on type '{ chil... Remove this comment to see the full error message
const VariantManhattanPlot = withSize()(({ variants, size: { width }, ...otherProps }) => {
  const dataPoints = variants.filter(
    (v: VariantAssociations) =>
      v.allele_count !== 0 && v.pvalue && v.pvalue !== Infinity && v.pvalue !== 0
  )
  return (
    <Wrapper>
      {!!width && (
        <ManhattanPlot
          {...otherProps}
          gridLines={false}
          height={300}
          width={width}
          dataPoints={dataPoints}
          pointColor={rotateColorByChromosome(['#262262', '#71797E'], chromosomes)}
          // pointColor={rotateColorByChromosome(['#49699c', '#6aa7d5'], chromosomes)}
          chromosomes={chromosomes}
        />
      )}
    </Wrapper>
  )
})

VariantManhattanPlot.displayName = 'VariantManhattanPlot'

export default VariantManhattanPlot
