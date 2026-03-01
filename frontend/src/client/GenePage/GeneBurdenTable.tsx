import React from 'react'
import styled from 'styled-components'
import { useRecoilValue } from 'recoil'
import { BaseTable, Checkbox, TooltipAnchor } from '@gnomad/ui'
import { Badge } from '@gnomad/ui'

import { locusMafAtom } from '../sharedState'
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
    text-decoration-color: var(--theme-text-muted, grey);
  }
`

// Sort order for annotations
const annotationOrder: Record<string, number> = {
  'pLoF': 1,
  'pLoF;missenseLC': 2,
  'missenseLC': 3,
  'synonymous': 4,
}

// Sort and prepare data for the new table format
export const prepareAllMafTableData = (geneAssociations: GeneAssociations[]) => {
  // Filter to standard annotations and sort by annotation then MAF
  return geneAssociations
    .filter(g => ['pLoF', 'pLoF;missenseLC', 'missenseLC', 'synonymous'].includes(g.annotation))
    .sort((a, b) => {
      const annotationDiff = (annotationOrder[a.annotation] || 99) - (annotationOrder[b.annotation] || 99)
      if (annotationDiff !== 0) return annotationDiff
      // Sort by MAF descending (1% first, then 0.1%, then 0.01%)
      return (b.max_maf || 0) - (a.max_maf || 0)
    })
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

// Display label for annotations
const annotationLabel: Record<string, string> = {
  'pLoF': 'pLoF',
  'pLoF;missenseLC': 'pLoF + missenseLC',
  'missenseLC': 'missenseLC',
  'synonymous': 'synonymous',
}

export const GeneBurdenTable = ({
  geneAssociations,
  analysisMetadata,
  membershipFilters,
  setMembershipFilters,
}: Props) => {
  const selectedMaf = useRecoilValue(locusMafAtom)

  // Prepare all rows sorted by annotation then MAF, keeping only one row per annotation
  // (deduplicate by annotation, keeping the first/most significant one)
  const allRows = React.useMemo(() => {
    const filtered = prepareAllMafTableData(geneAssociations).filter(row => row.max_maf === selectedMaf)
    const seen = new Set<string>()
    return filtered.filter(row => {
      if (seen.has(row.annotation)) return false
      seen.add(row.annotation)
      return true
    })
  }, [geneAssociations, selectedMaf])

  // Render a p-value cell with highlighting
  const renderPvalueCell = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '-'
    let highlightColor = value < geneYellowThreshold ? yellowThresholdColor : null
    highlightColor = value < geneGreenThreshold ? greenThresholdColor : highlightColor
    return <RoundedNumber num={value} highlightColor={highlightColor} />
  }

  return (
    <div>
      <Table>
        <thead>
          <tr>
            <th scope='col'>Category</th>
            <th scope='col'>P-value SKATO</th>
            <th scope='col'>P-value burden</th>
            <th scope='col'>P-value SKAT</th>
            {membershipFilters && <th scope='col'>Filter</th>}
          </tr>
        </thead>
        <tbody>
          {allRows.map((row, idx) => (
            <tr key={`${row.annotation}-${row.max_maf}`}>
              <th>{annotationLabel[row.annotation] || row.annotation}</th>
              <td>{renderPvalueCell(row.pvalue)}</td>
              <td>{renderPvalueCell(row.pvalue_burden)}</td>
              <td>{renderPvalueCell(row.pvalue_skat)}</td>
              {membershipFilters && (
                <td>
                  <Checkbox
                    label=''
                    checked={membershipFilters[row.annotation] || false}
                    id={`${row.annotation}-${row.max_maf}-membership`}
                    disabled={false}
                    onChange={(checked: boolean) => {
                      setMembershipFilters({ ...membershipFilters, [row.annotation]: checked })
                    }}
                  />
                </td>
              )}
            </tr>
          ))}
          {allRows.length === 0 && (
            <tr>
              <td colSpan={membershipFilters ? 5 : 4} style={{ textAlign: 'center', color: 'var(--theme-text-muted, #666)' }}>
                No burden test results available
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  )
}
export default GeneBurdenTable
