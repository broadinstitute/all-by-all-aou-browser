import React from 'react'
// @ts-expect-error 
import Highlighter from 'react-highlight-words'
// @ts-expect-error 
import RightArrow from '@fortawesome/fontawesome-free/svgs/solid/arrow-alt-circle-right.svg'
// @ts-expect-error 
import UpArrow from '@fortawesome/fontawesome-free/svgs/solid/arrow-alt-circle-up.svg'
import { TooltipAnchor, TooltipHint as TooltipHintBase, Link } from '@gnomad/ui'
import { useRecoilState, useSetRecoilState, useRecoilValue } from 'recoil'
import styled from 'styled-components'
import { renderBetaCell, renderCount, renderPvalueCell } from '../PhenotypeList/Utils'
import { AncestryGroupCodes } from '../sharedState'
import { useAppNavigation } from '../hooks/useAppNavigation'
import { VariantAssociationManhattan, VariantJoined } from '../types'
import { ColorMarker } from '../UserInterface'
import { VariantFieldGroup, variantLabelsAtom, variantShowLabelAtom } from '../variantState'
import { getCategoryFromConsequence, getLabelForConsequenceTerm } from '../vepConsequences'
import SampleSourceIcon from './SampleSourceIcon'
import VariantFlag from './VariantFlag'

const categoryColors = {
  lof: '#DD2C00',
  missense: 'rgb(240, 201, 77)',
  // synonymous: '#2E7D32',
  synonymous: 'grey',
  other: '#424242',
  pLoF: '#DD2C00',
  'missense|LC': 'orange',
  gwas: '#424242',
}
const analysisColors = {
  pLoF: '#DD2C00',
  'missense|LC': 'rgb(240, 201, 77)',
  // synonymous: '#2E7D32',
  synonymous: 'grey',
  gwas: 'blue',
  other: '#424242',
}
const getAnalysisColor = (analysis: any) => {
  if (!analysis) {
    return 'gray'
  }
  // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  return analysisColors[analysis] ? analysisColors[analysis] : 'grey'
}
export const getConsequenceColor = (consequenceTerm: any) => {
  if (!consequenceTerm) {
    return 'gray'
  }
  const category = getCategoryFromConsequence(consequenceTerm) || 'other'
  // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  return categoryColors[category]
}
const getConsequenceName = (consequenceTerm: any) =>
  consequenceTerm ? getLabelForConsequenceTerm(consequenceTerm) : 'N/A'

const renderExponentialNumberCell = (row: any, key: any) => {
  const num = row[key]
  if (num === null || num === undefined) {
    return null
  }
  const truncated = Number(num.toPrecision(3))
  if (truncated === 0) {
    return '0'
  }
  return truncated.toExponential()
}

const TooltipHint = styled(TooltipHintBase)`
  background-image: none;

  span {
    max-width: 130px;
    height: 100%;
    overflow-x: hidden;
    white-space: nowrap;
  }
`

const InfoTooltipWrapper = styled.div`
  display: flex;
  flex-direction: column;
`
const InfoTooltipItem = styled.div`
  margin-bottom: 5px;

  strong {
    font-weight: bold;
    margin-right: 5px;
  }
  span {
    margin-right: 5px;
  }
`
const AnalysisHitsTooltip = ({ rowData }: any) => {
  const { analyses } = rowData
  const analysesDisplayed = analyses.map((analysis: any) => {
    return (
      <InfoTooltipItem key={`${rowData.variant_id}-${analysis.analysis_id}`}>
        <p>
          {analysis.description} Pvalue: {analysis.pvalue} Beta: {analysis.beta}
        </p>
      </InfoTooltipItem>
    )
  })
  return <InfoTooltipWrapper>{analysesDisplayed}</InfoTooltipWrapper>
}

