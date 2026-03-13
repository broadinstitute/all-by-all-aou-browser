import React from 'react';
import { useQuery } from '@axaou/ui';
import { useRecoilValue } from 'recoil';

import { PrecomputedQQPlot } from './PrecomputedQQPlot';
import type { QQPoint } from './PrecomputedQQPlot';
import { axaouDevUrl, pouchDbName, cacheEnabled } from '../Query';
import { ancestryGroupAtom } from '../sharedState';

interface QQRow {
  pvalue_log10: number;
  pvalue_expected_log10: number;
  contig: string;
  position: number;
}

interface Props {
  analysisId: string;
  sequencingType: 'exomes' | 'genomes';
}

export const PrecomputedQQMini: React.FC<Props> = ({
  analysisId,
  sequencingType,
}) => {
  const ancestryGroup = useRecoilValue(ancestryGroupAtom);

  interface Data {
    qqData: QQRow[] | null;
  }

  const { queryStates, anyLoading } = useQuery<Data>({
    dbName: pouchDbName,
    queries: [
      {
        url: `${axaouDevUrl}/phenotype/${analysisId}/qq?ancestry=${ancestryGroup}&sequencing_type=${sequencingType}`,
        name: 'qqData',
      },
    ],
    deps: [analysisId, ancestryGroup, sequencingType],
    cacheEnabled,
  });

  if (anyLoading()) {
    return (
      <div style={{ width: 200, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: 11 }}>
        Loading QQ...
      </div>
    );
  }

  if (queryStates.qqData?.error || !queryStates.qqData?.data) {
    return null;
  }

  const points: QQPoint[] = queryStates.qqData.data.map((row) => ({
    x: row.pvalue_expected_log10,
    y: row.pvalue_log10,
  }));

  return (
    <PrecomputedQQPlot
      points={points}
      width={200}
      height={180}
    />
  );
};
