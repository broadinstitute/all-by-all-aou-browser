import React, { useRef, useState } from "react";
import styled from "styled-components";

import { RegionViewerContext } from "./RegionViewer";

const CursorWrapper = styled.div`
  position: relative;
`;

const CursorOverlay = styled.svg`
  position: absolute;
  top: 0;
  height: 100%;
  pointer-events: none;
`;

type CursorProps = {
  onClick: (position: number) => void;
  children?: React.ReactNode;
};

export const Cursor: React.FC<CursorProps> = ({ children, onClick }) => {
  const container: { current: HTMLDivElement | null } = useRef<HTMLDivElement>(
    null
  );
  const [cursorPosition, setCursorPosition] = useState<number | null>(null);

  const containerX = container.current
    ? container.current.getBoundingClientRect().left
    : null;

  return (
    <RegionViewerContext.Consumer>
      {({
        centerPanelWidth,
        leftPanelWidth,
        scalePosition
      }: any) => {
        // To allow interaction with child tracks behind the overlaid SVG, the SVG element is styled with `pointer-events: none`.
        // This also makes it unclickable, so the click handler is placed on the parent element (which wraps the entire child
        // track(s)). Consumers are only notified if a click occurs within the center panel of the child track(s).

        // TODO: Make this focusable? Arrow keys to move cursor? ARIA role?
        // if (!container.current) return null
        return (
          <CursorWrapper
            ref={container}
            onClick={() => {
              // If cursorPosition is null, then the mouse pointer is outside the region viewer's center panel.
              if (cursorPosition !== null) {
                if (scalePosition) {
                  onClick(scalePosition.invert(cursorPosition));
                }
              }
            }}
            onMouseEnter={(e) => {
              if (containerX) {
                const x = e.clientX - containerX;
                const isInCenterPanel =
                  x >= leftPanelWidth && x <= leftPanelWidth + centerPanelWidth;
                setCursorPosition(isInCenterPanel ? x - leftPanelWidth : null);
              }
            }}
            onMouseMove={(e) => {
              if (containerX) {
                const x = e.clientX - containerX;

                const isInCenterPanel =
                  x >= leftPanelWidth && x <= leftPanelWidth + centerPanelWidth;
                setCursorPosition(isInCenterPanel ? x - leftPanelWidth : null);
              }
            }}
            onMouseLeave={() => {
              setCursorPosition(null);
            }}
          >
            <CursorOverlay
              style={{
                left: `${leftPanelWidth}px`,
                width: `${centerPanelWidth}px`,
              }}
            >
              {cursorPosition && (
                <rect
                  x={cursorPosition - 15}
                  y={0}
                  width={30}
                  height="100%"
                  fill="none"
                  stroke="black"
                  strokeDasharray="5, 5"
                  strokeWidth={1}
                  style={{ cursor: "pointer" }}
                />
              )}
            </CursorOverlay>
            {children}
          </CursorWrapper>
        );
      }}
    </RegionViewerContext.Consumer>
  );
};
