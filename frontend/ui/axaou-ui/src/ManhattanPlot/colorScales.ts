import type { Variant } from '@axaou/types';

export const rotateColorByChromosome = (
  colors: string[],
  chromosomes: string[],
) => {
  const chromosomeColors: { [chr: string]: string } = chromosomes.reduce(
    (acc, chr, i) => ({
      ...acc,
      [chr]: colors[i % colors.length],
    }),
    {},
  );

  return (d: Variant) => chromosomeColors[d.locus.contig];
};
