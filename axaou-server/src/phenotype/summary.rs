//! Phenotype summary endpoint
//!
//! Returns the phenotype_summary derived table for the All Phenotypes directory view.

use crate::api::AppState;
use crate::clickhouse::models::PhenotypeSummaryRow;
use crate::error::AppError;
use crate::response::{LookupResult, QueryTimer};
use axum::{extract::State, Json};
use std::sync::Arc;

/// GET /api/phenotypes/summary
///
/// Returns all rows from the phenotype_summary derived table,
/// ordered by significant loci count descending.
pub async fn get_phenotypes_summary(
    State(state): State<Arc<AppState>>,
) -> Result<Json<LookupResult<PhenotypeSummaryRow>>, AppError> {
    let timer = QueryTimer::start();
    let query = "SELECT * FROM phenotype_summary ORDER BY sig_loci_count DESC, analysis_id ASC";

    let rows = state
        .clickhouse
        .query(query)
        .fetch_all::<PhenotypeSummaryRow>()
        .await
        .map_err(|e| AppError::DataTransformError(format!("ClickHouse query error: {}", e)))?;

    Ok(Json(LookupResult::new(rows, timer.elapsed())))
}
