import React from 'react'

import type { BurdenDirection } from './geneAssociationSemantics'

type Props = {
  direction: BurdenDirection | null | undefined
  fillCell?: boolean
}

const PRESENTATION: Record<
  BurdenDirection,
  { symbol: string; color: string; label: string }
> = {
  positive: {
    symbol: '▲',
    color: '#0072b2',
    label: 'Positive META burden-statistic direction; magnitude unavailable',
  },
  negative: {
    symbol: '▼',
    color: '#d55e00',
    label: 'Negative META burden-statistic direction; magnitude unavailable',
  },
  zero: {
    symbol: '■',
    color: '#6b7280',
    label: 'Zero META burden-statistic direction; magnitude unavailable',
  },
}

export const BurdenDirectionIndicator = ({ direction, fillCell = true }: Props) => {
  const presentation = direction ? PRESENTATION[direction] : undefined
  const symbol = presentation?.symbol ?? '—'
  const label =
    presentation?.label ?? 'META burden-statistic direction unavailable; magnitude unavailable'

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      style={{
        color: presentation?.color ?? 'var(--theme-text-muted, #6b7280)',
        display: 'inline-flex',
        justifyContent: 'center',
        width: fillCell ? '100%' : 'auto',
        fontSize: 14,
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {symbol}
    </span>
  )
}
