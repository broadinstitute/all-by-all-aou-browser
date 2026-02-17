-- DDL for analysis_metadata table
-- Contains phenotype/analysis metadata for the browser
--
-- Source: gs://aou_results/414k/utils/aou_phenotype_meta_info.ht
-- Rows: ~25K (3600 phenotypes x 7 ancestries)

CREATE TABLE IF NOT EXISTS analysis_metadata (
    -- Keys (matches frontend AnalysisMetadataHds)
    analysis_id          String,                       -- phenoname from source
    ancestry_group       LowCardinality(String),       -- ancestry from source

    -- Core metadata
    category             Nullable(String),
    description          Nullable(String),
    description_more     Nullable(String),             -- derived: same as description for now
    trait_type           LowCardinality(String),       -- binary/continuous
    pheno_sex            LowCardinality(String),       -- both_sexes/females/males

    -- Sample sizes
    n_cases              Nullable(Int32),
    n_controls           Nullable(Int32),

    -- Lambda GC statistics (genomic inflation factors)
    lambda_gc_exome      Nullable(Float64),            -- lambda_gc_exome_hq from source
    lambda_gc_acaf       Nullable(Float64),            -- lambda_gc_acaf_hq from source
    lambda_gc_gene_burden_001 Nullable(Float64),       -- lambda_gc_gene_hq from source

    -- Burden test availability flags (computed based on data availability)
    keep_pheno_burden    UInt8 DEFAULT 1,              -- assume available
    keep_pheno_skat      UInt8 DEFAULT 1,
    keep_pheno_skato     UInt8 DEFAULT 1,

    -- Additional fields from source (for reference/debugging)
    disease_category     Nullable(String),
    lambda_gc_exome_raw  Nullable(Float64),
    lambda_gc_acaf_raw   Nullable(Float64),
    lambda_gc_gene_raw   Nullable(Float64),

    -- Indexes for common query patterns
    INDEX idx_category (category) TYPE bloom_filter GRANULARITY 1,
    INDEX idx_ancestry (ancestry_group) TYPE bloom_filter GRANULARITY 1
)
ENGINE = MergeTree()
ORDER BY (analysis_id, ancestry_group)
SETTINGS index_granularity = 8192;
