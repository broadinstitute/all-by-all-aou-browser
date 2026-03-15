import React from 'react'
import styled from 'styled-components'
import { ColorMarker } from '../UserInterface'

export interface CategoryFilterItem {
  category: string
  color: string
  count: number
}

interface CategoryFilterProps {
  categories: CategoryFilterItem[]
  selectedCategories: Set<string>
  onToggleCategory: (category: string) => void
  onSelectAll: () => void
  onSelectNone: () => void
}

const CategoryList = styled.div`
  overflow-y: auto;
  background: var(--theme-surface, #fff);
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
`

const CategoryHeader = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 6px 8px;
  background: var(--theme-surface-alt, #f5f5f5);
  border-bottom: 1px solid var(--theme-border, #ddd);
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
  background: var(--theme-surface, #fff);
  border-bottom: 1px solid var(--theme-border, #ddd);

  &:hover {
    background: var(--theme-surface-alt, #f5f5f5);
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

const CategoryFilter: React.FC<CategoryFilterProps> = ({
  categories,
  selectedCategories,
  onToggleCategory,
  onSelectAll,
  onSelectNone,
}) => {
  return (
    <CategoryList>
      <CategoryHeader>
        <span>{selectedCategories.size} of {categories.length} selected</span>
        <div>
          <button type="button" onClick={onSelectAll}>All</button>
          {' / '}
          <button type="button" onClick={onSelectNone}>None</button>
        </div>
      </CategoryHeader>
      {categories.map((cat) => (
        <CategoryItem
          key={cat.category}
          $selected={selectedCategories.has(cat.category)}
        >
          <input
            type="checkbox"
            checked={selectedCategories.has(cat.category)}
            onChange={() => onToggleCategory(cat.category)}
          />
          <ColorMarker color={cat.color} />
          <CategoryName title={cat.category}>{cat.category}</CategoryName>
          <CategoryCount>({cat.count})</CategoryCount>
        </CategoryItem>
      ))}
    </CategoryList>
  )
}

export default CategoryFilter
