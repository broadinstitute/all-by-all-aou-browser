import * as R from 'ramda';
import { scaleLinear } from 'd3-scale';
import type { ScaleLinear } from 'd3-scale';

export type ScalePosition = {
  (pos: number): number;
  invert: (scaledPosition: number) => number;
};

export interface MinimalRegion {
  start: number;
  stop: number;
}

export type Region = {
  feature_type: string;
  start: number;
  stop: number;
  previousRegionDistance: number;
  offset: number;
};

const sortRegions = (regions: Region[]) =>
  [...regions].sort((r1, r2) => r1.start - r2.start);

export const calculateRegionDistances = (regions: Region[]) =>
  regions.map((region, i) => {
    if (i === 0) {
      return {
        ...region,
        previousRegionDistance: Infinity,
      };
    }
    return {
      ...region,
      previousRegionDistance: region.start - regions[i - 1].stop,
    };
  });

const mergeOverlappingRegions = (sortedRegions: Region[]) => {
  if (sortedRegions.length === 0) {
    return [];
  }

  const mergedRegions = [{ ...sortedRegions[0] }];

  let previousRegion = mergedRegions[0];

  for (let i = 1; i < sortedRegions.length; i += 1) {
    const nextRegion = sortedRegions[i];

    if (nextRegion.start <= previousRegion.stop + 1) {
      if (nextRegion.stop > previousRegion.stop) {
        previousRegion.stop = nextRegion.stop;
      }
    } else {
      previousRegion = { ...nextRegion };
      mergedRegions.push(previousRegion);
    }
  }

  return mergedRegions;
};

export const addPadding = R.curry((padding, regions: Region[]) => {
  if (padding === 0) return regions;
  if (regions.length === 0) return [];
  return regions.reduce((acc: Region[], region): Region[] => {
    const startPad: Region = {
      feature_type: 'start_pad',
      start: region.start - padding,
      stop: region.start - 1,
      previousRegionDistance: 0,
      offset: 0,
    };

    const endPad: Region = {
      feature_type: 'end_pad',
      start: region.stop + 1,
      stop: region.stop + padding,
      previousRegionDistance: 0,
      offset: 0,
    };

    // check if total padding greater than distance between exons
    if (region.previousRegionDistance < padding * 2) {
      return [
        ...R.init(acc), // remove previous end_pad
        {
          feature_type: 'intron',
          start: region.start - region.previousRegionDistance,
          stop: region.start - 1,
          previousRegionDistance: 0,
          offset: 0,
        },
        region,
        endPad,
      ];
    }
    return [...acc, startPad, region, endPad];
  }, []);
});

export const calculateOffset = R.curry((regions: Region[]) =>
  regions.reduce((acc: Region[], region: Region, i) => {
    if (i === 0) return [{ ...region, offset: 0 }];
    return [
      ...acc,
      {
        ...region,
        offset: acc[i - 1].offset + (region.start - acc[i - 1].stop),
      },
    ];
  }, []),
);

const pipe = (...fns: any) => (x: any) =>
  fns.reduce((v: any, f: any) => f(v), x);

export const calculateOffsetRegions = (
  padding = 50,
  regions: MinimalRegion[],
): Region[] => {
  return pipe(
    sortRegions,
    mergeOverlappingRegions,
    calculateRegionDistances,
    addPadding(padding),
    calculateOffset,
  )(regions);
};

export const calculatePositionOffset = (regions: Region[]) => (
  position: number,
) => {
  const lastRegionBeforePosition = R.findLast<Region>(
    (region) => region.start <= position,
  )(regions);

  if (lastRegionBeforePosition) {
    // Position is within a region
    if (position < lastRegionBeforePosition.stop) {
      return {
        offsetPosition: position - lastRegionBeforePosition.offset,
      };
    }

    // Position is between regions
    return {
      offsetPosition:
        lastRegionBeforePosition.stop - lastRegionBeforePosition.offset,
    };
  }

  // Position is before first region
  return {
    offsetPosition: regions[0].start - regions[0].offset,
  };
};

export const invertPositionOffset = (
  regions: Region[],
  xScale: ScaleLinear<number, number>,
) => (scaledPosition: number) => {
  let result = 0;
  for (let i = 0; i < regions.length; i += 1) {
    if (
      scaledPosition >= xScale(regions[i].start - regions[i].offset)! &&
      scaledPosition <= xScale(regions[i].stop - regions[i].offset)!
    ) {
      result = Math.floor(xScale.invert(scaledPosition) + regions[i].offset);
    }
  }
  return result;
};

export const calculateXScale = (
  width: number,
  offsetRegions: Region[],
): ScaleLinear<number, number> =>
  scaleLinear()
    .domain([
      offsetRegions[0].start,
      offsetRegions[offsetRegions.length - 1].stop -
        offsetRegions[offsetRegions.length - 1].offset,
    ])
    .range([0, width]);
