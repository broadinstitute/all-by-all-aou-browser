import { BaseTable } from '@gnomad/ui'
import { flatten } from 'lodash'
import React from 'react'
import { useRecoilValue } from 'recoil'
import styled from 'styled-components'
import { countColumns } from '../VariantList/variantTableColumns'
import { ancestryGroupAtom, selectedAnalysesColorsSelector } from '../sharedState'
import { VariantJoined } from '../types'
import { ColorMarker } from '../UserInterface'

const Container = styled.div`
  width: 100%;
  max-width: 95%;
  overflow: auto;
  margin-left: 40px;
  margin-bottom: 40px;
`

const Table = styled(BaseTable)`
  font-size: 12px;

  .tilted-text {
    font-size: 10px;
    transform: rotate(-25deg);
    margin-bottom: 16px;
    margin-left: 5px;
    max-width: 100px;

    padding-bottom: 25px;
    padding-top: 20px;
    padding-right: 5px;
    padding-left: 5px;
  }
`

interface Props {
  variantDatasets: VariantJoined[][]
  sortVariants: any
}

export const IndividualVariantResultsTable: React.FC<Props> = ({
  variantDatasets,
  sortVariants,
}) => {
  const variants = sortVariants(flatten(variantDatasets))
  const analysesColors = useRecoilValue(selectedAnalysesColorsSelector)
  const ancestryGroup = useRecoilValue(ancestryGroupAtom)

  return (
    <Container>
      <Table>
        <thead>
          <tr>
            <td />
            {variants.map((v: any) => {
              const color = analysesColors.find((a) => a.analysisId === v.analysis_id)!.color
              return (
                <td key={`${v.analysis_id}-heading`} className='tilted-text'>
                  <ColorMarker color={color} />
                  {v.analysis_description}
                </td>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {countColumns(ancestryGroup).map((field) => {
            const style = { maxWidth: field.minWidth, borderBottom: field.borderBottom }

            return (
              <tr
                style={{ borderBottom: field.borderBottom, background: field.background }}
                key={`variant-results-${field.key}`}
              >
                <td style={{ minWidth: 80, borderBottom: field.borderBottom }}>
                  <strong>{field.heading}</strong>
                </td>
                {variants.map((variant: any) => {
                  return (
                    <td
                      key={`single-variant-${variant.variant_id}-${variant.analysis_id}`}
                      style={style}
                    >
                      {field.render(variant, field.key)}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </Table>
    </Container>
  )
}
