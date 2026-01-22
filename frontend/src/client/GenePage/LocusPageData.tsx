import { Button } from '@gnomad/ui'
import { useMemo } from 'react'
import { useRecoilState, useRecoilValue } from 'recoil'

import { axaouDevUrl, cacheEnabled, pouchDbName } from '../Query'
import {
  analysisIdAtom,
  ancestryGroupAtom,
  AncestryGroupCodes,
  geneIdAtom,
  regionIdAtom,
  selectedAnalyses,
  variantIdAtom,
} from '../sharedState'
import { StatusMessage } from '../UserInterface'

import { renderCountText } from '../PhenotypeList/Utils'

import { addVariantIdsToList, annotateWorstConsequence, genericMerge, processGeneBurden } from '../utils'

import { useQuery } from '@karaogram/kgui'
import {
  AnalysisMetadata,
  GeneAssociations,
  GeneModels,
  VariantAnnotations,
  VariantAssociations,
  VariantJoined,
  VariantDataset,
} from '../types'
import { LocusPageLayout } from './LocusPageLayout'

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
    throw new Error('Analysis metadata is not available.')
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

  const sequencingTypes = ["exomes", "genomes"];
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

  const sequencingTypes = ["exomes", "genomes"];

  const variantAssociationsGeneQueries = analyses.flatMap((analysisID) =>
    ['exomes'].map((seqType) => ({
      url: `${axaouDevUrl}/variants/associations/gene/${geneIdOrName}?ancestry_group=${ancestryGroup}&analysis_id=${analysisID}&sequencing_type=${seqType}`,
      name: `variantAssociations-${analysisID}-${seqType}-${ancestryGroup}`,
      queryMode: 'two_step',
      queryModeMinItems: 0
    }))
  );

  const variantAnnotationGeneQueries = sequencingTypes.map(seqType =>
  ({
    url: `${axaouDevUrl}/variants/annotations/gene/${geneIdOrName}?ancestry_group=${ancestryGroup}&sequencing_type=${seqType}`,
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

  const variantAnnotationRegionQueries = sequencingTypes.map(seqType =>
  ({
    url: `${axaouDevUrl}/variants/annotations/interval/chr${regionId}?ancestry_group=${ancestryGroup}&sequencing_type=${seqType}`,
    name: `variantAnnotations-${seqType}-${ancestryGroup}`,
  })
  )

  const regionQueries = [
    {
      url: `${axaouDevUrl}/genes/model/interval/chr${regionId}`,
      name: 'geneModels',
    },
    {
      url: `${axaouDevUrl}/genes/associations/interval/chr${regionId}?analysis_id=${analysisId}&ancestry_group=${ancestryGroup}&use_index=idx_gene_associations_hds_gene_id`,
      name: `geneAssociations`,
    },
    ...sequencingTypes.map((seqType) => ({
      url: `${axaouDevUrl}/variants/associations/interval/chr${regionId}?ancestry_group=${ancestryGroup}&analysis_id=${analysisId}&sequencing_type=${seqType}`,
      name: `variantAssociations-${analysisId}-${seqType}-${ancestryGroup}`,
      queryMode: 'two_step',
      queryModeMinItems: seqType == "genomes" ? 2000 : Infinity
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


  let geneAssociationsForAncestry: GeneAssociations[] = []
  if (geneIdOrName) {
    geneAssociationsForAncestry =
      geneAssociations?.filter((association) => association.ancestry_group === ancestryGroup) || []
  }


  if (!queryStates.geneAssociations.isLoading && geneIdOrName && !regionId) {
    if (!geneAssociationsForAncestry || geneAssociationsForAncestry.length === 0) {
      const availableAncestries: AncestryGroupCodes[] = geneAssociations
        ? [
          ...new Set(
            geneAssociations.map(
              (association) => association.ancestry_group as AncestryGroupCodes
            )
          ),
        ]
        : []

      const identifier = regionId || geneId
      return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <StatusMessage>
            No gene associations found between
            <strong>{identifier}</strong> and phenotype <strong>{analysisId}</strong>.
          </StatusMessage>
          {availableAncestries.length > 0 && (
            <div>
              <p> The association test may not have run because of *reasons*.</p>
              <p>
                Select an ancestry group where associations are found for this gene/phenotype pair:
              </p>
              <br />
              <br />
              {availableAncestries.map((ancestry) => (
                <Button key={ancestry} onClick={() => setAncestryGroup(ancestry)}>
                  {ancestry.toUpperCase()}
                </Button>
              ))}
            </div>
          )}
        </div>
      )
    }
  }

  return (
    <LocusPageLayout
      geneModels={geneModels}
      geneAssociations={geneAssociations}
      analysisMetadata={singleAnalysisMetadata}
      ancestryGroup={ancestryGroup}
      variantDatasets={variantDatasets}
      variantId={variantId || "my-variant"}
      queryStates={queryStates}
    />
  )
}
