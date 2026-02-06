//! PheWAS query handlers
//!
//! Provides endpoints for cross-phenotype queries.

use crate::api::AppState;
use crate::clickhouse::models::SignificantVariantRow;
use crate::clickhouse::xpos::parse_variant_id;
use crate::error::AppError;
use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::Deserialize;
use std::sync::Arc;

/// GET /api/variants/associations/phewas/:variant_id
///
/// Returns all phenotypes where this variant is significant (fan-out query).
/// This is the PheWAS endpoint for exploring variant associations across traits.
pub async fn get_phewas_by_variant(
    State(state): State<Arc<AppState>>,
    Path(variant_id): Path<String>,
) -> Result<Json<Vec<SignificantVariantRow>>, AppError> {
    let (xpos, ref_allele, alt_allele) = parse_variant_id(&variant_id)?;

    let query = r#"
        SELECT phenotype, ancestry, sequencing_type, xpos, contig, position,
               ref, alt, pvalue, beta, se, af
        FROM significant_variants
        WHERE xpos = ? AND ref = ? AND alt = ?
        ORDER BY pvalue ASC
    "#;

    let rows = state
        .clickhouse
        .query(query)
        .bind(xpos)
        .bind(&ref_allele)
        .bind(&alt_allele)
        .fetch_all::<SignificantVariantRow>()
        .await
        .map_err(|e| AppError::DataTransformError(format!("ClickHouse query error: {}", e)))?;

    Ok(Json(rows))
}

/// Query parameters for top variants endpoint
#[derive(Debug, Deserialize)]
pub struct TopVariantsQuery {
    /// Ancestry group (required)
    pub ancestry: String,
    /// Minimum p-value (default: 1e-10)
    pub min_p: Option<f64>,
    /// Maximum p-value (default: 1e-6)
    pub max_p: Option<f64>,
    /// Maximum number of results (default: 1000)
    pub limit: Option<u64>,
}

/// GET /api/variants/associations/top
///
/// Returns top variants across all phenotypes within a p-value range.
/// Useful for identifying the most significant associations globally.
pub async fn get_top_variants(
    State(state): State<Arc<AppState>>,
    Query(params): Query<TopVariantsQuery>,
) -> Result<Json<Vec<SignificantVariantRow>>, AppError> {
    let min_p = params.min_p.unwrap_or(1e-10);
    let max_p = params.max_p.unwrap_or(1e-6);
    let limit = params.limit.unwrap_or(1000);

    let query = r#"
        SELECT phenotype, ancestry, sequencing_type, xpos, contig, position,
               ref, alt, pvalue, beta, se, af
        FROM significant_variants
        WHERE ancestry = ? AND pvalue >= ? AND pvalue <= ?
        ORDER BY pvalue ASC
        LIMIT ?
    "#;

    let rows = state
        .clickhouse
        .query(query)
        .bind(&params.ancestry)
        .bind(min_p)
        .bind(max_p)
        .bind(limit)
        .fetch_all::<SignificantVariantRow>()
        .await
        .map_err(|e| AppError::DataTransformError(format!("ClickHouse query error: {}", e)))?;

    Ok(Json(rows))
}
