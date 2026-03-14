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
),
burden_plof AS (
    SELECT gene_id, count(DISTINCT phenotype) as cnt
    FROM gene_associations
    WHERE ancestry = 'meta' AND annotation = 'pLoF' AND (pvalue < 2.5e-6 OR pvalue_burden < 2.5e-6 OR pvalue_skat < 2.5e-6) AND gene_id != ''
    GROUP BY gene_id
),
burden_mis AS (
    SELECT gene_id, count(DISTINCT phenotype) as cnt
    FROM gene_associations
    WHERE ancestry = 'meta' AND annotation = 'missenseLC' AND (pvalue < 2.5e-6 OR pvalue_burden < 2.5e-6 OR pvalue_skat < 2.5e-6) AND gene_id != ''
    GROUP BY gene_id
),
burden_syn AS (
    SELECT gene_id, count(DISTINCT phenotype) as cnt
    FROM gene_associations
    WHERE ancestry = 'meta' AND annotation = 'synonymous' AND (pvalue < 2.5e-6 OR pvalue_burden < 2.5e-6 OR pvalue_skat < 2.5e-6) AND gene_id != ''
    GROUP BY gene_id
)
SELECT
    gm.gene_id,
    gm.symbol as gene_symbol,
    gm.chrom,
    gm.start,
    gm.xstart,
    gm.gnomad_oe_lof,
    gm.gnomad_pli,
    coalesce(vp.cnt, 0) as sig_phenos_variant_count,
    coalesce(bp.cnt, 0) as sig_phenos_burden_count,
    coalesce(bpl.cnt, 0) as sig_phenos_burden_plof,
    coalesce(bm.cnt, 0) as sig_phenos_burden_missense,
    coalesce(bs.cnt, 0) as sig_phenos_burden_synonymous
FROM gene_models gm
LEFT JOIN var_phenos vp ON gm.gene_id = vp.gene_id
LEFT JOIN burden_phenos bp ON gm.gene_id = bp.gene_id
LEFT JOIN burden_plof bpl ON gm.gene_id = bpl.gene_id
LEFT JOIN burden_mis bm ON gm.gene_id = bm.gene_id
LEFT JOIN burden_syn bs ON gm.gene_id = bs.gene_id
WHERE coalesce(vp.cnt, 0) > 0 OR coalesce(bp.cnt, 0) > 0