const GwasCatalogTooltip = ({ rowData }: any) => {
  const items = rowData.gwas_catalog.slice(0, 3)

  const numRemaining = rowData.gwas_catalog.length - items.length
  return (
    <InfoTooltipWrapper>
      {items.map((item: any, i: number) => {
        return (
          <InfoTooltipWrapper key={`${rowData.variant_id}-gwas_catalog-${i}`}>
            <InfoTooltipItem>
              <strong>Mapped trait:</strong>
              <span>{item.mapped_trait}</span>
              <strong>P-value</strong>
              <span>{item.pvalue}</span>
              <strong>Study:</strong>
              <span>{item.study.slice(0)}</span>
              <strong>Author:</strong>
              <span>{item.first_author}</span>
              <strong>Journal:</strong>
              <span>{item.journal}</span>
              <strong>Date:</strong>
              <span>{item.date_added}</span>
              <span />
              {numRemaining !== 0 && <strong>And {numRemaining} more...</strong>}
            </InfoTooltipItem>
          </InfoTooltipWrapper>
        )
      })}
    </InfoTooltipWrapper>
  )
}

const borderBottom = '1px solid var(--theme-border, black)'
const background = 'var(--theme-surface-alt, whitesmoke)'

// Styled input for label editing
const LabelInput = styled.input`
  width: 60px;
  padding: 2px 4px;
  font-size: 11px;
  border: 1px solid var(--theme-border, #ccc);
  border-radius: 3px;
  background: var(--theme-surface, white);
  color: var(--theme-text, black);

  &:focus {
    outline: none;
    border-color: #1976d2;
  }

  &::placeholder {
    color: #999;
    font-style: italic;
  }
`

// Component for toggle label visibility cell
const ShowLabelCell = ({ variantId }: { variantId: string }) => {
  const [showLabels, setShowLabels] = useRecoilState(variantShowLabelAtom)
  const isShown = showLabels[variantId] || false

  const handleToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    setShowLabels(prev => ({ ...prev, [variantId]: e.target.checked }))
  }

  return (
    <input
      type="checkbox"
      checked={isShown}
      onChange={handleToggle}
      onClick={(e) => e.stopPropagation()}
      style={{ cursor: 'pointer', margin: '0 auto', display: 'block' }}
    />
  )
}

// Component for editable label cell
const LabelCell = ({ variantId }: { variantId: string }) => {
  const [labels, setLabels] = useRecoilState(variantLabelsAtom)
  const currentLabel = labels[variantId] || ''

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newLabel = e.target.value
    setLabels(prev => {
      if (newLabel === '') {
        const { [variantId]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [variantId]: newLabel }
    })
  }

  return (
    <LabelInput
      type="text"
      value={currentLabel}
      onChange={handleChange}
      placeholder="label"
      onClick={(e) => e.stopPropagation()}
    />
  )
}

