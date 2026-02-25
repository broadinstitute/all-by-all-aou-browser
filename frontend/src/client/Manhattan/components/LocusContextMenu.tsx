import React, { useEffect, useCallback } from 'react';

export interface LocusContextMenuProps {
  /** X position in viewport */
  x: number;
  /** Y position in viewport */
  y: number;
  /** Chromosome/contig */
  contig: string;
  /** Position in base pairs */
  position: number;
  /** Callback to close the menu */
  onClose: () => void;
}

/**
 * Context menu for locus cells and peak labels.
 * Provides options to open in new tab or copy coordinates.
 */
export const LocusContextMenu: React.FC<LocusContextMenuProps> = ({
  x,
  y,
  contig,
  position,
  onClose,
}) => {
  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    // Delay adding listener to avoid immediate close from the triggering right-click
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

  // Build locus URL with region ID (±500kb window) and hidden result layout
  const handleOpenInNewTab = useCallback(() => {
    const start = Math.max(0, position - 500000);
    const end = position + 500000;
    const regionId = `${contig}-${start}-${end}`;

    // Build URL from current location
    const url = new URL(window.location.href);
    url.searchParams.set('regionId', regionId);
    url.searchParams.set('resultLayout', 'hidden');

    window.open(url.toString(), '_blank');
    onClose();
  }, [contig, position, onClose]);

  // Copy coordinates to clipboard
  const handleCopyCoordinates = useCallback(() => {
    const coords = `${contig}:${position.toLocaleString()}`;
    navigator.clipboard.writeText(coords).then(() => {
      onClose();
    }).catch(() => {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = coords;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      onClose();
    });
  }, [contig, position, onClose]);

  // Prevent menu from going off-screen
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(x, window.innerWidth - 180),
    top: Math.min(y, window.innerHeight - 80),
    zIndex: 10000,
    background: '#fff',
    border: '1px solid #ddd',
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
    background: '#f5f5f5',
  };

  return (
    <div style={menuStyle} onClick={(e) => e.stopPropagation()}>
      <div
        style={menuItemStyle}
        onMouseEnter={(e) => Object.assign(e.currentTarget.style, menuItemHoverStyle)}
        onMouseLeave={(e) => (e.currentTarget.style.background = '')}
        onClick={handleOpenInNewTab}
      >
        <span style={{ width: 16 }}>↗</span>
        Open in new tab
      </div>
      <div
        style={menuItemStyle}
        onMouseEnter={(e) => Object.assign(e.currentTarget.style, menuItemHoverStyle)}
        onMouseLeave={(e) => (e.currentTarget.style.background = '')}
        onClick={handleCopyCoordinates}
      >
        <span style={{ width: 16 }}>📋</span>
        Copy coordinates
      </div>
    </div>
  );
};

export default LocusContextMenu;
