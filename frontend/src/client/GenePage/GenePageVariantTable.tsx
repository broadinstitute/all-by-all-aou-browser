/* eslint-disable camelcase */
import { flatten, keyBy, mergeWith, values } from 'lodash'
import memoizeOne from 'memoize-one'
import React from 'react'
import { useHistory } from 'react-router-dom'
import { useRecoilValue, useSetRecoilState, useRecoilState } from 'recoil'
import VariantTable from '../VariantList/VariantTable'
import { countColumns, getVariantColumns } from '../VariantList/variantTableColumns'
import ExportDataButton from '../ExportDataButton'
import {
  analysisIdAtom,
  ancestryGroupAtom,
  geneIdAtom,
  selectedAnalysesColorsSelector,
  variantIdAtom,
  windowSizeAtom,
} from '../sharedState'
import type { VariantJoined } from '../types'
import {
  selectedVariantFieldsAtom,
  VariantFieldType,
  hoveredVariantAtom,
  multiAnalysisVariantTableFormatAtom,
  enableVariantLabelsAtom,
  variantShowLabelAtom,
} from '../variantState'

import { scaleDiverging } from 'd3-scale'
import { interpolateRdBu } from 'd3-scale-chromatic'

export interface MultiAnalysisVariantSummary {
  variant_id: string
  analysisIds: string[]
  analyses: { analysis_id: string; description: string; pvalue: number; beta: number }[]
  consequence: string
  hgvsp: string
  hgvsc: string
  pValueRange: [number, number] | null
  // maxBeta: number;
  allele_count: number
  allele_frequency: number
  allele_number: number
}

const combineVariants = (objValue: MultiAnalysisVariantSummary, srcValue: VariantJoined) => {
  const { analysis_id } = srcValue

  const extraColumns = countColumns('meta').reduce(
    (acc, field) => ({ ...acc, [`${analysis_id}_${field.key}`]: (srcValue as any)[field.key] }),
    {}
  )

  if (!objValue) {
    return {
      ...srcValue,
      analysisIds: [srcValue.analysis_id],
      analyses: [
        {
          analysis_id: srcValue.analysis_id,
          description: srcValue.analysis_description,
          pvalue: srcValue.pvalue,
          beta: srcValue.beta,
        },
      ],
      pValueRange: srcValue.pvalue ? [srcValue.pvalue, srcValue.pvalue] : null,
      pvalue: srcValue.pvalue,
      ...extraColumns,
    }
  }

  const { pvalue } = srcValue
  const { pValueRange } = objValue

  let newPvalueRange: [number, number] | null = null

  if (pvalue && !pValueRange) {
    newPvalueRange = [pvalue, pvalue]
  } else if (!pvalue && !pValueRange) {
    newPvalueRange = null
  } else if (pvalue && pValueRange) {
    const pValueMin = pValueRange[0] < pvalue ? pValueRange[0] : pvalue
    const pValueMax = pValueRange[1] < pvalue ? pValueRange[1] : pvalue
    newPvalueRange = [pValueMin, pValueMax]
  }

  return {
    ...objValue,
    analysisIds: [...objValue.analyses, srcValue.analysis_id],
    analyses: [
      ...objValue.analyses,
      {
        analysis_id: srcValue.analysis_id,
        pvalue: srcValue.pvalue,
        beta: srcValue.beta,
        description: srcValue.analysis_description,
      },
    ],

    pValueRange: newPvalueRange,
    pvalue: newPvalueRange ? newPvalueRange[1] : null,
    ...extraColumns,
  }
}

type Props = {
  variantDatasets: VariantJoined[][]
  variantId?: string
  onSort: any
  sortState: any
  sortVariants: any
}

