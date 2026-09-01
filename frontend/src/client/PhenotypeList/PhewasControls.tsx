import { Button, Checkbox, SearchInput, SegmentedControl } from '@gnomad/ui'
import React from 'react'
import { useRecoilValue } from 'recoil'
import styled from 'styled-components'
import {
  ColorMarker,
  ControlsHeader,
  ControlsHeaderTitle,
  ControlsCloseButton,
  ControlsSection,
  ControlsSectionTitle,
} from '../UserInterface'
import { mafSignificanceAtom, MafOption, AnnotationCategory, burdenTestSignificanceAtom, BurdenTestType } from '../sharedState'
import { consequenceCategoryColors } from '../GenePage/LocusPagePlots'
import { optionPanelContract } from '../browserUiContracts'
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

const ControlsContainer = styled.div<{ $isMobile: boolean }>`
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

  ${({ $isMobile, theme }) =>
    $isMobile &&
    `
      position: fixed;
      inset: 0 auto 0 0;
      z-index: 1000;
      box-sizing: border-box;
      width: min(360px, calc(100vw - 32px));
      min-width: 0;
      max-width: none;
      height: 100dvh;
      overflow-y: auto;
      overscroll-behavior: contain;
      padding: 0 16px 24px;
      border-right: 1px solid ${theme.border};
      box-shadow: 4px 0 16px rgba(0, 0, 0, 0.25);
    `}
`

// MAF Selector with significance dots
const MafSelectorWrapper = styled.div`
  margin-top: 8px;
`

const MafOptionWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`

const MafSignificanceDots = styled.div`
  display: flex;
  gap: 2px;
  margin-bottom: 6px;
  height: 10px;
  align-items: center;
  justify-content: center;
`

const SignificanceDot = styled.span<{ $color: string }>`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: ${(props) => props.$color};
  border: 1px solid rgba(0, 0, 0, 0.3);
`

const EmptyDot = styled.span`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: transparent;
  border: 1px solid rgba(0, 0, 0, 0.3);
