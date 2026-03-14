import React, { useEffect, useCallback } from 'react';
import { useAppNavigation } from '../../hooks/useAppNavigation';

export interface GeneContextMenuProps {
  /** X position in viewport */
  x: number;
  /** Y position in viewport */
  y: number;
  /** Gene ID (e.g. ENSG...) */
  geneId: string;
  /** Gene symbol */
  geneSymbol: string;
  /** Callback to close the menu */
  onClose: () => void;
}

/**
 * Context menu for genes in tables.
 * Provides options to open PheWAS, open in a new tab, or copy symbol.
 */
export const GeneContextMenu: React.FC<GeneContextMenuProps> = ({
  x,
  y,
  geneId,
  geneSymbol,
  onClose,
}) => {
  const { goToGene, openInNewTab } = useAppNavigation();

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

  const handleOpenPheWAS = useCallback(() => {
    goToGene(geneId, { resultIndex: 'gene-phewas' });
    onClose();
  }, [geneId, goToGene, onClose]);

  const handleOpenInNewTab = useCallback(() => {
    openInNewTab({
      geneId,
      resultIndex: 'gene-phewas',
      resultLayout: 'split',
      regionId: null,
      variantId: null,
    });
    onClose();
  }, [geneId, openInNewTab, onClose]);

  const handleCopyGeneSymbol = useCallback(() => {
    navigator.clipboard.writeText(geneSymbol).then(() => onClose()).catch(() => onClose());
  }, [geneSymbol, onClose]);

  // Prevent menu from going off-screen
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(x, window.innerWidth - 180),
    top: Math.min(y, window.innerHeight - 120),
    zIndex: 10000,
    background: 'var(--theme-surface, #fff)',
    color: 'var(--theme-text, #333)',
    border: '1px solid var(--theme-border, #ddd)',
    borderRadius: 4,
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    padding: '4px 0',
    minWidth: 160,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 13,
  };

  const menuItemStyle: React.CSSProperties = {
    padding: '6px 12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };

  const menuItemHoverStyle = {
    background: 'var(--theme-surface-alt, #f5f5f5)',
  };

  return (
    <div style={menuStyle} onClick={(e) => e.stopPropagation()}>
      <div
        style={menuItemStyle}
        onMouseEnter={(e) => Object.assign(e.currentTarget.style, menuItemHoverStyle)}
        onMouseLeave={(e) => (e.currentTarget.style.background = '')}
        onClick={handleOpenPheWAS}
      >
        <span style={{ width: 16 }}>&#128202;</span>
        Open PheWAS
      </div>
      <div
        style={menuItemStyle}
        onMouseEnter={(e) => Object.assign(e.currentTarget.style, menuItemHoverStyle)}
        onMouseLeave={(e) => (e.currentTarget.style.background = '')}
        onClick={handleOpenInNewTab}
      >
        <span style={{ width: 16 }}>&#8599;</span>
        Open in new tab
      </div>
      <div
        style={menuItemStyle}
        onMouseEnter={(e) => Object.assign(e.currentTarget.style, menuItemHoverStyle)}
        onMouseLeave={(e) => (e.currentTarget.style.background = '')}
        onClick={handleCopyGeneSymbol}
      >
        <span style={{ width: 16 }}>&#128203;</span>
        Copy gene symbol
      </div>
    </div>
  );
};

export default GeneContextMenu;