export const countColumns = (ancestryGroup: AncestryGroupCodes, betaScale?: any) => [
  {
    key: 'pvalue',
    displayId: 'pvalue',
    heading: 'P-Value',
    tooltip: 'P-Value',
    grow: 0,
    isSortable: true,
    minWidth: 90,
    render: renderPvalueCell('variant'),
    background,
  },
  {
    key: 'beta',
    displayId: 'beta',
    heading: 'Beta',
    tooltip: 'Beta',
    grow: 0,
    isSortable: true,
    minWidth: 90,
    render: renderBetaCell(betaScale),
    borderBottom,
    background,
  },
  {
    key: 'ac_cases',
    displayId: 'ac_cases',
    heading: 'AC Case',
    tooltip: 'Allele count cases',
    grow: 0,
    isSortable: true,
    minWidth: 80,
    render: renderCount,
  },
  {
    key: 'an_cases',
    displayId: 'an_cases',
    heading: 'AN Case',
    tooltip: 'Allele number cases (computed from ac_cases / af_cases)',
    grow: 0,
    isSortable: true,
    minWidth: 80,
    render: (row: any) => {
      // Compute AN from AC/AF if available
      if (row.ac_cases && row.af_cases && row.af_cases > 0) {
        return Math.round(row.ac_cases / row.af_cases).toLocaleString();
      }
      // Fall back to raw value if present
      if (row.an_cases !== null && row.an_cases !== undefined) {
        return row.an_cases.toLocaleString();
      }
      return '-';
    },
    borderBottom,
  },
  {
    key: 'ac_controls',
    displayId: 'ac_controls',
    heading: 'AC Cont.',
    tooltip: 'Allele count controls',
    grow: 0,
    isSortable: true,
    minWidth: 80,
    render: renderCount,
    background,
  },
  {
    key: 'an_controls',
    displayId: 'an_controls',
    heading: 'AN Cont.',
    tooltip: 'Allele number controls (computed from ac_controls / af_controls)',
    grow: 0,
    isSortable: true,
    minWidth: 80,
    render: (row: any) => {
      // Compute AN from AC/AF if available
      if (row.ac_controls && row.af_controls && row.af_controls > 0) {
        return Math.round(row.ac_controls / row.af_controls).toLocaleString();
      }
      // Fall back to raw value if present
      if (row.an_controls !== null && row.an_controls !== undefined) {
        return row.an_controls.toLocaleString();
      }
      return '-';
    },
    borderBottom,
    background,
  },
  {
    key: 'association_ac',
    displayId: 'association_ac',
    heading: 'AC Trait',
    tooltip: 'Allele count individuals tested for trait',
    grow: 0,
    isSortable: true,
    minWidth: 80,
    render: renderCount,
  },
  {
    key: 'association_an',
    displayId: 'association_an',
    heading: 'AN Trait',
    tooltip: 'Allele number individuals tested for trait (computed from association_ac / association_af)',
    grow: 0,
    isSortable: true,
    minWidth: 80,
    render: (row: any) => {
      // Compute AN from AC/AF if available
      if (row.association_ac && row.association_af && row.association_af > 0) {
        return Math.round(row.association_ac / row.association_af).toLocaleString();
      }
      // Fall back to raw value if present
      if (row.association_an !== null && row.association_an !== undefined) {
        return row.association_an.toLocaleString();
      }
      return '-';
    },
    borderBottom,
  },
  {
    key: 'allele_count',
    displayId: 'allele_count',
    heading: `AC ${ancestryGroup.toUpperCase()}`,
    tooltip: `Allele count in ${ancestryGroup.toUpperCase()} population (regardless of trait measured)`,
    grow: 0,
    isSortable: true,
    minWidth: 80,
    render: renderCount,
    background,
  },
  {
    key: 'homozygote_count',
    displayId: 'homozygote_count',
    heading: `Hom ${ancestryGroup.toUpperCase()}`,
    tooltip: `Homozygote count in ${ancestryGroup.toUpperCase()} population (regardless of trait measured)`,
    grow: 0,
    isSortable: true,
    minWidth: 80,
    render: renderCount,
    background,
  },
  {
    key: 'allele_number',
    displayId: 'allele_number',
    heading: `AN ${ancestryGroup.toUpperCase()}`,
    tooltip: `Allele number count in ${ancestryGroup.toUpperCase()} population (regardless of trait measured)`,
    grow: 0,
    isSortable: true,
    minWidth: 80,
    render: renderCount,
    borderBottom,
    background,
  },
  {
    key: 'af_cases',
    displayId: 'af_cases',
    heading: 'AF Case',
    tooltip: 'Allele frequency cases',
    grow: 0,
    isSortable: true,
    minWidth: 80,
    render: renderExponentialNumberCell,
  },
  {
    key: 'af_controls',
    displayId: 'af_controls',
    heading: 'AF Cont.',
    tooltip: 'Allele frequency controls',
    grow: 0,
    isSortable: true,
    minWidth: 80,
    render: renderExponentialNumberCell,
  },
  {
    key: 'association_af',
    displayId: 'association_af',
    heading: 'AF Trait',
    tooltip: 'Allele frequency in individuals tested for trait ',
    grow: 0,
    isSortable: true,
    minWidth: 80,
    render: renderExponentialNumberCell,
  },
  {
    key: 'allele_frequency',
    displayId: 'allele_frequency',
    heading: `AF ${ancestryGroup.toUpperCase()}`,
    tooltip: `Allele frequency in ${ancestryGroup.toUpperCase()} population (regardless of trait measured`,
    grow: 0,
    isSortable: true,
    minWidth: 80,
    render: renderExponentialNumberCell,
    borderBottom,
  },
]

