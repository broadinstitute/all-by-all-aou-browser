use async_trait::async_trait;
use genohype_mcp::types as mcp;
use genohype_mcp::GenomicDataProvider;

use crate::clickhouse::models::{
    GeneModelRow, VariantAnnotationExtendedRow,
};
use crate::clickhouse::xpos::{compute_xpos, make_variant_id, parse_variant_id};

/// MCP data provider backed by the AxAoU ClickHouse database.
///
/// Bridges ClickHouse queries for variant annotations, gene models,
/// and gene associations into the generic [`GenomicDataProvider`] trait.
pub struct AxaouMcpProvider {
    pub clickhouse: clickhouse::Client,
}

impl AxaouMcpProvider {
    pub fn new(clickhouse: clickhouse::Client) -> Self {
        Self { clickhouse }
    }
}

// ---------------------------------------------------------------------------
// Type conversions: ClickHouse rows → MCP types
// ---------------------------------------------------------------------------

fn annotation_to_variant_summary(row: &VariantAnnotationExtendedRow) -> mcp::VariantSummary {
    mcp::VariantSummary {
        variant_id: make_variant_id(&row.contig, row.position, &row.ref_allele, &row.alt),
        chrom: row.contig.clone(),
        pos: row.position as i64,
        ref_allele: row.ref_allele.clone(),
        alt_allele: row.alt.clone(),
        rsids: vec![],
        consequence: row.consequence.clone(),
        hgvsc: row.hgvsc.clone(),
        hgvsp: row.hgvsp.clone(),
        gene_id: row.gene_id.clone(),
        gene_symbol: row.gene_symbol.clone(),
        transcript_id: None,
        lof: row.lof.clone(),
        ac: row.ac.unwrap_or(0) as i64,
        an: row.an.unwrap_or(0) as i64,
        af: row.af.unwrap_or(0.0),
    }
}

fn annotation_to_variant_details(row: &VariantAnnotationExtendedRow) -> mcp::VariantDetails {
    let variant_id = make_variant_id(&row.contig, row.position, &row.ref_allele, &row.alt);
    let consequence = row.consequence.clone().unwrap_or_default();

    let transcript_consequence = if row.gene_id.is_some() || row.gene_symbol.is_some() {
        vec![mcp::TranscriptConsequence {
            gene_id: row.gene_id.clone().unwrap_or_default(),
            gene_symbol: row.gene_symbol.clone().unwrap_or_default(),
            transcript_id: String::new(),
            transcript_version: None,
            consequence_terms: vec![consequence.clone()],
            major_consequence: consequence,
            hgvsc: row.hgvsc.clone(),
            hgvsp: row.hgvsp.clone(),
            is_canonical: false,
            is_mane_select: false,
            lof: row.lof.clone(),
            lof_filter: None,
            lof_flags: None,
            biotype: None,
            domains: vec![],
            refseq_id: None,
        }]
    } else {
        vec![]
    };

    let in_silico = row.polyphen2.as_ref().map(|pp| mcp::InSilicoPredictors {
        revel: None,
        cadd: None,
        splice_ai: None,
        pangolin: None,
        phylop: None,
        polyphen: Some(pp.clone()),
        sift: None,
    });

    mcp::VariantDetails {
        variant_id,
        chrom: row.contig.clone(),
        pos: row.position as i64,
        ref_allele: row.ref_allele.clone(),
        alt_allele: row.alt.clone(),
        rsids: vec![],
        caid: None,
        ac: row.ac.map(|v| v as i64),
        an: row.an.map(|v| v as i64),
        af: row.af,
        homozygote_count: row.hom.map(|v| v as i64),
        hemizygote_count: None,
        exome: None,
        genome: None,
        joint: None,
        transcript_consequences: transcript_consequence,
        in_silico_predictors: in_silico,
        flags: row.filters.clone(),
        coverage: None,
    }
}

