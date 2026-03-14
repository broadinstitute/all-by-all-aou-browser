CREATE TABLE IF NOT EXISTS gene_summary (
    gene_id String,
    gene_symbol String,
    chrom String,
    start Int32,
    xstart Int64,
    gnomad_oe_lof Nullable(Float64),
    gnomad_pli Nullable(Float64),
    sig_phenos_variant_count UInt32,
    sig_phenos_burden_count UInt32,
    sig_phenos_burden_plof UInt32,
    sig_phenos_burden_missense UInt32,
    sig_phenos_burden_synonymous UInt32
) ENGINE = MergeTree() ORDER BY gene_id
