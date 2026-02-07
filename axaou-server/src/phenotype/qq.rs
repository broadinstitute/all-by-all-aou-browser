//! QQ plot query handlers
//!
//! Provides endpoints for retrieving Q-Q plot data points.

use crate::api::AppState;
use crate::clickhouse::models::QQRow;
use crate::error::AppError;
use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::Deserialize;
use std::sync::Arc;

/// Query parameters for QQ plot endpoint
#[derive(Debug, Deserialize)]
pub struct QQQuery {
    /// Ancestry group filter (default: "meta")
    pub ancestry: Option<String>,
    /// Sequencing type filter (default: "genome")
    pub sequencing_type: Option<String>,
    /// Chromosome filter (optional, e.g., "chr1")
    pub contig: Option<String>,
}

/// GET /api/phenotype/:analysis_id/qq
///
/// Returns QQ plot points for a phenotype.
/// Points are pre-downsampled for efficient rendering.
pub async fn get_qq_plot(
    State(state): State<Arc<AppState>>,
    Path(analysis_id): Path<String>,
    Query(params): Query<QQQuery>,
) -> Result<Json<Vec<QQRow>>, AppError> {
    let ancestry = params.ancestry.unwrap_or_else(|| "meta".to_string());
    let sequencing_type = params.sequencing_type.unwrap_or_else(|| "genomes".to_string());

    let base_query = if params.contig.is_some() {
        r#"
        SELECT phenotype, ancestry, sequencing_type, contig, position,
               ref, alt, pvalue_log10, pvalue_expected_log10
        FROM qq_points
        WHERE phenotype = ? AND ancestry = ? AND sequencing_type = ? AND contig = ?
        ORDER BY pvalue_expected_log10 DESC
        "#
    } else {
        r#"
        SELECT phenotype, ancestry, sequencing_type, contig, position,
               ref, alt, pvalue_log10, pvalue_expected_log10
        FROM qq_points
        WHERE phenotype = ? AND ancestry = ? AND sequencing_type = ?
        ORDER BY pvalue_expected_log10 DESC
        "#
    };

    let mut query = state.clickhouse.query(base_query);
    query = query
        .bind(&analysis_id)
        .bind(&ancestry)
        .bind(&sequencing_type);

    if let Some(ref contig) = params.contig {
        query = query.bind(contig);
    }

    let rows = query
        .fetch_all::<QQRow>()
        .await
        .map_err(|e| AppError::DataTransformError(format!("ClickHouse query error: {}", e)))?;

    Ok(Json(rows))
}
