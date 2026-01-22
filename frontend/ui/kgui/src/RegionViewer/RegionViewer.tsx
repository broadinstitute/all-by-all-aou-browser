import React, { ReactNode } from "react";
import styled from "styled-components";

// import type { ScaleLinear } from 'd3-scale';
import type { Region, MinimalRegion, ScalePosition } from "./coordinates";

import {
  calculateOffsetRegions,
  calculatePositionOffset,
  invertPositionOffset,
  calculateXScale,
} from "./coordinates";

type ContextProps = {
  centerPanelWidth: number;
  leftPanelWidth: number;
  rightPanelWidth: number;
  isPositionDefined: (pos: number) => boolean;
  offsetRegions: Region[] | [];
  positionOffset: (position: number) => { offsetPosition: number };
  scalePosition: ScalePosition;
};

const defaultRegion = {
  feature_type: "none",
  start: 0,
  stop: 10,
  previousRegionDistance: 0,
  offset: 0,
};

const defaultOffsetRegions = calculateOffsetRegions(0, [defaultRegion]);
const defaultPositionOffset = calculatePositionOffset(defaultOffsetRegions);
const defaultXScale = calculateXScale(0, defaultOffsetRegions);
const defaultInvertOffset = invertPositionOffset(
  defaultOffsetRegions,
  defaultXScale
);
const defaultScalePosition = (pos: number) =>
  defaultXScale(defaultPositionOffset(pos).offsetPosition)!;

defaultScalePosition.invert = defaultInvertOffset;

const defaultIsPositionDefined = (pos: number) =>
  defaultOffsetRegions.some(
    (region) => region.start <= pos && pos <= region.stop
  );

const defaultContextProps = {
  centerPanelWidth: 10,
  leftPanelWidth: 10,
  rightPanelWidth: 10,
  isPositionDefined: defaultIsPositionDefined,
  offsetRegions: defaultOffsetRegions,
  positionOffset: defaultPositionOffset,
  scalePosition: defaultScalePosition,
};

export const RegionViewerContext = React.createContext<ContextProps>(
  defaultContextProps
);

const RegionViewerWrapper = styled.div`
  display: flex;
  flex-direction: column;
  width: ${(props: { width: number }) => props.width}px;
  font-size: 12px;
`;
type RegionViewerProps = {
  regions: MinimalRegion[];
  leftPanelWidth?: number;
  rightPanelWidth?: number;
  padding?: number;
  width?: number;
  children?: ReactNode;
};

export const RegionViewer: React.FC<RegionViewerProps> = ({
  children,
  leftPanelWidth = 60,
  rightPanelWidth = 10,
  padding = 50,
  regions,
  width = 300,
}) => {
  const centerPanelWidth = width - (leftPanelWidth + rightPanelWidth);
  const offsetRegions = calculateOffsetRegions(padding, regions);

  const positionOffset = calculatePositionOffset(offsetRegions);
  const xScale = calculateXScale(centerPanelWidth, offsetRegions);
  const invertOffset = invertPositionOffset(offsetRegions, xScale);

  const scalePosition = (pos: number) =>
    xScale(positionOffset(pos).offsetPosition)!;

  scalePosition.invert = invertOffset;

  const isPositionDefined = (pos: number) =>
    offsetRegions.some((region) => region.start <= pos && pos <= region.stop);

  const childProps: ContextProps = {
    centerPanelWidth,
    isPositionDefined,
    leftPanelWidth,
    offsetRegions, // used only by track-coverage
    positionOffset,
    rightPanelWidth,
    scalePosition,
  };

  return (
    <RegionViewerWrapper width={width}>
      <RegionViewerContext.Provider value={childProps}>
        {children}
      </RegionViewerContext.Provider>
    </RegionViewerWrapper>
  );
};
