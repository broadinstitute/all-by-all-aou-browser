import React, { useEffect, useCallback } from 'react';
import { useSetRecoilState } from 'recoil';
import { geneIdAtom, regionIdAtom, resultIndexAtom, resultLayoutAtom } from '../../sharedState';

/** Gene info for context menu */
export interface ContextMenuGene {
  geneId: string;
  geneSymbol: string;
  /** Optional: burden annotation types (pLoF, missenseLC, etc) */
  burdenTypes?: string[];
  /** Optional: has coding variants */
  hasCoding?: boolean;
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
  };
  /** Single gene info (for backwards compatibility) */
  gene?: ContextMenuGene;
  /** Multiple genes with evidence (optional - shows each as separate item) */
  genes?: ContextMenuGene[];
  /** Callback to close the menu */
  onClose: () => void;
  /** Optional callback when navigating to locus in same tab */
  onLocusClick?: (contig: string, position: number) => void;
}

/**
 * Unified context menu for loci and genes.
 * Shows relevant options based on what info is provided.
 * Supports multiple implicated genes with individual menu items.
 */
export const LocusGeneContextMenu: React.FC<LocusGeneContextMenuProps> = ({
  x,
  y,
  locus,
  gene,
  genes,
  onClose,
  onLocusClick,
}) => {
  const setGeneId = useSetRecoilState(geneIdAtom);
  const setRegionId = useSetRecoilState(regionIdAtom);
  const setResultIndex = useSetRecoilState(resultIndexAtom);
  const setResultLayout = useSetRecoilState(resultLayoutAtom);

  // Combine single gene with genes array, deduplicated
  const allGenes: ContextMenuGene[] = [];
  if (genes && genes.length > 0) {
    allGenes.push(...genes);
  } else if (gene) {
    allGenes.push(gene);
  }

  // Close on click outside
  useEffect(() => {
    const handleClick = () => onClose();
    const handleKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClick);
      document.addEventListener('contextmenu', handleClick);
      document.addEventListener('keydown', handleKeyDown);
    }, 0);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClick);
      document.removeEventListener('contextmenu', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // === Locus handlers ===
  const handleViewLocus = useCallback(() => {
    if (locus && onLocusClick) {
      onLocusClick(locus.contig, locus.position);
    }
    onClose();
  }, [locus, onLocusClick, onClose]);

  const handleOpenLocusInNewTab = useCallback(() => {
    if (!locus) return;
    const start = Math.max(0, locus.position - 500000);
    const end = locus.position + 500000;
    const regionId = `${locus.contig}-${start}-${end}`;

    const url = new URL(window.location.href);
    const stateStr = url.searchParams.get('state');
    let stateObj: Record<string, unknown> = {};
    if (stateStr) {
      try {
        stateObj = JSON.parse(decodeURIComponent(stateStr));
      } catch (e) {
        try {
          stateObj = JSON.parse(stateStr);
        } catch (e2) {
          // Ignore parse errors
        }
      }
    }

    stateObj.regionId = regionId;
    stateObj.resultLayout = 'hidden';
    delete stateObj.geneId;
    delete stateObj.variantId;

    url.searchParams.set('state', JSON.stringify(stateObj));
    url.searchParams.delete('regionId');
    url.searchParams.delete('resultLayout');
    url.searchParams.delete('geneId');

    window.open(url.toString(), '_blank');
    onClose();
  }, [locus, onClose]);

  const handleCopyCoordinates = useCallback(() => {
    if (!locus) return;
    const coords = `${locus.contig}:${locus.position.toLocaleString()}`;
    navigator.clipboard.writeText(coords).then(() => onClose()).catch(() => onClose());
  }, [locus, onClose]);

  // === Gene handlers (parameterized for multiple genes) ===
  const openGenePheWAS = useCallback((g: ContextMenuGene) => {
    setGeneId(g.geneId);
    setRegionId(null);
    setResultIndex('gene-phewas');
    setResultLayout('half');
    onClose();
  }, [setGeneId, setRegionId, setResultIndex, setResultLayout, onClose]);

  const openGeneInNewTab = useCallback((g: ContextMenuGene) => {
    const url = new URL(window.location.href);
    const stateStr = url.searchParams.get('state');
    let stateObj: Record<string, unknown> = {};
    if (stateStr) {
      try {
        stateObj = JSON.parse(decodeURIComponent(stateStr));
      } catch (e) {
        try {
          stateObj = JSON.parse(stateStr);
        } catch (e2) {
          // Ignore parse errors
        }
      }
    }

    stateObj.geneId = g.geneId;
    stateObj.resultIndex = 'gene-phewas';
    stateObj.resultLayout = 'full';
    delete stateObj.regionId;
    delete stateObj.variantId;

    url.searchParams.set('state', JSON.stringify(stateObj));
    url.searchParams.delete('regionId');
    url.searchParams.delete('geneId');

    window.open(url.toString(), '_blank');
    onClose();
  }, [onClose]);

  // Prevent menu from going off-screen
  const menuHeight = 50 + allGenes.length * 60 + (locus ? 100 : 0);
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(x, window.innerWidth - 220),
    top: Math.min(y, window.innerHeight - Math.min(menuHeight, 400)),
    zIndex: 10000,
    background: 'var(--theme-surface, #fff)',
    color: 'var(--theme-text, #333)',
    border: '1px solid var(--theme-border, #ddd)',
    borderRadius: 4,
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    padding: '4px 0',
    minWidth: 200,
    maxHeight: 400,
    overflowY: 'auto',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 13,
  };

  const menuItemStyle: React.CSSProperties = {
    padding: '5px 12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };

  const sectionHeaderStyle: React.CSSProperties = {
    padding: '4px 12px 2px',
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--theme-text-muted, #888)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };

  const geneHeaderStyle: React.CSSProperties = {
    padding: '6px 12px 2px',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--theme-text, #333)',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  };

  const dividerStyle: React.CSSProperties = {
    height: 1,
    background: 'var(--theme-border, #eee)',
    margin: '4px 0',
  };

  const menuItemHoverStyle = {
    background: 'var(--theme-surface-alt, #f5f5f5)',
  };

  const hasLocus = !!locus;
  const hasGenes = allGenes.length > 0;

  return (
    <div style={menuStyle} onClick={(e) => e.stopPropagation()}>
      {/* Genes section */}
      {hasGenes && (
        <>
          <div style={sectionHeaderStyle}>
            {allGenes.length === 1 ? 'Gene' : `Genes (${allGenes.length})`}
          </div>
          {allGenes.map((g, idx) => (
            <React.Fragment key={g.geneId}>
              {/* Gene header with indicators */}
              <div style={geneHeaderStyle}>
                <span style={{ color: 'var(--theme-primary, #262262)' }}>{g.geneSymbol}</span>
                {/* Burden dots */}
                {g.burdenTypes?.includes('pLoF') && (
                  <span style={{ color: '#d32f2f' }} title="pLoF burden">●</span>
                )}
                {g.burdenTypes?.includes('missenseLC') && (
                  <span style={{ color: '#f9a825' }} title="Missense burden">●</span>
                )}
                {/* Coding indicator */}
                {g.hasCoding && (
                  <span style={{ fontSize: 10, color: '#262262' }}>(C)</span>
                )}
              </div>
              {/* Gene actions */}
              <div
                style={{ ...menuItemStyle, paddingLeft: 20 }}
                onMouseEnter={(e) => Object.assign(e.currentTarget.style, menuItemHoverStyle)}
                onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                onClick={() => openGenePheWAS(g)}
              >
                <span style={{ width: 14, fontSize: 12 }}>&#128202;</span>
                Open gene PheWAS
              </div>
              <div
                style={{ ...menuItemStyle, paddingLeft: 20 }}
                onMouseEnter={(e) => Object.assign(e.currentTarget.style, menuItemHoverStyle)}
                onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                onClick={() => openGeneInNewTab(g)}
              >
                <span style={{ width: 14, fontSize: 12 }}>&#8599;</span>
                Open in new tab
              </div>
              {/* Divider between genes (but not after the last one) */}
              {idx < allGenes.length - 1 && <div style={{ ...dividerStyle, margin: '2px 12px' }} />}
            </React.Fragment>
          ))}
        </>
      )}

      {/* Divider between genes and locus sections */}
      {hasGenes && hasLocus && <div style={dividerStyle} />}

      {/* Locus section */}
      {hasLocus && (
        <>
          <div style={sectionHeaderStyle}>Locus: {locus.contig}:{locus.position.toLocaleString()}</div>
          {onLocusClick && (
            <div
              style={menuItemStyle}
              onMouseEnter={(e) => Object.assign(e.currentTarget.style, menuItemHoverStyle)}
              onMouseLeave={(e) => (e.currentTarget.style.background = '')}
              onClick={handleViewLocus}
            >
              <span style={{ width: 16 }}>&#128269;</span>
              View locus
            </div>
          )}
          <div
            style={menuItemStyle}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, menuItemHoverStyle)}
            onMouseLeave={(e) => (e.currentTarget.style.background = '')}
            onClick={handleOpenLocusInNewTab}
          >
            <span style={{ width: 16 }}>&#8599;</span>
            Open locus in new tab
          </div>
          <div
            style={menuItemStyle}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, menuItemHoverStyle)}
            onMouseLeave={(e) => (e.currentTarget.style.background = '')}
            onClick={handleCopyCoordinates}
          >
            <span style={{ width: 16 }}>&#128203;</span>
            Copy coordinates
          </div>
        </>
      )}
    </div>
  );
};

export default LocusGeneContextMenu;
