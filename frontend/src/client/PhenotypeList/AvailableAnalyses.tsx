import React from 'react';
import { Grid } from '@karaogram/kgui';
import { useQuery } from '@karaogram/kgui';
import { axaouDevUrl, cacheEnabled, pouchDbName } from '../Query';
import { useSetRecoilState } from 'recoil';
import {
  analysisIdAtom,
  resultIndexAtom,
  resultLayoutAtom,
  ancestryGroupAtom,
  AncestryGroupCodes,
} from '../sharedState';
import { RightArrow } from '../UserInterface';
import { LoadedAnalysis } from '../types';



interface Data {
  availableAnalyses: LoadedAnalysis[];
}

const AvailableAnalyses: React.FC = () => {
  const setAnalysisId = useSetRecoilState(analysisIdAtom);
  const setResultIndex = useSetRecoilState(resultIndexAtom);
  const setResultsLayout = useSetRecoilState(resultLayoutAtom);
  const setAncestryGroup = useSetRecoilState(ancestryGroupAtom);

  const { queryStates, anyLoading } = useQuery<Data>({
    dbName: pouchDbName,
    queries: [
      {
        url: `${axaouDevUrl}/analyses-loaded`,
        name: 'availableAnalyses',
      },
    ],
    deps: [],
    cacheEnabled: true,
  });

  const availableAnalysesState = queryStates.availableAnalyses;

  if (!availableAnalysesState) {
    throw new Error('Query state for available analyses not found.');
  }

  const { data, error } = availableAnalysesState;

  console.log(data)

  const columns = [
    {
      key: 'analysis_id',
      heading: 'Analysis ID',
      isSortable: true,
      minWidth: 150,
    },
    {
      key: 'details',
      heading: 'Details',
      isSortable: false,
      minWidth: 250,
      render: (row: LoadedAnalysis) => {
        const details = row.details.map((detail) => {
          const seqAbbrev = detail.sequencing_type.startsWith('g') ? 'G' : 'E';
          return (
            <span
              style={{
                display: 'inline-block',
                padding: '4px 8px',
                margin: '2px',
                borderRadius: '12px',
                backgroundColor: '#f0f0f0',
                color: '#333',
                fontSize: '0.85em',
              }}
              key={`${seqAbbrev}-${detail.ancestry_group}`}
            >
              {`${seqAbbrev}-${detail.ancestry_group}`}
            </span>
          );
        });
        return <div>{details}</div>;
      },
    },
    {
      key: 'show',
      heading: 'Show',
      isSortable: false,
      minWidth: 80,
      render: (row: LoadedAnalysis) => {
        const handleClick = () => {
          setAnalysisId(row.analysis_id);
          // setAncestryGroup(row.ancestry_group as AncestryGroupCodes);
          setResultIndex('pheno-info');
          setResultsLayout('half');
        };

        return <RightArrow onClick={handleClick} />;
      },
    },
  ];

  if (anyLoading()) {
    return <div>Loading...</div>;
  }

  if (error) {
    console.log(`Failed to load analysis data: ${error.message}`);
    return <div>Error: Failed to load analysis data</div>;
  }

  if (!data) {
    return <div>No analyses available.</div>;
  }

  return (
    <Grid
      columns={columns}
      data={data}
      rowKey={(row: LoadedAnalysis) => row.analysis_id}
      numRowsRendered={20}
    />
  );
};

export default AvailableAnalyses;
