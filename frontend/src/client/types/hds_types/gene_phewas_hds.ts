export interface GenePhewasHds {
    ancestry_group: string;
    annotation:     string;
    data:           Data[];
    gene_id:        string;
    gene_symbol:    string;
    max_maf:        number;
}

export interface Data {
    analysis_id:         string;
    ancestry_group:      string;
    annotation:          string;
    beta_burden:         number | null;
    contig:              null | string;
    gene_id:             string;
    gene_start_position: number | null;
    gene_symbol:         string;
    max_maf:             number;
    pvalue:              number | null;
    pvalue_burden:       number | null;
    pvalue_skat:         number | null;
    total_variants:      number | null;
}
