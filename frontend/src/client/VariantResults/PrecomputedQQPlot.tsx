import { scaleLinear } from 'd3-scale';
import React, { useEffect, useMemo, useRef } from 'react';
import { useTheme } from 'styled-components';

export interface QQPoint {
  x: number; // expected -log10(p)
  y: number; // observed -log10(p)
  label?: string;
}

interface Props {
  points: QQPoint[];
  height?: number;
  width?: number;
  xLabel?: string;
  yLabel?: string;
}

/**
 * Canvas-based QQ plot that renders pre-computed -log10(p) coordinates.
 * Designed for data from the /api/phenotype/:id/qq endpoint where
 * expected and observed values are already computed server-side.
 */
export const PrecomputedQQPlot: React.FC<Props> = ({
  points,
  height = 400,
  width = 600,
  xLabel = 'Expected -log10(p)',
  yLabel = 'Observed -log10(p)',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = useTheme() as any;
  const scale = window.devicePixelRatio || 1;

  const mini = width <= 250;
  const margin = mini
    ? { top: 6, right: 6, bottom: 42, left: 38 }
    : { top: 10, right: 10, bottom: 70, left: 60 };
  const tickFont = mini ? '7px sans-serif' : '10px sans-serif';
  const labelFont = mini ? '9px sans-serif' : '14px sans-serif';
  const pointRadius = mini ? 1 : 2;
  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;

  const { xScale, yScale, mappedPoints, yCap, cappedCount } = useMemo(() => {
    const maxX = points.reduce((m, p) => Math.max(m, p.x), 0);

    // Build a temporary scale to get tick spacing, then place the cap
    // one tick beyond the last tick that fits under the raw cap value.
    const rawCap = Math.max(maxX * 1.5, 10);
    const tmpScale = scaleLinear().domain([0, rawCap]).nice();
    const ticks = tmpScale.ticks();
    const tickStep = ticks.length >= 2 ? ticks[1] - ticks[0] : 1;
    // Last tick <= rawCap, then one more step
    const lastTick = ticks.filter((t) => t <= rawCap).pop() || rawCap;
    const cap = lastTick + tickStep;

    const numCapped = points.filter((p) => p.y > cap).length;

    const xs = scaleLinear()
      .domain([0, maxX * 1.05 || 1])
      .range([0, w])
      .nice();
    const ys = scaleLinear()
      .domain([0, cap * 1.05])
      .range([h, 0])
      .nice();

    const mapped = points.map((p) => ({
      px: xs(p.x) || 0,
      py: ys(Math.min(p.y, cap)) || 0,
      capped: p.y > cap,
      data: p,
    }));

    return { xScale: xs, yScale: ys, mappedPoints: mapped, yCap: cap, cappedCount: numCapped };
  }, [points, w, h]);

  const plotCanvas = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    // Y axis
    ctx.save();
    ctx.transform(1, 0, 0, 1, margin.left, margin.top);
    const yTickCount = Math.max(2, Math.floor(h / 40));
    const yTicks = yScale.ticks(yTickCount).filter((t) => t < yCap);
    for (const t of yTicks) {
      const y = yScale(t) || 0;
      ctx.beginPath();
      ctx.moveTo(-5, y);
      ctx.lineTo(0, y);
      ctx.strokeStyle = theme.border || '#333';
      ctx.stroke();
      ctx.font = tickFont;
      ctx.fillStyle = theme.text || '#000';
      const { width: tw } = ctx.measureText(`${t}`);
      ctx.fillText(`${t}`, -(9 + tw), y + 3);
    }
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, h);
    ctx.strokeStyle = theme.border || '#333';
    ctx.stroke();
    ctx.fillStyle = theme.text || '#000';
    ctx.font = labelFont;
    const { width: ylw } = ctx.measureText(yLabel);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(yLabel, -(h + ylw) / 2, mini ? -24 : -40);
    ctx.restore();

    // X axis
    ctx.save();
    ctx.transform(1, 0, 0, 1, margin.left, height - margin.bottom);
    const xTickCount = Math.max(2, Math.floor(w / 50));
    const xTicks = xScale.ticks(xTickCount);
    for (const t of xTicks) {
      const x = xScale(t) || 0;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 3);
      ctx.strokeStyle = theme.border || '#333';
      ctx.stroke();
      ctx.font = tickFont;
      ctx.fillStyle = theme.text || '#000';
      const { width: tw } = ctx.measureText(`${t}`);
      ctx.fillText(`${t}`, x - tw / 2, 13);
    }
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w, 0);
    ctx.strokeStyle = theme.border || '#333';
    ctx.stroke();
    ctx.font = labelFont;
    ctx.fillStyle = theme.text || '#000';
    const { width: xlw } = ctx.measureText(xLabel);
    ctx.fillText(xLabel, (w - xlw) / 2, mini ? 26 : 50);
    ctx.restore();

    // Y = X reference line
    ctx.save();
    ctx.transform(1, 0, 0, 1, margin.left, margin.top);
    const p1 = Math.max(xScale.domain()[0], yScale.domain()[0]);
    const p2 = Math.min(xScale.domain()[1], yScale.domain()[1]);
    ctx.beginPath();
    ctx.moveTo(xScale(p1) || 0, yScale(p1) || 0);
    ctx.lineTo(xScale(p2) || 0, yScale(p2) || 0);
    ctx.strokeStyle = theme.textMuted || '#888';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Points
    ctx.save();
    ctx.transform(1, 0, 0, 1, margin.left, margin.top);
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();
    const sigThreshold = 7.3; // -log10(5e-8)
    for (const pt of mappedPoints) {
      ctx.beginPath();
      ctx.arc(pt.px, pt.py, pointRadius, 0, 2 * Math.PI);
      ctx.fillStyle = pt.data.y >= sigThreshold ? '#c62828' : (theme.text || '#000');
      ctx.fill();
    }
    ctx.restore();

    // Genome-wide significance line (5e-8 => -log10 = 7.3)
    const sigLine = 7.3;
    if (yScale.domain()[1] >= sigLine) {
      ctx.save();
      ctx.transform(1, 0, 0, 1, margin.left, margin.top);
      const sy = yScale(sigLine) || 0;
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(w, sy);
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = theme.textMuted || '#999';
      ctx.stroke();
      ctx.font = tickFont;
      ctx.fillStyle = theme.textMuted || '#999';
      ctx.fillText('5×10⁻⁸', 2, sy - 4);
      ctx.restore();
    }

    return canvas;
  }, [mappedPoints, height, width, xScale, yScale, xLabel, yLabel, mini, theme]);

  const drawPlot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(plotCanvas, 0, 0, width, height);
  };

  useEffect(drawPlot);

  const onMouseMove = (event: React.MouseEvent) => {
    const bounds = (event.target as HTMLElement).getBoundingClientRect();
    const mx = event.clientX - bounds.left - margin.left;
    const my = event.clientY - bounds.top - margin.top;

    let nearest: (typeof mappedPoints)[0] | undefined;
    let minDist = Infinity;
    for (const pt of mappedPoints) {
      const d = Math.sqrt((pt.px - mx) ** 2 + (pt.py - my) ** 2);
      if (d < minDist) {
        nearest = pt;
        minDist = d;
      }
    }

    drawPlot();

    if (nearest && minDist <= 8 && nearest.data.label) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d')!;
      ctx.save();
      ctx.transform(1, 0, 0, 1, margin.left, margin.top);
      ctx.font = '12px sans-serif';
      const label = nearest.data.label;
      const { width: tw } = ctx.measureText(label);
      const lx = mx < w / 2 ? nearest.px + 6 : nearest.px - tw - 12;
      const ly = my < 30 ? nearest.py + 4 : nearest.py - 20;
      ctx.beginPath();
      ctx.rect(lx, ly, tw + 8, 18);
      ctx.fillStyle = theme.text || '#000';
      ctx.fill();
      ctx.fillStyle = theme.surface || '#fff';
      ctx.fillText(label, lx + 4, ly + 13);
      ctx.restore();
    }
  };

  return (
    <canvas
      ref={canvasRef}
      height={height * scale}
      width={width * scale}
      style={{ height: `${height}px`, width: `${width}px` }}
      onMouseMove={onMouseMove}
      onMouseLeave={drawPlot}
    />
  );
};
