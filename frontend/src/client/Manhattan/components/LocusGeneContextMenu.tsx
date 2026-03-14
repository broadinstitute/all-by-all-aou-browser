import React from 'react';
import { UnifiedContextMenu, ContextMenuSection } from '../../components/UnifiedContextMenu';
import { useContextMenuNavigation, FOCUS_LOCUS, FOCUS_REGION } from '../../hooks/useContextMenuNavigation';

/** Gene info for context menu */
export interface ContextMenuGene {
  geneId: string;
  geneSymbol: string;
  /** Optional: burden annotation types (pLoF, missenseLC, etc) */
  burdenTypes?: string[];
  /** Optional: has coding variants */
  hasCoding?: boolean;
  /** Optional: genomic position for creating locus region */
  contig?: string;
  start?: number;
  stop?: number;
}

export interface LocusGeneContextMenuProps {
  /** X position in viewport */
  x: number;
  /** Y position in viewport */
  y: number;
  /** Locus info (optional - if provided, show locus options) */
  locus?: {
    contig: string;
    position: number;
    start?: number;
    stop?: number;
  };
  /** Single gene info (for backwards compatibility) */
  gene?: ContextMenuGene;
  /** Multiple genes with evidence (optional - shows each as separate section) */
  genes?: ContextMenuGene[];
  /** Callback to close the menu */
  onClose: () => void;
  /** Optional callback when navigating to locus in same tab */
  onLocusClick?: (contig: string, position: number, start?: number, stop?: number) => void;
  /** Optional current phenotype description for contextual Manhattan view */
  currentPhenotypeDescription?: string;
}

/**
 * Unified context menu for loci and genes.
 * Shows relevant options based on what info is provided.
 * Supports multiple implicated genes with individual sections.
 */
