import styled from 'styled-components'
import { SegmentedControl } from '@gnomad/ui'

const ControlsWrapper = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  margin-right: 20px;
  margin-bottom: 0;
`

const AnalysisControls = ({ burdenSet, setBurdenSet }: any) => {
  const options = [{ value: 'pLoF' }, { value: 'missenseLC' }, { value: 'synonymous' }]

  return (
    <ControlsWrapper>
      {/* @ts-ignore */}
      <SegmentedControl
        id='analysis-control'
        options={options}
        value={burdenSet}
        onChange={setBurdenSet}
      />
    </ControlsWrapper>
  )
}
export default AnalysisControls