fn gene_model_to_summary(row: GeneModelRow) -> mcp::GeneSummary {
    let constraint = row.gnomad_pli.map(|_| mcp::GeneConstraint {
        pli: row.gnomad_pli,
        loeuf: row.gnomad_oe_lof_upper,
        mis_z: row.gnomad_mis_z,
        syn_z: row.gnomad_syn_z,
    });

    mcp::GeneSummary {
        gene_id: row.gene_id,
        gene_symbol: row.symbol,
        name: row.name,
        chrom: row.chrom,
        start: row.start as i64,
        stop: row.stop as i64,
        strand: Some(row.strand),
        canonical_transcript_id: row.canonical_transcript_id,
        constraint,
    }
}

// ---------------------------------------------------------------------------
// GenomicDataProvider implementation
// ---------------------------------------------------------------------------

#[async_trait]
impl GenomicDataProvider for AxaouMcpProvider {
    async fn get_variant_details(
        &self,
        variant_id: &str,
        _dataset: &str,
    ) -> anyhow::Result<Option<mcp::VariantDetails>> {
        let (xpos, ref_allele, alt_allele) = parse_variant_id(variant_id)
            .map_err(|e| anyhow::anyhow!("{e}"))?;

        // Try exome first, then genome
        for table in &["exome_annotations", "genome_annotations"] {
            let query = format!(
                "SELECT xpos, contig, position, ref, alt, ac, af, an, hom, gene_id, gene_symbol, \
                 consequence, hgvsc, hgvsp, amino_acids, polyphen2, lof, filters \
                 FROM {} WHERE xpos = ? AND ref = ? AND alt = ? LIMIT 1",
                table
            );
            let row = self.clickhouse.query(&query)
                .bind(xpos)
                .bind(&ref_allele)
                .bind(&alt_allele)
                .fetch_optional::<VariantAnnotationExtendedRow>()
                .await?;
            if let Some(r) = row {
                return Ok(Some(annotation_to_variant_details(&r)));
            }
        }
        Ok(None)
    }

    async fn get_variant_summary(
        &self,
        variant_id: &str,
        _dataset: &str,
    ) -> anyhow::Result<Option<mcp::VariantSummary>> {
        let (xpos, ref_allele, alt_allele) = parse_variant_id(variant_id)
            .map_err(|e| anyhow::anyhow!("{e}"))?;

        for table in &["exome_annotations", "genome_annotations"] {
            let query = format!(
                "SELECT xpos, contig, position, ref, alt, ac, af, an, hom, gene_id, gene_symbol, \
                 consequence, hgvsc, hgvsp, amino_acids, polyphen2, lof, filters \
                 FROM {} WHERE xpos = ? AND ref = ? AND alt = ? LIMIT 1",
                table
            );
            let row = self.clickhouse.query(&query)
                .bind(xpos)
                .bind(&ref_allele)
                .bind(&alt_allele)
                .fetch_optional::<VariantAnnotationExtendedRow>()
                .await?;
            if let Some(r) = row {
                return Ok(Some(annotation_to_variant_summary(&r)));
            }
        }
        Ok(None)
    }

    async fn get_variant_frequencies(
        &self,
        variant_id: &str,
        _dataset: &str,
    ) -> anyhow::Result<Option<Vec<mcp::PopulationFrequency>>> {
        // The AoU ClickHouse schema doesn't store per-population breakdowns
        // in the annotation tables. Return the aggregate as a single entry.
        let (xpos, ref_allele, alt_allele) = parse_variant_id(variant_id)
            .map_err(|e| anyhow::anyhow!("{e}"))?;

        for table in &["exome_annotations", "genome_annotations"] {
            let query = format!(
                "SELECT xpos, contig, position, ref, alt, ac, af, an, hom, gene_id, gene_symbol, \
                 consequence, hgvsc, hgvsp, amino_acids, polyphen2, lof, filters \
                 FROM {} WHERE xpos = ? AND ref = ? AND alt = ? LIMIT 1",
                table
            );
            let row = self.clickhouse.query(&query)
                .bind(xpos)
                .bind(&ref_allele)
                .bind(&alt_allele)
                .fetch_optional::<VariantAnnotationExtendedRow>()
                .await?;
            if let Some(r) = row {
                let freq = mcp::PopulationFrequency {
                    id: "all".to_string(),
                    ac: r.ac.unwrap_or(0) as i64,
                    an: r.an.unwrap_or(0) as i64,
                    af: r.af.unwrap_or(0.0),
                    homozygote_count: r.hom.unwrap_or(0) as i64,
                    hemizygote_count: 0,
                };
                return Ok(Some(vec![freq]));
            }
        }
        Ok(None)
    }

