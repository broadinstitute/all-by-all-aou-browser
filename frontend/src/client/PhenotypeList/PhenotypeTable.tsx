import React from 'react'
import styled from 'styled-components'
// @ts-expect-error ts-migrate(7016) FIXME: Could not find a declaration file for module 'reac... Remove this comment to see the full error message
import Highlighter from 'react-highlight-words'
// @ts-expect-error ts-migrate(2307) FIXME: Cannot find module '@fortawesome/fontawesome-free/... Remove this comment to see the full error message
import Info from '@fortawesome/fontawesome-free/svgs/solid/info-circle.svg'
import { Grid, TooltipAnchor, ExternalLink } from '@gnomad/ui'
import { ColorMarker, RightArrow, Link } from '../UserInterface'

import {
  renderNumberCell,
  renderPvalueCell,
  renderExponentialNumberCell,
  renderCount,
  renderBetaCell,
} from './Utils'
import { AnalysisMetadata, GenePhewasAnnotated, VariantAssociations } from '../types'
import {
  analysisIdAtom,
  geneIdAtom,
  regionIdAtom,
  resultIndexAtom,
  resultLayoutAtom,
} from '../sharedState'
import { useRecoilState, useSetRecoilState } from 'recoil'

const DescriptionContainer = styled.span`
  overflow: hidden;
  max-width: 100%;
  text-overflow: ellipsis;
  white-space: nowrap;
`
const NoPhenotypes = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: ${(props) => (props as any).height}px;
  border: 1px dashed gray;
  font-size: 20px;
  font-weight: bold;
