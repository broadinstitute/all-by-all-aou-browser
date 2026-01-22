import PropTypes from "prop-types";
import React, { useContext } from "react";

import { Track } from "./Track";
import type { RenderPanel } from "./Track";
import { RegionsPlot } from "./RegionsPlot";
import type { MinimalRegion } from "./coordinates";
import { RegionViewerContext } from "./RegionViewer";

interface Props {
  renderLeftPanel: RenderPanel;
  renderRightPanel: RenderPanel;
  renderTopPanel: RenderPanel;
  regions: MinimalRegion[];
  title: string;
  height?: number;
}

export const RegionsTrack = ({
  renderLeftPanel,
  renderRightPanel,
  renderTopPanel,
  regions,
  height,
}: Props) => {
  const { scalePosition, centerPanelWidth } = useContext(RegionViewerContext);
  return (
    <Track
      renderLeftPanel={renderLeftPanel}
      renderRightPanel={renderRightPanel}
      renderTopPanel={renderTopPanel}
    >
      <RegionsPlot
        regions={regions}
        scalePosition={scalePosition}
        width={centerPanelWidth}
        height={height}
      />
    </Track>
  );
};

RegionsTrack.propTypes = {
  renderLeftPanel: PropTypes.func,
  renderRightPanel: PropTypes.func,
  renderTopPanel: PropTypes.func,
  title: PropTypes.string,
};

RegionsTrack.defaultProps = {
  renderLeftPanel: undefined,
  renderRightPanel: undefined,
  renderTopPanel: undefined,
  title: "",
};
