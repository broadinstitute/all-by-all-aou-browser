import { min } from "d3-array";
import { scaleLinear } from "d3-scale";
import React, { useEffect, useMemo, useRef } from "react";

import type { Variant, Association } from "@axaou/types";

interface AssociationVariant extends Variant {
  association: Association;
}

type Threshold = {
  color: string;
  label: string;
  value: number;
};

interface Props {
  variants: Variant[];
  gridLines?: boolean;
  height?: number;
  width?: number;
  onClickPoint?: () => void;
  pointLabel?(d: Variant): any;
  thresholds?: Threshold[];
  xLabel?: string;
  yLabel?: string;
  xDomain?: number[];
  yDomain?: number[];
}

export const QQPlot: React.FC<Props> = ({
  variants,
  gridLines = true,
  height = 800,
  width = 1100,
  onClickPoint = (d: AssociationVariant) => console.log(d),
  pointLabel = (d) => d.variant_id,
  thresholds = [],
  xDomain = undefined,
  xLabel = "Expected -log10(p)",
  yDomain = undefined,
  yLabel = "Actual -log10(p)",
}) => {
  const associationVariants = variants.filter(
    (v) => v.association
  ) as AssociationVariant[];

  const minPval = min(associationVariants, (d) => d.association.pvalue) || 0;

  const margin = {
    bottom: 55,
    left: 60,
    right: 10,
    top: 10,
  };

  const xScale = scaleLinear().range([0, width - margin.left - margin.right]);

  if (xDomain === undefined) {
    xScale.domain([0, -Math.log10(1 / associationVariants.length)]).nice();
  } else {
    xScale.domain(xDomain);
  }

  const yScale = scaleLinear().range([height - margin.top - margin.bottom, 0]);

  if (yDomain === undefined) {
    yScale.domain([0, -Math.log10(minPval)]).nice();
  } else {
    yScale.domain(yDomain);
  }

  const sortedPoints = [...associationVariants].sort(
    (d1, d2) => d1.association.pvalue - d2.association.pvalue
  );
  const points = sortedPoints.map((d, i, arr) => ({
    x: xScale(-Math.log10((i + 1) / (arr.length + 1))) || 0,
    y: yScale(-Math.log10(d.association.pvalue)) || 0,
    data: d,
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

    const yTicks = yScale.ticks();
    for (let i = 0; i < yTicks.length; i += 1) {
      const t = yTicks[i];
      const y = yScale(t) || 0;

      ctx.beginPath();
      ctx.moveTo(-5, y);
      ctx.lineTo(0, y);
      ctx.strokeStyle = "#333";
      ctx.stroke();

      ctx.font = "10px sans-serif";
      ctx.fillStyle = "#000";
      const { width: tickLabelWidth } = ctx.measureText(`${t}`);
      ctx.fillText(`${t}`, -(9 + tickLabelWidth), y + 3);

      if (gridLines) {
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

    const xTicks = xScale.ticks();
    for (let i = 0; i < xTicks.length; i += 1) {
      const t = xTicks[i];
      const x = xScale(t) || 0;

      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 3);
      ctx.strokeStyle = "#333";
      ctx.stroke();

      ctx.font = "10px sans-serif";
      ctx.fillStyle = "#000";
      const { width: tickLabelWidth } = ctx.measureText(`${t}`);
      ctx.fillText(`${t}`, x - tickLabelWidth / 2, 13);
    }

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w, 0);
    ctx.strokeStyle = "#333";
    ctx.stroke();

    ctx.font = "14px sans-serif";
    const { width: xLabelWidth } = ctx.measureText(xLabel);
    ctx.fillText(xLabel, (w - xLabelWidth) / 2, 50);

    ctx.restore();

    // Y = X line
    // ====================================================

    ctx.save();

    ctx.transform(1, 0, 0, 1, margin.left, margin.top);

    ctx.beginPath();
    const p1 = Math.max(xScale.domain()[0], yScale.domain()[0]);
    const p1x = xScale(p1) || 0;
    const p1y = yScale(p1) || 0;
    ctx.moveTo(p1x, p1y);

    const p2 = Math.min(xScale.domain()[1], yScale.domain()[1]);
    const p2x = xScale(p2) || 0;
    const p2y = yScale(p2) || 0;
    ctx.lineTo(p2x, p2y);
    ctx.strokeStyle = "red";
    ctx.lineWidth = 2;
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

      ctx.beginPath();
      ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI, false);
      ctx.fillStyle = "#000";
      ctx.fill();
    }

    ctx.restore();

    // Significance thresholds
    // ====================================================

    thresholds.forEach((threshold) => {
      ctx.save();

      ctx.transform(1, 0, 0, 1, margin.left, margin.top);

      const thresholdY = yScale(-Math.log10(threshold.value)) || 0;
      ctx.beginPath();
      ctx.moveTo(0, thresholdY);
      ctx.lineTo(w, thresholdY);
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = threshold.color || "#333";
      ctx.stroke();

      if (threshold.label) {
        ctx.font = "10px sans-serif";
        ctx.fillStyle = "#000";
        ctx.fillText(threshold.label, 2, thresholdY - 4);
      }

      ctx.restore();
    });

    // ====================================================

    return canvas;
  }, [associationVariants, height, width, xLabel, yLabel, thresholds]);

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

  const findNearestPoint = (x: number, y: number, distanceThreshold = 5) => {
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
    <canvas
      ref={mainCanvas}
      height={height * scale}
      width={width * scale}
      style={{
        height: `${height}px`,
        width: `${width}px`,
      }}
      onClick={onClick}
      onMouseLeave={drawPlot}
      onMouseMove={onMouseMove}
    />
  );
};
