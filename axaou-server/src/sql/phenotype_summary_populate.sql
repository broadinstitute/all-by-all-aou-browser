INSERT INTO phenotype_summary
WITH sig_variants AS (
    SELECT phenotype, count() as cnt FROM significant_variants WHERE pvalue < 5e-8 AND ancestry = 'meta' GROUP BY phenotype
),
sig_loci AS (
    SELECT phenotype, count() as cnt FROM loci WHERE ancestry = 'meta' GROUP BY phenotype
),
sig_genes AS (
    SELECT phenotype, count(DISTINCT gene_id) as cnt FROM gene_associations WHERE ancestry = 'meta' AND (pvalue < 2.5e-6 OR pvalue_burden < 2.5e-6 OR pvalue_skat < 2.5e-6) GROUP BY phenotype
)
SELECT
    am.analysis_id,
    coalesce(am.description, am.analysis_id),
    coalesce(am.category, 'Unknown'),
    am.trait_type,
    am.pheno_sex,
    am.lambda_gc_exome,
    coalesce(am.n_cases, 0),
    coalesce(am.n_controls, 0),
    coalesce(sv.cnt, 0),
    coalesce(sl.cnt, 0),
    coalesce(sg.cnt, 0)
FROM analysis_metadata am
LEFT JOIN sig_variants sv ON am.analysis_id = sv.phenotype
LEFT JOIN sig_loci sl ON am.analysis_id = sl.phenotype
LEFT JOIN sig_genes sg ON am.analysis_id = sg.phenotype
WHERE lower(am.ancestry_group) = 'meta'
  AND coalesce(am.category, '') != 'random_phenotype'
  AND coalesce(am.description, '') NOT LIKE '%random%'
  AND coalesce(am.description, '') NOT LIKE '%PFHH%'
  AND coalesce(am.description, '') NOT LIKE '%County%'
  AND am.analysis_id != '654'
