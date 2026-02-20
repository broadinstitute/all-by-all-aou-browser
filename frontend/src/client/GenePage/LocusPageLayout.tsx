import React, { useState } from 'react'
import { RegionsTrack, RegionViewer } from '@axaou/ui'
import { withSize } from 'react-sizeme'
import { useRecoilState, useRecoilValue } from 'recoil'
import styled from 'styled-components'
import { Button } from '@gnomad/ui' // Ensure Table is imported
import { QueryState } from '@axaou/ui'

import {
  AncestryGroupCodes,
  regionIdAtom,
  variantIdAtom,
} from '../sharedState'
import { TinySpinner } from '../UserInterface'
import {
  gwasCatalogOptionsAtom,
  membershipFiltersAtom,
  multiAnalysisVariantDetailsAtom,
  multiAnalysisVariantTableFormatAtom,
  sortStateAtom,
  variantFilterAtom,
  variantSearchTextAtom,
} from '../variantState'

import filterVariants from '../VariantList/filterVariants'
import sortItems from '../sortItems'

import { LocusPagePlots } from './LocusPagePlots'
import { GenePageVariantTable } from './GenePageVariantTable'
import { VariantDetails } from './VariantDetails'
import { IndividualVariantResultsTable } from './IndividualVariantResultsTable'
import { ZoomRegion } from './LocusPlotControls'
import GeneBurdenTable from './GeneBurdenTable'
import GenesTrackContainer from './GenesTrackContainer'
import getColumns from '../GeneResults/geneResultColumns'

import {
  GeneAssociations,
  AnalysisMetadata,
  VariantJoined,
  GeneModels,
  VariantDataset,
  LocusPlotResponse,
} from '../types'
import GeneResultsTable from '../GeneResults/GeneResultsTable'

// Styled Components (unchanged)
const GenePageGridStyles = styled.div`
  width: 100%;
  height: 100%;
  min-height: 100%;

  h3 {
    max-width: 100%;
    white-space: nowrap;
    text-overflow: ellipsis;
    margin-right: 5px;
  }

  .associations-page-grid {
    width: 100%;
    max-height: calc(100vh - 10em);
    overflow-y: auto;
    padding-right: 20px;

    display: grid;

    grid-template-columns: 1fr 1fr;
    grid-template-rows: min-content min-content;
    grid-template-areas:
      'sva-title sva-title'
      'plot-controls plot-controls'
      'region-viewer region-viewer'
      'variant-table variant-table';

    justify-content: center;
    align-content: flex-start;
    align-items: flex-start;
  }

  .grid-area-sva-title {
    grid-area: sva-title;
  }

  .grid-area-plot-controls {
    grid-area: plot-controls;
    display: flex;
    justify-content: space-between;
    flex-direction: row;
    gap: 10px;
    max-height: 27px;
    margin-top: 10px;
  }

  .gene-phenotype-title {
    width: 100%;
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
  }

  .grid-area-gene-info {
    grid-area: gene-info;
  }

  .grid-area-region-viewer {
    grid-area: region-viewer;
  }

  .grid-area-variant-details {
    max-width: 600px;
    grid-area: variant-details;
    width: 90%;
    height: 100%;
  }

  .grid-area-variant-table {
    grid-area: variant-table;
    width: 100%;
    max-width: 100%;
    margin-top: 20px;
    margin-bottom: 20px;
    min-height: 500px;
  }
`

const PageWithVariantDetails = styled(GenePageGridStyles)`
  .associations-page-grid {
    grid-template-columns: 1fr 1fr 1fr;
    grid-template-areas:
      'title title title'
      'plot-controls plot-controls plot-controls'
      'region-viewer region-viewer variant-details'
      'variant-table variant-table variant-table';
  }
`

const PageWithGeneBurdenDetails = styled(GenePageGridStyles)`
  .associations-page-grid {
    grid-template-columns: 1fr 1fr 1fr;
    grid-template-areas:
      'burden-title burden-title burden-title'
      'burden-table burden-table burden-table'
      'sva-title sva-title sva-title'
      'plot-controls plot-controls plot-controls'
      'region-viewer region-viewer variant-details'
      'variant-table variant-table variant-table';
  }

  .grid-area-burden-title {
    grid-area: burden-title;
  }

  .grid-area-burden-table {
    grid-area: burden-table;
    min-width: 100%;
    margin-bottom: 20px;

    display: grid;
    grid: min-content fit-content / max-content max-content;

    .grid-burden-table-values {
      grid-column: span 3;
    }
  }

  .threshold-legend {
    font-size: 10px;
    justify-self: end;
  }
`

