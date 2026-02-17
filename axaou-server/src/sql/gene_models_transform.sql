-- Transform SQL for gene_models
-- Transforms staging_gene_models_raw -> gene_models
--
-- This query flattens nested structs, converts Sets to Arrays,
-- and serializes transcripts to JSON.

INSERT INTO gene_models
SELECT
    gene_id,
    symbol,
    symbol_upper_case,
    chrom,
    start,
    stop,
    xstart,
    xstop,
    strand,
    gene_version,
    gencode_symbol,
    name,
    hgnc_id,
    ncbi_id,
    omim_id,
    reference_genome,
    canonical_transcript_id,
    preferred_transcript_id,
    preferred_transcript_source,

    -- Convert Sets to Arrays
    arrayMap(x -> x, alias_symbols) AS alias_symbols,
    arrayMap(x -> x, previous_symbols) AS previous_symbols,
    arrayMap(x -> x, search_terms) AS search_terms,
    arrayMap(x -> x, flags) AS flags,

    -- Exons Nested columns (parallel arrays)
    arrayMap(x -> x.feature_type, exons) AS `exons.feature_type`,
    arrayMap(x -> x.start, exons) AS `exons.start`,
    arrayMap(x -> x.stop, exons) AS `exons.stop`,
    arrayMap(x -> x.xstart, exons) AS `exons.xstart`,
    arrayMap(x -> x.xstop, exons) AS `exons.xstop`,

    -- Flatten gnomad_constraint
    gnomad_constraint.gene AS gnomad_gene,
    gnomad_constraint.gene_id AS gnomad_gene_id,
    gnomad_constraint.transcript AS gnomad_transcript,
    gnomad_constraint.mane_select AS gnomad_mane_select,
    arrayMap(x -> x, gnomad_constraint.flags) AS gnomad_flags,
    gnomad_constraint.pli AS gnomad_pli,
    gnomad_constraint.lof_z AS gnomad_lof_z,
    gnomad_constraint.mis_z AS gnomad_mis_z,
    gnomad_constraint.syn_z AS gnomad_syn_z,
    gnomad_constraint.oe_lof AS gnomad_oe_lof,
    gnomad_constraint.oe_lof_lower AS gnomad_oe_lof_lower,
    gnomad_constraint.oe_lof_upper AS gnomad_oe_lof_upper,
    gnomad_constraint.oe_mis AS gnomad_oe_mis,
    gnomad_constraint.oe_mis_lower AS gnomad_oe_mis_lower,
    gnomad_constraint.oe_mis_upper AS gnomad_oe_mis_upper,
    gnomad_constraint.oe_syn AS gnomad_oe_syn,
    gnomad_constraint.oe_syn_lower AS gnomad_oe_syn_lower,
    gnomad_constraint.oe_syn_upper AS gnomad_oe_syn_upper,
    gnomad_constraint.exp_lof AS gnomad_exp_lof,
    gnomad_constraint.exp_mis AS gnomad_exp_mis,
    gnomad_constraint.exp_syn AS gnomad_exp_syn,
    gnomad_constraint.obs_lof AS gnomad_obs_lof,
    gnomad_constraint.obs_mis AS gnomad_obs_mis,
    gnomad_constraint.obs_syn AS gnomad_obs_syn,

    -- Flatten mane_select_transcript
    mane_select_transcript.ensembl_id AS mane_ensembl_id,
    mane_select_transcript.ensembl_version AS mane_ensembl_version,
    mane_select_transcript.refseq_id AS mane_refseq_id,
    mane_select_transcript.refseq_version AS mane_refseq_version,
    mane_select_transcript.matched_gene_version AS mane_matched_gene_version,

    -- Transcripts as JSON (nested-of-nested)
    toJSONString(transcripts) AS transcripts_json
FROM staging_gene_models_raw;
