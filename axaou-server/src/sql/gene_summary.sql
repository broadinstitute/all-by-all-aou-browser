CREATE TABLE IF NOT EXISTS gene_summary (
    gene_id String,
    gene_symbol String,
    chrom String,
    sig_phenos_variant_count UInt32,
    sig_phenos_burden_count UInt32
) ENGINE = MergeTree() ORDER BY gene_id
