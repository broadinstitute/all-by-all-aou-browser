import { Button } from '@gnomad/ui'
import { useMemo, useState, useEffect, useRef } from 'react'
import { useRecoilValue, useSetRecoilState } from 'recoil'

import { axaouDevUrl, cacheEnabled, pouchDbName } from '../Query'
import {
  analysisIdAtom,
  ancestryGroupAtom,
  AncestryGroupCodes,
  selectedAnalyses,
  variantIdAtom,
  locusMafAtom,
  MafOption,
  mafSignificanceAtom,
  MafSignificance,
  MafSignificanceMap,
  AnnotationCategory,
  MafAnnotationSignificance,
  burdenTestSignificanceAtom,
  BurdenTestSignificanceMap,
} from '../sharedState'
import { renderCountText } from '../PhenotypeList/Utils'

import { addVariantIdsToList, annotateWorstConsequence, processGeneBurden } from '../utils'
import { mergeGeneVariantResponses } from './geneVariantSemantics'
import {
  initialAutomaticGeneColumnPresetState,
  resolveAutomaticGeneColumnPreset,
} from '../geneColumnPresets'
import { useSelectedVariantFieldsPreset } from '../variantState'

import { useQuery } from '@axaou/ui'
import {
  AnalysisMetadata,
  GeneAssociations,
  GeneModels,
  VariantAnnotations,
  VariantAssociations,
  VariantJoined,
  VariantDataset,
  LocusPlotResponse,
  LocusMetadata,
  RegionOverlayResponse,
} from '../types'
import { LocusPageLayout } from './LocusPageLayout'
import {
  findVariantById,
  GenomicContext,
  parseVariantLocus,
} from './genomicContext'

/**
 * Convert regionId format from "19-32216732-34497056" to "19:32216732-34497056"
 * for API interval endpoints which expect "chr:start-end" format.
 */
const formatRegionIdForApi = (regionId: string): string => {
  const parts = regionId.split('-')
  if (parts.length >= 3) {
    // Format: "19-32216732-34497056" -> "19:32216732-34497056"
    return `${parts[0]}:${parts.slice(1).join('-')}`
  }
  return regionId
}

const annotateVariantWithAnalysisMetadata = (
  v: VariantJoined,
  analysisId: string,
  analysesMetadata: AnalysisMetadata[]
) => {
  const analysisMetadata = analysesMetadata.find((a) => a.analysis_id === analysisId)

  if (!analysisMetadata) {
    // Return variant without metadata annotation if not found
    return {
      ...v,
      analysis_id: analysisId,
      analysis_description: analysisId,
      analysisMetadata: undefined,
      trait_type: 'unknown',
    }
  }

  const { trait_type } = analysisMetadata
  const analysisName = `${analysisMetadata.description} (${analysisMetadata.analysis_id})`

  return {
    ...v,
    analysis_id: analysisId,
    analysis_description: analysisName,
    analysisMetadata,
    trait_type,
  }
}

const PrimaryAnalysisColumnPresetBridge = ({
  analysisId,
  traitType,
}: {
  analysisId: string
  traitType: string | null | undefined
}) => {
  const applyPreset = useSelectedVariantFieldsPreset()
  const automaticPresetState = useRef(initialAutomaticGeneColumnPresetState)

  useEffect(() => {
    const decision = resolveAutomaticGeneColumnPreset(
      automaticPresetState.current,
      analysisId,
      traitType
    )
    automaticPresetState.current = decision.state

    if (decision.presetToApply) {
      applyPreset(decision.presetToApply)
    }
  }, [analysisId, traitType, applyPreset])

  return null
}

