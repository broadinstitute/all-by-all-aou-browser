import React from 'react'
import styled from 'styled-components'
import { BaseTable, Checkbox, TooltipAnchor } from '@gnomad/ui'
import { Badge } from '@gnomad/ui'

import {
  geneYellowThreshold,
  yellowThresholdColor,
  geneGreenThreshold,
  greenThresholdColor,
  RoundedNumber,
} from '../PhenotypeList/Utils'
import { GeneAssociations, AnalysisMetadata } from '../types'

const Table = styled(BaseTable)`
  min-width: 325px;

  .tooltip {
    text-decoration: underline;
    text-decoration-style: dashed;
    text-decoration-thickness: 1px;
    text-decoration-color: grey;
  }
`

const createRenderCell = (tableData: GeneAssociations[]) => (category: any, key: any) => {
  const tableDataRecord = tableData[category] as Record<string, any>
  if (tableDataRecord) {
    if (
      key.includes('synonymous_lambda_gc_skato') ||
      key.includes('synonymous_lambda_gc_skat') ||
      key.includes('synonymous_lambda_gc_burden')
    ) {
      const burdenSet = key.split('_')[3]
      const passed = tableDataRecord[`keep_gene_${burdenSet}`]
      const num = tableDataRecord[key]

      const tooltip = passed
        ? `The ${burdenSet.toUpperCase()} synonymous lambda GC for this gene is within the range of 0.75-1.5`
        : `Caution is warranted for this gene as the ${burdenSet.toUpperCase()} synonymous lambda GC is outside 0.75-1.5`

      const emoji = allGeneQcPass || passed ? '✅' : '❌'

      return (
        <TooltipAnchor tooltip={tooltip}>
          <span className='tooltip'>
            {emoji} <RoundedNumber num={num} />
          </span>
        </TooltipAnchor>
      )
    }
    if (key.includes('pvalue') && tableDataRecord[key]) {
      const num = tableDataRecord[key]
      let highlightColor = num < geneYellowThreshold ? yellowThresholdColor : null
      highlightColor = num < geneGreenThreshold ? greenThresholdColor : highlightColor
      return <RoundedNumber num={num} highlightColor={highlightColor} />
    }

    if (tableDataRecord[key]) {
      const num = tableDataRecord[key]
      return <RoundedNumber num={num} />
    }

    return '-'
  }
  return '-'
}

const allGeneLambdaGcPass = true // TODO: fix me

const renderPhenotypeLambda = (data: any, key: any) => {
  if (
    key.includes('lambda_gc_skato') ||
    key.includes('lambda_gc_skat') ||
    key.includes('lambda_gc_burden')
  ) {
    const burdenSet = key.split('_')[2]
    const passed = data[`keep_pheno_${burdenSet}`]
    const num = data[key]

    const tooltip = passed
      ? `The ${burdenSet.toUpperCase()} synonymous lambda GC for this phenotype is at least 0.75`
      : `Caution is warranted for this phenotype as the ${burdenSet.toUpperCase()} synonymous lambda GC is below 0.75`

    const emoji = allGeneLambdaGcPass || passed ? '✅' : '❌'

    return (
      <TooltipAnchor tooltip={tooltip}>
        <span className='tooltip'>
          {emoji} <RoundedNumber num={num} />
        </span>
      </TooltipAnchor>
    )
  }
  return '-'
}

export const prepareTableData = (geneAssociations: GeneAssociations[]) => {
  return geneAssociations.reduce((acc, entry) => {
    return {
      [`${entry.annotation}`]: entry,
      ...acc,
    }
  }, {})
}

interface Props {
  geneAssociations: GeneAssociations[]
  analysisMetadata?: AnalysisMetadata
  membershipFilters?: any
  setMembershipFilters?: any
}

const allGeneQcPass = true // TODO: fix me

export const GeneQc: React.FC<{ geneAssociations: GeneAssociations[]; burdenSet: string }> = ({
  geneAssociations,
  burdenSet,
}) => {
  const qcItems = [
    { field: 'keep_gene_coverage', message: 'Coverage less than 20X' },
    // { field: 'keep_gene_caf', message: 'total_variants less than 1e-4' },
    { field: 'keep_gene_n_var', message: 'Number of variants less than 2' },
  ]

  // @ts-expect-error ts-migrate(2322) FIXME
  const qcResults: any = ([] = qcItems.reduce((acc, qcItem) => {
    let pass

    const item = geneAssociations.find((r) => r.annotation == burdenSet) as any

    if (item && item[qcItem.field]) {
      pass = item[qcItem.field] as boolean
    }

    if (!pass) {
      return [...acc, qcItem.message]
    }
    return []
  }, []))

  let geneQcFlag: any = null

  if (allGeneQcPass || qcResults.length === 0) {
    const message = <Badge level='success'>Pass</Badge>
    const tooltip = 'All Gene QC checks passed'

    geneQcFlag = (
      <TooltipAnchor tooltip={tooltip}>
        <span>{message}</span>
      </TooltipAnchor>
    )
  } else {
    const message = <Badge level='warning'>Fail</Badge>
    const tooltip = `Reason: ${qcResults.join(', ')}`

    geneQcFlag = (
      <TooltipAnchor tooltip={tooltip}>
        <span>{message}</span>
      </TooltipAnchor>
    )
  }

  return <>{geneQcFlag}</>
}

