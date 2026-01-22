export interface VariantAssociationHdsB602Fafeb990 {
  ac_cases: number | null;
  ac_controls: number | null;
  af_cases: number | null;
  af_controls: number | null;
  allele_count: number | null;
  allele_frequency: number | null;
  allele_number: number | null;
  alt: string;
  an_cases: number;
  an_controls: number | null;
  analysis_id: string;
  ancestry_group: string;
  association_ac: number;
  association_af: number;
  association_an: number;
  beta: number;
  consequence: null | string;
  gene_symbol: null | string;
  hgvsc: null | string;
  hgvsp: null | string;
  homozygote_count: number | null;
  locus: Locus;
  pvalue: number;
  pvalue_expected: number;
  ref: string;
  sequencing_type: string;
  xpos: number;
}

export interface Locus {
  contig: string;
  position: number;
}
