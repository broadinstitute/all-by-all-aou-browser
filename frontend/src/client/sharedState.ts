import {
  atom,
  selector,
  selectorFamily,
  useRecoilState,
  useRecoilValue,
  useResetRecoilState,
  useSetRecoilState,
} from 'recoil'
import { string, nullable, stringLiterals, bool, number } from '@recoiljs/refine'
import { urlSyncEffect } from 'recoil-sync'

import randomColor from 'randomcolor'
import { P_VALUE_BURDEN, P_VALUE_SKAT, P_VALUE_SKAT_O } from './PhenotypeList/Utils'

export const geneIdAtom = atom<string | null | undefined>({
  key: 'geneId',
  default: 'ENSG00000162551',
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
  default: '3035995',
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

export type PhenotypeTab = 'overview' | 'gene-burden' | 'exome-variants' | 'genome-variants'
const phenotypeTabChecker = stringLiterals<PhenotypeTab>({
  overview: 'overview',
  'gene-burden': 'gene-burden',
  'exome-variants': 'exome-variants',
  'genome-variants': 'genome-variants',
})

export const phenotypeTabAtom = atom<PhenotypeTab>({
  key: 'phenotypeTab',
  default: 'overview',
  effects: [
    urlSyncEffect({
      refine: phenotypeTabChecker,
      history: 'push',
    }),
  ],
})

export type PhenotypePlotView = 'manhattan' | 'qq'
const phenotypePlotViewChecker = stringLiterals<PhenotypePlotView>({
  manhattan: 'manhattan',
  qq: 'qq',
})

export const phenotypePlotViewAtom = atom<PhenotypePlotView>({
  key: 'phenotypePlotView',
  default: 'manhattan',
  effects: [
    urlSyncEffect({
      refine: phenotypePlotViewChecker,
      history: 'push',
    }),
  ],
})

export type GeneBurdenViewMode = 'standard' | 'overlay' | 'heatmap' | 'qqplot'
const geneBurdenViewModeChecker = stringLiterals<GeneBurdenViewMode>({
  standard: 'standard',
  overlay: 'overlay',
  heatmap: 'heatmap',
  qqplot: 'qqplot',
})

export const geneBurdenViewModeAtom = atom<GeneBurdenViewMode>({
  key: 'geneBurdenViewMode',
  default: 'standard',
  effects: [
    urlSyncEffect({
      refine: geneBurdenViewModeChecker,
      history: 'push',
    }),
  ],
})

export const geneBurdenShowSigAtom = atom<boolean>({
  key: 'geneBurdenShowSig',
  default: false,
  effects: [
    urlSyncEffect({
      refine: bool(),
      history: 'push',
    }),
  ],
})

export type TopResultsTab = 'all-phenotypes' | 'all-genes' | 'gene-burden' | 'single-variants'

const topResultsTabChecker = stringLiterals<TopResultsTab>({
  'all-phenotypes': 'all-phenotypes',
  'all-genes': 'all-genes',
  'gene-burden': 'gene-burden',
  'single-variants': 'single-variants',
})

export const topResultsTabAtom = atom<TopResultsTab>({
  key: 'topResultsTab',
  default: 'all-phenotypes',
  effects: [
    urlSyncEffect({
      refine: topResultsTabChecker,
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

export type MafOption = 0.01 | 0.001 | 0.0001
export const locusMafAtom = atom<MafOption>({
  key: 'locusMaf',
  default: 0.001,
  effects: [
    urlSyncEffect({
      refine: number(),
      history: 'push',
      syncDefault: true,
    }),
  ],
})

// Significance: 'hit' (p < 1e-4) or 'none'
export type MafSignificance = 'hit' | 'none'

// Annotation categories we track
export type AnnotationCategory = 'pLoF' | 'missense' | 'synonymous'

// For each MAF, track whether each annotation category has a hit
export type MafAnnotationSignificance = Record<AnnotationCategory, MafSignificance>
export type MafSignificanceMap = Record<MafOption, MafAnnotationSignificance>

const defaultMafAnnotationSig: MafAnnotationSignificance = {
  pLoF: 'none',
  missense: 'none',
  synonymous: 'none',
}

export const mafSignificanceAtom = atom<MafSignificanceMap>({
  key: 'mafSignificance',
  default: {
    0.01: { ...defaultMafAnnotationSig },
    0.001: { ...defaultMafAnnotationSig },
    0.0001: { ...defaultMafAnnotationSig },
  },
})

// Burden test type significance - tracks which test types have hits per annotation category
export type BurdenTestType = 'burden' | 'skat' | 'skato'
export type BurdenTestAnnotationSignificance = Record<AnnotationCategory, MafSignificance>
export type BurdenTestSignificanceMap = Record<BurdenTestType, BurdenTestAnnotationSignificance>

const defaultBurdenTestAnnotSig: BurdenTestAnnotationSignificance = {
  pLoF: 'none',
  missense: 'none',
  synonymous: 'none',
}

export const burdenTestSignificanceAtom = atom<BurdenTestSignificanceMap>({
  key: 'burdenTestSignificance',
  default: {
    burden: { ...defaultBurdenTestAnnotSig },
    skat: { ...defaultBurdenTestAnnotSig },
    skato: { ...defaultBurdenTestAnnotSig },
  },
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
export const themeModeAtom = atom<'light' | 'dark' | 'system'>({
  key: 'themeMode',
  default: 'system',
  effects: [
    ({ setSelf, onSet }) => {
      // Load from localStorage on initialization
      if (typeof window !== 'undefined') {
        const savedValue = localStorage.getItem('themeMode')
        if (savedValue != null) {
          try {
            const parsed = JSON.parse(savedValue)
            if (['light', 'dark', 'system'].includes(parsed)) {
              setSelf(parsed as 'light' | 'dark' | 'system')
            }
          } catch (e) {
            // Ignore parse errors and fall back to default
          }
        }
      }

      // Save to localStorage whenever the state changes
      onSet((newValue, _, isReset) => {
        if (typeof window !== 'undefined') {
          isReset
            ? localStorage.removeItem('themeMode')
            : localStorage.setItem('themeMode', JSON.stringify(newValue))
        }
      })
    },
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

export const showQQOverlayAtom = atom<boolean>({
  key: 'showQQOverlay',
  default: false,
  effects: [
    ({ setSelf, onSet }) => {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('showQQOverlay')
        if (saved != null) {
          setSelf(saved === 'true')
        }
      }
      onSet((newValue, _, isReset) => {
        if (typeof window !== 'undefined') {
          isReset
            ? localStorage.removeItem('showQQOverlay')
            : localStorage.setItem('showQQOverlay', String(newValue))
        }
      })
    },
  ],
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

        if (resultLayout === 'full') {
          return containerWidth / 1.05
        }

        if (resultLayout === 'hidden') {
          return 5
        }

        if (resizableWidth) {
          return resizableWidth
        }

        if (resultLayout === 'half') {
          return containerWidth / 2
        }

        if (resultLayout === 'large') {
          return containerWidth / 1.5
        }

        if (resultLayout === 'small') {
          return containerWidth / 2.4
        }

        if (resultLayout === 'smallest') {
          return containerWidth / 3.5
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
