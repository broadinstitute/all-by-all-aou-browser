import { useState } from 'react'
import memoizeOne from 'memoize-one'
import styled from 'styled-components'
import { useRecoilState, useSetRecoilState } from 'recoil'
import { Button } from '@gnomad/ui'
import { analysisIdAtom, regionIdAtom, resultLayoutAtom, selectedContigAtom } from '../sharedState'
import VariantManhattanPlot from './VariantManhattanPlot'
import VariantQQPlot from './VariantQQPlot'
import { HalfPage, Titles } from '../UserInterface'
import filterVariants from '../VariantList/filterVariants'
import sortItems from '../sortItems'
import VariantFilterControls from '../VariantList/VariantFilterControls'
import VariantTable from '../VariantList/VariantTable'
import { getVariantColumns } from '../VariantList/variantTableColumns'
import ExportDataButton from '../ExportDataButton'
import { withSize } from 'react-sizeme'
import { useRecoilValue } from 'recoil'
import { windowSizeAtom } from '../sharedState'
import { AnalysisMetadata, LocusAssociation, VariantAssociationManhattan, VariantDataset } from '../types'
import VariantLocusTable from './VariantLocusTable'

const ResultsSection = styled.div`
  width: 100%;
  max-width: calc(100vw - 1.5em);
  min-height: calc(100vh - 1em);
  padding-right: 10px;
  overflow-y: auto;
  padding-right: 10px;
  margin-top: 20px;
`

const ManhattanPlotButtons = styled.div`
  margin-left: 20px;
`

const Plots = styled.div`
  display: flex;
  flex-direction: row;
  width: 100%;
`

interface VariantsInPhenotypeProps {
  variantDatasets: VariantDataset[];
  analysisMetadata: AnalysisMetadata;
  locusData?: LocusAssociation[];
  size: { width: number; height: number };
  ancestryGroup: string;
}

