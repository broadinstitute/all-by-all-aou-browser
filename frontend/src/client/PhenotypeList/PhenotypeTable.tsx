import React, { useState } from 'react'
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
  formatMixedPhenotypeMacCount,
  mixedPhenotypeMacCountForCsv,
  MAC_CASES_TOOLTIP,
  MAC_CONTROLS_TOOLTIP,
  renderBetaCell,
} from './Utils'
import { AnalysisMetadata, GenePhewasAnnotated, VariantAssociations } from '../types'
import { resultIndexAtom } from '../sharedState'
import { useRecoilValue } from 'recoil'
import { UnifiedContextMenu } from '../components/UnifiedContextMenu'
import { ContextMenuTrigger } from '../components/ContextMenuTrigger'
import { useContextMenuNavigation } from '../hooks/useContextMenuNavigation'
import { useAppNavigation } from '../hooks/useAppNavigation'
import { formatBurdenDirection } from '../geneAssociationSemantics'
import { BurdenDirectionIndicator } from '../BurdenDirectionIndicator'
import {
  getAssociationDetailsAriaLabel,
  getAssociationDetailsNavigation,
} from './phewasDisplay'

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
  border: 1px dashed var(--theme-border, gray);
  color: var(--theme-text, inherit);
  font-size: 20px;
  font-weight: bold;
`
const InfoIconWrapper = styled.span`
  min-width: 20px;
  min-height: 10px;
  cursor: pointer;
  svg {
    fill: var(--theme-text, #333);
    transition: fill 0.15s;
  }
  &:hover svg {
    fill: var(--theme-primary, #262262);
  }
`
const InfoTooltipWrapper = styled.div`
  display: flex;
  flex-direction: column;
  color: #fff;
  h3 {
    color: #fff;
  }
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
    </InfoTooltipWrapper>
  )
}

