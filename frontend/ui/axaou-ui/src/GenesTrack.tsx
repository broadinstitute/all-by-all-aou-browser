import React from 'react';
import styled from 'styled-components';

import type { ScalePosition } from './RegionViewer/coordinates';

import type { GeneModel } from '@axaou/types';

const GeneName = styled.text`
  fill: #428bca;

  &:hover {
    fill: #be4248;
    cursor: pointer;
  }
`;

const TestElem = styled.div<{ width: number }>`
  width: ${(props) => props.width}px;
`;

const GeneTrackWrapper = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  align-items: center;
`;

const layoutRows = (genes: GeneModel[] | [], scalePosition: ScalePosition) => {
  if (genes.length === 0) {
    return [];
  }

  const sortedGenes = [...genes].sort(
    (gene1, gene2) => gene1.start - gene2.start
  );

  const rows = [[sortedGenes[0]]];

  for (let i = 1; i < sortedGenes.length; i += 1) {
    const gene = sortedGenes[i];

    let newRow = true;
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const lastGeneInRow = rows[rowIndex][rows[rowIndex].length - 1];
      if (scalePosition(gene.start) - scalePosition(lastGeneInRow.stop) > 60) {
        rows[rowIndex].push(gene);
        newRow = false;
        break;
      }
    }

    if (newRow) {
      rows.push([gene]);
    }
  }

  return rows;
};

type GeneTrackProps = {
  genes: GeneModel[] | [];
  onGeneClick: (gene: GeneModel) => void;
  scalePosition?: ScalePosition;
  leftPanelWidth: number;
  rightPanelWidth: number;
  width: number;
  title: string;
  geneBurdenMap?: Record<string, string[]>;
};

export const GenesTrack = ({
  genes,
  onGeneClick,
  scalePosition,
  leftPanelWidth,
  rightPanelWidth,
  width,
  geneBurdenMap,
}: GeneTrackProps) => {
  if (!scalePosition) {
    return <p>Need scalePosition</p>;
  }

  const rows = layoutRows(
    genes.filter((gene) =>
      gene.exons.some((exon) => exon.feature_type === 'CDS')
    ),
    scalePosition
  );
  const rowHeight = 30;

  // Helper function to estimate text width (rough approximation)
  // Average character width in pixels for the gene label font
  const estimateTextWidth = (text: string): number => {
    // Using approximate width based on typical sans-serif font metrics
    // Uppercase letters ~9px, lowercase ~7px on average
    let width = 0;
    for (const char of text) {
      if (char === char.toUpperCase() && char !== char.toLowerCase()) {
        width += 9; // Uppercase letter
      } else if (char >= '0' && char <= '9') {
        width += 8; // Number
      } else {
        width += 7; // Lowercase or other
      }
    }
    return width;
  };

  return (
    <GeneTrackWrapper>
      <TestElem width={leftPanelWidth}>
        <p>
          <strong>Genes</strong>
        </p>
      </TestElem>
      <svg height={rowHeight * rows.length} width={width}>
        {rows.map((track, trackNumber) =>
          track.map((gene) => {
            const textYPosition = rowHeight * 0.66 + rowHeight * trackNumber;
            const exonsYPosition = rowHeight * 0.16 + rowHeight * trackNumber;
            const geneStart = scalePosition(gene.start);
            const geneStop = scalePosition(gene.stop);
            return (
              <g key={gene.gene_id}>
                <g>
                  <GeneName
                    x={(geneStop + geneStart) / 2 - 5}
                    y={textYPosition + 3}
                    onClick={() => onGeneClick(gene)}
                  >
                    {gene.symbol}
                  </GeneName>
                  {geneBurdenMap && geneBurdenMap[gene.gene_id] && (() => {
                    // Calculate proper positioning for burden circles
                    const textWidth = estimateTextWidth(gene.symbol);
                    const textStartX = (geneStop + geneStart) / 2 - 5;
                    const circleDiameter = 8; // radius 4 * 2
                    const circleSpacing = 3; // space between circles
                    const textPadding = 8; // space between text and first circle

                    // Start circles after the text with padding
                    const firstCircleX = textStartX + textWidth + textPadding;

                    const hasPLoF = geneBurdenMap[gene.gene_id].includes('pLoF');
                    const hasMissense = geneBurdenMap[gene.gene_id].includes('missenseLC');
                    const hasSynonymous = geneBurdenMap[gene.gene_id].includes('synonymous');

                    // Calculate x positions for each circle
                    let currentX = 0;
                    const pLofX = currentX;
                    if (hasPLoF) currentX += circleDiameter + circleSpacing;

                    const missenseX = currentX;
                    if (hasMissense) currentX += circleDiameter + circleSpacing;

                    const synonymousX = currentX;

                    return (
                      <g transform={`translate(${firstCircleX}, ${textYPosition - 1})`}>
                        {hasPLoF && (
                          <circle cx={pLofX} cy={0} r={4} fill="#c62828" />
                        )}
                        {hasMissense && (
                          <circle cx={missenseX} cy={0} r={4} fill="#f57c00" />
                        )}
                        {hasSynonymous && (
                          <circle cx={synonymousX} cy={0} r={4} fill="grey" />
                        )}
                      </g>
                    );
                  })()}
                </g>
                <line
                  x1={geneStart}
                  x2={geneStop}
                  y1={exonsYPosition}
                  y2={exonsYPosition}
                  stroke='#424242'
                  strokeWidth={1}
                />
                {gene.exons
                  .filter((exon) => exon.feature_type === 'CDS')
                  .map((exon) => {
                    const exonStart = scalePosition(exon.start);
                    const exonStop = scalePosition(exon.stop);
                    return (
                      <rect
                        key={`${gene.gene_id}-${exon.start}-${exon.stop}`}
                        x={exonStart}
                        y={rowHeight * trackNumber}
                        width={exonStop - exonStart}
                        height={rowHeight * 0.33}
                        fill='#424242'
                        stroke='#424242'
                      />
                    );
                  })}
              </g>
            );
          })
        )}
      </svg>
      <TestElem width={rightPanelWidth} />
    </GeneTrackWrapper>
  );
};
