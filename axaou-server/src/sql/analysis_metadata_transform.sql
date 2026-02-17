-- Transform SQL for analysis_metadata
-- Transforms staging_analysis_metadata_raw -> analysis_metadata
--
-- Maps source field names to frontend-expected names:
-- - phenoname -> analysis_id
-- - ancestry -> ancestry_group
-- - lambda_gc_*_hq -> lambda_gc_* (prefer HQ over raw)

INSERT INTO analysis_metadata
SELECT
    -- Keys
    phenoname AS analysis_id,
    ancestry AS ancestry_group,

    -- Core metadata
    category,
    description,
    description AS description_more,  -- No separate description_more in source
    trait_type,
    pheno_sex,

    -- Sample sizes
    n_cases,
    n_controls,

    -- Lambda GC (prefer HQ versions)
    lambda_gc_exome_hq AS lambda_gc_exome,
    lambda_gc_acaf_hq AS lambda_gc_acaf,
    lambda_gc_gene_hq AS lambda_gc_gene_burden_001,

    -- Burden test flags (default to available)
    1 AS keep_pheno_burden,
    1 AS keep_pheno_skat,
    1 AS keep_pheno_skato,

    -- Additional source fields
    disease_category,
    lambda_gc_exome_raw,
    lambda_gc_acaf_raw,
    lambda_gc_gene_raw
FROM staging_analysis_metadata_raw;

-- =============================================================================
-- Derive analysis_categories from analysis_metadata
-- =============================================================================

-- Create the categories table if it doesn't exist
CREATE TABLE IF NOT EXISTS analysis_categories (
    category             String,
    classification_group Nullable(String),
    color                String DEFAULT '#666666',
    analyses             Array(String),
    analysis_count       UInt32,
    phenocodes           Array(String),
    pheno_count          UInt32
)
ENGINE = MergeTree()
ORDER BY (category)
SETTINGS index_granularity = 8192;

-- Clear existing categories (replace strategy)
TRUNCATE TABLE analysis_categories;

-- Populate categories by aggregating from analysis_metadata
INSERT INTO analysis_categories
SELECT
    category,
    any(disease_category) AS classification_group,
    -- Assign colors based on category keywords
    multiIf(
        category LIKE '%cardiovascular%' OR category LIKE '%heart%', '#e41a1c',
        category LIKE '%neuro%' OR category LIKE '%brain%', '#377eb8',
        category LIKE '%metabolic%' OR category LIKE '%diabetes%', '#4daf4a',
        category LIKE '%cancer%' OR category LIKE '%neoplasm%', '#984ea3',
        category LIKE '%immune%' OR category LIKE '%autoimmune%', '#ff7f00',
        category LIKE '%respiratory%' OR category LIKE '%lung%', '#ffff33',
        category LIKE '%musculoskeletal%' OR category LIKE '%bone%', '#a65628',
        category LIKE '%renal%' OR category LIKE '%kidney%', '#f781bf',
        '#666666'
    ) AS color,
    groupUniqArray(analysis_id) AS analyses,
    uniq(analysis_id) AS analysis_count,
    groupUniqArray(analysis_id) AS phenocodes,
    uniq(analysis_id) AS pheno_count
FROM analysis_metadata
WHERE category IS NOT NULL AND category != ''
GROUP BY category
ORDER BY category;
