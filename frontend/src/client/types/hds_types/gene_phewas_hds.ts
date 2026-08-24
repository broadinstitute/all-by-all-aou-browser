import type { BurdenDirection } from '../../geneAssociationSemantics'

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
    burden_direction:    BurdenDirection | null;
    contig:              null | string;
    gene_id:             string;
    gene_start_position: number | null;
    gene_symbol:         string;
    max_maf:             number;
    mac?:                number | null;
    mac_case?:           number | null;
    mac_control?:        number | null;
    pvalue:              number | null;
    pvalue_burden:       number | null;
    pvalue_skat:         number | null;
    total_variants:      number | null;
}
