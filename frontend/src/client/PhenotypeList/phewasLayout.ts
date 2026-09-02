export type PhewasLayoutMode = 'pane' | 'document'

export const DOCUMENT_PHEWAS_ROW_CAP = 16
export const DOCUMENT_PHEWAS_EMPTY_STATE_HEIGHT = 64
export const PANE_PHEWAS_EMPTY_STATE_HEIGHT = 320

type PhewasTableLayoutInput = {
  layoutMode: PhewasLayoutMode
  rowCount: number
  windowHeight?: number
  plotHeight: number
}

type PhewasTableLayoutPolicy = {
  numRowsRendered: number
  emptyStateHeight: number
}

export const getPhewasTableLayoutPolicy = ({
  layoutMode,
  rowCount,
  windowHeight,
  plotHeight,
}: PhewasTableLayoutInput): PhewasTableLayoutPolicy => {
  if (layoutMode === 'document') {
    return {
      numRowsRendered: Math.min(Math.max(rowCount, 0), DOCUMENT_PHEWAS_ROW_CAP),
      emptyStateHeight: DOCUMENT_PHEWAS_EMPTY_STATE_HEIGHT,
    }
  }

  let numRowsRendered = 20
  if (windowHeight) {
    const baseOffset = 280
    const availableHeight = windowHeight - baseOffset - plotHeight
    numRowsRendered = Math.floor(availableHeight / 25)
  }

  return {
    numRowsRendered: Math.max(numRowsRendered, 10),
    emptyStateHeight: PANE_PHEWAS_EMPTY_STATE_HEIGHT,
  }
}

export const getVariantPhewasLayoutMode = (
  layout: 'standalone' | 'composed'
): PhewasLayoutMode => (layout === 'composed' ? 'document' : 'pane')