// A wrapper to hold state for column context menus cleanly
const PhenotypeLinkRenderer = ({ row, highlightWords, markerColor }: any) => {
  const [menu, setMenu] = useState<{x: number, y: number} | null>(null);
  const navigate = useContextMenuNavigation();
  const { goToAssociation, goToPhenotype } = useAppNavigation();
  const resultIndex = useRecoilValue(resultIndexAtom);

  return (
    <>
      <ContextMenuTrigger
        className='grid-cell-content'
        menuOpen={menu !== null}
        onPrimaryAction={() => {
          if (resultIndex === 'top-associations' && row.gene_id) {
            goToAssociation(row.analysis_id, {
              geneId: row.gene_id,
              regionId: null,
              variantId: null,
            })
          } else {
            goToPhenotype(row.analysis_id, {
              destination: 'overview',
              resultIndex: 'pheno-info',
            })
          }
        }}
        onOpenMenu={setMenu}
        title="Open phenotype; press Shift+F10 for more actions"
      >
        <ColorMarker color={markerColor} />
        <DescriptionContainer>
          <Highlighter searchWords={highlightWords} textToHighlight={row.description || ''} />
        </DescriptionContainer>
      </ContextMenuTrigger>
      {menu && (
        <UnifiedContextMenu
          x={menu.x}
          y={menu.y}
          title={`PHENOTYPE: ${row.description}`}
          targets={[
            { label: 'Phenotype Info', resultIndex: 'pheno-info' },
            { label: 'Gene Manhattan', resultIndex: 'gene-manhattan' },
            { label: 'Variant Manhattan', resultIndex: 'variant-manhattan' }
          ]}
          onNavigate={(mode, target) => {
            navigate('phenotype', row.analysis_id, mode, target);
            setMenu(null);
          }}
          onCopy={() => { navigator.clipboard.writeText(row.analysis_id); setMenu(null); }}
          copyLabel="Copy Phenotype ID"
          onClose={() => setMenu(null)}
        />
      )}
    </>
  );
};

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
        let markerColor = row.color
        if (showSelectAnalysesOnly) {
          markerColor =
            analysesColors && analysesColors.length > 0
              ? analysesColors.find((a: any) => a.analysisId === row.analysis_id)?.color
              : markerColor
        }

        return <PhenotypeLinkRenderer row={row} highlightWords={highlightWords} markerColor={markerColor} />;
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
      key: 'trait_type',
      displayId: 'trait_type',
      heading: 'Trait type',
      isRowHeader: true,
      isSortable: true,
      minWidth: 90,
      grow: 0,
    },
    {
      key: 'pheno_sex',
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
      renderForCSV: (row: any) => row.pheno_sex,
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
      renderForCSV: (row: any) => row.category,
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
      key: 'mac_case',
      displayId: 'mac_case',
      heading: 'MAC cases',
      tooltip: MAC_CASES_TOOLTIP,
      grow: 0,
      isSortable: true,
      minWidth: 90,
      render: (row: any) => formatMixedPhenotypeMacCount(row.mac_case, row.trait_type),
      renderForCSV: (row: any) => mixedPhenotypeMacCountForCsv(row.mac_case, row.trait_type),
    },
    {
      key: 'mac_control',
      displayId: 'mac_control',
      heading: 'MAC controls',
      tooltip: MAC_CONTROLS_TOOLTIP,
      grow: 0,
      isSortable: true,
      minWidth: 100,
      render: (row: any) => formatMixedPhenotypeMacCount(row.mac_control, row.trait_type),
      renderForCSV: (row: any) => mixedPhenotypeMacCountForCsv(row.mac_control, row.trait_type),
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
        const { goToGene } = useAppNavigation()

        return (
          <Link
            style={{ cursor: 'pointer' }}
            className='grid-cell-content'
            onClick={() => {
              goToGene(row.gene_id, {
                fromPhenotype: true,
                keepVariant: true,
                analysisId: row.analysis_id,
                resultIndex: 'gene-phewas',
              })
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
      key: 'burden_direction',
      displayId: 'burden_direction',
      heading: 'Direction',
      grow: 0,
      isSortable: true,
      minWidth: 70,
      render: (row: GenePhewasAnnotated) => (
        <BurdenDirectionIndicator direction={row.burden_direction} />
      ),
      renderForCSV: (row: GenePhewasAnnotated) =>
        formatBurdenDirection(row.burden_direction),
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
      heading: 'Compare',
      minWidth: 60,
      grow: 0,
      render: (row: GenePhewasAnnotated) => {
        const isSelected = selectedAnalyses.includes(row.analysis_id)
        return (
          <input
            type='checkbox'
            checked={isSelected}
            aria-label={`Compare ${row.description || row.analysis_id}`}
            onChange={() => toggleSelectedAnalysis(row.analysis_id)}
          />
        )
      },
    },
    {
      key: 'show',
      displayId: 'show',
      heading: 'Details',
      isRowHeader: true,
      isSortable: false,
      minWidth: 50,
      grow: 0,
      render: (row: GenePhewasAnnotated) => {
        const { goToAssociation } = useAppNavigation()

        const handleClick = () => {
          const target = getAssociationDetailsNavigation(row)
          goToAssociation(target.analysisId, target.context)
        }

        return (
          <RightArrow
            onClick={handleClick}
            ariaLabel={getAssociationDetailsAriaLabel(row)}
          />
        )
      },
    },
    {
      key: 'show',
      displayId: 'show_phewas_variant_exome',
      heading: 'Details',
      isRowHeader: true,
      isSortable: false,
      minWidth: 80,
      grow: 0,
      render: (row: GenePhewasAnnotated) => {
        const { goToAssociation } = useAppNavigation()

        const handleClick = () => {
          const target = getAssociationDetailsNavigation(row, 'variant')
          goToAssociation(target.analysisId, target.context)
        }

        return (
          <RightArrow
            onClick={handleClick}
            ariaLabel={getAssociationDetailsAriaLabel(row, 'variant')}
          />
        )
      },
    }, {
      key: 'show',
      displayId: 'show_phewas_locus',
      heading: 'Association details',
      isRowHeader: true,
      isSortable: false,
      minWidth: 110,
      grow: 0,
      render: (row: VariantAssociations & AnalysisMetadata) => {
        const { goToAssociation } = useAppNavigation()

        const handleClick = () => {
          const target = getAssociationDetailsNavigation(row, 'locus')
          goToAssociation(target.analysisId, target.context)
        }

        return (
          <RightArrow
            onClick={handleClick}
            ariaLabel={getAssociationDetailsAriaLabel(row, 'locus')}
          />
        )
      },
    },
    {
      key: 'show',
      displayId: 'show_top_hits',
      heading: 'Association details',
      isRowHeader: true,
      isSortable: false,
      minWidth: 110,
      grow: 0,
      render: (row: GenePhewasAnnotated) => {
        const { goToAssociation } = useAppNavigation()

        const handleClick = () => {
          const target = getAssociationDetailsNavigation(row, 'topHit')
          goToAssociation(target.analysisId, target.context)
        }

        return (
          <RightArrow
            onClick={handleClick}
            ariaLabel={getAssociationDetailsAriaLabel(row, 'topHit')}
          />
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
