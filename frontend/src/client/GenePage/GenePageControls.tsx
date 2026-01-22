import {
  Button,
  Checkbox,
  KeyboardShortcut,
  SearchInput,
  SegmentedControl,
  TooltipAnchor,
  TooltipHint as TooltipHintBase,
} from '@gnomad/ui'
import React, { useRef } from 'react'
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil'
import styled from 'styled-components'

// @ts-expect-error ts-migrate(2307) FIXME: Cannot find module '@fortawesome/fontawesome-free/... Remove this comment to see the full error message
import Warning from '@fortawesome/fontawesome-free/svgs/solid/exclamation-triangle.svg'

import {
  alleleFrequencyFilterAtom,
  selectedVariantFieldsAtom,
  useToggleSelectedVariantField,
  membershipFiltersAtom,
  multiAnalysisColorByAtom,
  multiAnalysisTransparencyAtom,
  multiAnalysisVariantTableFormatAtom,
  variantFieldGroupState,
  VariantFieldType,
  useSelectedVariantFieldsPreset,
  selectedVariantFieldsOptions,
  variantSearchTextAtom,
  showCaseControlTracksAtom,
  autoPvalFilter,
  gwasCatalogOptionsAtom,
} from '../variantState'
// @ts-ignore: FIXME
import RangeSlider from '../PhenotypeList/RangeSlider'
import { getVariantColumns } from '../VariantList/variantTableColumns'
import { ColorMarker } from '../UserInterface'
import {
  variantGreenThreshold,
  greenThresholdColor,
  RoundedNumber,
  variantYellowThreshold,
  yellowThresholdColor,
} from '../PhenotypeList/Utils'
import { getAlleleFrequencyScale, consequenceCategoryColors } from './LocusPagePlots'
import { ancestryGroupAtom, regionIdAtom, variantIdAtom } from '../sharedState'

const TooltipHint = styled(TooltipHintBase)`
  background-image: none;
`

const GenePageControlsGeneFocus = styled.div`
  max-width: 210px;
  min-width: 230px;
  margin-left: 5px;
  padding-left: 0;
  padding-right: 0;

  max-height: calc(100vh - 10em);
  overflow-y: auto;
  overflow-x: hidden;

  display: grid;
  grid-auto-rows: min-content;
  grid-template-columns: 1fr;
  grid-template-areas:
    'search'
    'burden-set'
    'zoom-controls'
    'gwas-catalog-options'
    'show-case-control-tracks'
    'color-by'
    'pvalue-legend'
    'af-slider'
    'af-legend'
    'transparency-slider'
    'table-format'
    'field-group-controls'
    'individual-field-checkboxes'
    'app-data-stats';

  grid-row-gap: 1.2em;
  align-items: flex-start;

  span {
    margin-right: 5px;
    margin-right: 5px;
    margin-bottom: 5px;
  }

  .multi-analysis-controls-title {
    grid-area: title;
  }

  .multi-analysis-variant-search {
    grid-area: search;
  }

  .burden-set {
    grid-area: burden-set;

    span {
      margin-right: 5px;
    }

    label {
      display: flex;
      flex-direction: row;

      .burden-set-text {
        min-width: 80px;
      }
    }
  }

  .gwas-catalog-options {
    grid-area: gwas-catalog-options;
  }

  .show-case-control-tracks {
    grid-area: show-case-control-tracks;
  }

  .multi-analysis-color-by {
    grid-area: color-by;
  }

  .pvalue-slider {
    grid-area: pvalue-slider;
    text-align: center;
    display: flex;
    flex-direction: column;
  }
  .auto-pvalue-filter-warning {
    font-size: 10px;
  }
  .pvalue-legend {
    grid-area: pvalue-legend;
    text-align: center;
  }
  .allele-frequency-slider {
    grid-area: af-slider;
    text-align: center;
    margin-bottom: 1.3em;

    .display-values {
      width: 100%;
      display: flex;
      flex-direction: row;
      justify-content: space-between;
    }

    .value {
      font-size: 10px;
      color: grey;
      margin-right: 3px;
      margin-left: 3px;
    }
  }
  .allele-frequency-legend {
    grid-area: af-legend;
    text-align: center;
  }
  .transparency-slider {
    grid-area: transparency-slider;
    text-align: center;
    margin-bottom: 0.8em;
  }
  .field-group-controls {
    grid-area: field-group-controls;
  }

  .table-format {
    grid-area: table-format;
    margin-top: 20px;
  }
  .individual-field-checkboxes {
    grid-area: individual-field-checkboxes;
    display: flex;
    width: 100%;
    flex-direction: column;
    flex-wrap: wrap;
    max-height: 300px;
  }

  .individual-checkbox {
    display: flex;
    flex-direction: row;
    max-width: 50%;

    span {
      text-decoration: underline;
      text-decoration-style: dashed;
      text-decoration-thickness: 1px;
      text-decoration-color: grey;
    }
  }

  .unselect-variant {
    grid-area: unselect-variant;
  }
`

