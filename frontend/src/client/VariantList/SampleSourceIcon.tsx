import { transparentize } from 'polished'
import styled from 'styled-components'

import { TooltipAnchor } from '@gnomad/ui'

const Icon = styled.span<{ isFiltered: boolean; color: string }>`
  padding: 1px 4px;
  border: 1px ${(props) => (props.isFiltered ? 'dashed' : 'solid')} #000;
  border-radius: 3px;
  margin-left: 10px;
  background-color: ${(props) =>
    props.isFiltered ? transparentize(0.5, props.color) : props.color};
  color: white;
`

const abbreviations = {
  exome: 'E',
  genome: 'G',
}

const colors = {
  exome: 'rgb(70, 130, 180)',
  genome: 'rgb(115, 171, 61)',
}

type Props = {
  source: 'exome' | 'genome'
  filters: string[]
}

const SampleSourceIcon = ({ source, filters }: Props) => {
  const isFiltered = filters.length > 0

  let tooltip = `This variant is found in ${source} samples`
  if (isFiltered) {
    tooltip += `, where it failed the following filters: ${filters.join(', ')}`
  }

  return (
    <TooltipAnchor tooltip={tooltip}>
      <Icon color={colors[source]} isFiltered={isFiltered}>
        {abbreviations[source]}
      </Icon>
    </TooltipAnchor>
  )
}

export default SampleSourceIcon
