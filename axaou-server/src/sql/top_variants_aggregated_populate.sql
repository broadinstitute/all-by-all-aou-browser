-- Populate top_variants_aggregated from significant_variants + annotation tables

INSERT INTO top_variants_aggregated
SELECT
    sv.xpos,
    sv.contig,
    sv.position,
    sv.ref,
    sv.alt,
    sv.ancestry,
    min(sv.pvalue) AS top_pvalue,
    argMin(sv.phenotype, sv.pvalue) AS top_phenotype,
    count() AS num_associations,
    any(coalesce(ea.gene_id, ga.gene_id)) AS gene_id,
    any(coalesce(ea.gene_symbol, ga.gene_symbol)) AS gene_symbol,
    any(coalesce(ea.consequence, ga.consequence)) AS consequence
FROM significant_variants sv
LEFT JOIN exome_annotations ea ON sv.xpos = ea.xpos AND sv.ref = ea.ref AND sv.alt = ea.alt
LEFT JOIN genome_annotations ga ON sv.xpos = ga.xpos AND sv.ref = ga.ref AND sv.alt = ga.alt
GROUP BY sv.xpos, sv.contig, sv.position, sv.ref, sv.alt, sv.ancestry;
