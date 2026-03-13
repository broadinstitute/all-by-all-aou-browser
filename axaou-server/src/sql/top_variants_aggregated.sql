-- Derived table: top_variants_aggregated
-- Aggregates significant_variants by variant, yielding the most significant
-- phenotype per variant and the total count of significant associations.
-- Joined with annotation tables for gene symbol and consequence.

CREATE TABLE IF NOT EXISTS top_variants_aggregated (
    xpos Int64,
    contig LowCardinality(String),
    position Int32,
    ref String,
    alt String,
    ancestry LowCardinality(String),
    top_pvalue Float64,
    top_phenotype String,
    num_associations UInt64,
    gene_id Nullable(String),
    gene_symbol Nullable(String),
    consequence Nullable(String)
) ENGINE = MergeTree()
ORDER BY (ancestry, num_associations, top_pvalue);
