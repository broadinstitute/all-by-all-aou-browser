import { withSize } from 'react-sizeme'
import styled from 'styled-components'

// @ts-expect-error ts-migrate(7016) FIXME: Could not find a declaration file for module '@gno... Remove this comment to see the full error message
import { QQPlot } from '@gnomad/qq-plot'

const Wrapper = styled.div`
  overflow: hidden;
  width: 100%;
`

// @ts-expect-error ts-migrate(2339) FIXME: Property 'results' does not exist on type '{ child... Remove this comment to see the full error message
const VariantQQPlot = withSize()(({ results, size: { width }, ...otherProps }) => {
  const dataPoints = results
    .filter((r: any) => r.pvalue)
    .map((v: any) => ({ ...v, obs_pval: v.pvalue, exp_pval: v.pvalue_expected }))

  return (
    <Wrapper>
      {!!width && (
        <QQPlot
          {...otherProps}
          gridLines={false}
          height={300}
          width={width}
          dataPoints={dataPoints}
          pointRadius={() => 1.5}
          pointLabel={(d: any) => d.variant_id}
          xyStrokeStyle='black'
        />
      )}
    </Wrapper>
  )
})

export default VariantQQPlot
