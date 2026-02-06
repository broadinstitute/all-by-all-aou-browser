//! Significant variants handler
//!
//! Provides endpoint for retrieving variants that pass significance thresholds.

use crate::api::AppState;
use crate::clickhouse::models::LocusVariantExtendedRow;
use crate::error::AppError;
use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::Deserialize;
use std::sync::Arc;

/// Query parameters for significant variants endpoint
#[derive(Debug, Deserialize)]
pub struct SignificantQuery {
    /// Ancestry group filter (default: "meta")
    pub ancestry: Option<String>,
    /// Sequencing type filter (optional: "exome" or "genome")
    pub sequencing_type: Option<String>,
    /// Maximum number of results (default: 50000)
    pub limit: Option<u64>,
}

/// GET /api/phenotype/:analysis_id/significant
///
/// Returns only significant variants across all loci for a phenotype.
/// Useful for highlighting peaks on Manhattan plots.
pub async fn get_significant_variants(
    State(state): State<Arc<AppState>>,
    Path(analysis_id): Path<String>,
    Query(params): Query<SignificantQuery>,
) -> Result<Json<Vec<LocusVariantExtendedRow>>, AppError> {
    let ancestry = params.ancestry.unwrap_or_else(|| "meta".to_string());
    let limit = params.limit.unwrap_or(50000);

    // Build query with optional sequencing_type filter
    let rows = if let Some(ref seq_type) = params.sequencing_type {
        let query = r#"
            SELECT locus_id, xpos, position, pvalue, neg_log10_p, is_significant
            FROM loci_variants
            WHERE phenotype = ? AND ancestry = ? AND sequencing_type = ? AND is_significant = true
            ORDER BY pvalue ASC
            LIMIT ?
        "#;

        state
            .clickhouse
            .query(query)
            .bind(&analysis_id)
            .bind(&ancestry)
            .bind(seq_type)
            .bind(limit)
            .fetch_all::<LocusVariantExtendedRow>()
            .await
            .map_err(|e| AppError::DataTransformError(format!("ClickHouse query error: {}", e)))?
    } else {
        let query = r#"
            SELECT locus_id, xpos, position, pvalue, neg_log10_p, is_significant
            FROM loci_variants
            WHERE phenotype = ? AND ancestry = ? AND is_significant = true
            ORDER BY pvalue ASC
            LIMIT ?
        "#;

        state
            .clickhouse
            .query(query)
            .bind(&analysis_id)
            .bind(&ancestry)
            .bind(limit)
            .fetch_all::<LocusVariantExtendedRow>()
            .await
            .map_err(|e| AppError::DataTransformError(format!("ClickHouse query error: {}", e)))?
    };

    Ok(Json(rows))
}
