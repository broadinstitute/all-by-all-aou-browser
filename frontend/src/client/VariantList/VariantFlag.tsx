import { Badge } from '@gnomad/ui'

const flagProps = {
  lcr: {
    children: 'LCR',
    level: 'info',
    formatTooltip: () => 'Found in a low complexity region\nVariant annotation or quality dubious',
  },
  fail_interval_qc: {
    children: 'FIQC',
    level: 'warning',
    formatTooltip: () => 'Failed interval QC',
  },
  in_capture_region: {
    children: 'Capture',
    level: 'info',
    formatTooltip: () => 'In capture kit',
  },
  lc_lof: {
    children: 'LC pLoF',
    level: 'error',
    formatTooltip: (variant: any) =>
      `Low-confidence pLoF: ${variant.lof_filter}\nVariant annotation or quality dubious`,
  },
  lof_flag: {
    children: 'pLoF flag',
    level: 'warning',
    formatTooltip: (variant: any) =>
      `Flagged by LOFTEE: ${variant.lof_flags}\nVariant annotation or quality dubious`,
  },
  nc_transcript: {
    children: 'NC Transcript',
    level: 'error',
    formatTooltip: () => 'Non-protein-coding transcript\nVariant annotation dubious',
  },
  os_lof: {
    children: 'OS pLoF',
    level: 'info',
    formatTooltip: () =>
      'Variant predicted to create or disrupt a splice site outside the canonical splice site (beta)',
  },
  mnv: {
    children: 'MNV',
    level: 'error',
    formatTooltip: () =>
      'Multi-nucleotide variant: this variant is found in phase with another variant in some individuals, altering the amino acid sequence\nVariant annotation dubious',
  },
}

type Props = {
  type: any // TODO: PropTypes.oneOf(Object.keys(flagProps))
}

const VariantFlag = ({ type }: Props) => {
  if (type in flagProps) {
    // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    const { children, level } = flagProps[type]
    return <Badge level={level}>{children}</Badge>
  }
  return null
}

export default VariantFlag
