import { Button, Checkbox, SearchInput, SegmentedControl } from '@gnomad/ui'
import React from 'react'
import styled from 'styled-components'
import AnalysisControls from '../AnalysisControls'
import { ColorMarker } from '../UserInterface'
import {
  P_VALUE_BURDEN,
  P_VALUE_SKAT,
  P_VALUE_SKAT_O,
  greenThresholdColor,
  yellowThresholdColor,
  geneGreenThreshold,
  geneYellowThreshold,
  RoundedNumber,
  variantYellowThreshold,
  variantGreenThreshold,
} from './Utils'

const ControlsContainer = styled.div`
  max-width: 260px;
  min-width: 260px;
  padding: 16px;
  padding-top: 0;
  padding-bottom: 20px;
  border-right: 1px solid ${(props) => props.theme.border};
  background: ${(props) => props.theme.background};

  display: flex;
  flex-direction: column;
  gap: 20px;
`

const ControlsHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid ${(props) => props.theme.border};
  margin-bottom: 4px;
`

const HeaderTitle = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: var(--theme-text, #333);
`

const CloseButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  font-size: 18px;
  color: var(--theme-text-muted, #666);
  line-height: 1;
  border-radius: 4px;

  &:hover {
    background: var(--theme-border, #e0e0e0);
    color: var(--theme-text, #333);
  }
`

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const SectionTitle = styled.strong`
  font-size: 13px;
  color: var(--theme-text, #333);
  margin-bottom: 4px;
`

const PlotOptionCheckboxes = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 4px;

  label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    cursor: pointer;
  }

  input[type='checkbox'] {
    margin: 0;
  }
`

const PValueLegend = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
`

const SelectionButtons = styled.div`
  display: flex;
  flex-direction: row;
  gap: 8px;
  flex-wrap: wrap;

  button {
    font-size: 12px;
    padding: 4px 8px;
  }
`

const CategoryList = styled.div`
  max-height: 280px;
  overflow-y: auto;
  border: 1px solid ${(props) => props.theme.border};
  border-radius: 4px;
  background: ${(props) => props.theme.surface};
`

const CategoryHeader = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 6px 8px;
  background: ${(props) => props.theme.surfaceAlt};
  border-bottom: 1px solid ${(props) => props.theme.border};
  font-size: 12px;

  button {
    background: none;
    border: none;
    color: var(--theme-primary, #262262);
    cursor: pointer;
    padding: 0;
    font-size: 12px;

    &:hover {
      text-decoration: underline;
    }
  }
`

const CategoryItem = styled.label<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  font-size: 13px;
  cursor: pointer;
  background: ${(props) => (props.$selected ? 'rgba(25, 118, 210, 0.15)' : props.theme.surface)};
  border-bottom: 1px solid ${(props) => props.theme.border};

  &:hover {
    background: ${(props) => (props.$selected ? 'rgba(25, 118, 210, 0.25)' : props.theme.surfaceAlt)};
  }

  &:last-child {
    border-bottom: none;
  }

  input[type='checkbox'] {
    margin: 0;
  }
`

const CategoryName = styled.span`
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const CategoryCount = styled.span`
  color: var(--theme-text-muted, #666);
  font-size: 11px;
`

const MafSelect = styled.select`
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid ${(props) => props.theme.border};
  background: ${(props) => props.theme.surface};
  color: ${(props) => props.theme.text};
  font-size: 13px;
  width: 100%;
`

interface Category {
  category: string
  color: string
  analysisCount: number
}

interface PhewasControlsProps {
  // Search
  onSearchChange: (text: string) => void

  // Close handler
  onClose: () => void

  // Burden set (gene phewas only)
  isGenePhewas: boolean
  burdenSet: string
  setBurdenSet: (value: any) => void

  // MAF filter
  selectedMaf: number
  setSelectedMaf: (value: number) => void

  // P-value type (burden test)
  pValueType: string
  setPValueType: (value: any) => void

  // Plot options
  plotType: string
  setPlotType: (value: string) => void
  plotSortKey: string
  onTogglePvalueOrder: () => void

  // Multi-phenotype selection
  analysesCount: number
  topAnalyses: string[]
  onSelectTop: () => void
  onClearSelected: () => void
  showSelectAnalysesOnly: boolean
  onToggleShowSelectOnly: () => void
  phewasType: string

  // Categories
  categories: Category[]
  selectedCategories: Set<string>
  onToggleCategory: (category: string) => void
  onSelectAllCategories: () => void
  onSelectNoCategories: () => void
}

const PhewasControls: React.FC<PhewasControlsProps> = ({
  onSearchChange,
  onClose,
  isGenePhewas,
  burdenSet,
  setBurdenSet,
  selectedMaf,
  setSelectedMaf,
  pValueType,
  setPValueType,
  plotType,
  setPlotType,
  plotSortKey,
  onTogglePvalueOrder,
  analysesCount,
  topAnalyses,
  onSelectTop,
  onClearSelected,
  showSelectAnalysesOnly,
  onToggleShowSelectOnly,
  phewasType,
  categories,
  selectedCategories,
  onToggleCategory,
  onSelectAllCategories,
  onSelectNoCategories,
}) => {
  const plotTypeOptions = [{ value: 'P-value' }, { value: 'Beta' }, { value: 'Both' }]

  return (
    <ControlsContainer>
      <ControlsHeader>
        <HeaderTitle>Controls</HeaderTitle>
        <CloseButton onClick={onClose} title="Hide controls">
          &times;
        </CloseButton>
      </ControlsHeader>

      {/* Search */}
      <Section>
        <SearchInput
          placeholder='Search phenotypes'
          onChange={onSearchChange}
        />
      </Section>

      {/* Burden Set & MAF (gene phewas only) */}
      {isGenePhewas && (
        <Section>
          <SectionTitle>Burden set</SectionTitle>
          <AnalysisControls burdenSet={burdenSet} setBurdenSet={setBurdenSet} />
          <div style={{ marginTop: '8px' }}>
            <SectionTitle>Max MAF</SectionTitle>
            <MafSelect
              value={selectedMaf}
              onChange={(e) => setSelectedMaf(Number(e.target.value))}
            >
              <option value={0.01}>1%</option>
              <option value={0.001}>0.1%</option>
              <option value={0.0001}>0.01%</option>
            </MafSelect>
          </div>
        </Section>
      )}

      {/* Burden Test Type */}
      {isGenePhewas && (
        <Section>
          <SectionTitle>Burden test</SectionTitle>
          <SegmentedControl
            id='pvalue-type-control'
            options={[
              { value: P_VALUE_BURDEN, label: 'Burden' },
              { value: P_VALUE_SKAT, label: 'SKAT' },
              { value: P_VALUE_SKAT_O, label: 'SKAT-O' },
            ]}
            value={pValueType}
            onChange={setPValueType}
          />
        </Section>
      )}

      {/* P-value Legend */}
      <Section>
        <SectionTitle>{isGenePhewas ? 'Gene' : 'Variant'} P-value coloring</SectionTitle>
        <PValueLegend>
          <span>
            <ColorMarker color='white' />
            1.0 &gt;{' '}
            <RoundedNumber
              num={isGenePhewas ? geneYellowThreshold : variantYellowThreshold}
              highlightColor={yellowThresholdColor}
            />{' '}
            &gt;{' '}
            <RoundedNumber
              num={isGenePhewas ? geneGreenThreshold : variantGreenThreshold}
              highlightColor={greenThresholdColor}
            />
          </span>
        </PValueLegend>
      </Section>

      {/* Plot Options */}
      <Section>
        <SectionTitle>Plot options</SectionTitle>
        <SegmentedControl
          id='plot-type'
          options={plotTypeOptions}
          value={plotType}
          onChange={setPlotType}
        />
        <PlotOptionCheckboxes>
          <label>
            <input
              type='checkbox'
              checked={plotSortKey === 'pvalue'}
              onChange={onTogglePvalueOrder}
            />
            P-value ordered
          </label>
        </PlotOptionCheckboxes>
      </Section>

      {/* Multi-phenotype Selection */}
      {phewasType !== 'topHit' && (
        <Section>
          <SectionTitle>Multi-phenotype selection</SectionTitle>
          <SelectionButtons>
            <Button onClick={onSelectTop}>Select top</Button>
            <Button disabled={analysesCount <= 1} onClick={onClearSelected}>
              Clear {analysesCount > 1 && `(${analysesCount})`}
            </Button>
          </SelectionButtons>
          <Checkbox
            label='Filter to selected'
            checked={showSelectAnalysesOnly}
            id='multi-analysis-filter-traits-to-selected'
            disabled={false}
            onChange={onToggleShowSelectOnly}
          />
        </Section>
      )}

      {/* Categories */}
      <Section>
        <SectionTitle>Categories</SectionTitle>
        <CategoryList>
          <CategoryHeader>
            <span>{selectedCategories.size} of {categories.length} selected</span>
            <div>
              <button type='button' onClick={onSelectAllCategories}>All</button>
              {' / '}
              <button type='button' onClick={onSelectNoCategories}>None</button>
            </div>
          </CategoryHeader>
          {categories.map((cat) => (
            <CategoryItem
              key={cat.category}
              $selected={selectedCategories.has(cat.category)}
            >
              <input
                type='checkbox'
                checked={selectedCategories.has(cat.category)}
                onChange={() => onToggleCategory(cat.category)}
              />
              <ColorMarker color={cat.color} />
              <CategoryName title={cat.category}>{cat.category}</CategoryName>
              <CategoryCount>({cat.analysisCount})</CategoryCount>
            </CategoryItem>
          ))}
        </CategoryList>
      </Section>
    </ControlsContainer>
  )
}

export default PhewasControls