    async fn get_multiple_variant_details(
        &self,
        variant_ids: &[String],
        dataset: &str,
    ) -> anyhow::Result<Vec<mcp::VariantDetails>> {
        let mut results = Vec::with_capacity(variant_ids.len());
        for vid in variant_ids {
            if let Some(detail) = self.get_variant_details(vid, dataset).await? {
                results.push(detail);
            }
        }
        Ok(results)
    }

    async fn get_gene_summary(
        &self,
        gene_id_or_symbol: &str,
    ) -> anyhow::Result<Option<mcp::GeneSummary>> {
        let (where_clause, bind_value) = if gene_id_or_symbol.starts_with("ENSG") {
            ("gene_id = ?", gene_id_or_symbol.to_string())
        } else {
            ("symbol_upper_case = ?", gene_id_or_symbol.to_uppercase())
        };

        let query = format!(
            "SELECT gene_id, symbol, symbol_upper_case, chrom, start, stop, xstart, xstop, strand, \
             gene_version, gencode_symbol, name, hgnc_id, ncbi_id, omim_id, reference_genome, \
             canonical_transcript_id, preferred_transcript_id, preferred_transcript_source, \
             alias_symbols, previous_symbols, search_terms, flags, \
             `exons.feature_type`, `exons.start`, `exons.stop`, `exons.xstart`, `exons.xstop`, \
             gnomad_gene, gnomad_gene_id, gnomad_transcript, gnomad_mane_select, gnomad_flags, \
             gnomad_pli, gnomad_lof_z, gnomad_mis_z, gnomad_syn_z, \
             gnomad_oe_lof, gnomad_oe_lof_lower, gnomad_oe_lof_upper, \
             gnomad_oe_mis, gnomad_oe_mis_lower, gnomad_oe_mis_upper, \
             gnomad_oe_syn, gnomad_oe_syn_lower, gnomad_oe_syn_upper, \
             gnomad_exp_lof, gnomad_exp_mis, gnomad_exp_syn, \
             gnomad_obs_lof, gnomad_obs_mis, gnomad_obs_syn, \
             mane_ensembl_id, mane_ensembl_version, mane_refseq_id, mane_refseq_version, \
             mane_matched_gene_version, transcripts_json \
             FROM gene_models WHERE {} LIMIT 1",
            where_clause
        );

        let row = self.clickhouse.query(&query)
            .bind(&bind_value)
            .fetch_optional::<GeneModelRow>()
            .await?;

        Ok(row.map(gene_model_to_summary))
    }

    async fn get_gene_variants(
        &self,
        gene_id: &str,
        _dataset: &str,
        _consequence_filter: Option<&str>,
    ) -> anyhow::Result<Vec<mcp::VariantSummary>> {
        // Look up gene to get coordinates
        let gene = self.get_gene_summary(gene_id).await?;
        let gene = match gene {
            Some(g) => g,
            None => return Ok(vec![]),
        };

        let contig = gene.chrom.trim_start_matches("chr");
        let xpos_start = compute_xpos(contig, gene.start as u32);
        let xpos_end = compute_xpos(contig, gene.stop as u32);

        let query = "SELECT xpos, contig, position, ref, alt, ac, af, an, hom, gene_id, gene_symbol, \
                     consequence, hgvsc, hgvsp, amino_acids, polyphen2, lof, filters \
                     FROM exome_annotations WHERE xpos >= ? AND xpos <= ? LIMIT 1000";

        let rows = self.clickhouse.query(query)
            .bind(xpos_start)
            .bind(xpos_end)
            .fetch_all::<VariantAnnotationExtendedRow>()
            .await?;

        Ok(rows.iter().map(annotation_to_variant_summary).collect())
    }

