import React, { useEffect, useMemo, useRef } from "react";
import styled from "styled-components";

import { scaleLinear } from "d3-scale";

import type { ScalePosition } from "../RegionViewer/coordinates";
import type { Variant, Association, FinemappingResult } from "@karaogram/types";

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
  onClickPoint?: (d: FinemappedVariant) => void;
  pointColor?: (d: FinemappedVariant) => string;
  pointLabel?(d: FinemappedVariant): string;
  selectedVariant?: Variant | null;
  thresholds?: threshold[];
  xLabel?: string;
  yLabel?: string;
  r2PopulationId?: string;
  disableGridline?: boolean;
}

export const IntervalFMCredibleSetPlot = ({
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
  yLabel = "PIP",
  disableGridline = true,
}: Props) => {
  const csColor = "#1f77b4";
  const otherColor = "#7f7f7f";

  const margin = {
    bottom: 10,
    left: leftPanelWidth,
    right: rightPanelWidth,
    top: 10,
  };

  const finemappedVariants = variants.filter(
    (v) => v.finemapping
  ) as FinemappedVariant[];

  const yExtent = [0, 1];

  const yScale = scaleLinear()
    .domain(yExtent)
    .range([height - margin.top - margin.bottom, 0])
    .nice();

  const points = finemappedVariants.map((d) => ({
    data: d,
    x: scalePosition(d.locus.position) || 0,
    y: yScale(d.finemapping.prob) || 0,
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

    const ticks = yScale.ticks(5);
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
        ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI, false);
        ctx.fillStyle = "red";
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI, false);

      if (point.data.finemapping.cs_99) {
        ctx.fillStyle = csColor;
      } else {
        ctx.fillStyle = otherColor;
      }
      ctx.fill();
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
    finemappedVariants,
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
      <Legend>
        <LegendItems>
          <li>
            <LegendIcon color={csColor} />
            99% Credible set
          </li>
        </LegendItems>
      </Legend>
    </PlotWrapper>
  );
};
