import React from 'react';
import { getChromosomeLayout } from '../layout';

interface ChromosomeLabelsProps {
  /** Width of the plot area in pixels */
  width: number;
  /** Height of the label strip */
  height?: number;
  /** Current contig view ('all' for genome-wide, or 'chr1'-'chrY') */
  contig?: string;
}

/**
 * Renders chromosome labels below the Manhattan plot.
 * For genome-wide view: shows all chromosome numbers (1-22, X)
 * For single chromosome: shows the chromosome name centered
 */
export const ChromosomeLabels: React.FC<ChromosomeLabelsProps> = ({
  width,
  height = 24,
  contig = 'all',
}) => {
  const layout = getChromosomeLayout(contig);

  if (width === 0) return null;

  return (
    <div
      className="manhattan-chrom-labels"
      style={{
        position: 'relative',
        width,
        height,
        marginTop: 4,
        fontSize: 11,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {layout.chromosomes.map((chrom) => {
        // Calculate center position for the label
        const centerNormalized = (chrom.startNormalized + chrom.endNormalized) / 2;
        const centerPx = centerNormalized * width;

        // For genome-wide view, skip label if chromosome is too narrow
        const chromWidthPx = (chrom.endNormalized - chrom.startNormalized) * width;
        if (contig === 'all' && chromWidthPx < 20) {
          // Only show labels for chromosomes wide enough to fit them
          // Skip 19, 20, 21, 22 which are narrow
          if (['19', '20', '21', '22'].includes(chrom.name)) {
            return null;
          }
        }

        return (
          <span
            key={chrom.name}
            className="manhattan-chrom-label"
            style={{
              position: 'absolute',
              left: centerPx,
              transform: 'translateX(-50%)',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              color: '#666',
            }}
          >
            {chrom.name}
          </span>
        );
      })}
    </div>
  );
};

export default ChromosomeLabels;
