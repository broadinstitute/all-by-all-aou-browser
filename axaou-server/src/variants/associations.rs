//! Variant association route handlers
//!
//! Provides endpoints for gene-centric variant queries and Manhattan top-N.

use crate::api::AppState;
use crate::clickhouse::models::LocusVariantRow;
use crate::clickhouse::xpos::compute_xpos;
use crate::error::AppError;
use crate::models::Locus;
use crate::response::{LookupResult, QueryTimer};
use axum::{
    extract::{Path, Query, State},
    Json,
};
use clickhouse::Row;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Row from loci_variants joined with annotations
#[derive(Debug, Clone, Serialize, Deserialize, Row)]
pub struct GeneVariantRow {
    pub phenotype: String,
    pub ancestry: String,
    pub sequencing_type: String,
    pub xpos: i64,
    pub contig: String,
    pub position: u32,
    #[serde(rename = "ref")]
    pub ref_allele: String,
    pub alt: String,
    pub pvalue: f64,
    pub beta: Option<f64>,
    pub se: Option<f64>,
    pub af: Option<f64>,
    // From annotations join
    pub gene_symbol: Option<String>,
    pub consequence: Option<String>,
    pub hgvsc: Option<String>,
    pub hgvsp: Option<String>,
    pub ac: Option<u32>,
    pub an: Option<u32>,
    pub hom: Option<u32>,
    // Case/control breakdown fields (from loci_variants)
    pub ac_cases: Option<f64>,
    pub ac_controls: Option<f64>,
    pub af_cases: Option<f64>,
    pub af_controls: Option<f64>,
    pub association_ac: Option<f64>,
}

/// Extended API response with all available fields
#[derive(Debug, Clone, Serialize)]
pub struct VariantAssociationExtendedApi {
    pub variant_id: String,
    pub locus: Locus,
    #[serde(rename = "ref")]
    pub ref_allele: String,
    pub alt: String,
    pub pvalue: f64,
    pub beta: f64,
    pub se: f64,
    pub af: f64,
    pub phenotype: String,
    pub ancestry: String,
    pub sequencing_type: String,
    // Annotation fields
    pub gene_symbol: Option<String>,
    pub consequence: Option<String>,
    pub hgvsc: Option<String>,
    pub hgvsp: Option<String>,
    // Counts
    pub allele_count: Option<u32>,
    pub allele_number: Option<u32>,
    pub homozygote_count: Option<u32>,
    // Case/control breakdown fields
    pub ac_cases: Option<f64>,
    pub ac_controls: Option<f64>,
    pub af_cases: Option<f64>,
    pub af_controls: Option<f64>,
    // Trait-level stats
    pub association_ac: Option<f64>,
    pub association_af: Option<f64>,
}

impl GeneVariantRow {
    pub fn to_api(&self) -> VariantAssociationExtendedApi {
        let variant_id = format!(
            "{}-{}-{}-{}",
            self.contig, self.position, self.ref_allele, self.alt
        );
        VariantAssociationExtendedApi {
            variant_id,
            locus: Locus::new(self.contig.clone(), self.position),
            ref_allele: self.ref_allele.clone(),
            alt: self.alt.clone(),
            pvalue: self.pvalue,
            beta: self.beta.unwrap_or(0.0),
            se: self.se.unwrap_or(0.0),
            af: self.af.unwrap_or(0.0),
            phenotype: self.phenotype.clone(),
            ancestry: self.ancestry.clone(),
            sequencing_type: self.sequencing_type.clone(),
            gene_symbol: self.gene_symbol.clone(),
            consequence: self.consequence.clone(),
            hgvsc: self.hgvsc.clone(),
            hgvsp: self.hgvsp.clone(),
            allele_count: self.ac,
            allele_number: self.an,
            homozygote_count: self.hom,
            // Case/control breakdown
            ac_cases: self.ac_cases,
            ac_controls: self.ac_controls,
            af_cases: self.af_cases,
            af_controls: self.af_controls,
            // Trait-level stats (association_af is the same as af)
            association_ac: self.association_ac,
            association_af: self.af,
        }
    }
}

/// Query parameters for gene-centric variant query
#[derive(Debug, Deserialize)]
pub struct VariantGeneQuery {
    /// Phenotype / analysis ID (required)
    pub analysis_id: String,
    /// Ancestry group (default: "meta") - accepts both ancestry and ancestry_group
    pub ancestry: Option<String>,
    #[serde(alias = "ancestry")]
    pub ancestry_group: Option<String>,
    /// Sequencing type (default: "exomes")
    pub sequencing_type: Option<String>,
    /// Maximum number of results (default: 10000)
    pub limit: Option<u64>,
    /// Query mode (fast/slow) - accepted but currently ignored
    #[serde(default)]
    pub query_mode: Option<String>,
}

