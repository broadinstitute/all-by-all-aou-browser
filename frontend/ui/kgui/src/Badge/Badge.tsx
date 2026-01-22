import React from 'react'
import styled from 'styled-components'

import { TooltipAnchor } from '../Hover/TooltipAnchor'

const TextTooltipWrapper = styled.span`
  line-height: 1.5;
  text-align: center;
  white-space: pre-line;
`

const TextTooltip: React.FC<{ text: string }> = ({ text }) => <TextTooltipWrapper>{text}</TextTooltipWrapper>

const BADGE_COLOR: { [level: string]: string } = {
  error: '#DD2C00',
  info: '#424242',
  success: '#2E7D32',
  warning: 'orange',
}

const BadgeWrapper = styled.span<{ level: string }>`
  position: relative;
  top: -0.1em;
  display: inline-block;
  padding: 0.25em 0.4em 0.2em;
  border: 1px solid #000;
  border-radius: 0.3em;
  background: ${props => BADGE_COLOR[props.level]};
  color: ${props => (props.level === 'warning' ? '#000' : '#fff')};
  font-size: 0.75em;
  font-weight: bold;
  line-height: 1;
`

export interface BadgeProps {
  children: React.ReactNode
  level?: 'error' | 'info' | 'success' | 'warning'
  tooltip?: string
}

export const Badge: React.FC<BadgeProps> = ({ children, level = 'info', tooltip }) =>
  tooltip ? (
    <TooltipAnchor text={tooltip} tooltipComponent={TextTooltip}>
      <BadgeWrapper level={level}>{children}</BadgeWrapper>
    </TooltipAnchor>
  ) : (
    <BadgeWrapper level={level}>{children}</BadgeWrapper>
  )

