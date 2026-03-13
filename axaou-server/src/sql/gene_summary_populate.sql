INSERT INTO gene_summary
WITH var_phenos AS (
    SELECT gene_id, count(DISTINCT top_phenotype) as cnt
    FROM top_variants_aggregated
    WHERE ancestry = 'meta' AND top_pvalue < 5e-8 AND gene_id != ''
    GROUP BY gene_id
),
burden_phenos AS (
    SELECT gene_id, count(DISTINCT phenotype) as cnt
    FROM gene_associations
    WHERE ancestry = 'meta' AND (pvalue < 2.5e-6 OR pvalue_burden < 2.5e-6 OR pvalue_skat < 2.5e-6) AND gene_id != ''
    GROUP BY gene_id
)
SELECT
    gm.gene_id,
    gm.symbol as gene_symbol,
    gm.chrom,
    coalesce(vp.cnt, 0) as sig_phenos_variant_count,
    coalesce(bp.cnt, 0) as sig_phenos_burden_count
FROM gene_models gm
LEFT JOIN var_phenos vp ON gm.gene_id = vp.gene_id
LEFT JOIN burden_phenos bp ON gm.gene_id = bp.gene_id
WHERE coalesce(vp.cnt, 0) > 0 OR coalesce(bp.cnt, 0) > 0