/// GET /api/variants/associations/gene/:gene_id
///
/// Returns variants within a gene's genomic region for a specific phenotype.
/// This is the "two-step" query that:
/// 1. Resolves the gene to its coordinates via the gene models table
/// 2. Queries ClickHouse for variants in that region from significant_variants_enriched
///
/// The gene_id can be either an Ensembl ID (ENSG...) or a gene symbol.
pub async fn get_variants_by_gene(
    State(state): State<Arc<AppState>>,
    Path(gene_id): Path<String>,
    Query(params): Query<VariantGeneQuery>,
) -> Result<Json<LookupResult<VariantAssociationExtendedApi>>, AppError> {
    let timer = QueryTimer::start();
    // Accept both ancestry and ancestry_group parameters
    let ancestry = params
        .ancestry_group
        .or(params.ancestry)
        .unwrap_or_else(|| "meta".to_string());
    let sequencing_type = params
        .sequencing_type
        .unwrap_or_else(|| "exomes".to_string());
    let limit = params.limit.unwrap_or(10000);

    // Step 1: Resolve gene to coordinates using ClickHouse gene_models table
    let gene_query = if gene_id.starts_with("ENSG") {
        "SELECT chrom, start, stop FROM gene_models WHERE gene_id = ? LIMIT 1"
    } else {
        "SELECT chrom, start, stop FROM gene_models WHERE symbol = ? OR symbol_upper_case = ? LIMIT 1"
    };

    #[derive(Debug, Row, Deserialize)]
    struct GeneCoords {
        chrom: String,
        start: i32,
        stop: i32,
    }

    let gene_coords: Option<GeneCoords> = if gene_id.starts_with("ENSG") {
        state
            .clickhouse
            .query(gene_query)
            .bind(&gene_id)
            .fetch_optional()
            .await
            .map_err(|e| AppError::DataTransformError(format!("Gene lookup error: {}", e)))?
    } else {
        state
            .clickhouse
            .query(gene_query)
            .bind(&gene_id)
            .bind(&gene_id.to_uppercase())
            .fetch_optional()
            .await
            .map_err(|e| AppError::DataTransformError(format!("Gene lookup error: {}", e)))?
    };

    let gene = gene_coords.ok_or(AppError::NotFound(format!("Gene {} not found", gene_id)))?;

    // Step 2: Compute xpos range from gene coordinates
    let buffer = 1000; // 1kb buffer
    let start_pos = (gene.start - buffer).max(0);
    let stop_pos = gene.stop + buffer;
    let xstart = compute_xpos(&gene.chrom, start_pos as u32);
    let xstop = compute_xpos(&gene.chrom, stop_pos as u32);

    // Check for slow-path query mode (direct GCS Hail Table access)
    if params.query_mode.as_deref() == Some("slow") {
        return get_gene_variants_from_hail(
            &state,
            &gene.chrom,
            start_pos,
            stop_pos,
            &params.analysis_id,
            &ancestry,
            &sequencing_type,
            limit,
            timer,
        )
        .await;
    }

    // Step 3: Query loci_variants joined with annotations
    // Use exome_annotations or genome_annotations based on sequencing type
    let annotations_table = if sequencing_type == "exomes" || sequencing_type == "exome" {
        "exome_annotations"
    } else {
        "genome_annotations"
    };

    // Normalize sequencing_type for loci_variants (uses "exome"/"genome" not "exomes"/"genomes")
    let seq_type_normalized = if sequencing_type.ends_with('s') {
        &sequencing_type[..sequencing_type.len() - 1]
    } else {
        &sequencing_type
    };

    let query = format!(
        r#"
        SELECT
            lv.phenotype as phenotype,
            lv.ancestry as ancestry,
            lv.sequencing_type as sequencing_type,
            lv.xpos as xpos,
            lv.contig as contig,
            toUInt32(lv.position) as position,
            lv.ref as ref,
            lv.alt as alt,
            lv.pvalue as pvalue,
            lv.beta as beta,
            lv.se as se,
            coalesce(lv.af, ann.af) as af,
            ann.gene_symbol as gene_symbol,
            ann.consequence as consequence,
            ann.hgvsc as hgvsc,
            ann.hgvsp as hgvsp,
            ann.ac as ac,
            ann.an as an,
            ann.hom as hom,
            lv.ac_cases as ac_cases,
            lv.ac_controls as ac_controls,
            lv.af_cases as af_cases,
            lv.af_controls as af_controls,
            lv.association_ac as association_ac
        FROM loci_variants lv
        LEFT JOIN {} ann
            ON lv.xpos = ann.xpos AND lv.ref = ann.ref AND lv.alt = ann.alt
        WHERE lv.phenotype = ?
          AND lv.ancestry = ?
          AND lv.sequencing_type = ?
          AND lv.xpos >= ?
          AND lv.xpos <= ?
        ORDER BY lv.pvalue ASC
        LIMIT ?
        "#,
        annotations_table
    );

    let rows = state
        .clickhouse
        .query(&query)
        .bind(&params.analysis_id)
        .bind(&ancestry)
        .bind(seq_type_normalized)
        .bind(xstart)
        .bind(xstop)
        .bind(limit)
        .fetch_all::<GeneVariantRow>()
        .await
        .map_err(|e| AppError::DataTransformError(format!("ClickHouse query error: {}", e)))?;

    let api_rows: Vec<VariantAssociationExtendedApi> = rows.into_iter().map(|r| r.to_api()).collect();
    Ok(Json(LookupResult::new(api_rows, timer.elapsed())))
}