const processVariants = ({
  analyses,
  analysesMetadata,
  queryStates,
  variantId,
}: {
  analysisId: string;
  analyses: string[];
  analysesMetadata?: AnalysisMetadata[];
  queryStates: any;
  variantId?: string;
}): VariantDataset[] => {

  const sequencingTypes = ["exome", "genome"];
  const ancestryGroups = ["afr", "amr", "eas", "eur", "mid", "sas", "meta"];

  return analyses.flatMap((analysisId) =>
    sequencingTypes.flatMap((sequencingType) =>
      ancestryGroups.map((ancestryGroup) => {
        const associationsKey = `variantAssociations-${analysisId}-${sequencingType}-${ancestryGroup}`;
        const associations =
          queryStates.hasOwnProperty(associationsKey) && queryStates[associationsKey].data
            ? (queryStates[associationsKey].data as VariantAssociations[])
            : [];

        const variantAnnotationsKey = `variantAnnotations-${sequencingType}-${ancestryGroup}`;
        const variantAnnotationsWithId = addVariantIdsToList(queryStates[variantAnnotationsKey]?.data ?? []);

        const associationsWithId = addVariantIdsToList(associations);

        // Keep annotation-only rows for the No P-val track and association-only
        // rows that fall outside the annotation endpoint's exon-only response.
        // Both gene endpoints already enforce the requested gene identity.
        const variantsMerged = mergeGeneVariantResponses(
          variantAnnotationsWithId,
          associationsWithId
        ) as VariantJoined[];


        const data = variantsMerged
          .map(annotateWorstConsequence)
          .map((v) => {
            if (analysesMetadata) {
              return annotateVariantWithAnalysisMetadata(v, analysisId, analysesMetadata);
            } else {
              return v;
            }
          })
          .map((v) => ({
            ...v,
            ancestry_group: ancestryGroup,
            sequencing_type: sequencingType,
            logp: -Math.log10(v.pvalue),
            // pos: v.locus.position,
            analysis_description: v.analysis_id,
            allele_count: v.allele_count ?? v.ac,
            allele_frequency: v.allele_frequency ?? v.af,
            allele_number: v.allele_number ?? v.an,
            homozygote_count: v.homozygote_count ?? v.hom,

            combined_counts: `${renderCountText(v.ac_cases)} / ${renderCountText(
              v.an_cases
            )} | ${renderCountText(v.ac_controls)} / ${renderCountText(v.an_controls)}`,
          }));

        return {
          sequencingType,
          ancestryGroup,
          analysisId,
          data
        };
      })
    )
  ) as VariantDataset[];
}
export const LocusPageDataContainer = ({
  embedded = false,
  context,
}: {
  embedded?: boolean
  context: GenomicContext
}) => {
  interface Data {
    geneModels: GeneModels[]
    geneAssociations: GeneAssociations[]
    analysesMetadata: AnalysisMetadata[]
    variantAnnotations: VariantAnnotations[]
    variantAssociations: VariantAssociations[]
    [key: string]: any
  }

  const variantId = useRecoilValue(variantIdAtom)
  const analysisId = useRecoilValue(analysisIdAtom)
  const regionId = context.kind === 'locus' ? context.regionId : null
  const geneIdOrName = context.kind === 'gene' ? context.geneId : null

  if (!analysisId) {
    return null
  }

  const selectedAnalysesList = useRecoilValue(selectedAnalyses)

  const analyses = selectedAnalysesList.length === 0 ? [analysisId] : selectedAnalysesList

  const ancestryGroup = useRecoilValue(ancestryGroupAtom)

  let queries = [
    {
      url: `${axaouDevUrl}/analyses?ancestry_group=${ancestryGroup}`,
      name: 'analysesMetadata',
    },
    ...(variantId
      ? [{
          url: `${axaouDevUrl}/variants/annotations/${variantId}?extended=true`,
          name: 'selectedVariantAnnotation',
        }]
      : []),
  ]

  const sequencingTypes = ["exome", "genome"];

  const variantAssociationsGeneQueries = analyses.flatMap((analysisID) =>
    sequencingTypes.map((seqType) => ({
      url: `${axaouDevUrl}/variants/associations/gene/${geneIdOrName}?ancestry_group=${ancestryGroup}&analysis_id=${analysisID}&sequencing_type=${seqType}`,
      name: `variantAssociations-${analysisID}-${seqType}-${ancestryGroup}`,
      queryMode: 'two_step',
      queryModeMinItems: 0
    }))
  );

  const variantAnnotationGeneQueries = sequencingTypes.map(seqType =>
  ({
    url: `${axaouDevUrl}/variants/annotations/gene/${geneIdOrName}?ancestry_group=${ancestryGroup}&sequencing_type=${seqType}&extended=true`,
    name: `variantAnnotations-${seqType}-${ancestryGroup}`,
  })
  )

  let geneQueries = [
    {
      url: `${axaouDevUrl}/genes/model/${geneIdOrName}`,
      name: 'geneModels',
    },
    {
      url: `${axaouDevUrl}/genes/associations?gene_id=${geneIdOrName}&analysis_id=${analysisId}&ancestry_group=${ancestryGroup}&use_index=idx_gene_associations_hds_gene_id&gene_contract=burden_direction_v1`,
      name: 'geneAssociations',
    },
  ]

  geneQueries = [...geneQueries, ...variantAssociationsGeneQueries, ...variantAnnotationGeneQueries]

  // Format regionId for API: "19-32216732-34497056" -> "19:32216732-34497056"
  const apiRegionId = regionId ? formatRegionIdForApi(regionId) : ''

  // Determine if this is a large region that should use server-side rendering
  let isLargeRegion = false
  let rContig = ''
  let rStart = 0
  let rStop = 0

  if (regionId) {
    const parts = regionId.split('-')
    if (parts.length >= 3) {
      rContig = parts[0]
      rStart = parseInt(parts[1], 10)
      rStop = parseInt(parts[2], 10)
      if (rStop - rStart > 100000) {
        isLargeRegion = true
      }
    }
  }

  const variantAnnotationRegionQueries = sequencingTypes.map(seqType =>
  ({
    url: `${axaouDevUrl}/variants/annotations/interval/chr${apiRegionId}?ancestry_group=${ancestryGroup}&sequencing_type=${seqType}&extended=true`,
    name: `variantAnnotations-${seqType}-${ancestryGroup}`,
  })
  )

  // Base queries that both large and small regions need
  const baseRegionQueries = [
    {
      url: `${axaouDevUrl}/genes/model/interval/chr${apiRegionId}`,
      name: 'geneModels',
    },
    {
      url: `${axaouDevUrl}/genes/associations/interval/chr${apiRegionId}?analysis_id=${analysisId}&ancestry_group=${ancestryGroup}&use_index=idx_gene_associations_hds_gene_id&gene_contract=burden_direction_v1`,
      name: `geneAssociations`,
    },
  ]

  // For large regions, skip heavy variant queries and use lightweight overlay instead
  const regionQueries = isLargeRegion
    ? [
        ...baseRegionQueries,
        {
          url: `${axaouDevUrl}/phenotype/${analysisId}/region/render/overlay?ancestry=${ancestryGroup}&contig=${rContig}&start=${rStart}&stop=${rStop}&threshold=5e-8`,
          name: 'regionOverlay',
        },
      ]
    : [
        ...baseRegionQueries,
        ...sequencingTypes.map((seqType) => ({
          url: `${axaouDevUrl}/variants/associations/interval/chr${apiRegionId}?ancestry_group=${ancestryGroup}&analysis_id=${analysisId}&sequencing_type=${seqType}`,
          name: `variantAssociations-${analysisId}-${seqType}-${ancestryGroup}`,
          queryMode: 'two_step',
          queryModeMinItems: seqType == "genome" ? 2000 : Infinity
        })),
        ...variantAnnotationRegionQueries,
      ]

  if (regionId) {
    queries = [...queries, ...regionQueries]
  } else if (geneIdOrName) {
    queries = [...queries, ...geneQueries]
  }

  const { queryStates: allQueryState } = useQuery<Data>({
    dbName: pouchDbName,
    queries,
    deps: [geneIdOrName, analysisId, selectedAnalysesList, regionId, variantId, ancestryGroup],
    cacheEnabled,
  })

  const queryStates = allQueryState


  const analysesMetadata = queryStates.analysesMetadata?.data

  const regionOverlay = queryStates.regionOverlay?.data as RegionOverlayResponse | undefined

  const variantDatasets = useMemo(() => {
    // For large regions, build lightweight variant datasets from the overlay's
    // significant hits instead of fetching + processing the full variant set.
    let datasets: VariantDataset[]
    if (isLargeRegion) {
      const data: VariantJoined[] = (regionOverlay?.significant_hits ?? []).map((hit: any) => {
        const parts = hit.id.replace(/^chr/, '').split('-')
        const contig = parts[0] ? (parts[0].startsWith('chr') ? parts[0] : `chr${parts[0]}`) : hit.contig
        const position = hit.position || (parts[1] ? parseInt(parts[1], 10) : 0)

        return {
          variant_id: hit.id,
          locus: { contig, position },
          ref: parts[2] || '',
          alt: parts[3] || '',
          pvalue: hit.pvalue,
          beta: hit.beta ?? 0,
          se: hit.se ?? 0,
          af: hit.af ?? 0,
          consequence: hit.consequence || 'unknown',
          gene_symbol: hit.gene_symbol || '',
          hgvsp: hit.hgvsp || '',
          hgvsc: hit.hgvsc || '',
          sequencing_type: 'combined',
          ancestry_group: ancestryGroup,
          analysis_id: analysisId,
          analysis_description: analysisId,
          logp: -Math.log10(hit.pvalue),
          allele_count: hit.ac ?? undefined,
          allele_frequency: hit.af ?? undefined,
        } as any as VariantJoined
      })

      datasets = [{
        sequencingType: 'combined',
        ancestryGroup,
        analysisId: analysisId!,
        data,
      }]
    } else {
      datasets = processVariants({
        analysisId,
        analyses,
        analysesMetadata,
        queryStates,
      });
    }

    if (variantId) {
      const rawAnnotation = queryStates.selectedVariantAnnotation?.data
      const annotationArray = Array.isArray(rawAnnotation)
        ? rawAnnotation
        : rawAnnotation ? [rawAnnotation] : []
      const annotated = addVariantIdsToList(annotationArray)
        .map(annotateWorstConsequence) as VariantJoined[]
      let selected = findVariantById(annotated, variantId)

      // The canonical ID itself is sufficient for an honest positional marker
      // while annotation data is unavailable; no allele/position fuzzy match.
      if (!selected) {
        const parsed = parseVariantLocus(variantId)
        if (parsed) {
          selected = {
            variant_id: variantId,
            locus: {
              contig: parsed.contig.startsWith('chr') ? parsed.contig : `chr${parsed.contig}`,
              position: parsed.position,
            },
            pvalue: null,
            consequence: 'unknown',
            analysis_id: analysisId,
            analysis_description: analysisId,
            ancestry_group: ancestryGroup,
            sequencing_type: 'selected',
          } as unknown as VariantJoined
        }
      }

      const alreadyPresent = datasets.some((dataset) =>
        Boolean(findVariantById(dataset.data, variantId))
      )
      if (selected && !alreadyPresent) {
        datasets = [
          ...datasets,
          {
            sequencingType: 'selected',
            ancestryGroup,
            analysisId,
            data: [selected],
          },
        ]
      }
    }

    return datasets
  }, [regionId, variantId, selectedAnalysesList, analysisId, analysesMetadata, queryStates, ancestryGroup, isLargeRegion, regionOverlay]);

  const geneModels = queryStates.geneModels?.data || []

  if (!geneModels) {
    return <>Couldn't fetch gene models</>
  }

  let geneAssociations: GeneAssociations[] | undefined = []

  geneAssociations = queryStates.geneAssociations && queryStates.geneAssociations.data || []

  geneAssociations = processGeneBurden(geneAssociations);

  const singleAnalysisMetadata =
    analysesMetadata && analysesMetadata.find((a) => a.analysis_id === analysisId)

  // Locus plot data state
  const [locusPlotData, setLocusPlotData] = useState<LocusPlotResponse | null>(null)

  // Fetch locus plot data when we have a gene model or region
  useEffect(() => {
    const fetchLocusPlot = async () => {
      try {
        // First, find loci that overlap with our region
        const lociUrl = `${axaouDevUrl}/phenotype/${analysisId}/loci?ancestry=${ancestryGroup}`
        const lociResponse = await fetch(lociUrl)
        if (!lociResponse.ok) {
          setLocusPlotData(null)
          return
        }

        const loci: LocusMetadata[] = await lociResponse.json()

        // Find the first locus that overlaps with the current gene/region
        const geneModel = geneModels[0]
        let overlappingLocus: LocusMetadata | undefined

        if (regionId) {
          // Parse regionId format: "19-32216732-34497056"
          const parts = regionId.split('-')
          if (parts.length >= 3) {
            const contig = parts[0]
            const contigWithChr = contig.startsWith('chr') ? contig : `chr${contig}`
            const start = parseInt(parts[1], 10)
            const stop = parseInt(parts[2], 10)

            overlappingLocus = loci.find(
              (l) =>
                l.contig === contigWithChr &&
                l.start <= stop &&
                l.stop >= start &&
                l.plot_gcs_uri // Only consider loci with plots
            )
          }
        } else if (geneModel) {
          overlappingLocus = loci.find(
            (l) =>
              l.contig === geneModel.chrom &&
              l.start <= (geneModel.stop || 0) &&
              l.stop >= (geneModel.start || 0) &&
              l.plot_gcs_uri // Only consider loci with plots
          )
        }

        if (!overlappingLocus) {
          setLocusPlotData(null)
          return
        }

        // Fetch the locus plot data
        const plotUrl = `${axaouDevUrl}/phenotype/${analysisId}/loci/${overlappingLocus.locus_id}/plot?ancestry=${ancestryGroup}`
        const plotResponse = await fetch(plotUrl)
        if (!plotResponse.ok) {
          setLocusPlotData(null)
          return
        }

        const plotData: LocusPlotResponse = await plotResponse.json()
        setLocusPlotData(plotData)
      } catch (error) {
        console.error('Failed to fetch locus plot:', error)
        setLocusPlotData(null)
      }
    }

    // Only fetch if we have the necessary data
    if (analysisId && ancestryGroup && (geneModels.length > 0 || regionId)) {
      fetchLocusPlot()
    }
  }, [analysisId, ancestryGroup, geneModels, regionId])

  let geneAssociationsForAncestry: GeneAssociations[] = []
  if (geneIdOrName) {
    geneAssociationsForAncestry =
      geneAssociations?.filter((association) => association.ancestry_group === ancestryGroup) || []
  }

  // Track which gene we've already auto-selected MAF for
  const lastAutoSelectedGeneRef = useRef<string | null>(null)
  const setMafSignificance = useSetRecoilState(mafSignificanceAtom)
  const setBurdenTestSignificance = useSetRecoilState(burdenTestSignificanceAtom)
  const setLocusMaf = useSetRecoilState(locusMafAtom)

  // Compute MAF significance and auto-select best MAF when gene associations load
  useEffect(() => {
    if (!geneAssociationsForAncestry || geneAssociationsForAncestry.length === 0) {
      return
    }

    // Map annotation strings to our categories
    // pLoF;missenseLC goes under missense (orange) since it's the combined set
    const mapAnnotation = (annotation: string): AnnotationCategory | null => {
      if (annotation === 'pLoF') return 'pLoF'
      if (annotation === 'pLoF;missenseLC' || annotation === 'missenseLC' || annotation === 'missense') return 'missense'
      if (annotation === 'synonymous') return 'synonymous'
      return null
    }

    // Threshold for significance (p < 1e-4)
    const significanceThreshold = 1e-4

    // Check if p-value is significant
    const isSignificant = (pvalue: number | null | undefined): boolean => {
      return pvalue !== null && pvalue !== undefined && pvalue > 0 && pvalue < significanceThreshold
    }

    // Compute significance for each MAF and annotation
    const mafOptions: MafOption[] = [0.01, 0.001, 0.0001]
    const defaultAnnotSig: MafAnnotationSignificance = { pLoF: 'none', missense: 'none', synonymous: 'none' }
    const newSignificance: MafSignificanceMap = {
      0.01: { ...defaultAnnotSig },
      0.001: { ...defaultAnnotSig },
      0.0001: { ...defaultAnnotSig },
    }

    // Track burden test type significance per annotation category
    const defaultBurdenAnnotSig = { pLoF: 'none' as const, missense: 'none' as const, synonymous: 'none' as const }
    const newBurdenSig: BurdenTestSignificanceMap = {
      burden: { ...defaultBurdenAnnotSig },
      skat: { ...defaultBurdenAnnotSig },
      skato: { ...defaultBurdenAnnotSig },
    }

    // Best pvalue and MAF for auto-selection
    let bestPvalue = Infinity
    let bestMaf: MafOption = 0.001

    mafOptions.forEach((maf) => {
      const resultsForMaf = geneAssociationsForAncestry.filter((g) => g.max_maf === maf)

      resultsForMaf.forEach((r) => {
        const category = mapAnnotation(r.annotation)
        if (!category) return

        // Check if any p-value is significant
        const pvalues = [r.pvalue, r.pvalue_burden, r.pvalue_skat]
        const hasSignificantHit = pvalues.some(isSignificant)
        const minPvalue = Math.min(
          ...pvalues.filter((p): p is number => p !== null && p !== undefined && p > 0),
          Infinity
        )

        // Mark as hit if significant
        if (hasSignificantHit) {
          newSignificance[maf][category] = 'hit'
        }

        // Check each test type individually per annotation category
        if (isSignificant(r.pvalue_burden)) {
          newBurdenSig.burden[category] = 'hit'
        }
        if (isSignificant(r.pvalue_skat)) {
          newBurdenSig.skat[category] = 'hit'
        }
        if (isSignificant(r.pvalue)) {
          newBurdenSig.skato[category] = 'hit'
        }

        // Track best for auto-selection
        if (minPvalue < bestPvalue) {
          bestPvalue = minPvalue
          bestMaf = maf
        }
      })
    })

    setMafSignificance(newSignificance)
    setBurdenTestSignificance(newBurdenSig)

    // Auto-select the best MAF when gene changes (not on every re-render)
    const currentGeneKey = `${geneIdOrName}-${analysisId}-${ancestryGroup}`
    if (lastAutoSelectedGeneRef.current !== currentGeneKey && bestPvalue < Infinity) {
      lastAutoSelectedGeneRef.current = currentGeneKey
      setLocusMaf(bestMaf)
    }
  }, [geneAssociationsForAncestry, geneIdOrName, analysisId, ancestryGroup, setMafSignificance, setBurdenTestSignificance, setLocusMaf])

  return (
    <>
      {geneIdOrName && (
        <PrimaryAnalysisColumnPresetBridge
          analysisId={analysisId}
          traitType={singleAnalysisMetadata?.trait_type}
        />
      )}
      <LocusPageLayout
        geneModels={geneModels}
        geneAssociations={geneAssociations}
        analysisMetadata={singleAnalysisMetadata}
        ancestryGroup={ancestryGroup}
        variantDatasets={variantDatasets}
        variantId={variantId || "my-variant"}
        queryStates={queryStates}
        locusPlotData={locusPlotData}
        regionOverlay={regionOverlay}
        isLargeRegion={isLargeRegion}
        embedded={embedded}
        context={context}
      />
    </>
  )
}