const GenePageControlStylesVariantFocus = styled(GenePageControlsGeneFocus)`
  grid-template-areas:
    'unselect-variant'
    'burden-set'
    'show-case-control-tracks'
    'color-by'
    'transparency-slider'
    'table-format'
    'field-group-controls'
    'individual-field-checkboxes'
    'app-data-stats';
`

const InBurdenAnalysisControls: React.FC = () => {
  const [membershipFilters, setMembershipFilters] = useRecoilState(membershipFiltersAtom)
  const multiAnalysisColorBy = useRecoilValue(multiAnalysisColorByAtom)
  return (
    <div className='burden-set'>
      <span>
        <strong>Include variants:</strong>
      </span>
      <label>
        {multiAnalysisColorBy === 'consequence' && (
          <ColorMarker color={consequenceCategoryColors.lof} />
        )}
        <span className='burden-set-text'>pLoF</span>
        <Checkbox
          label=''
          checked={membershipFilters.pLoF}
          id='pLoF-membership'
          disabled={false}
          onChange={(checked: boolean) => {
            setMembershipFilters({ ...membershipFilters, pLoF: checked })
          }}
        />
      </label>
      <label>
        {multiAnalysisColorBy === 'consequence' && (
          <ColorMarker color={consequenceCategoryColors.missense} />
        )}
        <span className='burden-set-text'>Missense</span>
        <Checkbox
          label=''
          checked={membershipFilters['missense']}
          id='missense-membership'
          disabled={false}
          onChange={(checked: boolean) => {
            setMembershipFilters({ ...membershipFilters, missense: checked })
          }}
        />
      </label>
      <label>
        {multiAnalysisColorBy === 'consequence' && (
          <ColorMarker color={consequenceCategoryColors.synonymous} />
        )}
        <span className='burden-set-text'>Synonymous</span>
        <Checkbox
          label=''
          checked={membershipFilters.synonymous}
          disabled={false}
          id='syn-membership'
          onChange={(checked: boolean) => {
            setMembershipFilters({ ...membershipFilters, synonymous: checked })
          }}
        />
      </label>
      <label>
        {multiAnalysisColorBy === 'consequence' && (
          <ColorMarker color={consequenceCategoryColors['non-coding']} />
        )}
        <span className='burden-set-text'>Non-coding</span>
        <Checkbox
          label=''
          checked={membershipFilters['non-coding']}
          disabled={false}
          id='non-coding-membership'
          onChange={(checked: boolean) => {
            setMembershipFilters({ ...membershipFilters, 'non-coding': checked })
          }}
        />
      </label>
    </div>
  )
}

const GwasCatalogOptions: React.FC = () => {
  const [gwasCatalogOption, setGwasCatalogOption] = useRecoilState(gwasCatalogOptionsAtom)
  return (
    <div className='gwas-catalog-options'>
      <label>
        <span>GWAS Catalog</span>
        <SegmentedControl
          id='gwas-catalog-options-control'
          options={[
            { value: 'hide', label: 'Hide' },
            { value: 'highlight', label: 'Highlight' },
            { value: 'filter', label: 'Filter' },
          ]}
          //@ts-ignore FIXME
          value={gwasCatalogOption}
          onChange={setGwasCatalogOption}
        />
      </label>
    </div>
  )
}

const ShowCaseControlTracks: React.FC = () => {
  const [showCaseControlTracks, setShowCaseControlTracks] =
    useRecoilState(showCaseControlTracksAtom)
  return (
    <div className='show-case-control-tracks'>
      <label>
        <span>Show case/control tracks</span>
        <Checkbox
          label=''
          checked={showCaseControlTracks}
          disabled={false}
          id='show-case-control-tracks'
          onChange={(_: boolean) => {
            setShowCaseControlTracks(!showCaseControlTracks)
          }}
        />
      </label>
    </div>
  )
}

const ColorByControls: React.FC = () => {
  const [multiAnalysisColorBy, setMultiAnalysisColorBy] = useRecoilState(multiAnalysisColorByAtom)
  return (
    <div className='multi-analysis-color-by'>
      <span>
        <strong>Color by</strong>
      </span>
      <SegmentedControl
        id='multi-analysis-color-by'
        options={[
          { value: 'consequence', label: 'CSQ' },
          { value: 'pvalue', label: 'P' },
          { value: 'beta', label: 'Beta' },
          { value: 'analysis', label: 'Trait' },
          { value: 'homozygote', label: 'Hom' },
        ]}
        value={multiAnalysisColorBy}
        onChange={setMultiAnalysisColorBy}
      />
    </div>
  )
}

