//! Phenotype summary endpoint
//!
//! Returns the phenotype_summary derived table for the All Phenotypes directory view.

use crate::api::AppState;
use crate::clickhouse::models::PhenotypeSummaryRow;
use crate::error::AppError;
use crate::response::{LookupResult, QueryTimer};
use axum::extract::State;
use std::sync::Arc;

/// GET /api/phenotypes/summary
///
/// Returns all rows from the phenotype_summary derived table,
/// ordered by significant loci count descending.
pub async fn get_phenotypes_summary(
    State(state): State<Arc<AppState>>,
) -> Result<axum::response::Response, AppError> {
    let timer = QueryTimer::start();

    let dv = state.data_version.as_deref().unwrap_or("none");
    let cache_key = format!("phenotypes_summary_all_{}", dv);

    if let Some(cached_bytes) = state.api_cache.get(&cache_key).await {
        return Ok(axum::response::Response::builder()
            .status(axum::http::StatusCode::OK)
            .header(axum::http::header::CONTENT_TYPE, "application/json")
            .body(axum::body::Body::from(cached_bytes))
            .unwrap());
    }

    let query = "SELECT * FROM phenotype_summary ORDER BY sig_loci_count DESC, analysis_id ASC";

    let rows = state
        .clickhouse
        .query(query)
        .fetch_all::<PhenotypeSummaryRow>()
        .await
        .map_err(|e| AppError::DataTransformError(format!("ClickHouse query error: {}", e)))?;

    let result = LookupResult::new(rows, timer.elapsed());
    let json_bytes =
        serde_json::to_vec(&result).map_err(|e| AppError::DataTransformError(e.to_string()))?;

    state
        .api_cache
        .insert(cache_key, json_bytes.clone())
        .await;

    Ok(axum::response::Response::builder()
        .status(axum::http::StatusCode::OK)
        .header(axum::http::header::CONTENT_TYPE, "application/json")
        .body(axum::body::Body::from(json_bytes))
        .unwrap())
}
