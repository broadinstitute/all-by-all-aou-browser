import React, { useContext } from "react";

import { RegionViewerContext } from "./RegionViewer";
import { Track } from "./Track";
import { VariantsPlot } from "./VariantsPlot";
import type { Variant } from "./VariantsPlot";

export const VariantTrack: React.FC<{
  variants: Variant[];
  variantColor?: (v: Variant) => string;
}> = ({ variants, variantColor }) => {
  const { scalePosition, centerPanelWidth } = useContext(RegionViewerContext);

  return (
    <Track>
      <VariantsPlot
        variants={variants}
        variantColor={variantColor}
        scalePosition={scalePosition}
        width={centerPanelWidth}
      />
    </Track>
  );
};
