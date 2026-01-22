/**
 * Shared definitions currently required for genebass-style web app
 */
export interface AxouConfig {
    ancestry_codes?:                  string[];
    burden_pvalue_fields?:            string[];
    burden_set_membership?:           string;
    burden_sets?:                     string[];
    data_name?:                       string;
    default_max_maf?:                 MaxMAF;
    filter_genes?:                    string[];
    keep_analysis_metadata_fields?:   string[];
    keep_gene_analysis_fields?:       string[];
    keep_variant_analysis_fields?:    string[];
    keep_variant_annotation_fields?:  string[];
    keys?:                            string[];
    n_partitions_phewas?:             number;
    reference_genome?:                string;
    test_analyses?:                   string[];
    test_ancestry_codes?:             AncestryGroup[];
    test_gene_symbols?:               string[];
    test_intervals?:                  string[];
    top_gene_associations_threshold?: number;
    variant_phewas_threshold?:        number;
    variant_pvalue_field?:            string;
    variant_pvalue_threshold?:        number;
    [property: string]: any;
}

/**
 * Enumeration of allowed maximum minor allele frequency (MAF) values.
 *
 * - **value_0_01**: A max MAF of 0.01
 * - **value_0_001**: A max MAF of 0.001
 */
export enum MaxMAF {
    The0001 = "0.001",
    The001 = "0.01",
}

export enum AncestryGroup {
    AMR = "amr",
    Afr = "afr",
    EAS = "eas",
    Eur = "eur",
    Meta = "meta",
    Mid = "mid",
    SAS = "sas",
}
