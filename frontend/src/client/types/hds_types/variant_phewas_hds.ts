export interface VariantPhewasHds {
    alt:             string;
    ancestry_group:  string;
    num_hits:        number;
    phewas:          Phewas[];
    ref:             string;
    sequencing_type: string;
    xpos:            number;
}

export interface Phewas {
    analysis_id: string;
    beta:        number;
    pvalue:      number;
}
