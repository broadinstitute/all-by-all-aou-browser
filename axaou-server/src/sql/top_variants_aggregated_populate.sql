-- Populate top_variants_aggregated from significant_variants + annotation tables
-- For underflowed p-values (pvalue=0), uses loci_variants.neg_log10_p for true precision.
-- For normal p-values, computes -log10(pvalue) directly.

INSERT INTO top_variants_aggregated
SELECT
    sv.xpos,
    sv.contig,
    sv.position,
    sv.ref,
    sv.alt,
    sv.ancestry,
    sv.top_pvalue,
    if(sv.top_pvalue > 0,
       -log10(sv.top_pvalue),
       if(lv.max_neg_log10_p > 0, lv.max_neg_log10_p, 400)
    ) AS top_neg_log10_p,
    sv.top_phenotype,
    sv.num_associations,
    any(coalesce(ea.gene_id, ga.gene_id)) AS gene_id,
    any(coalesce(ea.gene_symbol, ga.gene_symbol)) AS gene_symbol,
    any(coalesce(ea.consequence, ga.consequence)) AS consequence
FROM (
    SELECT
        xpos, contig, position, ref, alt, ancestry,
        min(pvalue) AS top_pvalue,
        argMin(phenotype, pvalue) AS top_phenotype,
        count() AS num_associations
    FROM significant_variants
    WHERE ancestry = 'meta'
    GROUP BY xpos, contig, position, ref, alt, ancestry
) sv
LEFT JOIN (
    -- Only used for pvalue=0 variants: get the actual -log10(p) from loci_variants
    SELECT xpos, max(neg_log10_p) AS max_neg_log10_p
    FROM loci_variants
    WHERE is_significant = true
    GROUP BY xpos
) lv ON sv.xpos = lv.xpos AND sv.top_pvalue = 0
LEFT JOIN exome_annotations ea ON sv.xpos = ea.xpos AND sv.ref = ea.ref AND sv.alt = ea.alt
LEFT JOIN genome_annotations ga ON sv.xpos = ga.xpos AND sv.ref = ga.ref AND sv.alt = ga.alt
GROUP BY sv.xpos, sv.contig, sv.position, sv.ref, sv.alt, sv.ancestry,
         sv.top_pvalue, sv.top_phenotype, sv.num_associations, lv.max_neg_log10_p;
