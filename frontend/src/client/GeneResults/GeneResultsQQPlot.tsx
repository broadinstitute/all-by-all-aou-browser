import { withSize } from 'react-sizeme'
import styled from 'styled-components'

// @ts-expect-error ts-migrate(7016) FIXME: Could not find a declaration file for module '@gno... Remove this comment to see the full error message
import { QQPlot } from '@gnomad/qq-plot'

const Wrapper = styled.div`
  overflow: hidden;
  width: 100%;
`

const GeneResultsQQPlot = withSize()(({ results, height, size: { width }, ...otherProps }: any) => {
  const dataPoints = results.filter((r: any) => r.pvalue)
  return (
    <Wrapper>
      {!!width && (
        <QQPlot
          {...otherProps}
          gridLines={false}
          height={height}
          width={width}
          dataPoints={dataPoints}
          pointLabel={(d: any) =>
            `${d.gene_symbol || d.gene_id} (p = ${d.pvalue.toExponential(3)})`
          }
        />
      )}
    </Wrapper>
  )
})

export default GeneResultsQQPlot
