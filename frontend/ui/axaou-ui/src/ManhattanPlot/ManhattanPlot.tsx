import React, { useEffect, useMemo, useRef } from "react";

import { scaleLinear, scaleLog } from "d3-scale";
import type { ScaleLinear, ScaleLogarithmic } from "d3-scale";
// import { lighten } from "polished";

import type { AssociationVariant, FinemappingSummary } from "@axaou/types";

import { rotateColorByChromosome } from "./colorScales";

export const CHROMOSOMES = Array.from(
  new Array(22),
  (_, i) => `${i + 1}`
).concat(["X", "Y"]);

type threshold = {
  color: string;
  label: string;
  value: number;
  hideThresholdLine?: boolean;
};

interface ManhattanPlotProps {
  chromosomes?: string[];
  variants: AssociationVariant[];
  height?: number;
  width?: number;
  onClickPoint?: (variant: AssociationVariant) => void;
  pointColor?: any;
  pointLabel?(d: AssociationVariant): any;
  thresholds?: threshold[];
  finemappingSummary?: FinemappingSummary[] | [];
  xLabel?: string;
  yLabel?: string;
}

export const ManhattanPlot: React.FC<ManhattanPlotProps> = ({
  chromosomes = CHROMOSOMES,
  variants,
  height = 800,
  width = 1100,
  onClickPoint = (variant) => console.log(variant),
  pointColor = rotateColorByChromosome(["black", "grey"], CHROMOSOMES),
  pointLabel = (d) => d.variant_id,
  thresholds = [],
  // finemappingSummary = [],
  xLabel = "Chromosome",
  yLabel = "-log10(p)",
}) => {
  type positionExtents = {
    [chr: string]: { min: number; max: number };
  };

  const positionExtents: positionExtents = chromosomes.reduce(
    (acc, chr) => ({ ...acc, [chr]: { min: Infinity, max: -Infinity } }),
    Object.create(null)
  );

  for (let i = 0; i < variants.length; i += 1) {
    const d = variants[i];
    positionExtents[d.locus.contig].min = Math.min(
      positionExtents[d.locus.contig].min,
      d.locus.position
    );
    positionExtents[d.locus.contig].max = Math.max(
      positionExtents[d.locus.contig].max,
      d.locus.position
    );
  }

  const chromOffset: { [chrom: string]: number } = {};
  let cumulativePosition = 0;
  for (let i = 0; i < chromosomes.length; i += 1) {
    const chr = chromosomes[i];
    chromOffset[chr] = cumulativePosition;
    cumulativePosition += Math.max(
      0,
      positionExtents[chr].max - positionExtents[chr].min
    );
  }

  const margin = {
    bottom: 55,
    left: 60,
    right: 10,
    top: 10,
  };

  const xScale = scaleLinear()
    .domain([0, cumulativePosition])
    .range([0, width - margin.left - margin.right]);

  const yExtent = [0, 100];
  const yScaleLogThreshold = 10;

  const yScaleExtent = [yExtent[0], yScaleLogThreshold];
  const yScaleLogExtent = [yScaleLogThreshold, yExtent[1]];

  const plotHeight = height - margin.top - margin.bottom;

  const yScale = scaleLinear()
    .domain(yScaleExtent)
    .range([plotHeight, plotHeight / 3])
    .nice();

  const yScaleLog = scaleLog()
    .domain(yScaleLogExtent)
    .range([plotHeight / 3, 0])
    .nice();

  const yWithLogLogScale = (
    yScale: ScaleLinear<number, number>,
    yScaleLog: ScaleLogarithmic<number, number>
  ) => (log10PValue: number) => {
    let yScaled;
    if (log10PValue < yScaleLogThreshold) {
      yScaled = yScale(log10PValue);
    } else {
      yScaled = yScaleLog(log10PValue);
    }
    return yScaled;
  };

  const yScaleLogLog = yWithLogLogScale(yScale, yScaleLog);

  const points = variants.map((d) => {
    return {
      data: d,
      x:
        xScale(
          chromOffset[d.locus.contig] +
            d.locus.position -
            positionExtents[d.locus.contig].min
        ) || 0,
      y: yScaleLogLog(-Math.log10(d.association.pvalue)) || 0,
    };
  });

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

    const ticksLog = yScale.ticks();
    const ticksLogLog = yScaleLog.ticks().filter((_, i) => i % 2 != 0);

    const ticks = [...ticksLog, ...ticksLogLog];

    for (let i = 0; i < ticks.length; i += 1) {
      const t = ticks[i];
      const y = yScaleLogLog(t) || 0;

      ctx.beginPath();
      ctx.moveTo(-5, y);
      ctx.lineTo(0, y);
      ctx.strokeStyle = "#333";
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

    for (let i = 0; i < chromosomes.length; i += 1) {
      const chr = chromosomes[i];

      const x =
        xScale(
          chromOffset[chr] +
            (positionExtents[chr].max - positionExtents[chr].min) / 2
        ) || 0;

      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 3);
      ctx.strokeStyle = "#333";
      ctx.stroke();

      ctx.font = "12px sans-serif";
      ctx.fillStyle = "#000";
      const { width: tickLabelWidth } = ctx.measureText(chr);
      ctx.fillText(chr, x - tickLabelWidth / 2, 13);
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

    // Points
    // ====================================================

    ctx.save();

    ctx.transform(1, 0, 0, 1, margin.left, margin.top);

    if (ctx.clip) {
      ctx.beginPath();
      ctx.rect(1, 1, w - 2, h - 2);
      ctx.clip();
    }

    points.forEach((point) => {
      if (point.data.association.is_binned) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI, false);
        ctx.fillStyle = pointColor(point.data);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI, false);

        if (
          point.data.association.p_het &&
          point.data.association.p_het < 0.001
        ) {
          ctx.fillStyle = "orange";
          // ctx.strokeStyle = 'black';
          // ctx.stroke();
          ctx.fill();
          // } else if (
          //   finemappingSummary.some(
          //     (region) =>
          //       point.data.locus.contig == region.contig &&
          //       point.data.locus.position > region.start &&
          //       point.data.locus.position < region.stop,
          //   )
          // ) {
          //   ctx.fillStyle = lighten(0.4, '#152166');
          //   ctx.fill();
        } else {
          ctx.fillStyle = pointColor(point.data);
          ctx.fill();
        }

        if (point.data.ui && point.data.ui.isFiltered) {
          ctx.beginPath();
          ctx.arc(point.x, point.y, 10, 0, 2 * Math.PI, false);
          ctx.strokeStyle = "red";
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.strokeStyle = "black";
          ctx.lineWidth = 1;
        }
      }
    });

    ctx.restore();

    // Significance thresholds
    // ====================================================

    ctx.save();

    ctx.transform(1, 0, 0, 1, margin.left, margin.top);

    thresholds.forEach((threshold) => {
      const thresholdY = yScaleLogLog(-Math.log10(threshold.value)) || 0;
      ctx.beginPath();
      ctx.moveTo(0, thresholdY);
      ctx.lineTo(w, thresholdY);
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = threshold.color || "#333";

      if (!threshold.hideThresholdLine) {
        ctx.stroke();
      }

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
    chromosomes,
    variants,
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