`

const MafButton = styled.button<{ $active: boolean }>`
  padding: 6px 12px;
  border: none;
  background: ${({ $active }) => ($active ? '#262262' : 'var(--theme-surface-alt, #f5f5f5)')};
  color: ${({ $active }) => ($active ? 'white' : 'var(--theme-text, #333)')};
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
  border-right: 1px solid var(--theme-border, #ccc);

  &:last-child {
    border-right: none;
  }

  &:hover {
    background: ${({ $active }) => ($active ? '#262262' : 'var(--theme-border, #e0e0e0)')};
  }
`

const annotationColors: Record<AnnotationCategory, string> = {
  pLoF: consequenceCategoryColors.pLoF,
  missense: consequenceCategoryColors.missense,
  synonymous: consequenceCategoryColors.synonymous,
}

const annotationLabels: Record<AnnotationCategory, string> = {
  pLoF: 'pLoF',
  missense: 'Missense',
  synonymous: 'Synonymous',
}

// Burden Set Selector with significance dot per option
interface BurdenSetSelectorProps {
  burdenSet: string
  setBurdenSet: (value: string) => void
  showDots?: boolean
}

const BurdenSetSelector: React.FC<BurdenSetSelectorProps> = ({ burdenSet, setBurdenSet, showDots = true }) => {
  const mafSignificance = useRecoilValue(mafSignificanceAtom)

  // Check if any MAF has a hit for this annotation category
  const hasAnyHit = (category: AnnotationCategory): boolean => {
    const mafOptions: MafOption[] = [0.01, 0.001, 0.0001]
    return mafOptions.some((maf) => mafSignificance[maf][category] === 'hit')
  }

  const burdenSetOptions: { value: string; label: string; category: AnnotationCategory }[] = [
    { value: 'pLoF', label: 'pLoF', category: 'pLoF' },
    { value: 'missenseLC', label: 'Missense', category: 'missense' },
    { value: 'synonymous', label: 'Syn', category: 'synonymous' },
  ]

  return (
    <div style={{ display: 'flex', gap: 0 }}>
      {burdenSetOptions.map((opt) => {
        const hasHit = hasAnyHit(opt.category)
        return (
          <MafOptionWrapper key={opt.value}>
            {showDots && (
              <MafSignificanceDots>
                {hasHit ? (
                  <SignificanceDot $color={greenThresholdColor} title={`${opt.label}: has significant hit`} />
                ) : (
                  <EmptyDot title={`${opt.label}: no significant hits`} />
                )}
              </MafSignificanceDots>
            )}
            <MafButton
              $active={burdenSet === opt.value}
              onClick={() => setBurdenSet(opt.value)}
            >
              {opt.label}
            </MafButton>
          </MafOptionWrapper>
        )
      })}
    </div>
  )
}

// Burden Test Selector with significance dots (3 dots per test type: pLoF, missense, synonymous)
interface BurdenTestSelectorProps {
  pValueType: string
  setPValueType: (value: any) => void
  showDots?: boolean
}

const BurdenTestSelector: React.FC<BurdenTestSelectorProps> = ({ pValueType, setPValueType, showDots = true }) => {
  const burdenTestSignificance = useRecoilValue(burdenTestSignificanceAtom)

  const testOptions: { value: string; label: string; testKey: BurdenTestType }[] = [
    { value: P_VALUE_BURDEN, label: 'Burden', testKey: 'burden' },
    { value: P_VALUE_SKAT, label: 'SKAT', testKey: 'skat' },
    { value: P_VALUE_SKAT_O, label: 'SKAT-O', testKey: 'skato' },
  ]

  const annotationOrder: AnnotationCategory[] = ['pLoF', 'missense', 'synonymous']

  return (
    <div>
      <div style={{ display: 'flex', gap: 0, marginTop: 8 }}>
        {testOptions.map((opt) => {
          const sigForTest = burdenTestSignificance[opt.testKey]
          return (
            <MafOptionWrapper key={opt.value}>
              {showDots && (
                <MafSignificanceDots>
                  {annotationOrder.map((annot) => {
                    const hasHit = sigForTest[annot] !== 'none'
                    const tooltip = `${annotationLabels[annot]}: ${hasHit ? 'significant' : 'not significant'}`
                    return hasHit ? (
                      <SignificanceDot key={annot} $color={annotationColors[annot]} title={tooltip} />
                    ) : (
                      <EmptyDot key={annot} title={tooltip} />
                    )
                  })}
                </MafSignificanceDots>
              )}
              <MafButton
                $active={pValueType === opt.value}
                onClick={() => setPValueType(opt.value)}
              >
                {opt.label}
              </MafButton>
            </MafOptionWrapper>
          )
        })}
      </div>
    </div>
  )
}

interface MafSelectorProps {
  selectedMaf: number
  setSelectedMaf: (value: number) => void
  showDots?: boolean
}

const MafSelector: React.FC<MafSelectorProps> = ({ selectedMaf, setSelectedMaf, showDots = true }) => {
  const mafSignificance = useRecoilValue(mafSignificanceAtom)

  const mafOptions: { value: MafOption; label: string }[] = [
    { value: 0.01, label: '1%' },
    { value: 0.001, label: '0.1%' },
    { value: 0.0001, label: '0.01%' },
  ]

  const annotationOrder: AnnotationCategory[] = ['pLoF', 'missense', 'synonymous']

  return (
    <MafSelectorWrapper>
      <ControlsSectionTitle>Max MAF</ControlsSectionTitle>
      <div style={{ display: 'flex', gap: 0, marginTop: 8 }}>
        {mafOptions.map((opt) => {
          const sigForMaf = mafSignificance[opt.value]
          return (
            <MafOptionWrapper key={opt.value}>
              {showDots && (
                <MafSignificanceDots>
                  {annotationOrder.map((annot) => {
                    const hasHit = sigForMaf[annot] !== 'none'
                    const tooltip = `${annotationLabels[annot]}: ${hasHit ? 'significant' : 'not significant'}`
                    return hasHit ? (
                      <SignificanceDot key={annot} $color={annotationColors[annot]} title={tooltip} />
                    ) : (
                      <EmptyDot key={annot} title={tooltip} />
                    )
                  })}
                </MafSignificanceDots>
              )}
              <MafButton
                $active={selectedMaf === opt.value}
                onClick={() => setSelectedMaf(opt.value)}
              >
                {opt.label}
              </MafButton>
            </MafOptionWrapper>
          )
        })}
      </div>
    </MafSelectorWrapper>
  )
}

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
  background: ${(props) => props.theme.surface};
  border-bottom: 1px solid ${(props) => props.theme.border};

  &:hover {
    background: ${(props) => props.theme.surfaceAlt};
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
  isMobile?: boolean

  // Burden set (gene phewas only)
  isGenePhewas: boolean
  showEffectEstimate: boolean
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
  useDirectionalShapes: boolean
  onToggleDirectionalShapes: () => void

  // Persistent phenotype comparison
  analysesCount: number
  topAnalyses: string[]
  onSelectTop: () => void
  onClearSelected: () => void
  showComparedOnly: boolean
  onToggleShowComparedOnly: () => void
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
  isMobile = false,
  isGenePhewas,
  showEffectEstimate,
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
  useDirectionalShapes,
  onToggleDirectionalShapes,
  analysesCount,
  topAnalyses,
  onSelectTop,
  onClearSelected,
  showComparedOnly,
  onToggleShowComparedOnly,
  phewasType,
  categories,
  selectedCategories,
  onToggleCategory,
  onSelectAllCategories,
  onSelectNoCategories,
}) => {
  const plotTypeOptions = showEffectEstimate
    ? [{ value: 'P-value' }, { value: 'Beta' }, { value: 'Both' }]
    : [{ value: 'P-value' }]
  const controlsRef = React.useRef<HTMLDivElement>(null)

  const handlePanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isMobile) return
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab') return

    const focusable = controlsRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    )
    if (!focusable || focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <ControlsContainer
      ref={controlsRef}
      id={optionPanelContract.phewas.id}
      $isMobile={isMobile}
      role={isMobile ? 'dialog' : 'region'}
      aria-modal={isMobile || undefined}
      aria-labelledby={`${optionPanelContract.phewas.id}-title`}
      tabIndex={-1}
      onKeyDown={handlePanelKeyDown}
    >
      <ControlsHeader>
        <ControlsHeaderTitle id={`${optionPanelContract.phewas.id}-title`}>
          {optionPanelContract.phewas.label}
        </ControlsHeaderTitle>
        <ControlsCloseButton
          type="button"
          autoFocus={isMobile}
          onClick={onClose}
          title={`Hide ${optionPanelContract.phewas.label}`}
          aria-label={`Hide ${optionPanelContract.phewas.label}`}
          aria-expanded={true}
          aria-controls={optionPanelContract.phewas.id}
        >
          <span aria-hidden="true">{isMobile ? '×' : '‹'}</span>
        </ControlsCloseButton>
      </ControlsHeader>

      {/* Search */}
      <ControlsSection>
        <SearchInput
          placeholder='Search phenotypes'
          onChange={onSearchChange}
        />
      </ControlsSection>

      {/* Burden Set & MAF (gene phewas only) */}
      {isGenePhewas && (
        <ControlsSection>
          <ControlsSectionTitle>Burden set</ControlsSectionTitle>
          <BurdenSetSelector burdenSet={burdenSet} setBurdenSet={setBurdenSet} showDots={phewasType !== 'topHit'} />
          <MafSelector selectedMaf={selectedMaf} setSelectedMaf={setSelectedMaf} showDots={phewasType !== 'topHit'} />
        </ControlsSection>
      )}

      {/* Burden Test Type */}
      {isGenePhewas && (
        <ControlsSection>
          <ControlsSectionTitle>Burden test</ControlsSectionTitle>
          <BurdenTestSelector pValueType={pValueType} setPValueType={setPValueType} showDots={phewasType !== 'topHit'} />
        </ControlsSection>
      )}

      {/* P-value Legend */}
      <ControlsSection>
        <ControlsSectionTitle>{isGenePhewas ? 'Gene' : 'Variant'} P-value coloring</ControlsSectionTitle>
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
      </ControlsSection>

      {/* Plot Options */}
      <ControlsSection>
        <ControlsSectionTitle>Plot options</ControlsSectionTitle>
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
          {showEffectEstimate && (
            <label>
              <input
                type='checkbox'
                checked={useDirectionalShapes}
                onChange={onToggleDirectionalShapes}
              />
              Directional (▲ risk, ▼ protective)
            </label>
          )}
        </PlotOptionCheckboxes>
      </ControlsSection>

      {/* Persistent phenotype comparison */}
      {phewasType !== 'topHit' && (
        <ControlsSection>
          <ControlsSectionTitle>Compared phenotypes</ControlsSectionTitle>
          <SelectionButtons>
            <Button onClick={onSelectTop}>Add top hits</Button>
            <Button disabled={analysesCount === 0} onClick={onClearSelected}>
              Clear comparison
            </Button>
          </SelectionButtons>
          <Checkbox
            label='Show compared only'
            checked={showComparedOnly}
            id='show-compared-phenotypes-only'
            disabled={analysesCount === 0}
            onChange={onToggleShowComparedOnly}
          />
        </ControlsSection>
      )}

      {/* Categories */}
      <ControlsSection>
        <ControlsSectionTitle>Categories</ControlsSectionTitle>
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
      </ControlsSection>
    </ControlsContainer>
  )
}

export default PhewasControls
