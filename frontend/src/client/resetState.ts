import { matchPath, useLocation } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { useRecoilState, useResetRecoilState, useSetRecoilState } from 'recoil'
import { resizableWidthAtom, selectedAnalyses, useClearSelectedAnalyses } from './sharedState'
import { useClearVariantState, variantSearchTextAtom } from './variantState'

export function useResetStateOnLocationChange() {
  let location = useLocation()
  const clearSelectedAnalyses = useClearSelectedAnalyses()
  const clearVariantState = useClearVariantState()
  const setVariantSearchText = useSetRecoilState(variantSearchTextAtom)
  const resetResizableWidth = useResetRecoilState(resizableWidthAtom)
  const [analyses, setSelectedAnalyses] = useRecoilState(selectedAnalyses)

  const prevAnalysis = useRef<string | null>(null)
  const prevGene = useRef<string | null>(null)
  const prevVariant = useRef<string | null>(null)

  useEffect(() => {
    let match: any

    const matchGeneAndPheno = matchPath<{ phenotype: string; gene: string }>(location.pathname, {
      path: '/gene/:gene/phenotype/:phenotype',
    })

    const matchGene = matchPath<{ phenotype: string; gene: string }>(location.pathname, {
      path: '/gene/:gene',
    })

    const matchGeneAndPhenoAndVariant = matchPath<{
      phenotype: string
      gene: string
      variant: string
    }>(location.pathname, {
      path: '/gene/:gene/phenotype/:phenotype/variant/:variantId',
    })
    if (matchGeneAndPhenoAndVariant) {
      match = matchGeneAndPhenoAndVariant
    } else if (matchGeneAndPheno) {
      match = matchGeneAndPheno
    } else if (matchGene) {
      match = matchGene
      resetResizableWidth()
    }

    if (match) {
      const { phenotype: analysisId, gene: geneId, variantId } = match.params

      if (prevAnalysis.current !== analysisId) {
        setSelectedAnalyses([analysisId])
      }

      if (geneId !== prevGene.current) {
        if (analysisId && analyses.length > 1) {
          clearSelectedAnalyses()
        }
        clearVariantState()
        setVariantSearchText('')
      }

      prevAnalysis.current = analysisId
      prevGene.current = geneId
      prevVariant.current = variantId
    }

    setVariantSearchText('')
  }, [location.pathname])
}