const VariantSearchInput: React.FC = () => {
  const [searchText, setVariantSearchText] = useRecoilState(variantSearchTextAtom)
  const searchInput = useRef(null)
  return (
    <div className='multi-analysis-variant-search'>
      <SearchInput
        ref={searchInput}
        placeholder='Search variant table'
        value={searchText}
        onChange={(searchText: string) => {
          setVariantSearchText(searchText)
        }}
      />
      <KeyboardShortcut
        keys='/'
        handler={(e: any) => {
          e.preventDefault()
          if (searchInput.current) {
            // @ts-ignore FIXME
            searchInput.current.focus()
          }
        }}
      />
    </div>
  )
}
const PvalueLegend: React.FC = () => {
  const pValFilter = useRecoilValue(autoPvalFilter)
  return (
    <div className='pvalue-legend'>
      <span>
        <strong>Variant P-value coloring</strong>
      </span>
      <br />
      <span>
        <ColorMarker color='white' />
        1.0 &gt;{' '}
        <RoundedNumber
          num={variantYellowThreshold}
          highlightColor={yellowThresholdColor}
        /> &gt; <RoundedNumber num={variantGreenThreshold} highlightColor={greenThresholdColor} />
      </span>
      <br />
      {pValFilter && (
        <span className='auto-pvalue-filter-warning'>
          <TooltipAnchor
            tooltip={`Variants filtered to P-value < ${pValFilter} due to multiple analyses selected. Select fewer analyses to see all P-values`}
          >
            <TooltipHint>
              <Warning height={8} width={8} /> Filter &lt; {pValFilter} applied
            </TooltipHint>
          </TooltipAnchor>
        </span>
      )}
    </div>
  )
}

const AlleleFrequencySlider: React.FC = () => {
  const [alleleFrequencyFilter, setAlleleFrequencyFilter] =
    useRecoilState(alleleFrequencyFilterAtom)
  return (
    <div className='allele-frequency-slider'>
      <label>
        <span>
          <strong>Allele frequency (NFE)</strong>
        </span>
        <div className='display-values'>
          <span className='value'>{RoundedNumber({ num: alleleFrequencyFilter[0] })}</span>
          <span className='value'>{RoundedNumber({ num: alleleFrequencyFilter[1] })}</span>
        </div>
        <RangeSlider
          initialValues={alleleFrequencyFilter}
          presetInterval={[1e-7, 1]}
          onIntervalChange={setAlleleFrequencyFilter}
          step={1e-6}
          updateInterval={1000}
          showInputs={false}
          width={100}
          useLogScale
        />
      </label>
    </div>
  )
}

const AlleleFrequencyLegend: React.FC = () => {
  const regionId = useRecoilValue(regionIdAtom)
  const isRegion = regionId !== null && regionId !== undefined
  const alleleFrequencyScale = getAlleleFrequencyScale(isRegion)

  const margin = { left: 5, right: 5 }
  const width = 170

  const height = 30
  const labels = [0.00001, 0.0001, 0.001, 0.01, 0.1]
  const numTicks = labels.length

  return (
    <svg id='allele-frequency-legend' width={width} height={height}>
      {labels.map((tick, i) => {
        const x = margin.left + (i / numTicks) * width
        return (
          <g key={`af-circle-group-${i}`}>
            <text x={x - 5} y={height * 0.33} fontSize='8px' color='lightgrey'>
              {tick.toExponential(1)}
            </text>
            <circle
              key={`af-circle-${i}`}
              cx={x + 5}
              cy={height * 0.66}
              r={alleleFrequencyScale(tick)}
              fill='grey'
              stroke='black'
              strokeWidth={1}
            />
          </g>
        )
      })}
    </svg>
  )
}

const TransparencySlider: React.FC = () => {
  const [multiAnalysisTransparency, setMultiAnalysisTransparency] = useRecoilState(
    multiAnalysisTransparencyAtom
  )
  return (
    <div className='transparency-slider'>
      <label>
        <span>
          <strong>Transparency</strong>
        </span>
        <RangeSlider
          presetInterval={[0, 1]}
          initialValues={multiAnalysisTransparency}
          onIntervalChange={setMultiAnalysisTransparency}
          step={0.01}
          updateInterval={1000}
          showInputs={false}
          hideLowerBound
          width={100}
        />
      </label>
    </div>
  )
}

const TableFormatControls: React.FC = () => {
  const [tableFormat, setTableFormat] = useRecoilState(multiAnalysisVariantTableFormatAtom)
  return (
    <div className='table-format'>
      <span>
        <strong>Table format</strong>
      </span>
      <SegmentedControl
        id='multi-analysis-table-format'
        options={[
          { value: 'long', label: 'Long' },
          { value: 'wide', label: 'Wide' },
        ]}
        value={tableFormat}
        onChange={setTableFormat}
      />
    </div>
  )
}

