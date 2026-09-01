import { useCallback } from 'react';
import {
  RecoilValue,
  useRecoilCallback,
  useRecoilTransaction_UNSTABLE,
  useRecoilValue,
} from 'recoil';
import {
  activeSurfaceAtom,
  analysisIdAtom,
  browserContainerWidthAtom,
  geneIdAtom,
  regionIdAtom,
  resultIndexAtom,
  resultLayoutAtom,
  topResultsTabAtom,
  variantIdAtom,
  ResultIndex,
  TopResultsTab,
} from '../sharedState';
import {
  experienceModeAtom,
  experienceModePreferenceAtom,
  experienceModeUrlOverrideAtom,
  getExperienceModeFromAtoms,
} from '../browserModeState';
import {
  browserSemanticNavigation,
  buildCanonicalNavigationUrl,
  buildStateUrl,
  commitSemanticNavigation,
  NavigationState,
} from '../navigationUrl';
import {
  buildDestinationState,
  getCanonicalNewTabPresentation,
  getFocusedSurfaceForLayout,
  getNavigationPresentation,
  getSideBySideLayoutForSurface,
  NavigationDestination,
} from '../experienceNavigation';
import { canFitTwoPanes } from '../browserShell';

export { buildStateUrl };

export type NavMode = 'split' | 'newTab';

type NavigationUpdates = {
  geneId?: string | null;
  regionId?: string | null;
  variantId?: string | null;
  analysisId?: string | null;
  resultIndex?: ResultIndex;
  topResultsTab?: TopResultsTab;
};

type PresentationOptions = {
  destination: NavigationDestination;
  resultsOnly?: boolean;
};