const LeftPanel = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  padding-right: 10px;
`

const StrandIcon = styled.span`
  width: 20px;
  height: 20px;
  border-radius: 10px;
  background: #424242;
  color: #fff;
  font-size: 18px;
  line-height: 20px;
  text-align: center;
`

const GwasCatalogDetailsContainer = styled.div`
  margin-bottom: 40px;

  .gwas-details-item {
    strong {
      margin-right: 5px;
    }
    margin-top: 10px;
  }
`

interface GwasCatalogDetailsProps {
  gwasCatalog: any[]
}

const GwasCatalogDetails: React.FC<GwasCatalogDetailsProps> = ({ gwasCatalog }) => {
  return (
    <GwasCatalogDetailsContainer>
      <h2>GWAS Catalog Entries</h2>
      {gwasCatalog.map((item, i) => (
        <div className="gwas-details-item" key={`gwas-catalog-details-${i}`}>
          <div>
            <strong>Trait</strong>
            <span>{item.trait}</span>
          </div>
          <div>
            <strong>Mapped gene</strong>
            <span>{item.mapped_gene}</span>
          </div>
          <div>
            <strong>Study:</strong>
            <span>{item.study}</span>
          </div>
          <div>
            <strong>Author:</strong>
            <span>{item.first_author}</span>
          </div>
          <div>
            <strong>Journal:</strong>
            <span>{item.journal}</span>
          </div>
          <div>
            <strong>Date:</strong>
            <span>{item.date_added}</span>
          </div>
          <div>
            <strong>Pubmed ID:</strong>
            <span>
              <a target="_blank" rel="noopener noreferrer" href={`https://${item.link}`}>
                {item.pubmed_id}
              </a>
            </span>
          </div>
        </div>
      ))}
    </GwasCatalogDetailsContainer>
  )
}

const parseRegionId = (regionId: string) => {
  if (!regionId) {
    throw new Error('Region ID is missing')
  }

  const [contig, start, stop] = regionId.split('-')
  return { contig, start: parseInt(start, 10), stop: parseInt(stop, 10) }
}

// Main Component Props
type LocusPageLayoutProps = {
  geneModels: GeneModels[]
  geneAssociations: GeneAssociations[]
  analysisMetadata?: AnalysisMetadata
  ancestryGroup: AncestryGroupCodes
  variantDatasets: VariantDataset[]
  variantId: string
  queryStates: any
  size: { width: number; height: number }
  /** Optional locus plot data for PNG-based rendering */
  locusPlotData?: LocusPlotResponse | null
}

