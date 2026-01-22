export interface AnalysisMetadataHds {
    analysis_id:               string;
    ancestry_group:            string;
    category:                  string;
    description:               string;
    description_more:          string;
    keep_pheno_burden:         boolean;
    keep_pheno_skat:           boolean;
    keep_pheno_skato:          boolean;
    lambda_gc_acaf:            number | null;
    lambda_gc_exome:           number | null;
    lambda_gc_gene_burden_001: number | null;
    n_cases:                   number;
    n_controls:                number | null;
    pheno_sex:                 string;
    trait_type:                string;
}