export function useAppNavigation() {
  const experienceMode = useRecoilValue(experienceModeAtom);
  const resultLayout = useRecoilValue(resultLayoutAtom);

  // Semantic navigation is a browser-history operation, not a collection of
  // independent atom writes. Push the complete URL once and let the shared
  // popstate listener restore Router and Recoil from that exact destination.
  const navigate = useRecoilCallback(
    ({ snapshot }) =>
      (updates: NavigationUpdates, options: PresentationOptions) => {
        const get = <T,>(state: RecoilValue<T>): T =>
          snapshot.getLoadable(state).valueOrThrow();
        const presentation = getNavigationPresentation(
          getExperienceModeFromAtoms(get),
          get(resultLayoutAtom),
          options.destination,
          {
            resultsOnly: options.resultsOnly,
            singleSurface: !canFitTwoPanes(get(browserContainerWidthAtom)),
          }
        );

        commitSemanticNavigation(
          browserSemanticNavigation,
          buildDestinationState(updates, presentation)
        );
      },
    []
  );

  const goToGene = useCallback(
    (
      geneId: string,
      options?: {
        destination?: 'details' | 'phewas';
        fromPhenotype?: boolean;
        keepVariant?: boolean;
        analysisId?: string | null;
        resultIndex?: ResultIndex;
        resultsOnly?: boolean;
      }
    ) => {
      const destination =
        options?.destination ?? (options?.resultIndex ? 'phewas' : 'details');
      navigate(
        {
          geneId,
          regionId: null,
          ...(!options?.keepVariant ? { variantId: null } : {}),
          ...(options?.analysisId !== undefined
            ? { analysisId: options.analysisId }
            : !options?.fromPhenotype
              ? { analysisId: null }
              : {}),
          ...(options?.resultIndex ? { resultIndex: options.resultIndex } : {}),
        },
        {
          destination: destination === 'details' ? 'details' : 'results',
          resultsOnly: options?.resultsOnly,
        }
      );
    },
    [navigate]
  );

  const goToRegion = useCallback(
    (
      regionId: string,
      options?: {
        destination?: 'details' | 'phewas';
        fromPhenotype?: boolean;
        resultIndex?: ResultIndex;
        resultsOnly?: boolean;
      }
    ) => {
      const destination =
        options?.destination ?? (options?.resultIndex ? 'phewas' : 'details');
      navigate(
        {
          regionId,
          geneId: null,
          variantId: null,
          ...(!options?.fromPhenotype ? { analysisId: null } : {}),
          ...(options?.resultIndex ? { resultIndex: options.resultIndex } : {}),
        },
        {
          destination: destination === 'details' ? 'details' : 'results',
          resultsOnly: options?.resultsOnly,
        }
      );
    },
    [navigate]
  );

  const goToVariant = useCallback(
    (
      variantId: string,
      options?: {
        destination?: 'details' | 'phewas';
        geneId?: string | null;
        regionId?: string | null;
        analysisId?: string | null;
        resultIndex?: ResultIndex;
        resultsOnly?: boolean;
      }
    ) => {
      const destination =
        options?.destination ?? (options?.resultIndex ? 'phewas' : 'details');
      navigate(
        {
          variantId,
          ...(options?.geneId !== undefined ? { geneId: options.geneId } : {}),
          ...(options?.regionId !== undefined
            ? { regionId: options.regionId }
            : {}),
          ...(options?.analysisId !== undefined
            ? { analysisId: options.analysisId }
            : {}),
          ...(options?.resultIndex ? { resultIndex: options.resultIndex } : {}),
        },
        {
          destination: destination === 'details' ? 'details' : 'results',
          resultsOnly: options?.resultsOnly,
        }
      );
    },
    [navigate]
  );

  const goToPhenotype = useCallback(
    (
      analysisId: string,
      options?: {
        destination?: 'overview' | 'association';
        keepContext?: boolean;
        resultIndex?: ResultIndex;
        resultsOnly?: boolean;
      }
    ) => {
      const destination = options?.destination ?? 'overview';
      navigate(
        {
          analysisId,
          ...(!options?.keepContext
            ? { geneId: null, regionId: null, variantId: null }
            : {}),
          ...(options?.resultIndex ? { resultIndex: options.resultIndex } : {}),
        },
        {
          destination: destination === 'association' ? 'details' : 'results',
          resultsOnly: options?.resultsOnly,
        }
      );
    },
    [navigate]
  );

  const goToAssociation = useCallback(
    (
      analysisId: string,
      context: {
        geneId?: string | null;
        regionId?: string | null;
        variantId?: string | null;
      } = {}
    ) => {
      navigate(
        { analysisId, ...context },
        { destination: 'details' }
      );
    },
    [navigate]
  );

  const goToLocus = useCallback(
    (
      regionId: string,
      options?: {
        destination?: 'details' | 'phewas';
        geneId?: string;
        fromPhenotype?: boolean;
        resultIndex?: ResultIndex;
        resultsOnly?: boolean;
      }
    ) => {
      const destination =
        options?.destination ?? (options?.resultIndex ? 'phewas' : 'details');
      navigate(
        {
          regionId,
          variantId: null,
          ...(options?.geneId !== undefined ? { geneId: options.geneId } : {}),
          ...(!options?.fromPhenotype ? { analysisId: null } : {}),
          ...(options?.resultIndex ? { resultIndex: options.resultIndex } : {}),
        },
        {
          destination: destination === 'details' ? 'details' : 'results',
          resultsOnly: options?.resultsOnly,
        }
      );
    },
    [navigate]
  );

  const goToResults = useCallback(
    (topResultsTab: TopResultsTab = 'all-phenotypes') => {
      navigate(
        {
          topResultsTab,
          resultIndex: 'top-associations',
          geneId: null,
          regionId: null,
          variantId: null,
          analysisId: null,
        },
        { destination: 'results', resultsOnly: true }
      );
    },
    [navigate]
  );

  const switchAnalysis = useRecoilTransaction_UNSTABLE(
    ({ set }) =>
      (analysisId: string | null) => {
        set(analysisIdAtom, analysisId);
      },
    []
  );

  const clearVariant = useRecoilTransaction_UNSTABLE(
    ({ set }) =>
      () => set(variantIdAtom, null),
    []
  );

  const clearAll = useRecoilTransaction_UNSTABLE(
    ({ set }) =>
      () => {
        set(geneIdAtom, null);
        set(regionIdAtom, null);
        set(variantIdAtom, null);
      },
    []
  );

  const openInNewTab = useCallback(
    (
      stateUpdates: NavigationState,
      options: {
        destination?: NavigationDestination;
        resultsOnly?: boolean;
        preserveKeys?: readonly ('geneId' | 'regionId' | 'variantId' | 'analysisId')[];
      } = {}
    ) => {
      const destination =
        options.destination ??
        (stateUpdates.activeSurface === 'details' ||
        stateUpdates.resultLayout === 'detail'
          ? 'details'
          : 'results');
      const requestedLayout =
        stateUpdates.resultLayout === 'detail' ||
        stateUpdates.resultLayout === 'split' ||
        stateUpdates.resultLayout === 'full'
          ? stateUpdates.resultLayout
          : resultLayout;
      const presentation = getCanonicalNewTabPresentation(
        experienceMode,
        requestedLayout,
        destination,
        {
          resultsOnly:
            options.resultsOnly ?? stateUpdates.resultLayout === 'full',
        }
      );
      window.open(
        buildCanonicalNavigationUrl(
          window.location.href,
          buildDestinationState(stateUpdates, presentation),
          { preserveKeys: options.preserveKeys }
        ),
        '_blank'
      );
    },
    [experienceMode, resultLayout]
  );

  const setExperienceMode = useRecoilTransaction_UNSTABLE(
    ({ get, set }) =>
      (mode: 'focused' | 'sideBySide') => {
        if (mode === 'focused') {
          set(
            activeSurfaceAtom,
            getFocusedSurfaceForLayout(
              get(activeSurfaceAtom),
              get(resultLayoutAtom)
            )
          );
        } else {
          set(
            resultLayoutAtom,
            getSideBySideLayoutForSurface(
              get(activeSurfaceAtom),
              get(resultLayoutAtom)
            )
          );
        }
        set(experienceModePreferenceAtom, mode);
        set(experienceModeUrlOverrideAtom, mode);
      },
    []
  );

  const compareSideBySide = useRecoilTransaction_UNSTABLE(
    ({ set }) =>
      () => {
        set(experienceModePreferenceAtom, 'sideBySide');
        set(experienceModeUrlOverrideAtom, 'sideBySide');
        set(resultLayoutAtom, 'split');
        set(activeSurfaceAtom, 'details');
      },
    []
  );

  const setSideBySideLayout = useRecoilTransaction_UNSTABLE(
    ({ set }) =>
      (layout: 'detail' | 'split' | 'full') => {
        set(resultLayoutAtom, layout);
        if (layout === 'full') set(activeSurfaceAtom, 'results');
        if (layout === 'detail') set(activeSurfaceAtom, 'details');
      },
    []
  );

  const openDetailPane = useCallback(
    () => navigate({}, { destination: 'details' }),
    [navigate]
  );

  const openResultsPane = useCallback(
    () => navigate({}, { destination: 'results' }),
    [navigate]
  );

  return {
    goToGene,
    goToRegion,
    goToVariant,
    goToPhenotype,
    goToAssociation,
    goToLocus,
    goToResults,
    switchAnalysis,
    clearVariant,
    clearAll,
    openInNewTab,
    setExperienceMode,
    compareSideBySide,
    setSideBySideLayout,
    openDetailPane,
    openResultsPane,
    navigateToState: navigate,
  };
}
