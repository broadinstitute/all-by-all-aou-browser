import React, { useEffect } from 'react';
import styled from 'styled-components';
import { NavMode } from '../hooks/useContextMenuNavigation';

const MenuStyle = styled.div<{ x: number; y: number }>`
  position: fixed;
  left: ${({ x }) => Math.min(x, window.innerWidth - 300)}px;
  top: ${({ y }) => Math.min(y, window.innerHeight - 200)}px;
  z-index: 10000;
  background: var(--theme-surface, #fff);
  color: var(--theme-text, #333);
  border: 1px solid var(--theme-border, #ddd);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  padding: 8px 0;
  min-width: 280px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
`;

const Header = styled.div`
  padding: 4px 16px 8px;
  font-weight: 600;
  border-bottom: 1px solid var(--theme-border, #eee);
  margin-bottom: 4px;
  color: var(--theme-primary, #262262);
  font-size: 12px;
`;

const MatrixTable = styled.table`
  width: 100%;
  border-collapse: collapse;

  th {
    font-size: 10px;
    color: var(--theme-text-muted, #888);
    font-weight: 500;
    padding: 4px 8px;
    text-align: center;
  }

  td {
    padding: 2px 4px;
    text-align: center;
  }

  td:first-child {
    text-align: left;
    padding: 6px 16px;
    font-weight: 500;
  }
`;

const ActionBtn = styled.button`
  width: 100%;
  height: 100%;
  padding: 4px 0;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--theme-text, #333);
  border-radius: 4px;
  font-size: 14px;

  &:hover {
    background: var(--theme-surface-alt, #e8e8e8);
  }
`;

const UtilityAction = styled.div`
  padding: 6px 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  border-top: 1px solid var(--theme-border, #eee);
  margin-top: 4px;

  &:hover {
    background: var(--theme-surface-alt, #f5f5f5);
  }
`;

const SectionHeader = styled.div`
  padding: 8px 16px 4px;
  font-size: 10px;
  font-weight: 600;
  color: var(--theme-text-muted, #888);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-top: 1px solid var(--theme-border, #eee);
  margin-top: 4px;
`;

const UtilityRow = styled.div`
  padding: 6px 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;

  &:hover {
    background: var(--theme-surface-alt, #f5f5f5);
  }
`;

export interface ContextMenuTarget {
  label: string;
  resultIndex?: any;
  // Optional: custom action instead of navigation (e.g., for copy actions)
  onClick?: () => void;
  // Optional: icon to show before the label
  icon?: string;
}

export interface ContextMenuSection {
  label?: string; // Optional section header
  targets: ContextMenuTarget[];
}

export interface UnifiedContextMenuProps {
  x: number;
  y: number;
  title: React.ReactNode;
  // Support both old (flat array) and new (sections) format
  targets?: ContextMenuTarget[];
  sections?: ContextMenuSection[];
  onNavigate: (mode: NavMode, targetIndex: any) => void;
  onCopy?: () => void;
  copyLabel?: string;
  onClose: () => void;
}

export const UnifiedContextMenu: React.FC<UnifiedContextMenuProps> = ({
  x, y, title, targets, sections, onNavigate, onCopy, copyLabel = "Copy ID", onClose
}) => {
  useEffect(() => {
    const handleClick = () => onClose();
    const handleKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClick);
      document.addEventListener('contextmenu', handleClick);
      document.addEventListener('keydown', handleKey);
    }, 0);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClick);
      document.removeEventListener('contextmenu', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // Convert flat targets to sections format for uniform rendering
  const sectionsToRender: ContextMenuSection[] = sections || (targets ? [{ targets }] : []);

  return (
    <MenuStyle x={x} y={y} onClick={(e) => e.stopPropagation()}>
      <Header>{title}</Header>
      {sectionsToRender.map((section, sectionIdx) => {
        // Separate navigation targets from utility targets
        const navTargets = section.targets.filter(t => !t.onClick);
        const utilityTargets = section.targets.filter(t => t.onClick);

        return (
          <React.Fragment key={sectionIdx}>
            {section.label && <SectionHeader>{section.label}</SectionHeader>}

            {/* Navigation targets with Split/Full/Tab matrix */}
            {navTargets.length > 0 && (
              <MatrixTable>
                {sectionIdx === 0 && (
                  <thead>
                    <tr>
                      <th></th>
                      <th>Split</th>
                      <th>Full</th>
                      <th>Tab</th>
                    </tr>
                  </thead>
                )}
                <tbody>
                  {navTargets.map((t, idx) => (
                    <tr key={idx}>
                      <td>{t.icon && <span style={{ marginRight: 4 }}>{t.icon}</span>}{t.label}</td>
                      <td><ActionBtn onClick={() => onNavigate('split', t.resultIndex)}>◐</ActionBtn></td>
                      <td><ActionBtn onClick={() => onNavigate('full', t.resultIndex)}>●</ActionBtn></td>
                      <td><ActionBtn onClick={() => onNavigate('newTab', t.resultIndex)}>↗</ActionBtn></td>
                    </tr>
                  ))}
                </tbody>
              </MatrixTable>
            )}

            {/* Utility targets as simple clickable rows */}
            {utilityTargets.map((t, idx) => (
              <UtilityRow key={`util-${idx}`} onClick={t.onClick}>
                {t.icon && <span>{t.icon}</span>}
                {t.label}
              </UtilityRow>
            ))}
          </React.Fragment>
        );
      })}

      {/* Keep backward compatibility with onCopy prop */}
      {onCopy && (
        <UtilityAction onClick={onCopy}>
          <span>📋</span> {copyLabel}
        </UtilityAction>
      )}
    </MenuStyle>
  );
};
