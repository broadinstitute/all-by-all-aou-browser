import { analysesIdFromArray } from '../PhenotypeList/phenotypeUtils'

import { Link } from '@gnomad/ui'

import {
  P_VALUE_BURDEN,
  P_VALUE_SKAT,
  P_VALUE_SKAT_O,
  renderBetaCell,
  renderPvalueCell,
} from '../PhenotypeList/Utils'

import { GeneQc } from '../GenePage/GeneBurdenTable'

import { GeneAssociations } from '../types'
import { useSetRecoilState } from 'recoil'
import { geneIdAtom, regionIdAtom, resultIndexAtom, resultLayoutAtom } from '../sharedState'
import { ColorMarker, RightArrow } from '../UserInterface'
import { consequenceCategoryColors } from '../GenePage/LocusPagePlots'

const baseColumns = ({ burdenSet }: any) => [
  {
    key: 'gene_symbol',
    displayId: 'gene_name_phenotype_page',
    heading: 'Gene Name',
    isSortable: false,
    minWidth: 80,
    grow: 0,
    render: (row: any) => {
      const setResultIndex = useSetRecoilState(resultIndexAtom)
      const setGeneId = useSetRecoilState(geneIdAtom)
      const setRegionId = useSetRecoilState(regionIdAtom)

      return (
        <Link
          onClick={() => {
            setGeneId(row.gene_id)
            setResultIndex('gene-phewas')
            setRegionId(null)
          }}
        >
          {row.gene_symbol || row.gene_id}
        </Link>
      )
    },
  },
  {
    key: 'gene_id',
    displayId: 'gene_id',
    heading: 'Gene Id',
    isSortable: false,
    grow: 0,
    minWidth: 130,
  },
  {
    key: 'gene_qc',
    displayId: 'gene_qc',
    heading: 'QC',
    isSortable: false,
    minWidth: 30,
    render: (row: any) => {
      return <GeneQc geneAssociations={[row]} burdenSet={burdenSet} />
    },
  },
  {
    key: 'gene_description',
    displayId: 'gene_description',
    heading: 'Description',
    isSortable: true,
    minWidth: 200,
    grow: 4,
  },
  {
    key: 'top_phenotypes',
    displayId: 'top_phenotypes',
    heading: 'Top phenotypes',
    minWidth: 400,
    render: (row: any) => (
      <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
        {row.top_phenotypes.slice(0, 5).map((analysisIdArray: any, i: any) => {
          const analysisId = analysesIdFromArray(analysisIdArray)
          const phenoCode = analysisIdArray[1]
          return (
            <span key={`${analysisId}-${phenoCode}`}>
              <Link
                to={`/phenotype/${analysisId}/gene/${row.gene_id}`}
                style={{ cursor: 'pointer', marginLeft: 10 }}
                className='grid-cell-content'
              >
                {phenoCode}
              </Link>{' '}
              ({Number(row.top_pvalues[i].toPrecision(3)).toExponential()})
            </span>
          )
        })}
      </span>
    ),
    grow: 1,
  },
]
const geneResultsColumns = [
  {
    key: 'ancestry_group',
    displayId: 'ancestry_group',
    heading: 'Ancestry',
    grow: 0,
    minWidth: 80,
    render: (row: any) => (
      <span className="grid-cell-content">{(row.ancestry_group || '').toUpperCase()}</span>
    ),
  },
  {
    key: 'annotation',
    displayId: 'annotation',
    heading: 'Annotation',
    grow: 0,
    minWidth: 150,
    render: (row: GeneAssociations) => {
      return <>
        <ColorMarker color={consequenceCategoryColors[row.annotation as keyof typeof consequenceCategoryColors] || 'white'} />
        {row.annotation}
      </>
    }
  },
  {
    key: 'max_maf',
    displayId: 'max_maf',
    heading: 'MAF',
    grow: 0,
    minWidth: 60,
    render: (row: GeneAssociations) => {
      const maf = row.max_maf
      if (maf == null) return '-'
      if (maf >= 0.01) return `${(maf * 100).toFixed(0)}%`
      if (maf >= 0.001) return `${(maf * 100).toFixed(1)}%`
      return `${(maf * 100).toFixed(2)}%`
    }
  },
  {
    key: 'top_pvalue',
    displayId: 'top_pvalue',
    heading: 'Top P-value',
    minWidth: 100,
    grow: 0,
    render: renderPvalueCell('gene'),
  },
  {
    key: 'thresh_count',
    displayId: 'thresh_count',
    heading: 'Num. phenotypes below 0.0001',
    minWidth: 100,
    type: 'int',
    grow: 0,
  },
  {
    key: 'pvalue',
    displayId: 'pvalue',
    heading: 'P\u2011Value SKATO',
    minWidth: 100,
    grow: 0,
    render: renderPvalueCell('gene', P_VALUE_SKAT_O, 'gene'),
  },
  {
    key: 'pvalue_burden',
    displayId: 'pvalue_burden',
    heading: 'P\u2011Value Burden',
    minWidth: 100,
    grow: 0,
    render: renderPvalueCell('gene', P_VALUE_BURDEN, 'gene'),
  },
  {
    key: 'pvalue_skat',
    displayId: 'pvalue_skat',
    heading: 'P\u2011Value SKAT',
    minWidth: 100,
    grow: 0,
    render: renderPvalueCell('gene', P_VALUE_SKAT, 'gene'),
  },
  {
    key: 'beta_burden',
    displayId: 'beta_burden',
    heading: 'BETA Burden',
    minWidth: 100,
    grow: 0,
    render: renderBetaCell(),
  },
  {
    key: 'total_variants',
    displayId: 'total_variants',
    heading: 'Total variants',
    type: 'int',
    minWidth: 60,
    grow: 0,
  },
  {
    key: 'burdenSet',
    displayId: 'burden_set',
    heading: 'Burden Set',
    isSortable: false,
    grow: 0,
    minWidth: 80,
  },
  {
    key: 'xpos',
    displayId: 'xpos',
    heading: 'Chrom : Position',
    type: 'int',
    minWidth: 120,
    grow: 0,
    render: (row: GeneAssociations) => (
      <span>
        {row.contig}:{row.gene_start_position}
      </span>
    ),
  },
  {
    key: 'chrom',
    displayId: 'chrom',
    heading: 'Chrom',
    type: 'int',
    minWidth: 70,
    grow: 0,
  },
  {
    key: 'pos',
    displayId: 'position',
    heading: 'Position',
    type: 'int',
    minWidth: 100,
    grow: 0,
  },
]
const selectionColumns = () => [
  {
    key: 'show',
    displayId: 'show',
    heading: 'Details',
    isRowHeader: true,
    isSortable: true,
    minWidth: 80,
    grow: 0,
    render: (row: any) => {
      const setResultLayout = useSetRecoilState(resultLayoutAtom)
      const setGeneId = useSetRecoilState(geneIdAtom)
      const setRegionId = useSetRecoilState(regionIdAtom)

      return (
        <RightArrow
          onClick={() => {
            setResultLayout((currentLayout) => (currentLayout === 'full' ? 'small' : currentLayout))
            setGeneId(row.gene_id)
            setRegionId(null)
          }}
        />
      )
    },
  },
]
const resultColumns = () =>
  geneResultsColumns.map((inputColumn) => {
    const outputColumn = {
      isSortable: true,
      // @ts-expect-error ts-migrate(2783) FIXME: 'minWidth' is specified more than once, so this us... Remove this comment to see the full error message
      minWidth: 65,
      ...inputColumn,
    }
    return outputColumn
  })
const columns = ({
  onClickGeneId,
  onClickPhenotypeId,
  columnList,
  burdenSet,
}: any) => {
  return [
    ...baseColumns({ onClickGeneId, onClickPhenotypeId, columnList, burdenSet }),
    // @ts-expect-error ts-migrate(2554) FIXME: Expected 0 arguments, but got 1.
    ...resultColumns(columnList),
    ...selectionColumns(),
  ].filter((column) => columnList.includes(column.displayId))
}
export default columns
