-- DDL for gene_models table
-- Contains gene model data including transcripts and gnomAD constraint metrics
--
-- Source: gs://axaou-browser-common/reference-data/genes_grch38_annotated_6.ht
-- Rows: ~62K

CREATE TABLE IF NOT EXISTS gene_models (
    -- Key
    gene_id              String,

    -- Queryable fields (for interval lookups)
    symbol               String,
    symbol_upper_case    String,
    chrom                LowCardinality(String),
    start                Int32,
    stop                 Int32,
    xstart               Int64,
    xstop                Int64,
    strand               LowCardinality(String),

    -- Metadata (flat)
    gene_version         Nullable(String),
    gencode_symbol       Nullable(String),
    name                 Nullable(String),
    hgnc_id              Nullable(String),
    ncbi_id              Nullable(String),
    omim_id              Nullable(String),
    reference_genome     LowCardinality(String),
    canonical_transcript_id    Nullable(String),
    preferred_transcript_id    Nullable(String),
    preferred_transcript_source Nullable(String),

    -- Simple arrays (converted from Sets)
    alias_symbols        Array(String),
    previous_symbols     Array(Nullable(String)),
    search_terms         Array(String),
    flags                Array(String),

    -- Exons: Use Nested (simple array of structs, native ClickHouse)
    `exons.feature_type` Array(String),
    `exons.start`        Array(Int32),
    `exons.stop`         Array(Int32),
    `exons.xstart`       Array(Int64),
    `exons.xstop`        Array(Int64),

    -- Flatten gnomad_constraint (single struct, queryable for pLI lookups)
    gnomad_gene                 Nullable(String),
    gnomad_gene_id              Nullable(String),
    gnomad_transcript           Nullable(String),
    gnomad_mane_select          Nullable(UInt8),
    gnomad_flags                Array(String),
    gnomad_pli                  Nullable(Float64),
    gnomad_lof_z                Nullable(Float64),
    gnomad_mis_z                Nullable(Float64),
    gnomad_syn_z                Nullable(Float64),
    gnomad_oe_lof               Nullable(Float64),
    gnomad_oe_lof_lower         Nullable(Float64),
    gnomad_oe_lof_upper         Nullable(Float64),
    gnomad_oe_mis               Nullable(Float64),
    gnomad_oe_mis_lower         Nullable(Float64),
    gnomad_oe_mis_upper         Nullable(Float64),
    gnomad_oe_syn               Nullable(Float64),
    gnomad_oe_syn_lower         Nullable(Float64),
    gnomad_oe_syn_upper         Nullable(Float64),
    gnomad_exp_lof              Nullable(Float64),
    gnomad_exp_mis              Nullable(Float64),
    gnomad_exp_syn              Nullable(Float64),
    gnomad_obs_lof              Nullable(Int64),
    gnomad_obs_mis              Nullable(Int64),
    gnomad_obs_syn              Nullable(Int64),

    -- Flatten mane_select_transcript (single struct, 5 fields)
    mane_ensembl_id             Nullable(String),
    mane_ensembl_version        Nullable(String),
    mane_refseq_id              Nullable(String),
    mane_refseq_version         Nullable(String),
    mane_matched_gene_version   Nullable(String),

    -- Transcripts: JSON (nested-of-nested too complex for Nested type)
    transcripts_json     String,

    -- Secondary indexes
    INDEX idx_symbol (symbol_upper_case) TYPE bloom_filter GRANULARITY 1,
    INDEX idx_xstart (xstart) TYPE minmax GRANULARITY 1,
    INDEX idx_xstop (xstop) TYPE minmax GRANULARITY 1
)
ENGINE = MergeTree()
ORDER BY (gene_id)
SETTINGS index_granularity = 8192
