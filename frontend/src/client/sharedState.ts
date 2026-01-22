import {
  atom,
  selector,
  selectorFamily,
  useRecoilState,
  useRecoilValue,
  useResetRecoilState,
  useSetRecoilState,
} from 'recoil'
import { string, nullable, stringLiterals, bool } from '@recoiljs/refine'
import { urlSyncEffect } from 'recoil-sync'

import randomColor from 'randomcolor'
import { P_VALUE_BURDEN, P_VALUE_SKAT, P_VALUE_SKAT_O } from './PhenotypeList/Utils'

export const geneIdAtom = atom<string | null | undefined>({
  key: 'geneId',
  default: 'ENSG00000130164',
  effects: [
    urlSyncEffect({
      refine: nullable(string()),
      history: 'push',
      syncDefault: true,
    }),
  ],
})

export const regionIdAtom = atom<string | null | undefined>({
  key: 'regionId',
  default: null,
  effects: [
    urlSyncEffect({
      refine: nullable(string()),
      history: 'push',
      syncDefault: true,
    }),
  ],
})

export const selectedContigAtom = atom<string>({
  key: 'selectedContig',
  default: 'all',
  effects: [
    urlSyncEffect({
      refine: string(),
      history: 'push',
      syncDefault: true,
    }),
  ],
})

export const analysisIdAtom = atom<string | null | undefined>({
  key: 'analysisId',
  default: '3027114',
  effects: [
    urlSyncEffect({
      refine: nullable(string()),
      history: 'push',
      syncDefault: true,
    }),
  ],
})

export const variantIdAtom = atom<string | null | undefined>({
  key: 'variantId',
  default: null,
  effects: [
    urlSyncEffect({
      refine: nullable(string()),
      history: 'push',
      syncDefault: true,
    }),
  ],
})

type BurdenSetOptions = 'pLoF' | 'missenseLC' | 'synonymous' | 'other'

const burdenSetChecker = stringLiterals<BurdenSetOptions>({
  pLoF: 'pLoF',
  missenseLC: 'missenseLC',
  synonymous: 'synonymous',
  other: 'other',
})

export const burdenSetAtom = atom<BurdenSetOptions>({
  key: 'burdenSet',
  default: 'pLoF',
  effects: [
    urlSyncEffect({
      refine: burdenSetChecker,
      history: 'push',
      syncDefault: true,
    }),
  ],
})
export const phewasOptsAtom = atom<boolean>({
  key: 'phewasOpts',
  default: true,
  effects: [
    urlSyncEffect({
      refine: bool(),
      history: 'push',
      syncDefault: true,
    }),
  ],
})
export const hideGeneOptsAtom = atom<boolean>({
  key: 'hideGeneOpts',
  default: false,
  effects: [
    urlSyncEffect({
      refine: bool(),
      history: 'push',
      syncDefault: true,
    }),
  ],
})

export const selectedAnalyses = atom<string[]>({
  key: 'selectedAnalyses',
  default: [],
})

export function useSetManySelectedAnalyses(maxAnalyses = 100) {
  const setSelectedAnalyses = useSetRecoilState(selectedAnalyses)

  return (analyses: string[]) => {
    setSelectedAnalyses(analyses.slice(0, maxAnalyses))
  }
}

export function removeItemAtIndex<T>(arr: T[], index: number) {
  return [...arr.slice(0, index), ...arr.slice(index + 1)]
}

export const useToggleSelectedAnalysis = () => {
  const [analyses, setAnalyses] = useRecoilState(selectedAnalyses)

  return (analysisId: string) => {
    if (analyses.includes(analysisId)) {
      const index = analyses.findIndex((item: string) => item === analysisId)
      const updatedList = removeItemAtIndex<string>(analyses, index)
      setAnalyses(updatedList)
    } else {
      setAnalyses([...analyses, analysisId])
    }
  }
}

export const pValueTypeAtom = atom<
  typeof P_VALUE_SKAT_O | typeof P_VALUE_BURDEN | typeof P_VALUE_SKAT
>({
  key: 'pValueType',
  default: P_VALUE_SKAT_O,
})

export type AncestryGroupCodes = 'afr' | 'amr' | 'eas' | 'eur' | 'mid' | 'sas' | 'meta'

const ancestryChecker = stringLiterals<AncestryGroupCodes>({
  afr: 'afr',
  amr: 'amr',
  eas: 'eas',
  eur: 'eur',
  mid: 'mid',
  sas: 'sas',
  meta: 'meta',
})

export const ancestryGroupAtom = atom<AncestryGroupCodes>({
  key: 'ancestryGroup',
  default: 'meta',
  effects: [
    urlSyncEffect({
      refine: ancestryChecker,
      history: 'push',
      syncDefault: true,
    }),
  ],
})

export type SequencingType = 'exomes' | 'genomes' | 'exomes_and_genomes'

const sequencingTypeChecker = stringLiterals<SequencingType>({
  exomes: 'exomes',
  genomes: 'genomes',
  exomes_and_genomes: 'exomes_and_genomes',
})

export const sequencingTypeAtom = atom<SequencingType>({
  key: 'sequencingType',
  default: 'exomes_and_genomes',
  effects: [
    urlSyncEffect({
      refine: sequencingTypeChecker,
      history: 'push',
      syncDefault: true,
    }),
  ],
})