export const GeneBurdenTable = ({
  geneAssociations,
  analysisMetadata,
  membershipFilters,
  setMembershipFilters,
}: Props) => {

  const tableData: any = prepareTableData(
    geneAssociations.map((g: GeneAssociations) => ({
      ...g,
    }))
  );

  const renderCell = createRenderCell(tableData);

  return (
    <div>
      <Table>
        <thead>
          <tr>
            <th scope='col'>Category</th>
            <th scope='col'>P-value SKATO</th>
            <th scope='col'>P-value burden</th>
            <th scope='col'>P-value SKAT</th>
            <th scope='col'>Gene QC</th>
            {membershipFilters && <th scope='col'>Filter</th>}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>pLoF</th>
            <td>{renderCell('pLoF', 'pvalue')}</td>
            <td>{renderCell('pLoF', 'pvalue_burden')}</td>
            <td>{renderCell('pLoF', 'pvalue_skat')}</td>
            <td>
              <GeneQc geneAssociations={geneAssociations} burdenSet={'pLoF'} />
            </td>
            {membershipFilters && (
              <td>
                <Checkbox
                  label=''
                  checked={membershipFilters.pLoF || false}
                  id='pLoF-membership'
                  disabled={false}
                  onChange={(checked: boolean) => {
                    setMembershipFilters({ ...membershipFilters, pLoF: checked })
                  }}
                />
              </td>
            )}
          </tr>
          <tr>
            <th>missenseLC, LC</th>
            <td>{renderCell('missenseLC', 'pvalue')}</td>
            <td>{renderCell('missenseLC', 'pvalue_burden')}</td>
            <td>{renderCell('missenseLC', 'pvalue_skat')}</td>
            <td>
              <GeneQc geneAssociations={geneAssociations} burdenSet={'missenseLC'} />
            </td>
            {membershipFilters && (
              <td>
                <Checkbox
                  label=''
                  checked={membershipFilters['missense'] || false}
                  id='missenseLC-membership'
                  disabled={false}
                  onChange={(checked: boolean) => {
                    setMembershipFilters({ ...membershipFilters, "missense": checked })
                  }}
                />
              </td>
            )}
          </tr>
          <tr>
            <th>Synonymous</th>
            <td>{renderCell('synonymous', 'pvalue')}</td>
            <td>{renderCell('synonymous', 'pvalue_burden')}</td>
            <td>{renderCell('synonymous', 'pvalue_skat')}</td>
            <td>
              <GeneQc geneAssociations={geneAssociations} burdenSet={'synonymous'} />
            </td>
            {membershipFilters && (
              <td>
                <Checkbox
                  label=''
                  checked={membershipFilters.synonymous || false}
                  id='synonymous-membership'
                  disabled={false}
                  onChange={(checked: boolean) => {
                    setMembershipFilters({ ...membershipFilters, synonymous: checked })
                  }}
                />
              </td>
            )}
          </tr>
          <tr style={{ borderTop: '1px double black' }}>
            <th className='tooltip'>
              <TooltipAnchor
                tooltip={
                  'The lambda GC (genomic control) across all phenotypes for synonymous variants in this gene.'
                }
              >
                <span>Gene Lambda GC</span>
              </TooltipAnchor>
            </th>
            <td>{renderCell('synonymous', 'synonymous_lambda_gc_skato')}</td>
            <td>{renderCell('synonymous', 'synonymous_lambda_gc_burden')}</td>
            <td>{renderCell('synonymous', 'synonymous_lambda_gc_skat')}</td>
          </tr>
          <tr>
            <th className='tooltip'>
              <TooltipAnchor
                tooltip={
                  'The lambda GC (genomic control) for this phenotype across all ${burden_set} variants this gene for the SKAT-O test.'
                }
              >
                <span style={{ whiteSpace: 'nowrap' }}>Pheno Lambda GC</span>
              </TooltipAnchor>
            </th>
            {analysisMetadata && (
              <>
                <td>{renderPhenotypeLambda(analysisMetadata, 'lambda_gc_skato')}</td>
                <td>{renderPhenotypeLambda(analysisMetadata, 'lambda_gc_burden')}</td>
                <td>{renderPhenotypeLambda(analysisMetadata, 'lambda_gc_skat')}</td>
              </>
            )}
          </tr>
        </tbody>
      </Table>
    </div>
  )
}
export default GeneBurdenTable
