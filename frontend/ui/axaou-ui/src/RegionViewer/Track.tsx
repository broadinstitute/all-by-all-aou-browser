import React, {ReactNode, useContext} from "react";
import styled from "styled-components";

import { RegionViewerContext } from "./RegionViewer";

const OuterWrapper = styled.div`
  display: flex;
  flex-direction: column;
`;

const InnerWrapper = styled.div`
  display: flex;
  flex-direction: row;
  align-items: stretch;
`;

type TopPanelProps = {
  width: number;
  marginRight: number;
  marginLeft: number;
};

const TopPanel = styled.div`
  display: flex;
  width: ${(props: TopPanelProps) => props.width}px;
  margin-right: ${(props: TopPanelProps) => props.marginRight}px;
  margin-left: ${(props: TopPanelProps) => props.marginLeft}px;
`;

const SidePanel = styled.div`
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  width: ${(props: { width: number }) => props.width}px;
`;

const CenterPanel = styled.div`
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  width: ${(props: { width: number }) => props.width}px;
`;

const TitlePanel = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100%;
`;

// eslint-disable-next-line react/prop-types
const defaultRenderLeftPanel = ({ title = "" }) => (
  <TitlePanel>
    {title.split("\n").map((s) => (
      <span key={s}>{s}</span>
    ))}
  </TitlePanel>
);

export type RenderPanel = (props: { width: number }) => JSX.Element;

type TrackProps = {
  renderLeftPanel?: RenderPanel;
  renderRightPanel?: RenderPanel;
  renderTopPanel?: RenderPanel;
  children?: ReactNode
};

export const Track: React.FC<TrackProps> = ({
  children,
  renderLeftPanel = defaultRenderLeftPanel,
  renderRightPanel = defaultRenderLeftPanel,
  renderTopPanel = defaultRenderLeftPanel,
  ...rest
}) => {
  if (React.Children.count(children) === 0) return null;

  const {
    centerPanelWidth,
    isPositionDefined,
    leftPanelWidth,
    offsetRegions,
    rightPanelWidth,
    scalePosition,
  } = useContext(RegionViewerContext);

  return (
    <OuterWrapper>
      {renderTopPanel && (
        <TopPanel
          marginLeft={leftPanelWidth}
          marginRight={rightPanelWidth}
          width={centerPanelWidth}
        >
          {renderTopPanel({ ...rest, width: centerPanelWidth })}
        </TopPanel>
      )}
      <InnerWrapper>
        <SidePanel width={leftPanelWidth}>
          {renderLeftPanel &&
            renderLeftPanel({ ...rest, width: leftPanelWidth })}
        </SidePanel>
        <CenterPanel width={centerPanelWidth}>
          {React.Children.map(children, (child) => {
            if (React.isValidElement(child)) {
              return React.cloneElement(child, {
                ...rest,
                // @ts-ignore
                isPositionDefined,
                leftPanelWidth,
                offsetRegions,
                centerPanelWidth,
                rightPanelWidth,
                scalePosition,
                width: centerPanelWidth,
              });
            }
            return null;
          })}
        </CenterPanel>
        {renderRightPanel && (
          <SidePanel width={rightPanelWidth}>
            {renderRightPanel({ ...rest, width: rightPanelWidth })}
          </SidePanel>
        )}
      </InnerWrapper>
    </OuterWrapper>
  );
};
