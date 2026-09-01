export const browsingModeControlContract = {
  groupLabel: 'Browsing mode',
  options: [
    { value: 'focused', label: 'Focused' },
    { value: 'sideBySide', label: 'Side by side' },
  ],
} as const

export const mobileControlContract = {
  globalSearch: {
    breakpoint: 750,
    triggerLabel: 'Open global search',
    controlsId: 'search-results',
  },
  phewasOptions: {
    breakpoint: 700,
  },
} as const

export const optionPanelContract = {
  phewas: {
    id: 'phewas-options-panel',
    label: 'PheWAS options',
  },
  detail: {
    id: 'detail-display-options-panel',
  },
} as const

export const getDetailOptionsLabel = ({
  variantId,
  regionId,
}: {
  variantId?: string | null
  regionId?: string | null
}): string => {
  if (variantId) return 'Variant options'
  if (regionId) return 'Locus options'
  return 'Gene options'
}
