import React from 'react'

import { TooltipAnchor } from './TooltipAnchor'

export function withTooltip(Component: any) {
  function WithTooltip(props: any) {
    return <TooltipAnchor {...props} tooltipComponent={Component} />
  }
  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
  WithTooltip.displayName = `WithTooltip(${Component.displayName || Component.name || 'Component'})`
  return WithTooltip
}
