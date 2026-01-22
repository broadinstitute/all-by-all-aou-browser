export interface GeneAssociationsHds {
  gene_id: string;
  gene_symbol: string;
  annotation: string;
  max_maf: number;
  analysis_id: string;
  ancestry_group: string;
  pvalue?: number;
  pvalue_burden?: number;
  pvalue_skat?: number;
  beta_burden?: number;
  contig: string;
  gene_start_position: number;
  gene_interval: {
    start: {
      contig: string;
      position: number;
    };
    end: {
      contig: string;
      position: number;
    };
    includeStart: boolean;
    includeEnd: boolean;
  };
  pval?: number;
}

