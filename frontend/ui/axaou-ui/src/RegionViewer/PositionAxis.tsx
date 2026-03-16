import React, {useContext} from "react";

import {RegionViewerContext} from "./RegionViewer";

export const PositionAxis = () => {

  const { scalePosition, centerPanelWidth } = useContext(RegionViewerContext)

  const width = centerPanelWidth
  const height = 15;
  const numIntervals = Math.min(10, Math.floor(width / 90));

  const tickInterval = width / numIntervals;
  const ticks = [...Array(numIntervals - 1)].map(
    (_, i) => tickInterval * (i + 1)
  );

  const strokeColor = "var(--theme-border, #333)"
  const textColor = "var(--theme-text, black)"

  return (
    <svg height={height} width={width}>
      <line
        x1={1}
        y1={height}
        x2={width - 1}
        y2={height}
        stroke={strokeColor}
        strokeWidth={2}
      />
      <g>
        <line
          x1={1}
          y1={height}
          x2={1}
          y2={height - 5}
          stroke={strokeColor}
          strokeWidth={2}
        />
        <text
          x={3}
          y={height - 7}
          textAnchor="start"
          fill={textColor}
          style={{ fontSize: "10px" }}
        >
          {scalePosition.invert(1).toLocaleString()}
        </text>
      </g>
      {ticks.map((x) => (
        <g key={x}>
          <line
            x1={x}
            y1={height}
            x2={x}
            y2={height - 5}
            stroke={strokeColor}
            strokeWidth={1}
          />
          <text
            x={x}
            y={height - 7}
            textAnchor="middle"
            fill={textColor}
            style={{ fontSize: "10px" }}
          >
            {scalePosition.invert(x).toLocaleString()}
          </text>
        </g>
      ))}
      <g>
        <line
          x1={width - 1}
          y1={height}
          x2={width - 1}
          y2={height - 5}
          stroke={strokeColor}
          strokeWidth={2}
        />
        <text
          x={width - 3}
          y={height - 7}
          textAnchor="end"
          fill={textColor}
          style={{ fontSize: "10px" }}
        >
          {scalePosition.invert(width - 1).toLocaleString()}
        </text>
      </g>
    </svg>
  );
};
