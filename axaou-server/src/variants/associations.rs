//! Variant association route handlers
//!
//! Provides endpoints for gene-centric variant queries and Manhattan top-N.

use crate::api::AppState;
use crate::clickhouse::models::{GenePageVariantRow, LocusVariantRow};
use crate::clickhouse::xpos::compute_xpos;
use crate::error::AppError;
use crate::response::{LookupResult, QueryTimer};
use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::Deserialize;
use std::sync::Arc;

/// Query parameters for gene-centric variant query
#[derive(Debug, Deserialize)]
pub struct VariantGeneQuery {
    /// Phenotype / analysis ID (required)
    pub analysis_id: String,
    /// Ancestry group (default: "meta")
    pub ancestry: Option<String>,
    /// Sequencing type (default: "genome")
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
/// 2. Queries ClickHouse for variants in that region joined with annotations
///
/// The gene_id can be either an Ensembl ID (ENSG...) or a gene symbol.
pub async fn get_variants_by_gene(
    State(state): State<Arc<AppState>>,
    Path(gene_id): Path<String>,
    Query(params): Query<VariantGeneQuery>,
) -> Result<Json<LookupResult<GenePageVariantRow>>, AppError> {
    let timer = QueryTimer::start();
    let ancestry = params.ancestry.unwrap_or_else(|| "meta".to_string());
    let sequencing_type = params.sequencing_type.unwrap_or_else(|| "genomes".to_string());
    let limit = params.limit.unwrap_or(10000);

    // Step 1: Resolve gene to coordinates using the gene models table
    let gene_models = Arc::clone(&state.gene_models);
    let gene_id_clone = gene_id.clone();

    let gene_opt = tokio::task::spawn_blocking(move || {
        // Try by gene_id first, then by symbol
        if gene_id_clone.starts_with("ENSG") {
            gene_models.get_by_gene_id(&gene_id_clone)
        } else {
            gene_models.get_by_symbol(&gene_id_clone)
        }
    })
    .await??;

    let gene = gene_opt.ok_or(AppError::NotFound(format!("Gene {} not found", gene_id)))?;

    // Step 2: Compute xpos range from gene coordinates
    // Add a small buffer around the gene region
    let buffer = 1000; // 1kb buffer
    let xstart = compute_xpos(&gene.chrom, (gene.start - buffer).max(0) as u32);
    let xstop = compute_xpos(&gene.chrom, (gene.stop + buffer) as u32);

    // Step 3: Query ClickHouse with JOIN on annotations
    let query = r#"
        SELECT
            lv.locus_id as locus_id,
            lv.phenotype as phenotype,
            lv.xpos as xpos,
            lv.position as position,
            lv.ref as ref,
            lv.alt as alt,
            lv.pvalue as pvalue,
            lv.neg_log10_p as neg_log10_p,
            lv.is_significant as is_significant,
            va.gene_symbol as gene_symbol,
            va.consequence as consequence
        FROM loci_variants lv
        LEFT JOIN variant_annotations va
            ON lv.xpos = va.xpos AND lv.ref = va.ref AND lv.alt = va.alt
        WHERE lv.phenotype = ?
          AND lv.ancestry = ?
          AND lv.sequencing_type = ?
          AND lv.xpos >= ?
          AND lv.xpos <= ?
        ORDER BY lv.pvalue ASC
        LIMIT ?
    "#;

    let rows = state
        .clickhouse
        .query(query)
        .bind(&params.analysis_id)
        .bind(&ancestry)
        .bind(&sequencing_type)
        .bind(xstart)
        .bind(xstop)
        .bind(limit)
        .fetch_all::<GenePageVariantRow>()
        .await
        .map_err(|e| AppError::DataTransformError(format!("ClickHouse query error: {}", e)))?;

    Ok(Json(LookupResult::new(rows, timer.elapsed())))
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
