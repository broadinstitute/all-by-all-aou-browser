import { withSize } from 'react-sizeme'
import styled from 'styled-components'

// @ts-expect-error ts-migrate(7016) FIXME: Could not find a declaration file for module '@gno... Remove this comment to see the full error message
import { ManhattanPlot } from '@gnomad/manhattan-plot'
import { GeneAssociations } from '../types'

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
const Wrapper = styled.div`
  overflow: hidden;
  width: 100%;
`

const GeneResultsManhattanPlot = withSize()(
  // @ts-expect-error ts-migrate(2339) FIXME: Property 'results' does not exist on type '{ child... Remove this comment to see the full error message
  ({ results, height, size: { width }, ...otherProps }) => {
    const dataPoints = results
      .map((r: GeneAssociations) => ({
        ...r,
        chrom: r.contig.replace('chr', ''),
        pos: r.gene_start_position,
        pval: r.pvalue,
      }))

    return (
      <Wrapper>
        {!!width && (
          <ManhattanPlot
            {...otherProps}
            gridLines={false}
            height={height}
            width={width}
            dataPoints={dataPoints}
            pointLabel={(d: any) =>
              `${d.gene_symbol || d.gene_id} (p = ${d.pvalue.toExponential(3)})`
            }
            pointColor={rotateColorByChromosome(['#262262', '#71797E'], chromosomes)}
            thresholdValue='2.2e-6'
            chromosomes={chromosomes}
          />
        )}
      </Wrapper>
    )
  }
)

GeneResultsManhattanPlot.displayName = 'GeneResultsManhattanPlot'

export default GeneResultsManhattanPlot