export const getVariantColumns = ({
  columns,
  ancestryGroup,
  showPhenotypeInfo = false,
  onClickVariantDetails,
  betaScale,
}: any) => {
  const phenotypeInfo = [
    {
      key: 'Description',
      heading: 'Description',
      isRowHeader: true,
      isSortable: false,
      minWidth: 200,
      grow: 1,
      render: (row: any, _: any, { highlightWords }: any) => (
        <Highlighter
          className='grid-cell-content'
          searchWords={highlightWords}
          textToHighlight={row.description}
        />
      ),
    },
  ]
  const variantDataColumns = [
    {
      key: 'variant_id',
      displayId: 'variant_id',
      heading: 'Variant ID',
      isRowHeader: true,
      isSortable: true,
      minWidth: 120,
      grow: 0,
      // TODO: fix variant link
      render: (row: any, _: any, { highlightWords }: any) => {

        const { goToVariant } = useAppNavigation()

        return (
          <Link>
            <Highlighter
              className='grid-cell-content'
              searchWords={highlightWords}
              textToHighlight={
                row.variant_id.length > 17 ? `${row.variant_id.slice(0, 14)}...` : row.variant_id
              }
              onClick={() => {
                goToVariant(row.variant_id, { resultIndex: 'variant-phewas' })
              }}
            />
          </Link>
        )
      },
    },
    {
      key: 'variant_id',
      displayId: 'variant_id_manhattan_sva',
      heading: 'Variant ID',
      isRowHeader: true,
      isSortable: true,
      minWidth: 150,
      grow: 0,
      render: (row: any, _: any, { highlightWords }: any) => {

        const { goToVariant } = useAppNavigation()

        return (
          <Link>
            <Highlighter
              className='grid-cell-content'
              searchWords={highlightWords}
              textToHighlight={row.variant_id}
              onClick={() => {
                goToVariant(row.variant_id, { resultIndex: 'variant-phewas' })
              }}
            />
          </Link>
        )
      },
    },
    {
      key: 'show_label',
      displayId: 'show_label',
      heading: 'Label',
      tooltip: 'Show label on lollipop plot',
      grow: 0,
      isSortable: true,
      minWidth: 50,
      render: (row: any) => <ShowLabelCell variantId={row.variant_id} />,
    },
    {
      key: 'label',
      displayId: 'label',
      heading: 'Custom Label',
      tooltip: 'Custom label text for this variant',
      grow: 0,
      isSortable: false,
      minWidth: 90,
      render: (row: any) => <LabelCell variantId={row.variant_id} />,
    },
    ...(showPhenotypeInfo ? phenotypeInfo : []),
    {
      key: 'gene_name',
      displayId: 'gene_name',
      heading: 'Gene',
      grow: 0,
      isSortable: true,
      minWidth: 70,
      render: (row: any, _: any, { highlightWords }: any) => (
        <span className='grid-cell-content'>
          <Highlighter searchWords={highlightWords} textToHighlight={row.gene_symbol} />
        </span>
      ),
    },
    {
      key: 'source',
      displayId: 'source',
      heading: 'Source',
      tooltip: 'Sample set and quality control filters',
      grow: 0,
      minWidth: 100,
      render: (variant: any) => (
        <React.Fragment>
          {variant.filters && <SampleSourceIcon source='exome' filters={variant.filters} />}
        </React.Fragment>
      ),
    },
    {
      key: 'ancestry_group',
      displayId: 'ancestry_group',
      heading: 'Ancestry Group',
      tooltip: 'Ancestry group for the variant',
      grow: 0,
      minWidth: 100,
      render: (variant: VariantJoined) => <span className='grid-cell-content'>{variant.ancestry_group}</span>,
    },
    {
      key: 'sequencing_type',
      displayId: 'sequencing_type',
      heading: 'Sequencing Type',
      tooltip: 'Sequencing type for the variant',
      grow: 0,
      minWidth: 100,
      render: (variant: VariantJoined) => <span className='grid-cell-content'>{variant.sequencing_type}</span>,
    },
    {
      key: 'analysis',
      displayId: 'analysis',
      heading: 'Phenotype',
      isSortable: true,
      minWidth: 120,
      render: (row: any, _: any, { highlightWords }: any) => (
        <span className='grid-cell-content'>
          <ColorMarker color={row.color} />
          <Highlighter searchWords={highlightWords} textToHighlight={row.analysis_description} />
        </span>
      ),
    },

    {
      key: 'consequence',
      displayId: 'consequence',
      heading: 'CSQ',
      tooltip: 'VEP most severe consequence',
      grow: 0,
      isSortable: true,
      minWidth: 110,
      render: (row: any, key: any, { highlightWords }: any) => (
        <span className='grid-cell-content'>
          <ColorMarker color={getConsequenceColor(row[key])} />
          <Highlighter
            searchWords={highlightWords}
            textToHighlight={getConsequenceName(row[key])}
          />
        </span>
      ),
    },
    {
      key: 'gwas_catalog',
      displayId: 'gwas_catalog',
      heading: 'GWAS Catalog',
      tooltip: 'Information about this variant in the NHGRI-EBI GWAS Catalog',
      grow: 0,
      isSortable: true,
      minWidth: 60,
      render: (row: any) => {
        if (row.gwas_catalog) {
          return (
            <TooltipAnchor
              key={`tooltip-${row.variant_id}-gwasCatalog`}
              rowData={row}
              tooltipComponent={GwasCatalogTooltip}
            >
              <TooltipHint>
                <ColorMarker color={'#800080'} />
              </TooltipHint>
            </TooltipAnchor>
          )
        }
      },
    },
    {
      key: 'analyses',
      displayId: 'analyses',
      heading: 'Top analysis',
      grow: 0,
      isSortable: true,
      minWidth: 200,
      render: (row: any) => {
        if (row.analyses) {
          return (
            <TooltipAnchor
              key={`tooltip-${row.variant_id}`}
              rowData={row}
              tooltipComponent={AnalysisHitsTooltip}
            >
              <TooltipHint />
            </TooltipAnchor>
          )
        }
      },
    },
    {
      key: 'pval_range',
      displayId: 'pval_range',
      heading: 'Top P-value',
      grow: 0,
      isSortable: true,
      minWidth: 80,
      render: (row: any) => {
        return <span className='grid-cell-content'>{row.pValueRange[1].toPrecision(3)}</span>
      },
    },
    {
      key: 'membership',
      displayId: 'membership',
      heading: 'Set',
      grow: 0,
      isSortable: true,
      minWidth: 45,
      render: (row: any) => {
        if (!row.analysisMembership) return
        const markers = row.analysisMembership.map((analysis: any) => {
          if (analysis === 'gwas') {
            return (
              <TooltipAnchor
                key={`${row.variant_id}-${analysis}`}
                tooltip='This variant is found in the GWAS dataset'
              >
                <ColorMarker color={getAnalysisColor(analysis)} />
              </TooltipAnchor>
            )
          }
          return (
            <TooltipAnchor
              key={`${row.variant_id}-${analysis}`}
              tooltip={`This variant is included in the ${analysis} burden test`}
            >
              <ColorMarker color={getAnalysisColor(analysis)} />
            </TooltipAnchor>
          )
        })
        // eslint-disable-next-line consistent-return
        return <span className='grid-cell-content'>{markers}</span>
      },
    },
    {
      key: 'rsid',
      displayId: 'rsid',
      heading: 'RSID',
      tooltip: 'Reference SNP cluster ID',
      isSortable: true,
      grow: 0,
    },
    {
      key: 'hgvsc',
      displayId: 'hgvsc',
      heading: 'HGVSc',
      tooltip: 'HGVSc protein sequence',
      grow: 0,
      isSortable: true,
      minWidth: 100,
      render: (variant: any, _: any, { highlightWords }: any) => (
        <span className='grid-cell-content'>
          <Highlighter
            searchWords={highlightWords}
            textToHighlight={variant.hgvsc ? variant.hgvsc.split(':')[1] : ''}
          />
        </span>
      ),
    },
    {
      key: 'hgvsp',
      displayId: 'hgvsp',
      heading: 'HGVSp',
      tooltip: 'HGVSc coding sequence',
      grow: 0,
      isSortable: true,
      minWidth: 100,
      render: (variant: any, _: any, { highlightWords }: any) => (
        <span className='grid-cell-content'>
          <Highlighter
            searchWords={highlightWords}
            textToHighlight={variant.hgvsp ? variant.hgvsp.split(':')[1] : ''}
          />
        </span>
      ),
    },
    {
      key: 'hgvs',
      displayId: 'hgvs',
      heading: 'HGVS',
      tooltip: 'HGVSp or HGVSc',
      grow: 0,
      isSortable: true,
      minWidth: 100,
      render: (variant: any, _: any, { highlightWords }: any) => (
        <span className='grid-cell-content'>
          <Highlighter
            searchWords={highlightWords}
            textToHighlight={
              variant.hgvsp ? variant.hgvsp.split(':')[1] :
                variant.hgvsc ? variant.hgvsc.split(':')[1] : ''
            }
          />
        </span>
      ),
    },
    {
      key: 'region_flag',
      displayId: 'flags',
      heading: 'Flags',
      tooltip: 'Flags that may affect annotation and/or confidence',
      grow: 1,
      isSortable: true,
      minWidth: 150,
      render: (row: any, key: any) => {
        const flags = Object.keys(row[key])
          .filter((flag) => row[key][flag] && flag !== 'segdup' && flag !== 'par')
          .map((flag) => <VariantFlag key={flag} type={flag} />)
        return flags
      },
    },
    ...countColumns(ancestryGroup, betaScale),
    {
      key: 'show',
      displayId: 'show_variant_manhattan_sva',
      heading: 'Locus',
      isRowHeader: true,
      isSortable: true,
      minWidth: 80,
      grow: 0,
      render: (variant: VariantAssociationManhattan) => {
        const { goToLocus } = useAppNavigation()

        const handleClick = () => {
          const intervalSize = 500_000
          const regionId = `${variant.chrom}-${variant.pos - intervalSize}-${variant.pos + intervalSize
            }`

          goToLocus(regionId, { fromPhenotype: true })
        }

        return (
          <RightArrow height={15} width={15} onClick={handleClick} style={{ cursor: 'pointer' }} />
        )
      },
    },
    {
      key: 'show',
      displayId: 'show_variant_gene_page',
      heading: 'Details',
      isRowHeader: true,
      isSortable: true,
      minWidth: 50,
      grow: 0,
      render: (row: any) => {
        return <UpArrow height={15} width={15} onClick={() => onClickVariantDetails(row)} />
      },
    },
  ]
  if (!columns) {
    return variantDataColumns
  }
  return variantDataColumns.filter((col) => columns.includes((col as any).displayId))
}