// Main Component
const LocusPageLayoutComponent: React.FC<LocusPageLayoutProps> = ({
  geneModels,
  geneAssociations,
  ancestryGroup,
  analysisMetadata,
  variantDatasets,
  size,
  queryStates,
  locusPlotData,
}) => {
  const { width } = size

  const [membershipFilters, setMembershipFilters] = useRecoilState(membershipFiltersAtom)
  const variantDetails = useRecoilValue(multiAnalysisVariantDetailsAtom)
  const variantId = useRecoilValue(variantIdAtom)
  const filter = useRecoilValue(variantFilterAtom)
  const [searchText, setVariantSearchText] = useRecoilState(variantSearchTextAtom)
  const [sortState, setSortState] = useRecoilState(sortStateAtom)
  const tableFormat = useRecoilValue(multiAnalysisVariantTableFormatAtom)
  const gwasCatalogOption = useRecoilValue(gwasCatalogOptionsAtom)
  const [regionId, setRegionId] = useRecoilState(regionIdAtom)
  const [showVariantTable, setShowVariantTable] = useState(false)

  const regionViewerWidth = width
  const geneModel = !regionId ? geneModels[0] : undefined
  const exons = geneModel?.exons.filter((e) => e.feature_type === 'CDS')

  const regions = regionId
    ? (() => {
      const { start, stop } = parseRegionId(regionId)
      return [
        {
          feature_type: 'region',
          start: start - 50000,
          stop: stop + 50000,
          previousRegionDistance: 0,
          offset: 0,
        },
      ]
    })()
    : exons || [{ start: 0, stop: 100 }]

  let Container = PageWithGeneBurdenDetails

  if (variantDetails) {
    Container = PageWithVariantDetails
  }


  const regionViewerWidthFactor = variantDetails ? 0.666 : 1

  const sortAndFilterVariants = (variants: VariantJoined[]) =>
    sortItems(filterVariants(variants, { ...filter, searchText }, membershipFilters), {
      sortKey: sortState.sortKey,
      sortOrder: sortState.sortOrder,
    })

  const datasets: VariantJoined[][] = variantDatasets
    ? variantDatasets
      .filter((vds) => vds.ancestryGroup === ancestryGroup)
      .map((vds) => {
        let filtered = filterVariants(vds.data, { ...filter, searchText }, membershipFilters)

        if (regionId) {
          const { start, stop } = parseRegionId(regionId);
          filtered = filtered.filter((variant) => {
            const variantPos = variant.locus.position;
            return variantPos >= start && variantPos <= stop;
          });
        } else if (geneModel) {
          const { start, stop } = geneModel;
          filtered = filtered.filter((variant) => {
            const variantPos = variant.locus.position;
            return variantPos >= start && variantPos <= stop;
          });
        }

        if (gwasCatalogOption === 'filter') {
          filtered = filtered.filter((v) => v.gwas_catalog)
        }

        return sortItems(filtered, sortState)
      })
    : [[]]

  const handleSort = (newSortKey: string) => {
    const newSortOrder: 'ascending' | 'descending' =
      newSortKey === sortState.sortKey && sortState.sortOrder === 'ascending'
        ? 'descending'
        : 'ascending'
    setSortState({ sortKey: newSortKey, sortOrder: newSortOrder })
  }

  React.useEffect(() => {
    if (variantId) {
      setVariantSearchText(variantId)
    }
  }, [variantId, setVariantSearchText])

  const renderTitle = () => {
    if (!regionId) {
      if (!geneModel) {
        return null
      }

      return (
        <>
          <h3 className="app-section-title">
            <strong>{geneModel.symbol}</strong> single variant associations with{' '}
            <strong>
              {analysisMetadata && analysisMetadata.description}
            </strong>{' '}

          </h3>
          <div className="grid-area grid-area-plot-controls">
            <Button
              onClick={() => {
                if (geneModel) {
                  const newRegionId = `${geneModel.chrom}-${geneModel.start - 200000}-${geneModel.stop + 200000}`
                  setRegionId(newRegionId)
                }
              }}
            >
              Show Region
            </Button>
            <LoadingSpinners queryStates={queryStates} />
          </div>
        </>
      )
    }

    return (
      <h3 className="app-section-title">
        Single variant <strong>{variantId}</strong> associations in locus {regionId} with{' '}
        <strong>{analysisMetadata && analysisMetadata.description} {' '}</strong>

      </h3>
    )
  }

  // New state for toggling tables

  const toggleTable = () => setShowVariantTable(!showVariantTable)

  const geneResultsColKeys = [
    'gene_name_phenotype_page',
    // 'chrom',
    // 'position',
    'annotation',
    // 'ancestry_group',
    'pvalue',
    'pvalue_skat',
    'pvalue_burden',
    'beta_burden',
    'show',
  ]

  const geneResultsColumns = getColumns({
    columnList: geneResultsColKeys,
    onClickGeneId: () => { },
    burdenSet: "pLoF",
  })

  const LoadingSpinners = ({ queryStates }: { queryStates: Record<string, QueryState<any>> }) => {
    const [dismissedErrors, setDismissedErrors] = React.useState<Record<string, boolean>>({});

    const dismissError = (key: string) => {
      setDismissedErrors(prev => ({ ...prev, [key]: true }));
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 50, alignItems: 'flex-end', zIndex: 10 }}>
        {Object.entries(queryStates).map(([key, state]) => {
          if ((state as QueryState<any>).error && !dismissedErrors[key]) {
            return (
              <div key={key} style={{ flexBasis: '100%', color: '#f44336', padding: '8px', borderRadius: '4px', backgroundColor: '#fff5f5', border: '1px solid #f44336', margin: '4px 0', position: 'relative' }}>
                <strong>Error loading:</strong> {key.replace(/([A-Z])/g, ' $1').toLowerCase()} - {state.error?.message}
                <span
                  style={{ marginLeft: '10px', cursor: 'pointer', fontWeight: 'bold' }}
                  onClick={() => {
                    dismissError(key);
                    delete queryStates[key];
                  }}
                >X</span>
              </div>
            );
          }
          if ((state as QueryState<any>).isLoading) {
            return (
              <TinySpinner key={key} style={{ flexBasis: '100%' }}>
                Loading {key.replace(/([A-Z])/g, ' $1').toLowerCase()}...
              </TinySpinner>
            );
          }
          return null;
        })}
      </div>
    );
  };

  return (
    <Container>
      <div className="associations-page-grid">
        {!variantId && !regionId && (
          <>

            <div className="grid-area grid-area-burden-title">
              <h3 className="app-section-title">
                <strong>{geneModel?.symbol || variantId}</strong> gene burden associations with{' '}
                <strong>
                  {analysisMetadata && analysisMetadata.description}
                </strong>{' '}

              </h3>
            </div>
            <div className="grid-area grid-area-burden-table">
              <GeneBurdenTable
                geneAssociations={(geneAssociations).filter(d => d.ancestry_group == ancestryGroup)}
                membershipFilters={membershipFilters}
                setMembershipFilters={setMembershipFilters}
                analysisMetadata={analysisMetadata}
              />
            </div>
          </>
        )}

        <div className="grid-area grid-area-sva-title">{renderTitle()}</div>

        {regionId && (
          <div className="grid-area grid-area-plot-controls">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <ZoomRegion />
              {regionId && (
                <Button onClick={toggleTable}>
                  {showVariantTable ? 'Show Gene Results' : 'Show Variant Table'}
                </Button>
              )}
            </div>
            <LoadingSpinners queryStates={queryStates} />
          </div>
        )}

        <div className="grid-area grid-area-region-viewer">
          <RegionViewer
            leftPanelWidth={50}
            width={regionViewerWidth * regionViewerWidthFactor}
            padding={25}
            regions={regions}
            rightPanelWidth={0}
          >
            <>
              <LocusPagePlots variantDatasets={datasets} locusPlotData={locusPlotData} />
              {!regionId && (
                <RegionsTrack
                  height={20}
                  regions={regions}
                  renderLeftPanel={() => (
                    <LeftPanel>
                      <StrandIcon>
                        {geneModel?.strand === '-' ? <span>&larr;</span> : <span>&rarr;</span>}
                      </StrandIcon>
                    </LeftPanel>
                  )}
                />
              )}
              {regions && <GenesTrackContainer geneModelsInRegion={geneModels} />}
            </>
          </RegionViewer>
        </div>

        {variantDetails && (
          <div className="grid-area grid-area-variant-details">
            <VariantDetails />
          </div>
        )}

        <div className="grid-area grid-area-variant-table">
          {regionId ? (
            showVariantTable ? (
              tableFormat === 'wide' && variantId && datasets?.[0]?.length === 1 ? (
                <>
                  <IndividualVariantResultsTable
                    variantDatasets={datasets}
                    sortVariants={sortAndFilterVariants}
                  />
                  {datasets[0][0].gwas_catalog && (
                    <GwasCatalogDetails gwasCatalog={datasets[0][0].gwas_catalog} />
                  )}
                </>
              ) : (
                <GenePageVariantTable
                  variantDatasets={datasets}
                  onSort={handleSort}
                  sortState={sortState}
                  sortVariants={sortAndFilterVariants}
                />
              )
            ) : (
              <>

                <h3 className="app-section-title">
                  Gene burden associations in locus {regionId} with {analysisMetadata && analysisMetadata.description}
                </h3>
                <GeneResultsTable columns={geneResultsColumns} results={geneAssociations} exportColumns={["gene_id"]} analysisId={"height"} burdenSet='pLoF' highlightText='' numRowsRendered={8} />
              </>
            )
          ) : (
            tableFormat === 'wide' && variantId && datasets?.[0]?.length === 1 ? (
              <>
                <IndividualVariantResultsTable
                  variantDatasets={datasets}
                  sortVariants={sortAndFilterVariants}
                />
                {datasets[0][0].gwas_catalog && (
                  <GwasCatalogDetails gwasCatalog={datasets[0][0].gwas_catalog} />
                )}
              </>
            ) : (
              <GenePageVariantTable
                variantDatasets={datasets}
                onSort={handleSort}
                sortState={sortState}
                sortVariants={sortAndFilterVariants}
              />
            )
          )}
        </div>
      </div>
    </Container>
  )
}

export const LocusPageLayout = withSize()(LocusPageLayoutComponent)
