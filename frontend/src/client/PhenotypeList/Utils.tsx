import { interpolateRdBu } from 'd3-scale-chromatic'
import { scaleDiverging } from 'd3-scale'
import { transparentize } from 'polished'
import React from 'react'
import styled from 'styled-components'

import { ColorMarker } from '../UserInterface'

export const P_VALUE_BURDEN = 'pValueBurden'
export const P_VALUE_SKAT = 'pValueSkat'
export const P_VALUE_SKAT_O = 'pValueSkatO'

export const burdenPValueKeyName = 'pvalue_burden'
export const skatPValueKeyName = 'pvalue_skat'
export const skatOPValueKeyName = 'pvalue'

export const pValueTypeToPValueKeyName = {
  [P_VALUE_BURDEN]: burdenPValueKeyName,
  [P_VALUE_SKAT]: skatPValueKeyName,
  [P_VALUE_SKAT_O]: skatOPValueKeyName,
}

export const tableDisplayThreshold = 1.0e-3
export const geneYellowThreshold = 1.0e-4
export const geneGreenThreshold = 2.5e-6

export const variantYellowThreshold = 1.0e-6
export const variantGreenThreshold = 3.5e-7

export const yellowThresholdColor = 'orange'
export const greenThresholdColor = 'mediumseagreen'

export const geneIsBelowThreshold = (
  gene: any,
  threshold: number = tableDisplayThreshold
): boolean => {
  if (gene.Pvalue < threshold) return true
  if (gene.Pvalue_Burden && gene.Pvalue_Burden < threshold) return true
  if (gene.Pvalue_SKAT && gene.Pvalue_SKAT < threshold) return true
  if (gene.top_pvalue && gene.top_pvalue < threshold) return true
  return false
}

export const renderPvalueCell =
  (thresholdType: string, pValueType: any) =>
    (row: any, key: any) => {
      if (row) {
        let pvalueKey = key
        if (thresholdType == "gene") {
          // @ts-ignore
          pvalueKey = pValueTypeToPValueKeyName[pValueType]
        }
        const number = row[pvalueKey]
        if (number === null || number === undefined || number === '-' || number === 0) {
          // HACK
          return null
        }
        const truncated = Number(number.toPrecision(3))
        if (truncated === 0) {
          return '0'
        }

        const yellowThreshold =
          thresholdType === 'gene' ? geneYellowThreshold : variantYellowThreshold
        const greenThreshold = thresholdType === 'gene' ? geneGreenThreshold : variantGreenThreshold

        let pass = true

        // if (context === 'pheno') {
        //   if (pValueType == P_VALUE_SKAT_O) {
        //     pass = row.keep_pheno_skato
        //   } else if (pValueType == P_VALUE_SKAT) {
        //     pass = row.keep_pheno_skat
        //   } else if (pValueType == P_VALUE_BURDEN) {
        //     pass = row.keep_pheno_burden
        //   }
        // }

        // if (context === 'gene') {
        //   if (pValueType == P_VALUE_SKAT_O) {
        //     pass = row.keep_gene_skato
        //   } else if (pValueType == P_VALUE_SKAT) {
        //     pass = row.keep_gene_skat
        //   } else if (pValueType == P_VALUE_BURDEN) {
        //     pass = row.keep_gene_burden
        //   }
        // }

        let highlightColor = truncated < yellowThreshold ? yellowThresholdColor : null
        highlightColor = truncated < greenThreshold ? greenThresholdColor : highlightColor

        const border = pass ? 'solid' : 'dashed'
        const borderColor = pass ? 'black' : 'grey'
        highlightColor = pass ? highlightColor : transparentize(0.8, highlightColor || 'white')

        return (
          <>
            <ColorMarker
              color={highlightColor || 'white'}
              border={border}
              borderColor={borderColor}
            />
            {truncated.toExponential()}
          </>
        )
      }
    }

const betaExtent = [-0.15, 0.15]

const defaultBetaScale = scaleDiverging(interpolateRdBu).domain([betaExtent[0], 0, betaExtent[1]])

const BetaCell: React.FC<any> = ({ betaValue, betaScale }) => {
  // const signColor = 'blue'
  //
  let signColor = betaScale ? betaScale(betaValue) : defaultBetaScale(betaValue)

  return (
    <>
      <ColorMarker color={signColor || 'white'} />
      {betaValue.toExponential()}
    </>
  )
}

