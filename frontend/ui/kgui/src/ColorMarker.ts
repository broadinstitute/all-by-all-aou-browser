import styled from 'styled-components'

export const ColorMarker = styled.span<{ color: string; border?: string; borderColor?: string }>`
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 0.5em;

  &::before {
    content: '';
    display: inline-block;
    box-sizing: border-box;
    width: 10px;
    height: 10px;
    border: 1px ${props => props.border || 'solid'} ${props => props.borderColor || '#000'};
    border-radius: 5px;
    background: ${props => props.color};
  }
`
