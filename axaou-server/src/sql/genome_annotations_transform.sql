-- Transform SQL for genome_annotations
-- Transforms staging_genome_raw -> genome_annotations
--
-- This query extracts canonical transcript fields from VEP annotations
-- and computes xpos from locus coordinates.

INSERT INTO genome_annotations
WITH
    coalesce(vep.most_severe_consequence, most_severe_csq_variant) AS selected_consequence,
    arrayElement(
        arrayConcat(
            arrayFilter(x -> x.canonical = 1 AND has(x.consequence_terms, selected_consequence), vep.transcript_consequences),
            arrayFilter(x -> x.canonical = 1, vep.transcript_consequences),
            arrayFilter(x -> has(x.consequence_terms, selected_consequence), vep.transcript_consequences),
            vep.transcript_consequences
        ),
        1
    ) AS selected_transcript
SELECT
    -- Compute xpos from locus (chromosome index * 1B + position)
    (multiIf(
        locus.contig = 'chr1', 1,
        locus.contig = 'chr2', 2,
        locus.contig = 'chr3', 3,
        locus.contig = 'chr4', 4,
        locus.contig = 'chr5', 5,
        locus.contig = 'chr6', 6,
        locus.contig = 'chr7', 7,
        locus.contig = 'chr8', 8,
        locus.contig = 'chr9', 9,
        locus.contig = 'chr10', 10,
        locus.contig = 'chr11', 11,
        locus.contig = 'chr12', 12,
        locus.contig = 'chr13', 13,
        locus.contig = 'chr14', 14,
        locus.contig = 'chr15', 15,
        locus.contig = 'chr16', 16,
        locus.contig = 'chr17', 17,
        locus.contig = 'chr18', 18,
        locus.contig = 'chr19', 19,
        locus.contig = 'chr20', 20,
        locus.contig = 'chr21', 21,
        locus.contig = 'chr22', 22,
        locus.contig = 'chrX', 23,
        locus.contig = 'chrY', 24,
        locus.contig = 'chrM', 25,
        0
    ) * 1000000000 + locus.position) AS xpos,

    locus.contig AS contig,
    locus.position AS position,
    alleles[1] AS ref,
    alleles[2] AS alt,

    -- Frequency from nested struct (index 2 = alt allele, 1-indexed in ClickHouse)
    freq.`ALL`.AC[2] AS ac,
    freq.`ALL`.AF[2] AS af,
    freq.`ALL`.AN AS an,
    freq.`ALL`.homozygote_count[2] AS hom,

    -- VEP transcript extraction: use the first transcript in the priority-ordered
    -- candidate list computed above. All gene/HGVS fields come from that one row.
    -- Priority: 1) canonical + selected consequence, 2) canonical,
    --           3) selected consequence, 4) first transcript.
    selected_transcript.gene_id AS gene_id,
    selected_transcript.gene_symbol AS gene_symbol,
    -- Prefer VEP's severity-ranked consequence and preserve the source-level fallback.
    selected_consequence AS consequence,
    selected_transcript.hgvsc AS hgvsc,
    selected_transcript.hgvsp AS hgvsp,
    selected_transcript.amino_acids AS amino_acids,
    selected_transcript.polyphen_prediction AS polyphen2,
    selected_transcript.lof AS lof,

    -- Convert Set to Array for filters
    arrayMap(x -> x, filters) AS filters
FROM staging_genome_raw
LIMIT 1 BY locus.contig, locus.position, alleles[1], alleles[2];
