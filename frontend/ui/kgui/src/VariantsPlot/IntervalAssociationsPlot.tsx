import React, { useEffect, useMemo, useRef } from "react";
import styled from "styled-components";
import { max } from "d3-array";
// import { Select, MenuItem } from "@material-ui/core";
import { extent } from "d3-array";
import { scaleLinear, scaleSequential } from "d3-scale";
import { interpolateRdYlBu } from "d3-scale-chromatic";

import type { ScalePosition } from "../RegionViewer/coordinates";
import type { Variant, IntervalVariant } from "@karaogram/types";

import { finemappingPops } from "../constants";

type threshold = {
  color: string;
  label: string;
  value: number;
};

interface Props {
  variants: Variant[];
  scalePosition: ScalePosition;
  leftPanelWidth: number;
  rightPanelWidth: number;
  height?: number;
  width?: number;
  onClickPoint?: (d: IntervalVariant) => void;
  pointColor?: (d: IntervalVariant) => string;
  pointLabel?: (d: IntervalVariant) => string;
  selectedVariant?: Variant | null;
  thresholds?: threshold[];
  xLabel?: string;
  yLabel?: string;
  r2PopulationId?: string;
  showCorrelations?: boolean;
  onChangeR2Population?: (e: React.ChangeEvent<unknown>) => void;
  hideLegend?: boolean;
}

const PlotWrapper = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
`;

const Legend = styled.div<{ rightPanelWidth: number; height: number }>`
  display: flex;
  flex-direction: column;
  width: ${(props) => props.rightPanelWidth}px;
  height: ${(props) => props.height}px;
  align-items: center;
  justify-content: center;

  p {
    max-width: 100px;
    text-align: center;
    padding-left: 20px;
  }
`;

const LegendItems = styled.ul`
  display: flex;
  flex-direction: column;

  li {
    display: flex;
    flex-direction: row;
    list-style-type: none;
    margin-bottom: 5px;
    align-items: center;
  }
`;

const LegendIcon = styled.div<{ color: string | undefined }>`
  width: 20px;
  height: 20px;
  background-color: ${(props) => props.color || "black"};
  margin-right: 5px;
