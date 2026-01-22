import React, { useEffect, useMemo, useRef } from "react";
import styled from "styled-components";

import { scaleLinear } from "d3-scale";
import { transparentize } from "polished";

import type { ScalePosition } from "../RegionViewer/coordinates";
import type { Variant, Association, FinemappingResult } from "@axaou/types";
import { finemappingPops } from "../constants";

interface IntervalVariant extends Variant {
  association: Association;
  finemapping?: FinemappingResult;
}

interface FinemappedVariant extends Variant {
  association: Association;
  finemapping: FinemappingResult;
}

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
  pointLabel?(d: IntervalVariant): string;
  selectedVariant?: Variant | null;
  thresholds?: threshold[];
  xLabel?: string;
  yLabel?: string;
  disableGridline?: boolean;
  activeFMPops?: string[];
  onClickPopulationLegend?: (e: React.ChangeEvent<any>) => void;
  hideLegend?: boolean;
}

export const IntervalFMCorrelationPlot = ({
  variants = [],
  scalePosition,
  leftPanelWidth,
  rightPanelWidth,
  height = 400,
  width = 1100,
  onClickPoint = (d) => console.log(JSON.stringify(d)),
  pointColor = () => "black",
  pointLabel = (d) => JSON.stringify(d),
  selectedVariant,
  thresholds = [],
  xLabel = "",
  yLabel = "r\u00B2",
  disableGridline = true,
  activeFMPops = finemappingPops.map((p) => p.population_id),
  onClickPopulationLegend,
  hideLegend = false,
}: Props) => {
  const margin = {
    bottom: 20,
    left: leftPanelWidth,
    right: rightPanelWidth,
    top: 10,
  };

  const intervalVariants = variants.filter(
    (v) => v.association
  ) as IntervalVariant[];

  const getR2ForPop = (variant: FinemappedVariant, population_id: string) => {
    if (variant.finemapping.correlations) {
      const correlationResult = variant.finemapping.correlations.find(
        (c) => c.population_id === population_id
      );
      return correlationResult?.r2 || 0;
    }
    return 0;
  };

  const finemappedVariants = intervalVariants.filter(
    (v) => v.finemapping && v.finemapping.correlations
  ) as FinemappedVariant[];

  const yExtent = [0, 1.05];

  const yScale = scaleLinear()
    .domain(yExtent)
    .range([height - margin.top - margin.bottom, 0])
    .nice();

  const points = finemappedVariants.flatMap((d) =>
    finemappingPops.map((population) => ({
      data: d,
      x: scalePosition(d.locus.position) || 0,
      y: yScale(getR2ForPop(d, population.population_id)) || 0,
      color: population.color,
      population_id: population.population_id,
    }))
  );

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

    // let tickCount

    // if (height <= 200) {
    //   tickCount = 7
    // }

    const ticks = yScale.ticks();
    for (let i = 0; i < ticks.length - 1; i += 1) {
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

      if (!disableGridline) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.strokeStyle = "#e4e4e4";
        ctx.stroke();
      }
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
        ctx.arc(point.x, point.y, 3.5, 0, 2 * Math.PI, false);
        ctx.fillStyle = "red";
        ctx.fill();
      }

      if (activeFMPops.includes(point.population_id)) {
        ctx.beginPath();
        if (point.data.finemapping.cs) {
          // ctx.fillStyle = ;
          ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI, false);
          ctx.fillStyle = transparentize(0.5, point.color);
          ctx.fill();
        } else {
          ctx.arc(point.x, point.y, 3.5, 0, 2 * Math.PI, false);
          ctx.fillStyle =
            activeFMPops.length === 1
              ? point.color
              : transparentize(0.9, point.color);
          ctx.fill();
        }
      }
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
  }, [
    intervalVariants,
    activeFMPops,
    height,
    pointColor,
    width,
    xLabel,
    yLabel,
    thresholds,
  ]);

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

  const PlotWrapper = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
  `;

  const Legend = styled.div`
    display: flex;
    flex-direction: column;
    width: ${rightPanelWidth}px;
    height: ${height}px;
    align-items: center;
    justify-content: center;

    p {
      max-width: 100px;
      text-align: center;
      padding-left: 20px;
    }
  `;

  const LegendColumns = styled.div`
    display: flex;
    flex-direction: row;
  `;

  const PopulationsLegend = styled.ul`
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

  const LegendIcon = styled.div<{ isActive: boolean; color: string }>`
    width: 20px;
    height: 20px;
    background-color: ${(props) =>
      props.isActive ? props.color : transparentize(0.2, props.color)};
    margin-right: 5px;
  `;
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
        <Legend>
          <p>
            <strong>gnomAD population</strong>
          </p>
          <LegendColumns>
            <PopulationsLegend>
              {finemappingPops.slice(0, 5).map((population) => (
                <li
                  onMouseDown={onClickPopulationLegend}
                  value={population.population_id}
                  key={`pop-cb-${population.population_id}`}
                >
                  <LegendIcon
                    color={population.color}
                    isActive={activeFMPops.includes(population.population_id)}
                  />

                  {population.population_id.toUpperCase()}
                  <input
                    value={population.population_id}
                    onClick={onClickPopulationLegend}
                    type="checkbox"
                    defaultChecked={activeFMPops.includes(
                      population.population_id
                    )}
                  />
                </li>
              ))}
            </PopulationsLegend>
            <PopulationsLegend>
              {finemappingPops.slice(5).map((population) => (
                <li key={`pop-cb-${population.population_id}`}>
                  <LegendIcon
                    color={population.color}
                    isActive={activeFMPops.includes(population.population_id)}
                  />

                  {population.population_id.toUpperCase()}
                  <input
                    value={population.population_id}
                    onClick={onClickPopulationLegend}
                    type="checkbox"
                    defaultChecked={activeFMPops.includes(
                      population.population_id
                    )}
                  />
                </li>
              ))}
            </PopulationsLegend>
          </LegendColumns>
        </Legend>
      )}
    </PlotWrapper>
  );
};
