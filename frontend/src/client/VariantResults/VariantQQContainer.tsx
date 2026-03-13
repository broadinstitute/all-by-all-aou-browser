import React from 'react';
import { useQuery } from '@axaou/ui';
import { useRecoilValue } from 'recoil';
import { withSize } from 'react-sizeme';
import styled from 'styled-components';

import { PrecomputedQQPlot } from './PrecomputedQQPlot';
import type { QQPoint } from './PrecomputedQQPlot';
import { axaouDevUrl, pouchDbName, cacheEnabled } from '../Query';
import { ancestryGroupAtom } from '../sharedState';

const Wrapper = styled.div`
  width: 100%;
  overflow: hidden;
`;

interface QQRow {
  pvalue_log10: number;
  pvalue_expected_log10: number;
  contig: string;
  position: number;
}

interface Props {
  analysisId: string;
  sequencingType: 'exomes' | 'genomes';
  size: { width: number };
}

const VariantQQContainerInner: React.FC<Props> = ({
  analysisId,
  sequencingType,
  size: { width },
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
    return null;
  }

  if (queryStates.qqData?.error || !queryStates.qqData?.data) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#666' }}>
        QQ plot data not available for this phenotype.
      </div>
    );
  }

  const points: QQPoint[] = queryStates.qqData.data.map((row) => ({
    x: row.pvalue_expected_log10,
    y: row.pvalue_log10,
  }));

  const plotWidth = width || 600;
  const plotHeight = Math.min(Math.round(plotWidth * 0.85), 400);

  return (
    <Wrapper>
      <PrecomputedQQPlot
        points={points}
        width={plotWidth}
        height={plotHeight}
      />
    </Wrapper>
  );
};

export const VariantQQContainer = withSize()(VariantQQContainerInner);
