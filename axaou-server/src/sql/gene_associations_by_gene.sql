-- Denormalized copy of gene_associations sorted by gene_id for fast gene lookups.
-- The original table is partitioned by phenotype (3593 partitions), which makes
-- WHERE gene_id = ? queries scan every partition. This table has no partitioning
-- and is sorted by (gene_id, ancestry) so gene lookups read a single range.
CREATE TABLE IF NOT EXISTS gene_associations_by_gene (
    gene_id String,
    gene_symbol String,
    annotation LowCardinality(String),
    max_maf Float64,
    phenotype String,
    ancestry LowCardinality(String),
    pvalue Nullable(Float64),
    pvalue_burden Nullable(Float64),
    pvalue_skat Nullable(Float64),
    beta_burden Nullable(Float64),
    mac Nullable(Int64),
    contig LowCardinality(String),
    gene_start_position Int32,
    xpos Int64
) ENGINE = MergeTree
ORDER BY (gene_id, ancestry, annotation, phenotype)
