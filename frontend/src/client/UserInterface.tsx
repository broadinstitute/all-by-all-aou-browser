import React, { useState } from 'react'

import styled, { css } from 'styled-components'
import { Link as BaseRouterLink } from 'react-router-dom'
// @ts-expect-error 
import RightArrowIcon from '@fortawesome/fontawesome-free/svgs/solid/arrow-alt-circle-right.svg'

import { Page, Link as BaseLink, Modal, TextButton, ExternalLink as BaseExternalLink, ExternalLink } from '@gnomad/ui'
import { useEffect } from 'react'
import { greenThresholdColor, yellowThresholdColor } from './PhenotypeList/Utils'

export const ShowControlsButton = styled.button<{ $right?: boolean }>`
  position: absolute;
  ${(props) => props.$right ? 'right: 0;' : 'left: 0;'}
  top: 50%;
  transform: translateY(-50%);
  writing-mode: vertical-rl;
  text-orientation: mixed;
  padding: 12px 6px;
  background: var(--theme-surface-alt, #f5f5f5);
  border: 1px solid var(--theme-border, #e0e0e0);
  ${(props) => props.$right ? 'border-right: none;' : 'border-left: none;'}
  border-radius: ${(props) => props.$right ? '4px 0 0 4px' : '0 4px 4px 0'};
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  color: var(--theme-text, #333);
  z-index: 10;

  &:hover {
    background: var(--theme-border, #e8e8e8);
  }
`

// Reusable Controls Panel Components
export const ControlsHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid ${(props) => props.theme.border};
  margin-bottom: 4px;
`

export const ControlsHeaderTitle = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: var(--theme-text, #333);
`