`
const InfoIconWrapper = styled.span`
  min-width: 20px;
  min-height: 10px;
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
`
const InfoTooltip = ({ rowData }: { rowData: GenePhewasAnnotated }) => {
  return (
    <InfoTooltipWrapper>
      <InfoTooltipItem>
        <h3>{rowData.description}</h3>
      </InfoTooltipItem>
      <InfoTooltipItem>
        <strong>Phenotype ID:</strong>
        {rowData.analysis_id}
      </InfoTooltipItem>
      <InfoTooltipItem>
        <strong>Category:</strong>
        {rowData.path}
      </InfoTooltipItem>
      {rowData.trait_type === 'categorical' ? (
        <InfoTooltipItem>
          <strong>N Cases / N Controls:</strong>
          {rowData.n_cases} / {rowData.n_controls}
        </InfoTooltipItem>
      ) : (
        <InfoTooltipItem>
          <strong>N Cases :</strong>
          {rowData.n_cases}
        </InfoTooltipItem>
      )}

      <InfoTooltipItem>
        <strong>Trait type:</strong>
        {rowData.trait_type}
      </InfoTooltipItem>
      <InfoTooltipItem>
        <strong>Phenocode:</strong>
        {rowData.phenocode}
      </InfoTooltipItem>
      <InfoTooltipItem>
        <strong>Sex:</strong>
        {rowData.pheno_sex}
      </InfoTooltipItem>
      <InfoTooltipItem>
        <strong>Coding:</strong>
        {rowData.coding}
      </InfoTooltipItem>
      <InfoTooltipItem>
        <strong>Modifier:</strong>
        {rowData.modifier}
      </InfoTooltipItem>
    </InfoTooltipWrapper>
  )
}
export const getPhenotypeColumns = ({
  columns,
  selectedAnalyses,
  toggleSelectedAnalysis,
  pValueType,
  analysesColors = [],
  showSelectAnalysesOnly,
  width = 700,
}: any) => {
  const baseColumns = [
    // TODO: make variant phenotype key consistent,
    {
      key: 'description',
      displayId: 'description_with_link',
      heading: 'Description',
      isRowHeader: true,
      isSortable: true,
      minWidth: 100,
      grow: 1,
      render: (row: GenePhewasAnnotated, _: any, { highlightWords }: any) => {
        const setAnalysisId = useSetRecoilState(analysisIdAtom)
        const setGeneId = useSetRecoilState(geneIdAtom)
        const [resultIndex, setResultIndex] = useRecoilState(resultIndexAtom)

        let markerColor = row.color
        if (showSelectAnalysesOnly) {
          markerColor =
            analysesColors && analysesColors.length > 0
              ? analysesColors.find((a: any) => a.analysisId === row.analysis_id)?.color
              : markerColor
        }

        return (
          <Link
            className='grid-cell-content'
            onClick={() => {
              setAnalysisId(row.analysis_id)
              setResultIndex('pheno-info')
              if (resultIndex == "top-associations") {
                setGeneId(row.gene_id)
              }
            }}
          >
            <ColorMarker color={markerColor} />
            <DescriptionContainer>
              <Highlighter searchWords={highlightWords} textToHighlight={row.description || ''} />
            </DescriptionContainer>
          </Link>
        )
      },
    },
    {
      key: 'phenocode',
      displayId: 'phenotype',
      heading: 'Phenotype',
      isRowHeader: true,
      isSortable: true,
      minWidth: 100,
      grow: 0,
      render: (row: any, _: any, { highlightWords }: any) => {
        return (
          <ExternalLink
            style={{ cursor: 'pointer', marginLeft: 10 }}
            className='grid-cell-content'
            href={'https://allofus.nih.gov/'}
          >
            <Highlighter
              searchWords={highlightWords}
              textToHighlight={`${row.phenocode} ${row.coding} ${row.modifier}`}
            />
          </ExternalLink>
        )
      },
    },
    {
      key: 'sex',
      displayId: 'sex',
      heading: 'Sex',
      isRowHeader: true,
      isSortable: true,
      minWidth: 50,
      grow: 0,
      render: (row: any) => {
        const text = row.pheno_sex === 'both_sexes' ? 'Both' : row.pheno_sex
        return text
      },
    },
    {
      key: 'path',
      displayId: 'category',
      heading: 'Category',
      isRowHeader: true,
      isSortable: true,
      minWidth: 100,
      grow: 1,
      render: (row: any, _: any, { highlightWords }: any) => (
        <DescriptionContainer>
          <Highlighter searchWords={highlightWords} textToHighlight={row.category || ''} />
        </DescriptionContainer>
      ),
    },
    {
      displayId: 'description_more',
      isRowHeader: false,
      isSortable: true,
      minWidth: 130,
      grow: 1,
      render: (row: any, _: any, { highlightWords }: any) => (
        <DescriptionContainer>
          <Highlighter searchWords={highlightWords} textToHighlight={row.description_more || ''} />
        </DescriptionContainer>
      ),
    },
    {
      key: 'info',
      displayId: 'info',
      heading: 'Info',
      isRowHeader: true,
      minWidth: 30,
      grow: 0,
      render: (row: any) => (
        <TooltipAnchor
          key={`tooltip-${row.analysis_id}`}
          rowData={row}
          tooltipComponent={InfoTooltip}
        >
          <InfoIconWrapper>
            <Info height={13} width={13} />
          </InfoIconWrapper>
        </TooltipAnchor>
      ),
    },
    {
      key: 'short_category',
      displayId: 'short_category',
      heading: 'Category',
      isRowHeader: true,
      isSortable: true,
      minWidth: 100,
      grow: 0,
      render: (row: any, _: any, { highlightWords }: any) => (
        <span style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
          <Highlighter searchWords={highlightWords} textToHighlight={row.short_category || ''} />
        </span>
      ),
    },
  ]
  const analysisColumns = [
    {
      key: 'source',
      displayId: 'source',
      heading: 'Source',
      isRowHeader: true,
      isSortable: true,
      minWidth: 100,
      grow: 0,
      render: (row: any, _: any, { highlightWords }: any) => (
        <Link className='grid-cell-content' target='_blank' to={`/phenotype/${row.analysis_id}`}>
          <Highlighter searchWords={highlightWords} textToHighlight={row.source || ''} />
        </Link>
      ),
    },
    {
      key: 'variable_type',
      displayId: 'variable_type',
      heading: 'Type',
      isRowHeader: true,
      isSortable: true,
      minWidth: 130,
      grow: 0,
      render: (row: any, _: any, { highlightWords }: any) => (
        <Link className='grid-cell-content' target='_blank' to={`/phenotype/${row.analysis_id}`}>
          <Highlighter searchWords={highlightWords} textToHighlight={row.variable_type || ''} />
        </Link>
      ),
    },
    {
      key: 'n_cases',
      displayId: 'n_cases',
      heading: 'N cases',
      grow: 0,
      isSortable: true,
      minWidth: width < 600 ? 90 : 90,
      render: renderCount,
    },
    {
      key: 'n_controls',
      displayId: 'n_controls',
      heading: 'N controls',
      grow: 0,
      isSortable: true,
      minWidth: width < 600 ? 90 : 90,
      render: renderCount,
    },
    {
      key: 'n_cases',
      displayId: 'cases_over_controls',
      heading: 'Cases/controls',
      grow: 0,
      isSortable: true,
      minWidth: 70,
      render: (row: any) => {
        if (!row.n_cases) {
          return '-'
        }
        return `${renderNumberCell(row, 'n_cases')} /  ${renderNumberCell(row, 'n_controls')}`
      },
    },
    {
      key: 'n_cases_mf',
      displayId: 'n_cases_sexes',
      heading: 'N cases',
      grow: 0,
      isSortable: true,
      minWidth: 70,
      render: (row: any) => renderNumberCell(row, 'n_cases_both_sexes'),
    },
    {
      key: 'n_missing',
      displayId: 'n_missing',
      heading: 'N missing',
      grow: 0,
      isSortable: true,
      minWidth: width < 600 ? 75 : 110,
    },
    {
      key: 'n_non_missing',
      displayId: 'n_non_missing',
      heading: 'N nonmissing',
      grow: 0,
      isSortable: true,
      minWidth: width < 600 ? 75 : 110,
    },
    {
      key: 'thresh_count',
      displayId: 'thresh_count',
      heading: 'Num. genes below 0.0001',
      minWidth: 80,
      type: 'int',
      grow: 0,
    },
  ]
  const heritabilityColumns = [
    {
      key: 'h2_observed',
      displayId: 'h2_observed',
      heading: width < 600 ? 'h2obs' : 'Heritability (H2)',
      grow: 0,
      isSortable: true,
      minWidth: width < 600 ? 75 : 110,
      render: renderExponentialNumberCell,
    },
    {
      key: 'intercept',
      displayId: 'intercept',
      heading: width < 600 ? 'I' : 'Intercept (I)',
      grow: 0,
      isSortable: true,
      minWidth: width < 600 ? 75 : 110,
      render: renderExponentialNumberCell,
    },
    {
      key: 'prevalence',
      displayId: 'prevalence',
      heading: width < 600 ? 'Prev.' : 'Prevalence',
      grow: 0,
      isSortable: true,
      minWidth: width < 600 ? 75 : 110,
      render: renderExponentialNumberCell,
    },
  ]
  const querySummaryColumns = [
    {
      key: 'gene_symbol',
      displayId: 'gene_name_top_hits',
      heading: 'Gene',
      isSortable: false,
      grow: 0,
      minWidth: 70,
      render: (row: GenePhewasAnnotated) => {
        const setGeneId = useSetRecoilState(geneIdAtom)
        const setRegionId = useSetRecoilState(regionIdAtom)
        const setResultIndex = useSetRecoilState(resultIndexAtom)
        const setAnalysisId = useSetRecoilState(analysisIdAtom)

        return (
          <Link
            style={{ cursor: 'pointer' }}
            className='grid-cell-content'
            onClick={() => {
              setRegionId(null)
              setGeneId(row.gene_id)
              setAnalysisId(row.analysis_id)
              setResultIndex('gene-phewas')
            }}
          >
            {row.gene_symbol || row.gene_id}
          </Link>
        )
      },
    },
    {
      key: 'pvalue',
      displayId: 'top_pval',
      heading: width < 600 ? 'P' : 'Top P-value',
      grow: 0,
      isSortable: true,
      minWidth: width < 600 ? 75 : 110,
      render: renderExponentialNumberCell,
    },
    {
      key: 'pvalue',
      displayId: 'pvalue',
      heading: width < 600 ? 'P' : 'P-Value (SKAT-O)',
      grow: 0,
      isSortable: true,
      minWidth: 90,
      render: renderPvalueCell('gene', pValueType),
    },
    {
      key: 'pvalue',
      displayId: 'pval_variant',
      heading: 'P-Value',
      grow: 0,
      isSortable: true,
      minWidth: 90,
      render: renderPvalueCell('variant'),
    },
    {
      key: 'pvalue',
      displayId: 'pval_variant_min',
      heading: 'Min. P-Value',
      grow: 0,
      isSortable: true,
      minWidth: 90,
      render: renderPvalueCell('variant'),
    },
    {
      key: 'BETA',
      displayId: 'BETA',
      heading: width < 600 ? 'B' : 'Beta',
      grow: 0,
      isSortable: true,
      minWidth: 80,
      render: renderBetaCell(),
    },
    {
      key: 'variant_count',
      displayId: 'variant_count',
      heading: 'Variant count',
      grow: 0,
      isSortable: true,
      minWidth: width < 600 ? 75 : 100,
    },
  ]
  const selectionColumns = [
    {
      key: 'select',
      displayId: 'select',
      heading: 'Select',
      minWidth: 30,
      grow: 0,
      render: (row: GenePhewasAnnotated) => {
        const isSelected = selectedAnalyses.includes(row.analysis_id)
        return (
          <input
            type='checkbox'
            disabled={isSelected && selectedAnalyses.length === 1}
            checked={isSelected}
            onClick={() => toggleSelectedAnalysis(row.analysis_id)}
          />
        )
      },
    },
    {
      key: 'show',
      displayId: 'show',
      heading: '',
      isRowHeader: true,
      isSortable: true,
      minWidth: 50,
      grow: 0,
      render: (row: GenePhewasAnnotated) => {
        const setAnalysisId = useSetRecoilState(analysisIdAtom)
        const [resultLayout, setResultLayout] = useRecoilState(resultLayoutAtom)
        const setRegionId = useSetRecoilState(regionIdAtom)

        const handleClick = () => {
          setAnalysisId(row.analysis_id)
          const newLayout = resultLayout === 'full' ? 'small' : resultLayout
          setResultLayout(newLayout)
          setRegionId(null)
        }

        return (
          <RightArrow onClick={handleClick} />
        )
      },
    },
    {
      key: 'show',
      displayId: 'show_phewas_variant_exome',
      heading: '',
      isRowHeader: true,
      isSortable: true,
      minWidth: 80,
      grow: 0,
      render: (row: GenePhewasAnnotated) => {
        const setResultIndex = useSetRecoilState(resultIndexAtom)
        const setAnalysisId = useSetRecoilState(analysisIdAtom)

        const handleClick = () => {
          setResultIndex('variant-phewas')
          setAnalysisId(row.analysis_id)
        }

        return (
          <Link className='grid-cell-content' onClick={handleClick}>
            <RightArrow onClick={handleClick} />
          </Link>
        )
      },
    }, {
      key: 'show',
      displayId: 'show_phewas_locus',
      heading: '',
      isRowHeader: true,
      isSortable: true,
      minWidth: 80,
      grow: 0,
      render: (row: VariantAssociations & AnalysisMetadata) => {
        const setAnalysisId = useSetRecoilState(analysisIdAtom)

        const handleClick = () => {
          setAnalysisId(row.analysis_id)
        }

        return (
          <Link className='grid-cell-content' onClick={handleClick}>
            <RightArrow onClick={handleClick} />
          </Link>
        )
      },
    },
    {
      key: 'show',
      displayId: 'show_top_hits',
      heading: '',
      isRowHeader: true,
      isSortable: true,
      minWidth: 50,
      grow: 0,
      render: (row: GenePhewasAnnotated) => {

        const setGeneId = useSetRecoilState(geneIdAtom)
        const setAnalysisId = useSetRecoilState(analysisIdAtom)
        const setLayout = useSetRecoilState(resultLayoutAtom)
        const setRegionId = useSetRecoilState(regionIdAtom)

        const handleClick = () => {
          setGeneId(row.gene_id)
          setAnalysisId(row.analysis_id)
          setLayout((resultLayout) => resultLayout === 'full' ? 'small' : resultLayout)
          setRegionId(null)
        }

        return (
          <RightArrow onClick={handleClick} />
        )
      },
    },
    { key: 'analysis_id', heading: 'analysis_id', displayId: 'analysis_id', isRowHeader: true },
  ]
  const allColumns = [
    ...baseColumns,
    ...analysisColumns,
    ...heritabilityColumns,
    ...querySummaryColumns,
    ...selectionColumns,
  ]
  return allColumns.filter((column) => columns.includes(column.displayId))
}
type OwnPhenotypeTableProps = {
  columns: any[]
  highlightText?: string
  onVisibleRowsChange?: (...args: any[]) => any
  onHoverPhenotype?: (...args: any[]) => any
  onRequestSort?: (...args: any[]) => any
  sortKey: string
  sortOrder: boolean
  phenotypes: any[]
  numRowsRendered?: number
}
// @ts-expect-error ts-migrate(2456) FIXME: Type alias 'PhenotypeTableProps' circularly refere... Remove this comment to see the full error message
type PhenotypeTableProps = OwnPhenotypeTableProps & typeof PhenotypeTable.defaultProps
// @ts-expect-error ts-migrate(7022) FIXME: 'PhenotypeTable' implicitly has type 'any' because... Remove this comment to see the full error message
const PhenotypeTable = (props: PhenotypeTableProps) => {
  const grid = React.createRef()
  const {
    columns,
    highlightText,
    onVisibleRowsChange,
    onHoverPhenotype,
    onRequestSort,
    sortKey,
    sortOrder,
    phenotypes,
    numRowsRendered,
  } = props
  if (phenotypes.length === 0) {
    // @ts-expect-error ts-migrate(2769) FIXME: No overload matches this call.
    return <NoPhenotypes height={320}>No phenotypes found</NoPhenotypes>
  }
  return (
    <Grid
      cellData={{ highlightWords: highlightText.split(/\s+/) }}
      columns={columns}
      data={phenotypes}
      numRowsRendered={numRowsRendered}
      onHoverRow={(rowIndex: any) => {
        onHoverPhenotype(rowIndex === null ? null : phenotypes[rowIndex].analysis_id)
      }}
      onRequestSort={onRequestSort}
      onVisibleRowsChange={onVisibleRowsChange}
      // @ts-expect-error
      ref={grid}
      rowKey={(phenotype: any, index: number) => `${(phenotype as any).analysis_id}-${(phenotype as any).gene_id}-${index}`}
      sortKey={sortKey}
      sortOrder={sortOrder ? 'ascending' : 'descending'}
    />
  )
}
PhenotypeTable.defaultProps = {
  highlightText: '',
  onVisibleRowsChange: () => { },
  onHoverPhenotype: () => { },
  onRequestSort: () => { },
  numRowsRendered: 20,
}
export default PhenotypeTable