const FieldGroupControls: React.FC = () => {
  const [variantColumnGroup, setVariantFieldGroup] = useRecoilState(variantFieldGroupState)
  const setSelectedColumns = useSelectedVariantFieldsPreset()
  return (
    <div className='field-group-controls'>
      <span>
        <strong>Column presets</strong>
      </span>
      <SegmentedControl
        id='field-group-controls1'
        options={[
          { value: 'counts', label: 'Counts' },
          { value: 'freq', label: 'Freq' },
          { value: 'pop', label: 'Pop' },
        ]}
        value={variantColumnGroup}
        onChange={(value: any) => {
          setSelectedColumns(value)
          setVariantFieldGroup(value)
        }}
      />
      <SegmentedControl
        id='field-group-controls2'
        options={[
          { value: 'categorical_default', label: 'Categorical' },
          { value: 'continuous_default', label: 'Continuous' },
        ]}
        //@ts-ignore FIXME
        value={variantColumnGroup}
        onChange={(value: any) => {
          setSelectedColumns(value)
          setVariantFieldGroup(value)
        }}
      />
      <SegmentedControl
        id='field-group-controls2'
        options={[
          { value: 'stat', label: 'Stat' },
          { value: 'all', label: 'All' },
          { value: 'none', label: 'None' },
        ]}
        //@ts-ignore FIXME
        value={variantColumnGroup}
        onChange={(value: any) => {
          setSelectedColumns(value)
          setVariantFieldGroup(value)
        }}
      />
    </div>
  )
}

const IndividualFieldCheckboxes: React.FC = () => {
  const selectedVariantFields = useRecoilValue(selectedVariantFieldsAtom)
  const ancestryGroup = useRecoilValue(ancestryGroupAtom)
  const toggleField = useToggleSelectedVariantField()
  const columns = getVariantColumns({ columns: selectedVariantFieldsOptions, ancestryGroup })
  return (
    <div className='individual-field-checkboxes'>
      <span>
        <strong>Columns</strong>
      </span>
      {columns.map((opt) => (
        <div key={opt.key} className='individual-checkbox'>
          <Checkbox
            label=''
            id={`multi-analysis-compare-fields-${opt.key}`}
            checked={selectedVariantFields.includes(opt.key as VariantFieldType)}
            disabled={false}
            onChange={() => toggleField(opt.key as VariantFieldType)}
          />
          <TooltipAnchor
            // @ts-expect-error ts-migrate(2322) FIXME
            tooltip={opt.tooltip}
          >
            <span>{opt.heading}</span>
          </TooltipAnchor>
        </div>
      ))}
    </div>
  )
}

const UnselectVariant: React.FC = () => {
  const setVariantSearchText = useSetRecoilState(variantSearchTextAtom)
  const setVariantId = useSetRecoilState(variantIdAtom)

  return (
    <Button
      onClick={() => {
        setVariantSearchText('')
        setVariantId(null)
      }}
      backgroundColor={'lightblue'}
    >
      Unselect variant
    </Button>
  )
}

export const GenePageControls = () => {
  const variantId = useRecoilValue(variantIdAtom)

  const tableFormat = useRecoilValue(multiAnalysisVariantTableFormatAtom)

  const GenePageControlsItems: React.FC = () => {
    return (
      <>
        <InBurdenAnalysisControls />
        {/* <GwasCatalogOptions /> */}
        {/* <ShowCaseControlTracks /> */}
        <ColorByControls />
        <VariantSearchInput />
        <PvalueLegend />
        {/* <TransparencySlider /> */}
        {/* <AlleleFrequencySlider /> */}
        <AlleleFrequencyLegend />
        {/* <TableFormatControls /> */}
        <FieldGroupControls />
        <IndividualFieldCheckboxes />
        {/* <DataStats /> */}
      </>
    )
  }

  const VariantPageControls: React.FC = () => {
    return (
      <>
        <UnselectVariant />
        <InBurdenAnalysisControls />
        {/* <ShowCaseControlTracks /> */}
        <ColorByControls />
        {/* <TransparencySlider /> */}
        {/* <TableFormatControls /> */}
        {tableFormat === 'long' && (
          <>
            <FieldGroupControls />
            <IndividualFieldCheckboxes />
          </>
        )}
      </>
    )
  }

  if (variantId) {
    return (
      <GenePageControlStylesVariantFocus>
        <VariantPageControls />
      </GenePageControlStylesVariantFocus>
    )
  }

  return (
    <GenePageControlsGeneFocus>
      <GenePageControlsItems />
    </GenePageControlsGeneFocus>
  )
}