export const ControlsCloseButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  font-size: 18px;
  color: var(--theme-text-muted, #666);
  line-height: 1;
  border-radius: 4px;

  &:hover {
    background: var(--theme-border, #e0e0e0);
    color: var(--theme-text, #333);
  }
`

export const ControlsSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

export const ControlsSectionTitle = styled.strong`
  font-size: 13px;
  color: var(--theme-text, #333);
  margin-bottom: 4px;
`

export const SplitPageContainer = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-evenly;
  height: 100%;
  width: 100%;
  border: 3px dashed darkviolet;
`

export const FullPage = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-left: 20px;
  margin-right: 20px;
  padding: 20px 20px 20px 20px;
`

export const PhewasSplitGrid = styled.div`
  padding: 20px;

  display: grid;
  grid-gap: 1em;
  grid-template-columns: 50% 1px 50%;

  .grid-item {
    overflow: hidden;
    min-width: 0;
    min-height: 0;
  }
`

export const PhewasSplitGridCondensed = styled(PhewasSplitGrid)`
  grid-template-columns: 40% 1px 60%;
`

export const HalfPage = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 100%;
  max-width: 100%;
  align-items: center;
`

export const Divider = styled.div`
  height: 80%;
  border: 1px dashed var(--theme-border, lightgrey);
  justify-self: center;
`

export const GeneResultsHalfPage = styled(HalfPage).attrs({ className: 'grid-item' })``

export const AssociationsHalfPage = styled(HalfPage).attrs({ className: 'grid-item' })``

export const Titles = styled.div`
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  justify-content: space-between;
  align-items: center;
  width: 100%;

  h3 {
    font-weight: bold;
    font-size: 14px;
  }
`

export const TitlesColumn = styled.div`
  display: flex;
  flex-direction: column;
  flex-wrap: nowrap;
  justify-content: flex-start;
  align-items: flex-start;
  width: 100%;
`

export const NoDataBox = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: ${(props) => (props as any).height}px;
  border: 1px dashed var(--theme-border, gray);
  font-size: 20px;
  font-weight: bold;
  color: var(--theme-text, inherit);
`

export const InfoPage = styled(Page)`
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow-y: scroll;
  height: 100%;
  min-width: 100%;
  margin: 0;
  padding-right: 1em;
  padding-left: 1em;
  padding-bottom: 200px; 

  font-size: 16px;

  p {
    margin-bottom: 1em;
    line-height: 1.4;
  }
`

export const DocumentTitle = ({ title }: { title?: string }) => {
  useEffect(() => {
    const fullTitle = title ? `${title}` : 'All by All'
    document.title = fullTitle
  }, [title])
  return null
}

export const ColorMarker = styled.span<{ color: string; border?: string; borderColor?: string }>`
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 0.5em;

  &::before {
    content: '';
    display: inline-block;
    box-sizing: border-box;
    width: 10px;
    height: 10px;
    border: 1px ${(props) => props.border || 'solid'} ${(props) => props.borderColor || '#000'};
    border-radius: 5px;
    background: ${(props) => props.color};
  }
`

export const StatusMessage = styled.div`
  padding: 15px;
  font-size: 1.5em;
  text-align: center;
`

const SpinnerStyle = styled.div`
  .uncached-warning {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-weight: bold;

    p {
      margin-bottom: 10px;
    }

    span {
      margin-left: 0.5em;
    }
  }

  .loader {
    color: var(--theme-text, black);
    font-size: 90px;
    text-indent: -9999em;
    overflow: hidden;
    width: 1em;
    height: 1em;
    border-radius: 50%;
    margin: 72px auto;
    position: relative;
    -webkit-transform: translateZ(0);
    -ms-transform: translateZ(0);
    transform: translateZ(0);
    -webkit-animation: load6 1.7s infinite ease, round 1.7s infinite ease;
    animation: load6 1.7s infinite ease, round 1.7s infinite ease;
  }
  @-webkit-keyframes load6 {
    0% {
      box-shadow: 0 -0.83em 0 -0.4em, 0 -0.83em 0 -0.42em, 0 -0.83em 0 -0.44em, 0 -0.83em 0 -0.46em,
        0 -0.83em 0 -0.477em;
    }
    5%,
    95% {
      box-shadow: 0 -0.83em 0 -0.4em, 0 -0.83em 0 -0.42em, 0 -0.83em 0 -0.44em, 0 -0.83em 0 -0.46em,
        0 -0.83em 0 -0.477em;
    }
    10%,
    59% {
      box-shadow: 0 -0.83em 0 -0.4em, -0.087em -0.825em 0 -0.42em, -0.173em -0.812em 0 -0.44em,
        -0.256em -0.789em 0 -0.46em, -0.297em -0.775em 0 -0.477em;
    }
    20% {
      box-shadow: 0 -0.83em 0 -0.4em, -0.338em -0.758em 0 -0.42em, -0.555em -0.617em 0 -0.44em,
        -0.671em -0.488em 0 -0.46em, -0.749em -0.34em 0 -0.477em;
    }
    38% {
      box-shadow: 0 -0.83em 0 -0.4em, -0.377em -0.74em 0 -0.42em, -0.645em -0.522em 0 -0.44em,
        -0.775em -0.297em 0 -0.46em, -0.82em -0.09em 0 -0.477em;
    }
    100% {
      box-shadow: 0 -0.83em 0 -0.4em, 0 -0.83em 0 -0.42em, 0 -0.83em 0 -0.44em, 0 -0.83em 0 -0.46em,
        0 -0.83em 0 -0.477em;
    }
  }
  @keyframes load6 {
    0% {
      box-shadow: 0 -0.83em 0 -0.4em, 0 -0.83em 0 -0.42em, 0 -0.83em 0 -0.44em, 0 -0.83em 0 -0.46em,
        0 -0.83em 0 -0.477em;
    }
    5%,
    95% {
      box-shadow: 0 -0.83em 0 -0.4em, 0 -0.83em 0 -0.42em, 0 -0.83em 0 -0.44em, 0 -0.83em 0 -0.46em,
        0 -0.83em 0 -0.477em;
    }
    10%,
    59% {
      box-shadow: 0 -0.83em 0 -0.4em, -0.087em -0.825em 0 -0.42em, -0.173em -0.812em 0 -0.44em,
        -0.256em -0.789em 0 -0.46em, -0.297em -0.775em 0 -0.477em;
    }
    20% {
      box-shadow: 0 -0.83em 0 -0.4em, -0.338em -0.758em 0 -0.42em, -0.555em -0.617em 0 -0.44em,
        -0.671em -0.488em 0 -0.46em, -0.749em -0.34em 0 -0.477em;
    }
    38% {
      box-shadow: 0 -0.83em 0 -0.4em, -0.377em -0.74em 0 -0.42em, -0.645em -0.522em 0 -0.44em,
        -0.775em -0.297em 0 -0.46em, -0.82em -0.09em 0 -0.477em;
    }
    100% {
      box-shadow: 0 -0.83em 0 -0.4em, 0 -0.83em 0 -0.42em, 0 -0.83em 0 -0.44em, 0 -0.83em 0 -0.46em,
        0 -0.83em 0 -0.477em;
    }
  }
  @-webkit-keyframes round {
    0% {
      -webkit-transform: rotate(0deg);
      transform: rotate(0deg);
    }
    100% {
      -webkit-transform: rotate(360deg);
      transform: rotate(360deg);
    }
  }
  @keyframes round {
    0% {
      -webkit-transform: rotate(0deg);
      transform: rotate(0deg);
    }
    100% {
      -webkit-transform: rotate(360deg);
      transform: rotate(360deg);
    }
  }
`

export const TinySpinner = styled.div`
  display: inline-block;
  font-size: 0.8em;
  margin-left: 0.5em;
  &:after {
    content: ' ';
    display: inline-block;
    width: 8px;
    height: 8px;
    margin-left: 5px;
    border-radius: 50%;
    border: 2px solid currentColor;
    border-color: currentColor currentColor transparent transparent;
    animation: spin 0.75s linear infinite;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
`

export const Spinner: React.FC<{}> = () => {
  const [show, setShow] = useState(false)

  // On componentDidMount set the timer
  useEffect(() => {
    const timeId = setTimeout(() => {
      // After 3 seconds set the show value to false
      setShow(true)
    }, 4000)

    return () => {
      clearTimeout(timeId)
    }
  }, [])

  return (
    <SpinnerStyle>
      <div className='loader'>Loading</div>
      {show && (
        <div className='uncached-warning'>
          <p>Fetching possibly uncached result.</p>{' '}
          <p>
            Clicking on results indicated with
            <span>
              <ColorMarker color={yellowThresholdColor} />
            </span>{' '}
            or
            <span>
              <ColorMarker color={greenThresholdColor} />
            </span>{' '}
            should be faster!
          </p>
        </div>
      )}
    </SpinnerStyle>
  )
}

export const RightArrow: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <RightArrowIcon height={15} width={15} onClick={onClick} style={{ cursor: 'pointer', fill: 'var(--theme-text, #333)' }} />
);

export const NoVariants = styled.div<{ height?: number | string; width?: number | string }>`
  display: flex;
  justify-content: center;
  align-items: center;
  height: ${(props) => props.height || '300px'}px;
  width: ${(props) => props.width || '300px'};
  border: 1px dashed gray;
  font-size: 20px;
  font-weight: bold;
`

export const ShadedCell: React.FC<{
  color: string
  borderLeft?: boolean
  children?: React.ReactNode
}> = ({ color, borderLeft, children }) => {
  const borderStyle = borderLeft
    ? {
      borderLeft: '1px solid black',
      paddingLeft: '2px',
    }
    : {}

  const cellStyle = { backgroundColor: color, ...borderStyle }

  return <div style={cellStyle}>{children}</div>
}

export const Link = styled(BaseLink)`
  color: var(--theme-primary, #3279b7);
`

const basePageHeadingLinkStyles = css`
  font-size: 1.3rem;
  margin-right: 40px;
  margin-left: 0;
  cursor: pointer;
  text-transform: uppercase;
  text-wrap: nowrap;
  font-weight: bold;
  color: black;
  text-decoration: none;
`;

export const PageHeadingRouterLink = styled(BaseRouterLink)`
  ${basePageHeadingLinkStyles}
`;

export const PageHeadingExternalLink = styled(ExternalLink)`
  ${basePageHeadingLinkStyles}
`;

interface TogglePaneButtonProps {
  paneIsClosed: boolean;
  direction?: 'left' | 'right';
  onClick: () => void;
  tooltip?: string;
}

const ToggleButtonContainer = styled.div<{ paneIsClosed: boolean }>`
  width: ${({ paneIsClosed }) => (paneIsClosed ? '25px' : '20px')};
  height: 25px;
  border: 1px solid grey;
  border-radius: 5px;
  background: ${({ paneIsClosed }) =>
    paneIsClosed
      ? 'linear-gradient(90deg, #f1f1f1 45%, grey 50%, #e0e0e0 55%)'
      : '#f1f1f1'};
  position: relative;
  cursor: pointer;
`;

const ToggleIcon = styled.div<{ paneIsClosed: boolean; direction: 'left' | 'right' }>`
  position: absolute;
  top: 50%;
  left: ${({ paneIsClosed, direction }) =>
    (direction === 'left' && paneIsClosed) || (direction === 'right' && !paneIsClosed)
      ? '33%'
      : '67%'};
  width: 8px;
  height: 8px;
  background-color: #000;
  transform: translate(-50%, -50%);
  clip-path: ${({ paneIsClosed, direction }) =>
    (direction === 'left' && paneIsClosed) || (direction === 'right' && !paneIsClosed)
      ? 'polygon(0 0, 100% 50%, 0 100%)'
      : 'polygon(100% 0, 0 50%, 100% 100%)'};
`;

export const TogglePaneButton: React.FC<TogglePaneButtonProps> = ({
  paneIsClosed,
  direction = "left",
  onClick,
  tooltip,
}) => (
  <ToggleButtonContainer
    paneIsClosed={paneIsClosed}
    onClick={onClick}
    title={tooltip}
  >
    <ToggleIcon paneIsClosed={paneIsClosed} direction={direction} />
  </ToggleButtonContainer>
);

// Layout Toggle - a nicer segmented control for switching between layout modes
const LayoutToggleContainer = styled.div`
  display: flex;
  align-items: center;
  background: var(--theme-surface-alt, #e8e8e8);
  border-radius: 6px;
  padding: 3px;
  gap: 2px;
`;

const LayoutOption = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border: none;
  border-radius: 4px;
  background: ${({ $active }) => ($active ? '#262262' : 'transparent')};
  color: ${({ $active }) => ($active ? 'white' : 'var(--theme-text-muted, #555)')};
  font-size: 12px;
  font-family: GothamBook, sans-serif;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;

  &:hover {
    background: ${({ $active }) => ($active ? '#262262' : 'var(--theme-border, #d0d0d0)')};
  }

  svg {
    width: 16px;
    height: 12px;
  }
`;

// SVG icons for the layout options
const LayoutIconLeft = () => (
  <svg viewBox="0 0 24 16" fill="currentColor">
    <rect x="1" y="1" width="22" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="2" y="2" width="20" height="12" rx="1" fill="currentColor" opacity="0.3"/>
  </svg>
);

const LayoutIconSplit = () => (
  <svg viewBox="0 0 24 16" fill="currentColor">
    <rect x="1" y="1" width="22" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="2" y="2" width="9" height="12" rx="1" fill="currentColor" opacity="0.3"/>
    <rect x="13" y="2" width="9" height="12" rx="1" fill="currentColor" opacity="0.6"/>
    <line x1="12" y1="2" x2="12" y2="14" stroke="currentColor" strokeWidth="1"/>
  </svg>
);

const LayoutIconRight = () => (
  <svg viewBox="0 0 24 16" fill="currentColor">
    <rect x="1" y="1" width="22" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="2" y="2" width="20" height="12" rx="1" fill="currentColor" opacity="0.6"/>
  </svg>
);

export type LayoutMode = 'full' | 'split' | 'detail';

interface LayoutToggleProps {
  value: LayoutMode;
  onChange: (mode: LayoutMode) => void;
  leftLabel?: string;
  rightLabel?: string;
}

export const LayoutToggle: React.FC<LayoutToggleProps> = ({
  value,
  onChange,
  leftLabel = 'Results',
  rightLabel = 'Gene/Locus',
}) => (
  <LayoutToggleContainer>
    <LayoutOption
      $active={value === 'full'}
      onClick={() => onChange('full')}
      title="Show results panel only"
    >
      <LayoutIconLeft />
      {leftLabel}
    </LayoutOption>
    <LayoutOption
      $active={value === 'split'}
      onClick={() => onChange('split')}
      title="Show both panels"
    >
      <LayoutIconSplit />
      Split
    </LayoutOption>
    <LayoutOption
      $active={value === 'detail'}
      onClick={() => onChange('detail')}
      title="Show gene/locus panel only"
    >
      <LayoutIconRight />
      {rightLabel}
    </LayoutOption>
  </LayoutToggleContainer>
);

// Theme Toggle - similar style to LayoutToggle for light/dark mode
const ThemeToggleContainer = styled.div`
  display: flex;
  align-items: center;
  background: var(--theme-surface-alt, #e8e8e8);
  border-radius: 6px;
  padding: 3px;
  gap: 2px;
`;

const ThemeOption = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 5px 10px;
  border: none;
  border-radius: 4px;
  background: ${({ $active }) => ($active ? '#262262' : 'transparent')};
  color: ${({ $active }) => ($active ? 'white' : 'var(--theme-text-muted, #555)')};
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: ${({ $active }) => ($active ? '#262262' : 'var(--theme-border, #d0d0d0)')};
  }

  svg {
    width: 14px;
    height: 14px;
  }
`;

const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="12" r="5" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const SystemIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8v16z" />
  </svg>
);

interface ThemeToggleProps {
  value: 'light' | 'dark' | 'system';
  onChange: (mode: 'light' | 'dark' | 'system') => void;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ value, onChange }) => (
  <ThemeToggleContainer>
    <ThemeOption
      $active={value === 'light'}
      onClick={() => onChange('light')}
      title="Light mode"
    >
      <SunIcon />
    </ThemeOption>
    <ThemeOption
      $active={value === 'system'}
      onClick={() => onChange('system')}
      title="System default"
    >
      <SystemIcon />
    </ThemeOption>
    <ThemeOption
      $active={value === 'dark'}
      onClick={() => onChange('dark')}
      title="Dark mode"
    >
      <MoonIcon />
    </ThemeOption>
  </ThemeToggleContainer>
);


export const ScrollButtonContainer = styled.div`
  position: fixed;
  top: 118px;
  left: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background-color: ${(props) => props.theme.surface};
  border-radius: 8px;
  padding: 10px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  z-index: 1000;

  h3 {
    padding-top: 5px;
    padding-left: 10px;
    font-size: 2em;
    margin-right: 10px;
  }

  button {
    font-family: GothamBook;
    color: ${(props) => props.theme.text};
    background-color: ${(props) => props.theme.surfaceAlt};
    border: none;
    padding: 10px;
    border-radius: 5px;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    white-space: nowrap;
  }

  @media (max-width: 800px) {
    flex-direction: column;
    gap: 5px;
    button {
      display: none;
    }
  }
`;

export const ScrollButton: React.FC<{
  targetSelector: string;
  containerSelector: string;
  label: string;
}> = ({ targetSelector, containerSelector, label }) => {
  const scrollToElementWithinContainer = (
    targetSelector: string,
    containerSelector: string
  ) => {
    const offset = 60;
    const container = document.querySelector(containerSelector);
    const targetElement = document.querySelector(targetSelector);

    if (container && targetElement) {
      const { top: containerTop } = container.getBoundingClientRect();
      const { top: targetTop } = targetElement.getBoundingClientRect();
      const scrollToPosition = targetTop - containerTop + container.scrollTop - offset;

      container.scrollTop = scrollToPosition;
    }
  };

  return (
    <button
      onClick={() => scrollToElementWithinContainer(targetSelector, containerSelector)}
    >
      {label}
    </button>
  );
};

const DropdownButton = styled.div`
  position: relative;
  cursor: pointer;
  font-size: 25px;

  &:hover .dropdown-content {
    display: block;
  }
`;

const DropdownContent = styled.div`
  display: none;
  position: absolute;
  background-color: ${(props) => props.theme.surfaceAlt};
  min-width: 160px;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
  z-index: 99;
  font-size: 12px;

  button {
    display: block;
    color: ${(props) => props.theme.text};
    padding: 12px 16px;
    text-decoration: none;
    background: none;
    border: none;
    text-align: left;
    width: 100%;
    min-width: 160px;
  }

  button:hover {
    background-color: ${(props) => props.theme.border};
  }
`;

export const ScrollButtonDropdown: React.FC<{
  buttons: { targetSelector: string; containerSelector: string; label: string }[];
}> = ({ buttons }) => {
  return (
    <DropdownButton>
      ☰
      <DropdownContent className="dropdown-content">
        {buttons.map((button, index) => (
          <ScrollButton key={index} {...button} />
        ))}
      </DropdownContent>
    </DropdownButton>
  );
};

export const TitleWithScrollButtons: React.FC<{
  title: string;
  buttons: { targetSelector: string; containerSelector: string; label: string }[];
  width: number;
}> = ({ title, buttons, width }) => {

  const totalButtonTextLength = buttons.reduce((acc, button) => acc + button.label.length, 0);

  const titlePadding = 20
  const buttonPadding = 20
  const nButtons = buttons.length
  const buttonPxPerChar = 6.28
  const titlePxPerChar = 13
  const extraPadding = 120
  const buttonCharPixels = totalButtonTextLength * buttonPxPerChar
  const titleCharPixels = titlePxPerChar * title.length

  const breakpoint = titlePadding + (buttonPadding * nButtons) + buttonCharPixels + titleCharPixels + extraPadding

  return (
    <ScrollButtonContainer>
      <h3>{title}</h3>
      {width < breakpoint ? (
        <ScrollButtonDropdown buttons={buttons} />
      ) : (
        <>
          {buttons.map((button, index) => (
            <ScrollButton key={index} {...button} />
          ))}
        </>
      )}
    </ScrollButtonContainer>
  );
};


export const AttributeCards = styled.div`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  width: 100%;
  justify-content: center;

  h4 {
    font-weight: bold !important;
    font-size: 12px;
    margin-bottom: 10px;
    margin-top: 20px;
  }
`;

export const AttributeList = styled.dl<{ labelWidth: number }>`
  flex: 1;
  margin-bottom: 20px;
  padding: 20px;
  margin-right: 40px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  background-color: ${(props) => props.theme.surfaceAlt};

  dt,
  dd {
    box-sizing: border-box;
    line-height: 1.5;
    padding: 2px 0;
  }

  dt {
    flex-shrink: 0;
    width: ${(props) => props.labelWidth}px;
    font-weight: bold;
    text-align: right;
    color: ${(props) => props.theme.textMuted};
  }

  dd {
    margin-left: 1em;
    font-size: 1em;
  }

  @media (max-width: 600px) {
    dt {
      width: auto;
      text-align: left;
    }
  }
`;

export const AttributeListItemWrapper = styled.div`
  display: flex;
  flex-direction: row;
  margin-right: 20;
  margin-bottom: 3px;
  width: 100%;

  @media (max-width: 600px) {
    flex-direction: column;
  }
`;

type AttributeListItemProps = {
  children: React.ReactNode;
  label: string;
};

export const AttributeListItem = ({ children, label }: AttributeListItemProps) => (
  <AttributeListItemWrapper>
    <dt>{label}</dt>
    <dd>{children}</dd>
  </AttributeListItemWrapper>
);

const InlineListWrapper = styled.ul`
  display: inline;
  padding: 0;
  margin: 0;
  list-style: none;

  li {
    display: inline;

    &::after {
      content: ', ';
    }

    &:last-child::after {
      content: none;
    }
  }
`;

type InlineListProps = {
  items: React.ReactNode[];
  label: string;
  maxLength?: number;
};

export const InlineList: React.FC<InlineListProps> = ({ items, label, maxLength = 3 }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasMore = items.length > maxLength;
  const displayedItems = hasMore ? items.slice(0, maxLength - 1) : items;

  return (
    <>
      <InlineListWrapper>
        {displayedItems.map((item, index) => (
          <li key={index}>{item}</li> // eslint-disable-line react/no-array-index-key
        ))}
        {hasMore && (
          <li>
            <TextButton onClick={() => setIsExpanded(true)}>
              and {items.length - displayedItems.length} more
            </TextButton>
          </li>
        )}
      </InlineListWrapper>

      {isExpanded && (
        <Modal title={label} onRequestClose={() => setIsExpanded(false)}>
          <ul>
            {items.map((item, index) => (
              <li key={index}>{item}</li> // eslint-disable-line react/no-array-index-key
            ))}
          </ul>
        </Modal>
      )}
    </>
  );
};