export const showSelectAnalysesOnlyAtom = atom({
  key: 'showSelectedAnalysesOnly',
  default: false,
})

export const showFilteredAnalysesAtom = atom({
  key: 'showFilteredAnalyses',
  default: true,
})

export const useClearSelectedAnalyses = () => {
  const resetAnalyses = useResetRecoilState(selectedAnalyses)
  const resetShowSelectedOnly = useResetRecoilState(showSelectAnalysesOnlyAtom)
  return () => {
    resetAnalyses()
    resetShowSelectedOnly()
  }
}

export const selectedAnalysesColorsSelector = selector({
  key: 'selectedAnalysesColors',
  get: ({ get }) => {
    const analyses = get(selectedAnalyses)
    return analyses.map((analysisId, i) => ({
      analysisId,
      color: randomColor({ seed: (i + 1) * 10, luminosity: 'bright' }),
    }))
  },
})

export const hoveredAnalysisAtom = atom<string | null>({
  key: 'hoveredAnalysis',
  default: null,
})

export type ResultLayout = 'hidden' | 'smallest' | 'small' | 'half' | 'large' | 'full'

export type ResultIndex =
  | 'top-associations'
  | 'analyses'
  | 'gene-manhattan'
  | 'variant-manhattan'
  | 'gene-phewas'
  | 'variant-phewas'
  | 'locus-phewas'
  | 'pheno-info'

const resultLayoutChecker = stringLiterals<ResultLayout>({
  hidden: 'hidden',
  smallest: 'smallest',
  small: 'small',
  half: 'half',
  large: 'large',
  full: 'full',
})

const resultIndexChecker = stringLiterals<ResultIndex>({
  'top-associations': 'top-associations',
  'gene-manhattan': 'gene-manhattan',
  'variant-manhattan': 'variant-manhattan',
  'gene-phewas': 'gene-phewas',
  'variant-phewas': 'variant-phewas',
  'pheno-info': 'pheno-info',
  'analyses': 'analyses',
})

export const resultLayoutAtom = atom<ResultLayout>({
  key: 'resultLayout',
  default: 'small',
  effects: [
    urlSyncEffect({
      refine: resultLayoutChecker,
      history: 'push',
      syncDefault: true,
    }),
  ],
})

export const resultIndexAtom = atom<ResultIndex>({
  key: 'resultIndex',
  default: 'pheno-info',
  effects: [
    urlSyncEffect({
      refine: resultIndexChecker,
      history: 'push',
      syncDefault: true,
    }),
  ],
})

export const resizableWidthAtom = atom<number | null>({
  key: 'resizableWidth',
  default: null,
})

export const windowSizeAtom = atom<{ height: number; width: number }>({
  key: 'windowHeight',
  default: { height: window.innerHeight, width: window.innerWidth },
})

export const firstItemWidthSelector = selectorFamily<
  number,
  { containerWidth: number }
>({
  key: 'firstItemWidth',
  get:
    ({ containerWidth }) =>
      ({ get }) => {

        const resultLayout = get(resultLayoutAtom)
        const resizableWidth = get(resizableWidthAtom)

        if (resizableWidth) {
          return resizableWidth
        }

        if (resultLayout === 'half') {
          return containerWidth / 2
        }

        if (resultLayout === 'large') {
          return containerWidth / 1.5
        }

        if (resultLayout === 'full') {
          return containerWidth / 1.05
        }

        if (resultLayout === 'small') {
          return containerWidth / 2.4
        }

        if (resultLayout === 'smallest') {
          return containerWidth / 3.5
        }

        if (resultLayout === 'hidden') {
          return 5
        }

        // half by default
        return containerWidth / 2
      },
})

export const numVariantsInGeneAtom = atom<number | null>({
  key: 'numVariantsInGene',
  default: null,
})

export const numVariantsPostNoPvalFilterAtom = atom<number | null>({
  key: 'numVariantsPostNoPvalFilter',
  default: null,
})

export const numVariantsPostPvalueFilterAtom = atom<number | null>({
  key: 'numVariantsPostPvalueFilter',
  default: null,
})

export const numVariantsPostAfFilterAtom = atom<number | null>({
  key: 'numVariantsPostAfFilter',
  default: null,
})

export const numVarPostFilterAtom = atom<number | null>({
  key: 'numVarPostFilter',
  default: null,
})

export const useGetActiveItems = () => {
  const geneId = useRecoilValue(geneIdAtom)
  const regionId = useRecoilValue(regionIdAtom)
  const analysisId = useRecoilValue(analysisIdAtom)
  const variantId = useRecoilValue(variantIdAtom)
  const burdenSet = useRecoilValue(burdenSetAtom)
  const analyses = useRecoilValue(selectedAnalyses)
  const ancestryGroup = useRecoilValue(ancestryGroupAtom)
  const resultLayout = useRecoilValue(resultLayoutAtom)
  const resultIndex = useRecoilValue(resultIndexAtom)

  return {
    geneId,
    regionId,
    analysisId,
    variantId,
    burdenSet,
    selectedAnalyses: analyses,
    ancestryGroup,
    resultLayout,
    resultIndex,
  }
}