/// Query parameters for Manhattan top-N endpoint
#[derive(Debug, Deserialize)]
pub struct ManhattanTopQuery {
    /// Ancestry group (default: "meta")
    pub ancestry: Option<String>,
    /// Sequencing type (default: "genome")
    pub sequencing_type: Option<String>,
    /// Maximum number of results (default: 1000)
    pub limit: Option<u64>,
    /// Query mode (fast/slow) - accepted but currently ignored
    #[serde(default)]
    pub query_mode: Option<String>,
}

/// GET /api/variants/associations/manhattan/:analysis_id/top
///
/// Returns the top N variants by p-value for a phenotype, regardless of locus.
/// Useful as a fallback or supplement to the locus-based Manhattan plot.
pub async fn get_manhattan_top(
    State(state): State<Arc<AppState>>,
    Path(analysis_id): Path<String>,
    Query(params): Query<ManhattanTopQuery>,
) -> Result<Json<LookupResult<LocusVariantRow>>, AppError> {
    let timer = QueryTimer::start();
    let ancestry = params.ancestry.unwrap_or_else(|| "meta".to_string());
    let sequencing_type = params.sequencing_type.unwrap_or_else(|| "genomes".to_string());
    let limit = params.limit.unwrap_or(1000);

    let query = r#"
        SELECT xpos, position, pvalue, neg_log10_p, is_significant
        FROM loci_variants
        WHERE phenotype = ? AND ancestry = ? AND sequencing_type = ?
        ORDER BY pvalue ASC
        LIMIT ?
    "#;

    let rows = state
        .clickhouse
        .query(query)
        .bind(&analysis_id)
        .bind(&ancestry)
        .bind(&sequencing_type)
        .bind(limit)
        .fetch_all::<LocusVariantRow>()
        .await
        .map_err(|e| AppError::DataTransformError(format!("ClickHouse query error: {}", e)))?;

    Ok(Json(LookupResult::new(rows, timer.elapsed())))
}

/// Slow-path: Query Hail Table directly from GCS for gene variants
async fn get_gene_variants_from_hail(
    state: &AppState,
    chrom: &str,
    start: i32,
    stop: i32,
    analysis_id: &str,
    ancestry: &str,
    sequencing_type: &str,
    limit: u64,
    timer: QueryTimer,
) -> Result<Json<LookupResult<VariantAssociationExtendedApi>>, AppError> {
    // Normalize sequencing_type (frontend may send "exomes" or "exome")
    let seq_type_normalized = if sequencing_type.ends_with('s') {
        &sequencing_type[..sequencing_type.len() - 1]
    } else {
        sequencing_type
    };

    // Build GCS path to the Hail Table
    // Format: gs://aou_results/414k/ht_results/{ANCESTRY}/phenotype_{analysis_id}/{seq_type}_variant_results.ht
    let ht_path = format!(
        "gs://aou_results/414k/ht_results/{}/phenotype_{}/{}_variant_results.ht",
        ancestry.to_uppercase(),
        analysis_id,
        seq_type_normalized
    );

    // Normalize contig to GRCh38 format (chr1, chr2, etc.)
    let contig = if chrom.starts_with("chr") {
        chrom.to_string()
    } else {
        format!("chr{}", chrom)
    };

    // Query the Hail Table
    let associations = state
        .hail_client
        .query_interval_typed(&ht_path, &contig, start, stop)
        .await
        .map_err(|e| AppError::DataTransformError(format!("Hail query error: {}", e)))?;

    // Convert to API format (take up to limit)
    let api_rows: Vec<VariantAssociationExtendedApi> = associations
        .into_iter()
        .take(limit as usize)
        .map(|a| VariantAssociationExtendedApi {
            variant_id: a.variant_id(),
            locus: Locus::new(a.contig.clone(), a.position as u32),
            ref_allele: a.ref_allele,
            alt: a.alt_allele,
            pvalue: a.pvalue,
            beta: a.beta,
            se: a.se,
            af: a.af.unwrap_or(0.0),
            phenotype: analysis_id.to_string(),
            ancestry: ancestry.to_string(),
            sequencing_type: seq_type_normalized.to_string(),
            // Annotation fields not available from Hail Table
            gene_symbol: None,
            consequence: None,
            hgvsc: None,
            hgvsp: None,
            allele_count: a.ac.map(|v| v as u32),
            allele_number: None,
            homozygote_count: None,
            // Case/control breakdown (from Hail Table)
            ac_cases: a.ac_cases,
            ac_controls: a.ac_controls,
            af_cases: a.af_cases,
            af_controls: a.af_controls,
            // Trait-level stats
            association_ac: a.association_ac,
            association_af: a.af,
        })
        .collect();

    Ok(Json(LookupResult::with_source(
        api_rows,
        timer.elapsed(),
        "hail_gcs",
    )))
}
