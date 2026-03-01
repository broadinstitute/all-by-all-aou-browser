import { Button } from '@gnomad/ui'
import { useMemo, useState, useEffect, useRef } from 'react'
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil'

import { axaouDevUrl, cacheEnabled, pouchDbName } from '../Query'
import {
  analysisIdAtom,
  ancestryGroupAtom,
  AncestryGroupCodes,
  geneIdAtom,
  regionIdAtom,
  selectedAnalyses,
  variantIdAtom,
  locusMafAtom,
  MafOption,
  mafSignificanceAtom,
  MafSignificance,
  MafSignificanceMap,
  AnnotationCategory,
  MafAnnotationSignificance,
} from '../sharedState'
import { StatusMessage } from '../UserInterface'

import { renderCountText } from '../PhenotypeList/Utils'

import { addVariantIdsToList, annotateWorstConsequence, genericMerge, processGeneBurden } from '../utils'

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
} from '../types'
import { LocusPageLayout } from './LocusPageLayout'

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

const filterByVariantId =
  (variantId: string | undefined | null) =>
    (v: VariantJoined): boolean => {
      return variantId ? v.variant_id === variantId : true
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

        let variantsMerged = genericMerge(variantAnnotationsWithId, associationsWithId, {
          keys: ['variant_id'],
          joinType: 'outer',
        }) as VariantJoined[];


        const data = variantsMerged
          .filter(filterByVariantId(variantId))
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
  );
}
export const LocusPageDataContainer = () => {
  interface Data {
    geneModels: GeneModels[]
    geneAssociations: GeneAssociations[]
    analysesMetadata: AnalysisMetadata[]
    variantAnnotations: VariantAnnotations[]
    variantAssociations: VariantAssociations[]
    [key: string]: any
  }

  const regionId = useRecoilValue(regionIdAtom)
  const variantId = useRecoilValue(variantIdAtom)
  const geneId = useRecoilValue(geneIdAtom)
  const analysisId = useRecoilValue(analysisIdAtom)

  if (!analysisId) {
    throw Error('kjsdlkfj')
  }

  const selectedAnalysesList = useRecoilValue(selectedAnalyses)

  const analyses = selectedAnalysesList.length === 0 ? [analysisId] : selectedAnalysesList

  const geneIdOrName = geneId

  const [ancestryGroup, setAncestryGroup] = useRecoilState(ancestryGroupAtom)

  let queries = [
    {
      url: `${axaouDevUrl}/analyses?ancestry_group=${ancestryGroup}`,
      name: 'analysesMetadata',
    },
  ]

  const sequencingTypes = ["exome", "genome"];

  const variantAssociationsGeneQueries = analyses.flatMap((analysisID) =>
    ['exome'].map((seqType) => ({
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
      url: `${axaouDevUrl}/genes/associations?gene_id=${geneIdOrName}&analysis_id=${analysisId}&ancestry_group=${ancestryGroup}&use_index=idx_gene_associations_hds_gene_id`,
      name: 'geneAssociations',
    },
  ]

  geneQueries = [...geneQueries, ...variantAssociationsGeneQueries, ...variantAnnotationGeneQueries]

  // Format regionId for API: "19-32216732-34497056" -> "19:32216732-34497056"
  const apiRegionId = regionId ? formatRegionIdForApi(regionId) : ''

  const variantAnnotationRegionQueries = sequencingTypes.map(seqType =>
  ({
    url: `${axaouDevUrl}/variants/annotations/interval/chr${apiRegionId}?ancestry_group=${ancestryGroup}&sequencing_type=${seqType}&extended=true`,
    name: `variantAnnotations-${seqType}-${ancestryGroup}`,
  })
  )

  const regionQueries = [
    {
      url: `${axaouDevUrl}/genes/model/interval/chr${apiRegionId}`,
      name: 'geneModels',
    },
    {
      url: `${axaouDevUrl}/genes/associations/interval/chr${apiRegionId}?analysis_id=${analysisId}&ancestry_group=${ancestryGroup}&use_index=idx_gene_associations_hds_gene_id`,
      name: `geneAssociations`,
    },
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
  } else {
    queries = [...queries, ...geneQueries]
  }

  const { queryStates: allQueryState } = useQuery<Data>({
    dbName: pouchDbName,
    queries,
    deps: [geneIdOrName, analysisId, selectedAnalysesList, regionId, ancestryGroup],
    cacheEnabled,
  })

  const queryStates = allQueryState


  const analysesMetadata = queryStates.analysesMetadata.data

  const variantDatasets = useMemo(() => {
    let datasets: VariantDataset[] = []
    datasets = processVariants({
      analysisId,
      analyses,
      analysesMetadata,
      queryStates,
    });

    return datasets
  }, [geneId, regionId, selectedAnalysesList, analysisId, analysesMetadata, queryStates, ancestryGroup]);

  const geneModels = queryStates.geneModels.data || []

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

        // Track best for auto-selection
        if (minPvalue < bestPvalue) {
          bestPvalue = minPvalue
          bestMaf = maf
        }
      })
    })

    setMafSignificance(newSignificance)

    // Auto-select the best MAF when gene changes (not on every re-render)
    const currentGeneKey = `${geneIdOrName}-${analysisId}-${ancestryGroup}`
    if (lastAutoSelectedGeneRef.current !== currentGeneKey && bestPvalue < Infinity) {
      lastAutoSelectedGeneRef.current = currentGeneKey
      setLocusMaf(bestMaf)
    }
  }, [geneAssociationsForAncestry, geneIdOrName, analysisId, ancestryGroup, setMafSignificance, setLocusMaf])

  return (
    <LocusPageLayout
      geneModels={geneModels}
      geneAssociations={geneAssociations}
      analysisMetadata={singleAnalysisMetadata}
      ancestryGroup={ancestryGroup}
      variantDatasets={variantDatasets}
      variantId={variantId || "my-variant"}
      queryStates={queryStates}
      locusPlotData={locusPlotData}
    />
  )
}
