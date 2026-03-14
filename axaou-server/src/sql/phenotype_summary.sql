CREATE TABLE IF NOT EXISTS phenotype_summary (
    analysis_id String,
    description String,
    category String,
    trait_type String,
    pheno_sex String,
    lambda_gc_exome Nullable(Float64),
    n_cases Int32,
    n_controls Int32,
    sig_variants_count UInt32,
    sig_loci_count UInt32,
    sig_genes_count UInt32
) ENGINE = MergeTree() ORDER BY analysis_id