    async fn get_gene_expression(
        &self,
        _gene_id: &str,
    ) -> anyhow::Result<Option<mcp::GeneExpression>> {
        // Not available in AoU dataset
        Ok(None)
    }

    async fn get_region_variants(
        &self,
        chrom: &str,
        start: i64,
        end: i64,
        _dataset: &str,
    ) -> anyhow::Result<Vec<mcp::VariantSummary>> {
        let contig = chrom.trim_start_matches("chr");
        let xpos_start = compute_xpos(contig, start as u32);
        let xpos_end = compute_xpos(contig, end as u32);

        let query = "SELECT xpos, contig, position, ref, alt, ac, af, an, hom, gene_id, gene_symbol, \
                     consequence, hgvsc, hgvsp, amino_acids, polyphen2, lof, filters \
                     FROM exome_annotations WHERE xpos >= ? AND xpos <= ? LIMIT 1000";

        let rows = self.clickhouse.query(query)
            .bind(xpos_start)
            .bind(xpos_end)
            .fetch_all::<VariantAnnotationExtendedRow>()
            .await?;

        Ok(rows.iter().map(annotation_to_variant_summary).collect())
    }

    async fn list_gene_transcripts(
        &self,
        gene_id: &str,
    ) -> anyhow::Result<Vec<mcp::TranscriptSummary>> {
        // Query full gene model to get transcripts JSON
        let (where_clause, bind_value) = if gene_id.starts_with("ENSG") {
            ("gene_id = ?", gene_id.to_string())
        } else {
            ("symbol_upper_case = ?", gene_id.to_uppercase())
        };

        let query = format!(
            "SELECT gene_id, symbol, symbol_upper_case, chrom, start, stop, xstart, xstop, strand, \
             gene_version, gencode_symbol, name, hgnc_id, ncbi_id, omim_id, reference_genome, \
             canonical_transcript_id, preferred_transcript_id, preferred_transcript_source, \
             alias_symbols, previous_symbols, search_terms, flags, \
             `exons.feature_type`, `exons.start`, `exons.stop`, `exons.xstart`, `exons.xstop`, \
             gnomad_gene, gnomad_gene_id, gnomad_transcript, gnomad_mane_select, gnomad_flags, \
             gnomad_pli, gnomad_lof_z, gnomad_mis_z, gnomad_syn_z, \
             gnomad_oe_lof, gnomad_oe_lof_lower, gnomad_oe_lof_upper, \
             gnomad_oe_mis, gnomad_oe_mis_lower, gnomad_oe_mis_upper, \
             gnomad_oe_syn, gnomad_oe_syn_lower, gnomad_oe_syn_upper, \
             gnomad_exp_lof, gnomad_exp_mis, gnomad_exp_syn, \
             gnomad_obs_lof, gnomad_obs_mis, gnomad_obs_syn, \
             mane_ensembl_id, mane_ensembl_version, mane_refseq_id, mane_refseq_version, \
             mane_matched_gene_version, transcripts_json \
             FROM gene_models WHERE {} LIMIT 1",
            where_clause
        );

        let row = self.clickhouse.query(&query)
            .bind(&bind_value)
            .fetch_optional::<GeneModelRow>()
            .await?;

        let Some(row) = row else { return Ok(vec![]) };
        let model = row.to_api_model();
        let canonical_id = &model.canonical_transcript_id;

        Ok(model.transcripts.into_iter().map(|t| {
            mcp::TranscriptSummary {
                transcript_id: t.transcript_id.clone(),
                transcript_version: Some(t.transcript_version),
                biotype: "protein_coding".to_string(),
                is_canonical: t.transcript_id == *canonical_id,
                is_mane_select: false,
                refseq_id: t.refseq_id,
            }
        }).collect())
    }

    async fn get_transcript_details(
        &self,
        _transcript_id: &str,
    ) -> anyhow::Result<Option<mcp::TranscriptDetails>> {
        // Not directly available as a lookup by transcript ID
        Ok(None)
    }
}