export const renderBetaCell = (betaScale?: any) => (row: any, key: any) => {
  try {
    const number = row[key];

    if (
      number === null ||
      number === undefined ||
      number === '-' ||
      number === 0 ||
      number === Infinity ||
      number === -Infinity
    ) {
      return '';
    }
    const truncated = Number(number.toPrecision(3));
    if (truncated === 0) {
      return '0';
    }

    return <BetaCell betaValue={truncated} betaScale={betaScale} />;
  } catch (error) {
    console.error('Error processing row:', row, error);
    return 'ERROR';
  }
};

export const renderExponentialNumberCell = (row: any, key: any) => {
  const number = row[key]
  if (number === null || number === undefined || number === '-' || number === 0) {
    // HACK
    return ''
  }
  const truncated = Number(number.toPrecision(3))
  if (truncated === 0) {
    return '0'
  }
  return truncated.toExponential()
}

export const renderExponentialNumberCellColor = (color: any) => (row: any, key: any) => {
  const number = row[key]
  if (number === null || number === undefined || number === '-' || number === 0) {
    // HACK
    return ''
  }
  const truncated = Number(number.toPrecision(3))
  if (truncated === 0) {
    return '0'
  }
  return (
    <div style={{ backgroundColor: color, width: '100%', height: '100%' }}>
      {truncated.toExponential()}
    </div>
  )
}

export const renderNumberCell = (row: any, key: any) => {
  const number = row[key]
  if (number === null || number === undefined) {
    return ''
  }
  const truncated = Number(number.toPrecision(3))
  if (truncated === 0) {
    return '0'
  }
  return truncated
}

export const CountCell = styled.span`
  overflow: hidden;
  width: 100%;
  padding-right: 25px;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const renderCount = (row: any, key: any) => {
  let value = row[key]

  if ((value && typeof value === 'number') || value === 0) {
    value = Math.floor(value)
  } else {
    value = ''
  }

  return <CountCell>{value}</CountCell>
}

export const renderCountText = (text: any) => {
  let value = text

  if ((value && typeof value === 'number') || value === 0) {
    value = Math.floor(value)
  } else {
    value = ''
  }

  return value
}

export const NumberCell = styled.span`
  overflow: hidden;
  width: 100%;
  padding-right: 15px;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
`
export const renderFloat = (row: any, key: any) => {
  const value = row[key]
  if (value === null || value === undefined) {
    return ''
  }
  const truncated = Number(value.toPrecision(3))
  if (truncated === 0) {
    return <NumberCell>0</NumberCell>
  }
  return <NumberCell>{truncated.toExponential()}</NumberCell>
}

export const PvalueHighlight = styled.span<{ highlightColor?: string }>`
  display: inline-block;
  padding: 0.25em 0.4em;
  border: 1px solid #000;
  border-radius: 0.3em;
  background: ${(props) => props.highlightColor || 'none'};
  color: #000;
`

export const RoundedNumber = ({ num, precision = 3, highlightColor = null }: any) => {
  if (num === null || num === undefined) {
    return <span>'—'</span>
  }
  let roundedNumber = Number(num.toPrecision(precision))
  if (num <= 0.001) {
    // @ts-expect-error ts-migrate(2322) FIXME: Type 'string' is not assignable to type 'number'.
    roundedNumber = roundedNumber.toExponential()
  } else {
    roundedNumber.toFixed(3)
  }
  return highlightColor ? (
    <>
      <ColorMarker color={highlightColor} />
      {roundedNumber}
    </>
  ) : (
    <span>{roundedNumber}</span>
  )
}

export function reverseXPosition(xPosition: number): [string, number] {
  const contigNum = Math.floor(xPosition / 1_000_000_000)
  const position = xPosition % 1_000_000_000

  let contigName: string
  if (contigNum === 23) {
    contigName = 'X'
  } else if (contigNum === 24) {
    contigName = 'Y'
  } else if (contigNum === 25) {
    contigName = 'M' // Adjust this if "M" isn't correct in your context
  } else {
    contigName = contigNum.toString()
  }

  return [contigName, position]
}
