import React from 'react';
import { Grid } from '@axaou/ui';
import { LocusAssociation } from '../types';
import { RightArrow } from '../UserInterface';
import { renderPvalueCell } from '../PhenotypeList/Utils';
import { useAppNavigation } from '../hooks/useAppNavigation';

interface VariantLocusTableProps {
  data: LocusAssociation[];
}

export const VariantLocusTable: React.FC<VariantLocusTableProps> = ({ data }) => {
  const columns = [
    {
      key: 'contig',
      heading: 'Chromosome',
      isSortable: true,
      minWidth: 100,
    },
    // {
    //   key: 'start',
    //   heading: 'Start',
    //   isSortable: true,
    //   minWidth: 100,
    // },
    // {
    //   key: 'stop',
    //   heading: 'Stop',
    //   isSortable: true,
    //   minWidth: 100,
    // },
    {
      key: 'region_id',
      heading: 'Region ID',
      isSortable: true,
      minWidth: 150,
    },
    {
      key: 'lead_variant_id',
      heading: 'Lead Variant ID',
      isSortable: true,
      minWidth: 150,
    },
    {
      key: 'n_snps',
      heading: 'Number of SNPs',
      isSortable: true,
      minWidth: 100,
    },
    {
      key: 'min_pvalue',
      heading: 'Min P-value',
      isSortable: true,
      minWidth: 100,
      render: renderPvalueCell('locus'),
    },
    {
      key: 'show',
      heading: 'Show',
      isSortable: false,
      minWidth: 80,
      render: (locus: LocusAssociation) => {
        const { goToLocus } = useAppNavigation()

        const handleClick = () => {
          const regionId = locus.region_id.replace(":", "-").replace("chr", "")
          goToLocus(regionId, { fromPhenotype: true })
        }

        return (
          <RightArrow
            onClick={handleClick}
          />
        )
      },
    },
  ];

  return (
    <Grid
      columns={columns}
      data={data}
      rowKey={(row: LocusAssociation) => row.region_id}
      numRowsRendered={14}
    />
  );
};

export default VariantLocusTable;