export const LocusGeneContextMenu: React.FC<LocusGeneContextMenuProps> = ({
  x,
  y,
  locus,
  gene,
  genes,
  onClose,
  onLocusClick,
  currentPhenotypeDescription,
}) => {
  const navigate = useContextMenuNavigation();

  // Combine single gene with genes array
  const allGenes: ContextMenuGene[] = [];
  if (genes && genes.length > 0) {
    allGenes.push(...genes);
  } else if (gene) {
    allGenes.push(gene);
  }

  // Build sections for the menu
  const sections: ContextMenuSection[] = [];

  // Add gene sections - one per gene for multi-gene loci, or combined for single gene
  if (allGenes.length === 1) {
    const g = allGenes[0];

    // Build title with evidence indicators
    const titleParts = [`GENE: ${g.geneSymbol}`];
    const indicators: React.ReactNode[] = [];

    if (g.burdenTypes?.includes('pLoF')) {
      indicators.push(<span key="plof" style={{ color: '#d32f2f', marginLeft: 4 }}>●</span>);
    }
    if (g.burdenTypes?.includes('missenseLC')) {
      indicators.push(<span key="miss" style={{ color: '#f9a825', marginLeft: 4 }}>●</span>);
    }
    if (g.hasCoding) {
      indicators.push(<span key="coding" style={{ fontSize: 10, marginLeft: 4 }}>(C)</span>);
    }

    const geneLocusId = g.contig && g.start && g.stop
      ? `${g.contig}-${Math.max(0, g.start - 500000)}-${g.stop + 500000}`
      : null;

    const geneTargets: any[] = [
      { label: 'Gene PheWAS', resultIndex: 'gene-phewas' },
      { label: 'Gene Page', resultIndex: FOCUS_LOCUS },
      { label: 'Gene Region', resultIndex: FOCUS_REGION }
    ];

    if (geneLocusId) {
      geneTargets.push({ label: 'Gene Locus', resultIndex: 'locus-phewas' });
    }

    geneTargets.push({
      label: 'Copy Gene Symbol',
      icon: '📋',
      onClick: () => {
        navigator.clipboard.writeText(g.geneSymbol);
        onClose();
      }
    });

    sections.push({ targets: geneTargets });

    // Store gene info for navigation
    sections[0]._geneId = g.geneId;
    sections[0]._geneLocusId = geneLocusId;

  } else if (allGenes.length > 1) {
    // Multi-gene: show simplified per-gene options
    allGenes.forEach((g) => {
      const title = g.geneSymbol;
      const indicators: string[] = [];

      if (g.burdenTypes?.includes('pLoF')) indicators.push('●');
      if (g.burdenTypes?.includes('missenseLC')) indicators.push('●');
      if (g.hasCoding) indicators.push('(C)');

      sections.push({
        label: `${title} ${indicators.join(' ')}`,
        targets: [
          { label: 'Gene PheWAS', resultIndex: 'gene-phewas' },
          { label: 'Gene Page', resultIndex: FOCUS_LOCUS }
        ],
        _geneId: g.geneId
      } as any);
    });
  }

  // Add locus section if provided
  if (locus) {
    const locusStart = locus.start ?? Math.max(0, locus.position - 500000);
    const locusStop = locus.stop ?? (locus.position + 500000);
    const locusId = `${locus.contig}-${locusStart}-${locusStop}`;
    sections.push({
      label: `Locus: ${locus.contig}:${locus.position.toLocaleString()}`,
      targets: [
        { label: 'Locus View', resultIndex: 'locus-phewas' }
      ],
      _locusId: locusId
    } as any);
  }

  // Add phenotype section if provided
  if (currentPhenotypeDescription) {
    sections.push({
      label: `Current Phenotype: ${currentPhenotypeDescription}`,
      targets: [
        { label: 'Phenotype Results', resultIndex: 'pheno-info' }
      ]
    });
  }

  // Build title
  let title: React.ReactNode = '';
  if (allGenes.length === 1) {
    const g = allGenes[0];
    title = (
      <>
        GENE: {g.geneSymbol}
        {g.burdenTypes?.includes('pLoF') && <span style={{ color: '#d32f2f', marginLeft: 4 }}>●</span>}
        {g.burdenTypes?.includes('missenseLC') && <span style={{ color: '#f9a825', marginLeft: 4 }}>●</span>}
        {g.hasCoding && <span style={{ fontSize: 10, marginLeft: 4 }}>(C)</span>}
      </>
    );
  } else if (locus) {
    title = `LOCUS: ${locus.contig}:${locus.position.toLocaleString()}`;
  } else if (allGenes.length > 1) {
    title = `${allGenes.length} GENES`;
  }

  return (
    <UnifiedContextMenu
      x={x}
      y={y}
      title={title}
      sections={sections}
      onNavigate={(mode, target) => {
        // Find which section this target belongs to
        let targetGeneId: string | undefined;
        let targetLocusId: string | undefined;

        for (const section of sections) {
          const sec = section as any;
          if (sec.targets.some((t: any) => t.resultIndex === target)) {
            targetGeneId = sec._geneId;
            targetLocusId = sec._locusId;
            break;
          }
        }

        // Check first section for single-gene case
        const firstSection = sections[0] as any;

        if (target === 'locus-phewas') {
          // Locus navigation
          const locusId = targetLocusId || firstSection?._geneLocusId;
          if (locusId) {
            navigate('locus', locusId, mode, target, false);
          }
        } else if (target === FOCUS_REGION) {
          // Gene Region - don't change entity
          navigate('gene', '', mode, target, false);
        } else if (target === 'pheno-info') {
          // Preserve analysis when navigating to phenotype
          const geneId = targetGeneId || firstSection?._geneId || allGenes[0]?.geneId;
          navigate('gene', geneId || '', mode, target, true);
        } else {
          // Regular gene navigation
          const geneId = targetGeneId || firstSection?._geneId || allGenes[0]?.geneId;
          navigate('gene', geneId || '', mode, target, false);
        }
        onClose();
      }}
      onClose={onClose}
    />
  );
};

export default LocusGeneContextMenu;
