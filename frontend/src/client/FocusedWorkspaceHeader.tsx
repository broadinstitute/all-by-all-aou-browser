import { useHistory } from 'react-router-dom'
import styled from 'styled-components'

import {
  APP_RETURN_ORIGIN_STATE_KEY,
  AppHistoryState,
  getFocusedReturnPolicy,
} from './focusedReturnPolicy'
import { canCompareSideBySide, getDetailsContextLabel } from './browserShell'
import { useAppNavigation } from './hooks/useAppNavigation'

const Header = styled.nav`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px 16px;
  flex: 0 0 auto;
  padding: 10px 18px;
  border-bottom: 1px solid var(--theme-border, #ddd);
  background: var(--theme-surface-alt, #f5f5f5);

  button {
    padding: 8px 14px;
    cursor: pointer;
    font-weight: 600;
  }

  .back-to-results {
    border-color: #262262;
    background: #262262;
    color: white;
  }

  .details-context {
    min-width: 0;
    overflow: hidden;
    color: var(--theme-text-muted, #555);
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .compare-surfaces {
    margin-left: auto;
  }

  button:focus-visible {
    outline: 3px solid var(--theme-primary, #4f46e5);
    outline-offset: 2px;
  }

  @media (max-width: 600px) {
    padding: 8px 12px;

    .details-context {
      order: 3;
      width: 100%;
    }
  }
`

type Props = {
  analysisId?: string | null
  geneId?: string | null
  regionId?: string | null
  variantId?: string | null
  width?: number
  allowCompare?: boolean
}

export const FocusedWorkspaceHeader = ({
  analysisId,
  geneId,
  regionId,
  variantId,
  width,
  allowCompare = true,
}: Props) => {
  const history = useHistory<AppHistoryState>()
  const { compareSideBySide, goToPhenotype, goToResults } = useAppNavigation()
  const origin = history.location.state?.[APP_RETURN_ORIGIN_STATE_KEY]
  const returnPolicy = getFocusedReturnPolicy({ origin, analysisId })
  const showCompare =
    allowCompare &&
    canCompareSideBySide({ width, analysisId, geneId, regionId, variantId })

  const handleReturn = () => {
    if (returnPolicy.action === 'history-back') {
      history.goBack()
    } else if (returnPolicy.action === 'phenotype-fallback') {
      goToPhenotype(returnPolicy.analysisId, {
        destination: 'overview',
        resultIndex: 'pheno-info',
        resultsOnly: true,
      })
    } else {
      goToResults()
    }
  }

  return (
    <Header aria-label="Details navigation" data-focused-workspace-header>
      <button
        type="button"
        className="back-to-results"
        onClick={handleReturn}
        title={returnPolicy.action === 'history-back'
          ? 'Return to the exact results page you came from'
          : 'Open the nearest available results page'}
      >
        ← {returnPolicy.label}
      </button>
      <div className="details-context" aria-live="polite">
        {getDetailsContextLabel({ analysisId, geneId, regionId, variantId })}
      </div>
      {showCompare && (
        <button
          type="button"
          className="compare-surfaces"
          onClick={compareSideBySide}
        >
          Compare side by side
        </button>
      )}
    </Header>
  )
}
