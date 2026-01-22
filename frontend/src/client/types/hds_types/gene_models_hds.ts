export interface GeneModelsHds {
    alias_symbols:               string[];
    canonical_transcript_id:     string;
    chrom:                       string;
    exons:                       Exon[];
    flags:                       string[];
    gencode_symbol:              string;
    gene_id:                     string;
    gene_version:                string;
    gnomad_constraint:           GnomadConstraint | null;
    hgnc_id:                     string;
    interval:                    any;
    locus:                       Locus;
    mane_select_transcript:      ManeSelectTranscript;
    name:                        string;
    ncbi_id:                     string;
    omim_id:                     string;
    preferred_transcript_id:     string;
    preferred_transcript_source: string;
    previous_symbols:            Array<null | string> | null;
    reference_genome:            string;
    search_terms:                string[];
    start:                       number;
    stop:                        number;
    strand:                      string;
    symbol:                      string;
    symbol_upper_case:           string;
    transcripts:                 Transcript[];
    xstart:                      number;
    xstop:                       number;
}

export interface Exon {
    feature_type: string;
    start:        number;
    stop:         number;
    xstart:       number;
    xstop:        number;
}

export interface GnomadConstraint {
    exp_lof:      number;
    exp_mis:      number;
    exp_syn:      number;
    flags:        string[];
    gene:         string;
    gene_id:      string;
    lof_z:        number;
    mane_select:  boolean;
    mis_z:        number;
    obs_lof:      number;
    obs_mis:      number;
    obs_syn:      number;
    oe_lof:       number;
    oe_lof_lower: number;
    oe_lof_upper: number;
    oe_mis:       number;
    oe_mis_lower: number;
    oe_mis_upper: number;
    oe_syn:       number;
    oe_syn_lower: number;
    oe_syn_upper: number;
    pli:          number;
    syn_z:        number;
    transcript:   string;
}

export interface Locus {
    contig:   string;
    position: number;
}

export interface ManeSelectTranscript {
    ensembl_id:           string;
    ensembl_version:      string;
    matched_gene_version: string;
    refseq_id:            string;
    refseq_version:       string;
}

export interface Transcript {
    chrom:              string;
    exons:              TranscriptExon[];
    gene_id:            string;
    gene_version:       string;
    interval:           any;
    reference_genome:   string;
    refseq_id:          null | string;
    refseq_version:     null | string;
    start:              number;
    stop:               number;
    strand:             string;
    transcript_id:      string;
    transcript_version: string;
    xstart:             number;
    xstop:              number;
}

export interface TranscriptExon {
    feature_type: string;
    start:        number;
    stop:         number;
    xstart:       number;
    xstop:        number;
}
