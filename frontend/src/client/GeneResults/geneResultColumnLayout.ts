export const GENE_NAME_COLUMN_MIN_WIDTH_PX = 140

export const geneNameTextStyle = {
  display: 'block',
  minWidth: 0,
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const

type GeneNameFields = {
  gene_id?: string | null
  gene_symbol?: string | null
}

/** Keep the UI and CSV fallback identical when a result has no gene symbol. */
export const geneNameForResult = ({ gene_symbol, gene_id }: GeneNameFields) =>
  gene_symbol || gene_id || ''
