import React from "react";
import type { ScalePosition, MinimalRegion } from "./coordinates";

interface Props {
  axisColor?: string;
  height?: number;
  regions: MinimalRegion[];
  regionAttributes?: any;
  regionKey?: (r: MinimalRegion) => string;
  scalePosition: ScalePosition;
  width: number;
}

export const RegionsPlot: React.FC<Props> = ({
  axisColor = "#bdbdbd",
  height = 20,
  regions,
  regionAttributes = () => ({}),
  regionKey = (region: MinimalRegion) => `${region.start}-${region.stop}`,
  scalePosition,
  width,
}) => (
  <svg width={width} height={height}>
    <line
      x1={0}
      x2={width}
      y1={height / 2}
      y2={height / 2}
      stroke={axisColor}
      strokeWidth={1}
    />
    {regions.map((region) => {
      const x1 = scalePosition(region.start);
      const x2 = scalePosition(region.stop);
      const attributes = {
        fill: "#000",
        height,
        stroke: "none",
        ...regionAttributes(region),
      };

      return (
        <rect
          key={regionKey(region)}
          y={(height - attributes.height) / 2}
          {...attributes}
          x={x1}
          width={x2 - x1}
        />
      );
    })}
  </svg>
);
