-- Transform SQL for exome_annotations
-- Transforms staging_exome_raw -> exome_annotations
--
-- This query extracts canonical transcript fields from VEP annotations
-- and computes xpos from locus coordinates.

INSERT INTO exome_annotations
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

    -- VEP transcript extraction: prefer canonical (canonical=1), fall back to first transcript.
    -- arrayFirst returns default (empty) struct when no element matches, so we check length first.
    multiIf(
        length(arrayFilter(x -> x.canonical = 1, vep.transcript_consequences)) > 0,
        arrayFirst(x -> x.canonical = 1, vep.transcript_consequences).gene_id,
        length(vep.transcript_consequences) > 0,
        vep.transcript_consequences[1].gene_id,
        ''
    ) AS gene_id,
    multiIf(
        length(arrayFilter(x -> x.canonical = 1, vep.transcript_consequences)) > 0,
        arrayFirst(x -> x.canonical = 1, vep.transcript_consequences).gene_symbol,
        length(vep.transcript_consequences) > 0,
        vep.transcript_consequences[1].gene_symbol,
        ''
    ) AS gene_symbol,
    multiIf(
        length(arrayFilter(x -> x.canonical = 1, vep.transcript_consequences)) > 0,
        arrayFirst(x -> x.canonical = 1, vep.transcript_consequences).consequence_terms[1],
        length(vep.transcript_consequences) > 0,
        vep.transcript_consequences[1].consequence_terms[1],
        vep.most_severe_consequence
    ) AS consequence,
    multiIf(
        length(arrayFilter(x -> x.canonical = 1, vep.transcript_consequences)) > 0,
        arrayFirst(x -> x.canonical = 1, vep.transcript_consequences).hgvsc,
        length(vep.transcript_consequences) > 0,
        vep.transcript_consequences[1].hgvsc,
        ''
    ) AS hgvsc,
    multiIf(
        length(arrayFilter(x -> x.canonical = 1, vep.transcript_consequences)) > 0,
        arrayFirst(x -> x.canonical = 1, vep.transcript_consequences).hgvsp,
        length(vep.transcript_consequences) > 0,
        vep.transcript_consequences[1].hgvsp,
        ''
    ) AS hgvsp,
    multiIf(
        length(arrayFilter(x -> x.canonical = 1, vep.transcript_consequences)) > 0,
        arrayFirst(x -> x.canonical = 1, vep.transcript_consequences).amino_acids,
        length(vep.transcript_consequences) > 0,
        vep.transcript_consequences[1].amino_acids,
        ''
    ) AS amino_acids,
    multiIf(
        length(arrayFilter(x -> x.canonical = 1, vep.transcript_consequences)) > 0,
        arrayFirst(x -> x.canonical = 1, vep.transcript_consequences).polyphen_prediction,
        length(vep.transcript_consequences) > 0,
        vep.transcript_consequences[1].polyphen_prediction,
        ''
    ) AS polyphen2,
    multiIf(
        length(arrayFilter(x -> x.canonical = 1, vep.transcript_consequences)) > 0,
        arrayFirst(x -> x.canonical = 1, vep.transcript_consequences).lof,
        length(vep.transcript_consequences) > 0,
        vep.transcript_consequences[1].lof,
        ''
    ) AS lof,

    -- Convert Set to Array for filters
    arrayMap(x -> x, filters) AS filters
FROM staging_exome_raw;
