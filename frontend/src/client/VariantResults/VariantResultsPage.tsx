import { useQuery } from '@axaou/ui'
import { useRecoilValue } from 'recoil'
import { reverseXPosition } from '../PhenotypeList/Utils'
import { axaouDevUrl, cacheEnabled, pouchDbName } from '../Query'
import { analysisIdAtom, ancestryGroupAtom, selectedContigAtom } from '../sharedState'
import { AnalysisMetadata, LocusAssociation, VariantAssociationManhattan, VariantAssociations, VariantDataset } from '../types'
import { HalfPage, Spinner } from '../UserInterface'
import { addVariantId } from '../utils'
import VariantsInPhenotype from './VariantsInPhenotype'

export const VariantResultsPage = () => {
  interface Data {
    variantAssociations: VariantAssociations[]
    analysisMetadata: AnalysisMetadata[]
    lociAssociations: LocusAssociation[]

  }

  const analysisId = useRecoilValue(analysisIdAtom)
  const ancestryGroup = useRecoilValue(ancestryGroupAtom)
  const contig = useRecoilValue(selectedContigAtom)

  const sequencingTypes = ["exomes", "genomes"];

  const queries = sequencingTypes.map((seqType) => ({
    url: `${axaouDevUrl}/variants/associations/manhattan/${analysisId}?ancestry_group=${ancestryGroup}&sequencing_type=${seqType}&contig=${contig}&max_results=50000`,
    name: `variantAssociations-${seqType}`,
  }))

  queries.push({
    url: `${axaouDevUrl}/variants/associations/loci/all?analysis_id=${analysisId}&ancestry_group=${ancestryGroup}`,
    name: 'lociAssociations',
  })

  queries.push({
    url: `${axaouDevUrl}/analyses/${analysisId}?ancestry_group=${ancestryGroup}&analysis_id=${analysisId}`,
    name: 'analysisMetadata',
  })


  const { queryStates, anyLoading } = useQuery<Data>({
    dbName: pouchDbName,
    queries,
    deps: [analysisId, ancestryGroup, contig],
    cacheEnabled,
  })

  const Container = HalfPage

  if (anyLoading()) {
    return (
      <Container>
        <Spinner />
      </Container>
    )
  }

  // @ts-expect-error
  const variantDatasets: VariantDataset[] = sequencingTypes.map((seqType) => {
    const variantAssociationsKey = `variantAssociations-${seqType}`;

    const variants: VariantAssociationManhattan[] = queryStates[variantAssociationsKey].data
      ? queryStates[variantAssociationsKey].data.map((v: VariantAssociations) => {
        const [chrom, pos] = reverseXPosition(v.xpos);
        return {
          variant_id: addVariantId({
            locus: { contig: chrom, position: pos },
            ref: v.ref,
            alt: v.alt,
          }),
          chrom,
          pos,
          pval: v.pvalue,
          gene_id: null,
          is_binned: false,
          ...v,
        };
      })
      : [];

    return {
      sequencingType: seqType,
      ancestryGroup: ancestryGroup,
      analysisId: analysisId,
      data: variants,
    }
  })

  if (!variantDatasets || variantDatasets.length === 0 || variantDatasets.every(ds => ds.data.length === 0)) {
    return <div>No variants found</div>;
  }

  return (
    <VariantsInPhenotype
      variantDatasets={variantDatasets}
      analysisMetadata={queryStates.analysisMetadata!.data![0]}
      ancestryGroup={ancestryGroup}
      locusData={
        queryStates.lociAssociations.data
          ? queryStates.lociAssociations.data.filter(
            (locus) => {
              if (contig !== "all") {
                return locus.contig === contig
              } else {
                return true
              }
            }
          )
          : []
      }
    />
  );

}

export default VariantResultsPage