const VariantsInPhenotype = ({
  variantDatasets,
  analysisMetadata,
  size,
  ancestryGroup,
  locusData = [],
}: VariantsInPhenotypeProps) => {
  const { width } = size

  const defaultVariantFilter = {
    includeCategories: {
      lof: true,
      missense: true,
      synonymous: true,
      other: true,
    },
    includeFilteredVariants: false,
    includeSNVs: true,
    includeIndels: true,
    searchText: '',
  }

  const windowSize = useRecoilValue(windowSizeAtom)
  const setRegionId = useSetRecoilState(regionIdAtom)
  const [resultsLayout, setResultsLayout] = useRecoilState(resultLayoutAtom)

  const [filter, setVariantFilter] = useState(defaultVariantFilter)

  const [sortState, setSortState] = useState<{
    sortKey: string
    sortOrder: 'ascending' | 'descending'
  }>({ sortKey: 'pvalue', sortOrder: 'ascending' })

  const variants = variantDatasets.flatMap(vds =>
    vds.data.map(v => ({ ...v, sequencing_type: vds.sequencingType }))
  )

  const initialRenderedVariants = sortItems(filterVariants(variants, filter), {
    sortKey: sortState.sortKey,
    sortOrder: sortState.sortOrder,
  })

  const [renderedVariants, setRenderedVariants] = useState(initialRenderedVariants)

  const analysisId = useRecoilValue(analysisIdAtom)

  let numRowsRendered = 10

  if (windowSize.height) {
    numRowsRendered = (windowSize.height - 480) / 40
  }

  const mediumBreakpoint = 500
  const wideBreakpoint = 900

  const baseColumns = [
    'variant_id_manhattan_sva',
    'sequencing_type',
    'consequence',
    'gene_name',
    'pvalue',
    'show_variant_manhattan_sva',
  ]

  const mediumColumns = size.width > mediumBreakpoint ? ['beta', 'hgvsc', 'allele_count'] : []

  const wideColumns = size.width > wideBreakpoint ? ['allele_frequency', 'allele_number'] : []

  const columns = [...baseColumns, ...mediumColumns, ...wideColumns]

  const getAssociationVariantColumns = memoizeOne((width) =>
    getVariantColumns({
      width,
      columns,
      ancestryGroup,
      phenotypeId: analysisId,
    })
  )

  const onFilter = (newFilter: any) => {
    const { sortKey, sortOrder } = sortState
    const newRenderedVariants = sortItems(filterVariants(variants, newFilter), {
      sortKey,
      sortOrder,
    })
    setVariantFilter(newFilter)
    setRenderedVariants(newRenderedVariants)
  }

  const onSort = (newSortKey: any) => {
    let newSortOrder: 'ascending' | 'descending' = 'descending'
    if (newSortKey === sortState.sortKey) {
      newSortOrder = sortState.sortOrder === 'ascending' ? 'descending' : 'ascending'
    }

    const sortedVariants = sortItems(renderedVariants, {
      sortKey: newSortKey,
      sortOrder: newSortOrder,
    })

    setRenderedVariants(sortedVariants)
    setSortState({ sortKey: newSortKey, sortOrder: newSortOrder })
  }

  const newRenderedVariants = sortItems(filterVariants(renderedVariants, filter), {
    sortKey: sortState.sortKey,
    sortOrder: sortState.sortOrder,
  })

  const onVariantClick = (variant: VariantAssociationManhattan) => {
    const intervalSize = 500_000
    const regionId = `${variant.chrom}-${variant.pos - intervalSize}-${variant.pos + intervalSize
      }`
    if (resultsLayout == 'full') {
      setResultsLayout('half')
    }

    setRegionId(regionId)
  }

  const pointLabel = (variant: VariantAssociationManhattan) => {
    return variant.variant_id
  }

  const onlyUnbinned = newRenderedVariants.filter((v: any) => !v.is_binned)

  const [plotView, setPlotView] = useState<'manhattan' | 'qqplot' | 'both'>('manhattan')

  const handlePlotViewChange = (view: 'manhattan' | 'qqplot' | 'both') => {
    setPlotView(view)
  }

  const [showVariantTable, setShowVariantTable] = useState(true)

  const handleTableToggle = () => {
    setShowVariantTable(!showVariantTable)
  }

  return (
    <HalfPage>
      <ResultsSection>
        <h3 className='app-section-title variant-manhattan-title'>
          Genome-wide single variant associations with{' '}
          <strong>{analysisMetadata.description}</strong>
        </h3>
        <Plots>
          {plotView === 'both' && newRenderedVariants.some((v: any) => v.pvalue_expected) ? (
            <>
              <VariantManhattanPlot
                // @ts-expect-error
                variants={newRenderedVariants}
                onClickPoint={onVariantClick}
                pointLabel={pointLabel}
                width={width / 2}
              />
              <VariantQQPlot
                // @ts-expect-error
                results={newRenderedVariants}
                size={{ width: width / 2.2 }}
              />
            </>
          ) : plotView === 'manhattan' ||
            !newRenderedVariants.some((v: any) => v.pvalue_expected) ? (
            <VariantManhattanPlot
              // @ts-expect-error
              variants={newRenderedVariants}
              onClickPoint={onVariantClick}
              pointLabel={pointLabel}
              width={width}
            />
          ) : (
            <VariantQQPlot
              // @ts-expect-error
              results={newRenderedVariants}
              size={{ width }}
            />
          )}
        </Plots>
        {/* <ManhattanPlotButtons> */}
        {/*   <Button */}
        {/*     onClick={() => handlePlotViewChange('manhattan')} */}
        {/*     style={{ marginRight: '10px' }} */}
        {/*   > */}
        {/*     Manhattan */}
        {/*   </Button> */}
        {/*   <Button */}
        {/*     onClick={() => handlePlotViewChange('qqplot')} */}
        {/*     disabled={!newRenderedVariants.some((v: any) => v.pvalue_expected)} */}
        {/*     style={{ marginRight: '10px' }} */}
        {/*   > */}
        {/*     QQ Plot */}
        {/*   </Button> */}
        {/*   <Button */}
        {/*     onClick={() => handlePlotViewChange('both')} */}
        {/*     disabled={!newRenderedVariants.some((v: any) => v.pvalue_expected)} */}
        {/*   > */}
        {/*     Both */}
        {/*   </Button> */}
        {/*   <Button onClick={handleTableToggle} style={{ marginLeft: '10px' }}> */}
        {/*     {showVariantTable ? 'Locus Table' : 'Variant Table'} */}
        {/*   </Button> */}
        {/* </ManhattanPlotButtons> */}
        <VariantFilterControls onChange={onFilter} value={filter} />
        {showVariantTable ? (
          <VariantTable
            columns={getAssociationVariantColumns(width)}
            highlightText={filter.searchText}
            onRequestSort={onSort}
            sortKey={sortState.sortKey}
            sortOrder={sortState.sortOrder}
            variants={onlyUnbinned}
            numRowsRendered={numRowsRendered}
            getRowKey={(v: VariantAssociationManhattan) =>
              `${v.variant_id}-${v.ancestry_group}-${v.sequencing_type}_long_table`
            }
          />
        ) : (
          <VariantLocusTable data={locusData} />
        )}
        <ExportDataButton
          exportFileName={`single-variant-associations-exomes_${analysisId}`}
          data={onlyUnbinned}
          columns={getAssociationVariantColumns(width)}
        />
      </ResultsSection>
    </HalfPage>
  )
}

export default withSize()(VariantsInPhenotype)

