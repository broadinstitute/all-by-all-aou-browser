import { useRef } from 'react'
import styled from 'styled-components'

import { CategoryFilterControl, KeyboardShortcut, SearchInput } from '@gnomad/ui'
import { ChromosomeSelector } from '../Shared/ChromosomeSelector'

const consequenceCategories = [
  {
    id: 'lof',
    label: 'LoF',
    color: '#FF583F',
  },
  {
    id: 'missense',
    label: 'Missense',
    color: '#F0C94D',
  },
  {
    id: 'synonymous',
    label: 'Synonymous',
    color: 'green',
  },
  {
    id: 'other',
    label: 'Other',
    color: '#757575',
  },
]

const SettingsWrapper = styled.div`
  display: flex;
  flex-direction: column;
  flex-flow: row wrap;
  justify-content: space-around;
  align-items: center;
  width: 100%;
  margin-bottom: 1em;
  margin-top: 10px;

  * {
    font-size: 12px;
  }

  #variant-filter {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
  }

  #variant-manhattan-search-and-filter {
    margin-top: 10px;
    :nth-child(1) {
      margin-right: 5px;
    }
    :nth-:nth-child(2) {
      label {
        margin-right: 5px;
      }
    }
  }

  @media (max-width: 1300px) and (min-width: 1101px) {
    > div {
      &:nth-child(2) {
        order: 3;
        width: 50%;
        margin-top: 1em;
      }
    }
  }

  @media (max-width: 1100px) {
    flex-direction: column;
    align-items: center;

    > div {
      margin-bottom: 1.5em;
    }
  }
`

const keyboardShortcuts = {
  lof: 'l',
  missense: 'm',
  synonymous: 's',
  other: 'o',
}

type Props = {
  onChange: (...args: any[]) => any
  value: {
    includeCategories: {
      lof: boolean
      missense: boolean
      synonymous: boolean
      other: boolean
    }
    includeFilteredVariants: boolean
    includeSNVs: boolean
    includeIndels: boolean
    searchText: string
  }
}

const VariantFilterControls = ({ onChange, value }: Props) => {
  const searchInput = useRef(null)

  return (
    <SettingsWrapper>
      <CategoryFilterControl
        categories={consequenceCategories}
        categorySelections={value.includeCategories}
        id='variant-filter'
        onChange={(includeCategories: any) => {
          onChange({ ...value, includeCategories })
        }}
      />
      {Object.keys(keyboardShortcuts).map((category) => (
        <KeyboardShortcut
          key={category}
          handler={() => {
            onChange({
              ...value,
              includeCategories: {
                ...value.includeCategories,
                // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                [category]: !value.includeCategories[category],
              },
            })
          }}
          // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          keys={keyboardShortcuts[category]}
        />
      ))}
      <div id='variant-manhattan-search-and-filter'>
        <SearchInput
          ref={searchInput}
          placeholder='Search variant table'
          value={value.searchText}
          onChange={(searchText: any) => {
            onChange({ ...value, searchText })
          }}
        />
        <KeyboardShortcut
          keys='/'
          handler={(e: any) => {
            // preventDefault to avoid typing a "/" in the search input
            e.preventDefault()
            if (searchInput.current) {
              // @ts-expect-error ts-migrate(2531) FIXME: Object is possibly 'null'.
              searchInput.current.focus()
            }
          }}
        />

        <strong>Contig:</strong>
        <ChromosomeSelector />
      </div>
    </SettingsWrapper>
  )
}

export default VariantFilterControls
