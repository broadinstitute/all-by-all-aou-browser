-- DDL for genome_annotations table
-- Contains variant annotations for genome sequencing data
--
-- Source: gs://aou_results/414k/utils/aou_all_ACAF_variant_info_pruned_414k_annotated_filtered.ht
-- Rows: ~100M

CREATE TABLE IF NOT EXISTS genome_annotations (
    -- Position key
    xpos                 Int64,
    contig               LowCardinality(String),
    position             UInt32,
    ref                  String,
    alt                  String,

    -- Population frequencies (ALL only)
    ac                   Nullable(UInt32),
    af                   Nullable(Float64),
    an                   Nullable(UInt32),
    hom                  Nullable(UInt32),

    -- Functional annotations (from canonical VEP transcript)
    gene_id              Nullable(String),
    gene_symbol          Nullable(String),
    consequence          Nullable(String),
    hgvsc                Nullable(String),
    hgvsp                Nullable(String),
    amino_acids          Nullable(String),
    polyphen2            Nullable(String),
    lof                  Nullable(String),

    -- Filters
    filters              Array(String)
)
ENGINE = MergeTree()
PARTITION BY substring(contig, 4, 2)
ORDER BY (xpos, ref, alt)
SETTINGS allow_nullable_key = 1, index_granularity = 8192;
