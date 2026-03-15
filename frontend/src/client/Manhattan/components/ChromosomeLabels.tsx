import React from 'react';
import { getChromosomeLayout } from '../layout';

export interface ChromosomeLabelsProps {
  /** Width of the plot area in pixels */
  width: number;
  /** Height of the label strip */
  height?: number;
  /** Current contig view ('all' for genome-wide, or 'chr1'-'chrY') */
  contig?: string;
  /** Callback when a chromosome label is clicked */
  onContigClick?: (contig: string) => void;
  /** Normalized x range for viewport zoom (default: { min: 0, max: 1 }) */
  xRange?: { min: number; max: number };
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
  onContigClick,
  xRange = { min: 0, max: 1 },
}) => {
  const layout = getChromosomeLayout(contig);

  if (width === 0) return null;

  const xSpan = xRange.max - xRange.min;

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
        overflow: 'hidden',
      }}
    >
      {layout.chromosomes.map((chrom) => {
        // Map normalized positions through viewport xRange
        const centerNormalized = (chrom.startNormalized + chrom.endNormalized) / 2;
        const centerView = (centerNormalized - xRange.min) / xSpan;
        const centerPx = centerView * width;

        // Skip labels that are outside the visible range
        if (centerPx < -20 || centerPx > width + 20) return null;

        // Calculate visible width of this chromosome in pixels
        const chromStartView = (chrom.startNormalized - xRange.min) / xSpan;
        const chromEndView = (chrom.endNormalized - xRange.min) / xSpan;
        const chromWidthPx = (chromEndView - chromStartView) * width;

        // Skip labels for chromosomes too narrow to fit
        if (contig === 'all' && chromWidthPx < 20) {
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
              cursor: onContigClick && contig === 'all' ? 'pointer' : 'default',
            }}
            onClick={() => {
              if (onContigClick && contig === 'all') {
                onContigClick(`chr${chrom.name}`);
              }
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
