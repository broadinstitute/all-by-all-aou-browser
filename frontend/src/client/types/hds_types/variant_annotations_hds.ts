export interface VariantAnnotationsHds {
    allele_count:                number | null;
    allele_frequency:            number | null;
    allele_number:               number | null;
    alt:                         string;
    amino_acids:                 null | string;
    ancestry_group:              string;
    annotation:                  null | string;
    gene_id:                     string;
    gene_symbol:                 string;
    homozygote_count:            number | null;
    locus:                       Locus;
    polyphen2:                   null | string;
    ref:                         string;
    sequencing_type:             string;
    worst_csq_by_gene_canonical: WorstCsqByGeneCanonical[];
    xpos:                        number;
}

export interface Locus {
    contig:   string;
    position: number;
}

export interface WorstCsqByGeneCanonical {
    allele_num:              number;
    amino_acids:             null | string;
    appris:                  null | string;
    biotype:                 string;
    canonical:               number;
    ccds:                    null | string;
    cdna_end:                number | null;
    cdna_start:              number | null;
    cds_end:                 number | null;
    cds_start:               number | null;
    codons:                  null | string;
    consequence_terms:       string[];
    csq_score:               number;
    distance:                number | null;
    domains:                 WorstCsqByGeneCanonicalDomain[] | null;
    exon:                    null | string;
    flags:                   null | string;
    gene_id:                 string;
    gene_pheno:              number | null;
    gene_symbol:             string;
    gene_symbol_source:      string;
    hgnc_id:                 string;
    hgvs_offset:             number | null;
    hgvsc:                   null | string;
    hgvsp:                   null | string;
    impact:                  string;
    intron:                  null | string;
    lof:                     null | string;
    lof_filter:              null | string;
    lof_flags:               null | string;
    lof_info:                null | string;
    mane_plus_clinical:      null | string;
    mane_select:             null | string;
    mirna:                   Array<null | string> | null;
    most_severe_consequence: string;
    polyphen_prediction:     null | string;
    polyphen_score:          number | null;
    protein_end:             number | null;
    protein_id:              null | string;
    protein_start:           number | null;
    sift_prediction:         null | string;
    sift_score:              number | null;
    source:                  string;
    strand:                  number;
    transcript_id:           string;
    tsl:                     number | null;
    uniprot_isoform:         Array<null | string> | null;
    variant_allele:          string;
}

export interface WorstCsqByGeneCanonicalDomain {
    db:   null | string;
    name: null | string;
}
