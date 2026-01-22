/* eslint-disable react/display-name */
import { scaleLog } from "d3-scale";
import React, { forwardRef, useCallback, useEffect, useRef } from "react";
import type { ScalePosition } from "./coordinates";

const alleleFrequencyScale = scaleLog().domain([0.00001, 0.001]).range([4, 12]);

const drawEllipse = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number
) => {
  const K = 0.5522848;

  const xOffset = rx * K;
  const yOffset = ry * K;

  const x1 = cx - rx;
  const y1 = cy - ry;

  const x2 = cx + rx;
  const y2 = cy + ry;

  ctx.moveTo(x1, cy);
  ctx.bezierCurveTo(x1, cy - yOffset, cx - xOffset, y1, cx, y1);
  ctx.bezierCurveTo(cx + xOffset, y1, x2, cy - yOffset, x2, cy);
  ctx.bezierCurveTo(x2, cy + yOffset, cx + xOffset, y2, cx, y2);
  ctx.bezierCurveTo(cx - xOffset, y2, x1, cy + yOffset, x1, cy);
};

const useCombinedRefs = (
  refs: (
    | React.ForwardedRef<HTMLCanvasElement>
    | React.MutableRefObject<HTMLCanvasElement | null>
  )[]
) =>
  useCallback((element: any) => {
    refs.forEach((ref) => {
      if (!ref) {
        return;
      }

      if (typeof ref === "function") {
        ref(element);
      } else {
        ref.current = element; // eslint-disable-line no-param-reassign
      }
    });
  }, refs);

const Canvas = forwardRef<
  HTMLCanvasElement,
  {
    height: number;
    width: number;
    children: (arg: CanvasRenderingContext2D) => void;
    onMouseMove?: (e: React.MouseEvent) => void;
    onMouseLeave?: (e: React.MouseEvent) => void;
  }
>(({ children, height, width, ...otherProps }, ref) => {
  const element = useRef<HTMLCanvasElement>(null);
  const refs = useCombinedRefs([element, ref]);

  const scale = window.devicePixelRatio || 1;

  useEffect(() => {
    if (!element || !element.current) {
      return;
    }

    const context = element.current.getContext("2d");

    if (!children) {
      throw new Error("Need children");
    }

    if (context) {
      context.setTransform(scale, 0, 0, scale, 0, 0);
      children(context);
    }
  });

  return (
    <canvas
      {...otherProps}
      ref={refs}
      height={height * scale}
      width={width * scale}
      style={{
        height: `${height}px`,
        width: `${width}px`,
      }}
    />
  );
});

export interface Variant {
  allele_freq: number;
  consequence: string;
  isHighlighted: boolean;
  pos: number;
  variant_id: string;
}

interface VariantPlotProps {
  height?: number;
  scalePosition: ScalePosition;
  variants: Variant[];
  variantColor?: (v: Variant) => string;
  width: number;
  onHoverVariants?: (v: Variant[]) => void;
}

export const VariantsPlot = ({
  height = 60,
  scalePosition,
  variants,
  variantColor = () => "#757575",
  width,
  onHoverVariants,
}: VariantPlotProps) => {
  const canvas = useRef<HTMLCanvasElement>(null);

  const variantsWithX = variants.map((variant) => ({
    variant,
    variantX: scalePosition(variant.pos),
  }));

  const findNearbyVariants = (cursorX: number, threshold = 3) => {
    // TODO: optimize this using binary search in a copy of variants sorted by x
    return variantsWithX
      .map(({ variant, variantX }) => ({
        variant,
        distance: Math.abs(cursorX - variantX),
      }))
      .filter(({ distance }) => distance <= threshold)
      .sort(({ distance: d1 }, { distance: d2 }) => d1 - d2)
      .map(({ variant }) => variant);
  };

  let onMouseLeave;
  let onMouseMove;

  if (onHoverVariants && canvas && canvas.current) {
    onMouseMove = (e: React.MouseEvent) => {
      if (canvas.current) {
        const x = e.clientX - canvas.current.getBoundingClientRect().left;
        onHoverVariants(findNearbyVariants(x));
      }
    };

    onMouseLeave = () => {
      onHoverVariants([]);
    };
  }

  return (
    <Canvas
      ref={canvas}
      height={height}
      width={width}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      {(ctx: CanvasRenderingContext2D) => {
        const markerY = height / 2;

        ctx.clearRect(0, 0, width, height);
        ctx.lineWidth = 0.5;
        ctx.strokeStyle = "#000";

        variantsWithX.forEach(({ variant, variantX }) => {
          let rx;
          let ry;

          const fill = variantColor(variant);
          if (!variant.allele_freq) {
            rx = 1;
            ry = 1;
          } else {
            rx = 3;
            ry = alleleFrequencyScale(variant.allele_freq);
          }

          ctx.beginPath();
          drawEllipse(ctx, variantX, markerY, rx, ry || 0);
          ctx.closePath();
          ctx.fillStyle = fill;
          ctx.fill();
          ctx.lineWidth = 0.5;
          ctx.setLineDash([]);
          ctx.stroke();

          if (variant.isHighlighted) {
            ctx.beginPath();
            drawEllipse(ctx, variantX || 0, markerY, rx + 5, (ry || 1) + 5);
            ctx.closePath();
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.stroke();
          }
        });
      }}
    </Canvas>
  );
};