export const GenePageVariantTable = ({
  variantDatasets,
  onSort,
  sortState,
  sortVariants,
}: Props) => {
  const history = useHistory()
  const analysesColors = useRecoilValue(selectedAnalysesColorsSelector)
  const ancestryGroup = useRecoilValue(ancestryGroupAtom)
  const [selectedVariantFields, setSelectedVariantFields] = useRecoilState(selectedVariantFieldsAtom)
  const tableFormat = useRecoilValue(multiAnalysisVariantTableFormatAtom)
  const setHoveredVariant = useSetRecoilState(hoveredVariantAtom)
  const windowSize = useRecoilValue(windowSizeAtom)
  // const { betaScale } = useRecoilValue(variantBetaScaleAtom)

  const analysisId = useRecoilValue(analysisIdAtom)
  const geneId = useRecoilValue(geneIdAtom)
  const variantId = useRecoilValue(variantIdAtom)
  const enableVariantLabels = useRecoilValue(enableVariantLabelsAtom)
  const variantShowLabel = useRecoilValue(variantShowLabelAtom)

  // Track previous state to only add columns when feature is first enabled
  const prevEnabledRef = React.useRef(enableVariantLabels)

  // Auto-add label columns when feature is enabled (only on enable transition)
  React.useEffect(() => {
    const wasDisabled = !prevEnabledRef.current
    const isNowEnabled = enableVariantLabels

    if (wasDisabled && isNowEnabled) {
      setSelectedVariantFields(prev => {
        const needsShowLabel = !prev.includes('show_label')

        if (needsShowLabel) {
          return [...prev, 'show_label']
        }
        return prev
      })
    }

    prevEnabledRef.current = enableVariantLabels
  }, [enableVariantLabels, setSelectedVariantFields])

  const baseColumns = variantId
    ? []
    : [
      'variant_id',
      // Label columns are now controlled by selectedVariantFields checkboxes
      // 'sequencing_type',
      // 'ancestry_group',
      // 'consequence',
      // 'hgvsp',
    ]

  // Filter out label columns if feature flag is disabled
  const filteredVariantFields = enableVariantLabels
    ? selectedVariantFields
    : selectedVariantFields.filter(f => f !== 'show_label' && f !== 'label')

  const longColumns = tableFormat === 'long' ? [...filteredVariantFields] : []

  const multiVariantAnalysisColumns =
    tableFormat === 'long' && variantDatasets.length > 1 ? [] : []

  const betaExtent = [-1, 1]

  const betaScale = scaleDiverging(interpolateRdBu).domain([betaExtent[0], 0, betaExtent[1]])

  const wideColumns =
    tableFormat === 'wide'
      ? [
        ...selectedVariantFields.filter(
          (f) =>
            !countColumns(ancestryGroup, betaScale)
              .map((c) => c.key)
              .includes(f)
        ),
      ]
      : []

  const columns = [...baseColumns, ...multiVariantAnalysisColumns, ...longColumns, ...wideColumns]

  const analyses = variantDatasets
    .filter((ds) => ds.length !== 0)
    .map((ds) => {
      const { analysis_id, analysis_description } = ds[0]
      return { analysis_id, analysis_description }
    })

  const getAssociationVariantColumns = memoizeOne(() => {
    const cols = getVariantColumns({
      columns,
      geneId,
      history,
      ancestryGroup,
      phenotypeId: analysisId,
      betaScale,
    })

    const wideColumns =
      tableFormat === 'wide'
        ? analyses &&
        analyses.flatMap(({ analysis_id, analysis_description }) => {
          const color = analysesColors.find((a) => a.analysisId === analysis_id)!.color

          let tiltedLabel: string = analysis_description || ''

          if (tiltedLabel.length > 20) {
            tiltedLabel = tiltedLabel.slice(0, 20) + '...'
          }

          return countColumns(ancestryGroup, betaScale)
            .filter((field) => selectedVariantFields.includes(field.key as VariantFieldType))
            .map(({ key, render, heading, minWidth, tooltip }) => ({
              key: `${analysis_id}_${key}`,
              heading,
              grow: 0,
              isSortable: true,
              minWidth,
              render,
              tiltedLabel,
              tooltip,
              markerColor: color,
            }))
        })
        : []

    return [...cols, ...wideColumns]
  })

  const tableColumns = getAssociationVariantColumns()

  const getCsvExportColumns = getVariantColumns({
    columns: [
      'variant_id',
      'consequence',
      'hgvsc',
      'hgvsp',
      'pvalue',
      'beta',
      'allele_count',
      'allele_frequency',
      'homozygote_count',
    ],
    ancestryGroup,
  })

  const onHoverVariant = (variantId: string) => {
    setHoveredVariant(variantId)
  }

  let variants: any

  //@ts-ignore: FIXME
  const multiAnalysisVariantSummary: MultiAnalysisVariantSummary[] = React.useMemo(
    () =>
      //@ts-ignore: FIXME
      variantDatasets.reduce((acc: MultiAnalysisVariantSummary[], ds: VariantJoined[]) => {
        return values(mergeWith(keyBy(acc, 'variant_id'), keyBy(ds, 'variant_id'), combineVariants))

        // @ts-ignore: FIXME
      }, {}),
    [variantDatasets, tableFormat]
  )

  if (tableFormat === 'wide' && !variantId) {
    const augmentedVariants = multiAnalysisVariantSummary.map(v => ({
      ...v,
      show_label: variantShowLabel[v.variant_id] || false
    }))
    variants = sortVariants(augmentedVariants)
  } else if (tableFormat === 'long' || variantId) {
    const augmentedVariants = flatten(variantDatasets).map(v => ({
      ...v,
      show_label: variantShowLabel[v.variant_id] || false
    }))
    variants = sortVariants(augmentedVariants)
  }

  const longTableGetKey = (v: VariantJoined) => `${v.variant_id}-${v.ancestry_group}-${v.sequencing_type}_long_table`
  const wideTableGetKey = (v: VariantJoined) => `${v.variant_id}-${v.ancestry_group}-${v.sequencing_type}_wide_gene`

  const getRowKey = (tableFormat === 'long' && longTableGetKey) || wideTableGetKey

  const tiltedLabels = tableFormat === 'wide'

  const exportColumns = tableColumns.map((c) => ({ ...c, heading: c.key }))

  let numRowsRendered = 14

  if (windowSize.height) {
    if (variantDatasets.length === 1 && !variantId) {
      numRowsRendered = Math.floor((windowSize.height - 450) / 30)
      if (tableFormat === 'wide') {
        numRowsRendered = Math.floor((windowSize.height - 420) / 30)
      }
    } else if (tableFormat === 'wide') {
      numRowsRendered = Math.floor((windowSize.height - 450) / 30)
    } else {
      numRowsRendered = Math.floor((windowSize.height - 400) / 30)
    }
  }

  if (numRowsRendered < 14) {
    numRowsRendered = 14
  }

  return (
    <React.Fragment>
      <VariantTable
        columns={tableColumns}
        onHoverVariant={onHoverVariant}
        sortOrder={sortState.sortOrder}
        sortKey={sortState.sortKey}
        onRequestSort={onSort}
        variants={variants}
        numRowsRendered={numRowsRendered}
        getRowKey={getRowKey}
        tiltedLabels={tiltedLabels}
      />
      <ExportDataButton exportFileName='file.csv' data={variants} columns={exportColumns} />
    </React.Fragment>
  )
}
