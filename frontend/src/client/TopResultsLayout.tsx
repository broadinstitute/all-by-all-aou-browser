import React from 'react'
import styled from 'styled-components'
import { useRecoilState } from 'recoil'
import { HalfPage } from './UserInterface'
import { topResultsTabAtom, TopResultsTab } from './sharedState'

import TopHitPhewas from './PhenotypeList/TopHitPhewas'
import TopVariantsPhewas from './VariantResults/TopVariantsPhewas'

const PageContainer = styled(HalfPage)`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  position: relative;
`

const TabContainer = styled.div`
  display: flex;
  flex-direction: row;
  width: 100%;
  border-bottom: 2px solid var(--theme-border, #e0e0e0);
  margin-bottom: 20px;
`

const Tab = styled.button<{ $active: boolean }>`
  padding: 12px 24px;
  font-size: 14px;
  font-family: GothamBook, sans-serif;
  background-color: ${({ $active }) => ($active ? '#262262' : 'transparent')};
  color: ${({ $active }) => ($active ? 'white' : 'var(--theme-text, #262262)')};
  border: none;
  border-bottom: ${({ $active }) =>
    $active ? '3px solid #262262' : '3px solid transparent'};
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: ${({ $active }) => ($active ? 'bold' : 'normal')};

  &:hover {
    background: ${({ $active }) =>
      $active ? '#262262' : 'var(--theme-surface-alt, #f0f0f0)'};
  }
`

const ContentSection = styled.div`
  width: 100%;
`

const TABS: { key: TopResultsTab; label: string }[] = [
  { key: 'gene-burden', label: 'Top Gene Burden' },
  { key: 'single-variants', label: 'Top Single Variants' },
]

export const TopResultsLayout = ({ size }: any) => {
  const [activeTab, setActiveTab] = useRecoilState(topResultsTabAtom)

  return (
    <PageContainer>
      <TabContainer>
        {TABS.map((tab) => (
          <Tab
            key={tab.key}
            $active={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </Tab>
        ))}
      </TabContainer>
      <ContentSection>
        {activeTab === 'gene-burden' && <TopHitPhewas />}
        {activeTab === 'single-variants' && <TopVariantsPhewas />}
      </ContentSection>
    </PageContainer>
  )
}

export default TopResultsLayout