`;

export const IntervalAssociationsPlot = ({
  variants = [],
  scalePosition,
  leftPanelWidth,
  rightPanelWidth,
  height = 400,
  width = 1100,
  onClickPoint = (d) => console.log(JSON.stringify(d)),
  pointColor = () => "#383838",
  pointLabel = (d) => {
    if (d.association) {
      if (d.finemapping?.cs_99) {
        return `${d.variant_id} (${d.association.pvalue}, CS99)`;
      }
      return `${d.variant_id} (${d.association.pvalue})`;
    }

    return d.variant_id;
  },
  selectedVariant,
  thresholds = [],
  xLabel = "",
  yLabel = "-log10(p)",
  showCorrelations = false,
  r2PopulationId = "nfe",
  onChangeR2Population = (e) => console.log(e),
  hideLegend,
}: Props) => {
  const margin = {
    bottom: 10,
    left: leftPanelWidth,
    right: rightPanelWidth,
    top: 10,
  };

  const getR2ForPop = (variant: Variant, population_id: string) => {
    if (variant.finemapping && variant.finemapping.correlations) {
      const correlationResult = variant.finemapping.correlations.find(
        (c) => c.population_id === population_id
      );

      return correlationResult?.r2 || 0;
    }
    return 0;
  };

  const intervalVariants = variants.filter(
    (v) => v.association
  ) as IntervalVariant[];

  const yExtent = (extent(
    intervalVariants,
    (d) => d.association.pvalue
  ) as Array<number>)
    .map((p) => -Math.log10(p))
    .reverse();

  const yScale = scaleLinear()
    .domain(yExtent)
    .range([height - margin.top - margin.bottom, 0])
    .nice();

  const colorScale = scaleSequential(interpolateRdYlBu);

  const points = intervalVariants.map((d) => ({
    data: d,
    x: scalePosition(d.locus.position) || 0,
    y: yScale(-Math.log10(d.association.pvalue)) || 0,
    isLead:
      Math.floor(
        max(finemappingPops.map((p) => getR2ForPop(d, p.population_id))) || 0
      ) === 1 && d.finemapping?.cs_99,
  }));

  const scale = window.devicePixelRatio || 1;

  const plotCanvas = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.height = height * scale;
    canvas.width = width * scale;

    const ctx = canvas.getContext("2d")!;

    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    ctx.lineWidth = 1;

    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    // Y Axis
    // ====================================================

    ctx.save();

    ctx.transform(1, 0, 0, 1, margin.left, margin.top);

    const ticks = yScale.ticks();
    for (let i = 0; i < ticks.length; i += 1) {
      const t = ticks[i];
      const y = yScale(t) || 0;

      ctx.beginPath();
      ctx.moveTo(-5, y);
      ctx.lineTo(0, y);
      ctx.strokeStyle = "yellow:";
      ctx.stroke();

      ctx.font = "10px sans-serif";
      ctx.fillStyle = "#000";
      const { width: tickLabelWidth } = ctx.measureText(`${t}`);
      ctx.fillText(`${t}`, -(9 + tickLabelWidth), y + 3);

      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.strokeStyle = "#e4e4e4";
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, h);
    ctx.strokeStyle = "#333";
    ctx.stroke();

    ctx.font = "14px sans-serif";
    const { width: yLabelWidth } = ctx.measureText(yLabel);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(yLabel, -(h + yLabelWidth) / 2, -40);

    ctx.restore();

    // X Axis
    // ====================================================

    ctx.save();

    ctx.transform(1, 0, 0, 1, margin.left, height - margin.bottom);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w, 0);
    ctx.strokeStyle = "#333";
    ctx.stroke();

    ctx.restore();

    // Points
    // ====================================================

    ctx.save();

    ctx.transform(1, 0, 0, 1, margin.left, margin.top);

    if (ctx.clip) {
      ctx.beginPath();
      ctx.rect(1, 1, w - 2, h - 2);
      ctx.clip();
    }

    for (let i = 0; i < points.length; i += 1) {
      const point = points[i];

      if (
        selectedVariant &&
        point.data.locus.position == selectedVariant.locus.position
      ) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI, false);
        ctx.fillStyle = "red";
        ctx.fill();
      }

      ctx.beginPath();

      if (point.data.finemapping && showCorrelations) {
        if (point.isLead) {
          ctx.arc(point.x, point.y, 6, 0, 2 * Math.PI, false);
          ctx.fillStyle = "purple";
          ctx.fill();
        } else {
          ctx.arc(point.x, point.y, 3.5, 0, 2 * Math.PI, false);
          ctx.fillStyle = colorScale(
            1 - getR2ForPop(point.data, r2PopulationId)
          ) as string;
          ctx.fill();
          ctx.lineWidth = 0.3;
          ctx.stroke();
        }
      } else {
        ctx.arc(point.x, point.y, 3.5, 0, 2 * Math.PI, false);
        ctx.fillStyle = pointColor(point.data);
        ctx.fill();
      }

      if (point.data.ui && point.data.ui.isFiltered) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 10, 0, 2 * Math.PI, false);
        ctx.strokeStyle = "red";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.strokeStyle = "black";
      }
      ctx.stroke();
    }

    ctx.restore();

    // Significance thresholds
    // ====================================================

    ctx.save();

    ctx.transform(1, 0, 0, 1, margin.left, margin.top);

    thresholds.forEach((threshold) => {
      const thresholdY = yScale(-Math.log10(threshold.value)) || 0;
      ctx.beginPath();
      ctx.moveTo(0, thresholdY);
      ctx.lineTo(w, thresholdY);
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = threshold.color || "#333";
      ctx.stroke();

      if (threshold.label) {
        ctx.font = "14px sans-serif";
        ctx.fillStyle = "#000";
        ctx.fillText(threshold.label, 2, thresholdY - 4);
      }
    });

    ctx.restore();

    // ====================================================

    return canvas;
  }, [intervalVariants, height, pointColor, width, xLabel, yLabel, thresholds]);

  const mainCanvas: {
    current: HTMLCanvasElement | null;
  } = useRef<HTMLCanvasElement>(null);

  const drawPlot = () => {
    const canvas = mainCanvas.current;
    if (canvas) {
      const ctx: CanvasRenderingContext2D = canvas.getContext("2d")!;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(plotCanvas, 0, 0, width, height);
    }
  };

  useEffect(drawPlot);

  const findNearestPoint = (x = 0, y = 0, distanceThreshold = 5) => {
    let nearestPoint;
    let minDistance = Infinity;

    for (let i = 0; i < points.length; i += 1) {
      const p = points[i];
      const d = Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2);
      if (d < minDistance) {
        nearestPoint = p;
        minDistance = d;
      }
    }

    return minDistance <= distanceThreshold ? nearestPoint : undefined;
  };

  const updateHoveredPoint = (x: number, y: number) => {
    const nearestPoint = findNearestPoint(x, y);

    drawPlot();

    if (nearestPoint) {
      const canvas = mainCanvas.current;
      if (canvas) {
        const ctx = canvas.getContext("2d")!;
        ctx.save();

        ctx.transform(1, 0, 0, 1, margin.left, margin.top);

        ctx.font = "14px sans-serif";
        const label = pointLabel(nearestPoint.data);
        const { width: textWidth } = ctx.measureText(label);

        const labelX =
          x < width / 2 ? nearestPoint.x : nearestPoint.x - textWidth - 10;
        const labelY = y < 30 ? nearestPoint.y : nearestPoint.y - 24;

        ctx.beginPath();
        ctx.rect(labelX, labelY, textWidth + 12, 24);
        ctx.fillStyle = "#000";
        ctx.fill();

        ctx.fillStyle = "#fff";
        ctx.fillText(label, labelX + 6, labelY + 16);

        ctx.restore();
      }
    }
  };

  const onMouseMove = (event: React.MouseEvent) => {
    const bounds = (event.target as HTMLElement).getBoundingClientRect();
    const mouseX = event.clientX - bounds.left - margin.left;
    const mouseY = event.clientY - bounds.top - margin.top;
    updateHoveredPoint(mouseX, mouseY);
  };

  const onClick = (event: React.MouseEvent) => {
    const bounds = (event.target as HTMLElement).getBoundingClientRect();
    const clickX = event.clientX - bounds.left - margin.left;
    const clickY = event.clientY - bounds.top - margin.top;

    const point = findNearestPoint(clickX, clickY);
    if (point) {
      onClickPoint(point.data);
    }
  };

  return (
    <PlotWrapper>
      <canvas
        ref={mainCanvas}
        height={height * scale}
        width={(width - rightPanelWidth) * scale}
        style={{
          height: `${height}px`,
          width: `${width - rightPanelWidth}px`,
        }}
        onClick={onClick}
        onMouseLeave={drawPlot}
        onMouseMove={onMouseMove}
      />
      {!hideLegend && (
        <Legend rightPanelWidth={rightPanelWidth} height={height}>
          <p>
            <strong>Correlation with lead SNP (r&sup2;)</strong>
          </p>
          <LegendItems>
            {[0, 0.2, 0.4, 0.6, 0.8, 1.0].reverse().map((value) => (
              <li key={value}>
                <LegendIcon color={colorScale(1 - value)} />
                {value}
              </li>
            ))}
          </LegendItems>
          <div style={{ display: "flex", flexDirection: "row" }}>
            <p>r&sup2; population</p>
            <select
              style={{ fontSize: "0.8em" }}
              id="analysis-select"
              value={r2PopulationId}
              onChange={onChangeR2Population}
            >
              {finemappingPops.map((population) => (
                <option
                  value={population.population_id}
                  key={`fm-pop-dropdown${population.population_id}`}
                >
                  {population.population_id}
                </option>
              ))}
            </select>
          </div>
        </Legend>
      )}
    </PlotWrapper>
  );
};
