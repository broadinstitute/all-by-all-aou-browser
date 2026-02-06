//! Locus query handlers
//!
//! Provides endpoints for retrieving locus metadata and variants within loci
//! for Manhattan plot rendering.

use crate::api::AppState;
use crate::clickhouse::models::{LocusRow, LocusVariantRow};
use crate::error::AppError;
use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::Deserialize;
use std::sync::Arc;

/// Query parameters for loci list endpoint
#[derive(Debug, Deserialize)]
pub struct LociQuery {
    /// Ancestry group filter (default: "meta")
    pub ancestry: Option<String>,
}

/// GET /api/phenotype/:analysis_id/loci
///
/// Returns all loci for a phenotype with their metadata including
/// lead variant, variant counts, and plot URIs.
pub async fn get_phenotype_loci(
    State(state): State<Arc<AppState>>,
    Path(analysis_id): Path<String>,
    Query(params): Query<LociQuery>,
) -> Result<Json<Vec<LocusRow>>, AppError> {
    let ancestry = params.ancestry.unwrap_or_else(|| "meta".to_string());

    let query = r#"
        SELECT
            locus_id, phenotype, ancestry, contig, start, stop,
            xstart, xstop, source, lead_variant, lead_pvalue,
            exome_count, genome_count, plot_gcs_uri
        FROM loci
        WHERE phenotype = ? AND ancestry = ?
    "#;

    let rows = state
        .clickhouse
        .query(query)
        .bind(&analysis_id)
        .bind(&ancestry)
        .fetch_all::<LocusRow>()
        .await
        .map_err(|e| AppError::DataTransformError(format!("ClickHouse query error: {}", e)))?;

    Ok(Json(rows))
}

/// Query parameters for locus variants endpoint
#[derive(Debug, Deserialize)]
pub struct LocusVariantsQuery {
    /// Ancestry group filter (default: "meta")
    pub ancestry: Option<String>,
    /// Sequencing type (required: "exome" or "genome")
    pub sequencing_type: String,
}

/// GET /api/phenotype/:analysis_id/loci/:locus_id/variants
///
/// Returns all variants within a specific locus for Manhattan plot rendering.
/// Variants are sorted by position for efficient rendering.
pub async fn get_locus_variants(
    State(state): State<Arc<AppState>>,
    Path((analysis_id, locus_id)): Path<(String, String)>,
    Query(params): Query<LocusVariantsQuery>,
) -> Result<Json<Vec<LocusVariantRow>>, AppError> {
    let ancestry = params.ancestry.unwrap_or_else(|| "meta".to_string());

    let query = r#"
        SELECT xpos, position, pvalue, neg_log10_p, is_significant
        FROM loci_variants
        WHERE phenotype = ? AND locus_id = ? AND ancestry = ? AND sequencing_type = ?
        ORDER BY position
    "#;

    let rows = state
        .clickhouse
        .query(query)
        .bind(&analysis_id)
        .bind(&locus_id)
        .bind(&ancestry)
        .bind(&params.sequencing_type)
        .fetch_all::<LocusVariantRow>()
        .await
        .map_err(|e| AppError::DataTransformError(format!("ClickHouse query error: {}", e)))?;

    Ok(Json(rows))
}