export function getCountColumns(
  variantColumnGroup: VariantFieldGroup,
  trait_type: string = 'categorical'
) {
  const baseCountColumns = [
    'association_ac',
    'association_af',
    'association_an',
    'allele_count',
    'allele_number',
    'allele_frequency',
    'homozygote_count',
  ]

  const nonContinuousTraitColumns =
    trait_type !== 'continuous'
      ? ['ac_cases', 'an_cases', 'ac_controls', 'an_controls', 'af_cases', 'af_controls']
      : []

  const countColumns = [...baseCountColumns, ...nonContinuousTraitColumns]

  return countColumns.filter((col) => {
    if (variantColumnGroup === 'pop') {
      const cols = ['allele_count', 'allele_number', 'allele_frequency', 'homozygote_count']
      return cols.includes(col)
    }
    if (variantColumnGroup === 'freq') {
      const cols = ['af_cases', 'af_controls', 'association_af', 'allele_frequency']
      return cols.includes(col)
    }
    if (variantColumnGroup === 'counts') {
      const cols = [
        'ac_cases',
        'an_cases',
        'ac_controls',
        'an_controls',
        'association_ac',
        'association_an',
      ]
      return cols.includes(col)
    }
    if (variantColumnGroup === 'categorical_default') {
      const cols = [
        'pvalue',
        'beta',
        'homozygote_count',
        'ac_cases',
        'an_cases',
        'ac_controls',
        'an_controls',
        'af_cases',
        'af_controls',
        'association_ac',
        'association_an',
      ]

      return cols.includes(col)
    }
    if (variantColumnGroup === 'continuous_default') {
      const cols = [
        'pvalue',
        'beta',
        'association_ac',
        'association_af',
        'homozygote_count',
        'association_an',
      ]

      return cols.includes(col)
    }
    return true
  })
}
