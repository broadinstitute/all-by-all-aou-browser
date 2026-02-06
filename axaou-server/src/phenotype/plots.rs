//! Phenotype plot metadata handler
//!
//! Provides endpoint for retrieving pre-rendered Manhattan plot URIs.

use crate::api::AppState;
use crate::clickhouse::models::PlotRow;
use crate::error::AppError;
use axum::{
    extract::{Path, State},
    Json,
};
use std::sync::Arc;

/// GET /api/phenotype/:analysis_id/plots
///
/// Returns Manhattan plot GCS URIs for a phenotype.
/// These are pre-rendered images for quick display.
pub async fn get_phenotype_plots(
    State(state): State<Arc<AppState>>,
    Path(analysis_id): Path<String>,
) -> Result<Json<Vec<PlotRow>>, AppError> {
    let query = r#"
        SELECT phenotype, ancestry, plot_type, gcs_uri
        FROM phenotype_plots
        WHERE phenotype = ?
    "#;

    let rows = state
        .clickhouse
        .query(query)
        .bind(&analysis_id)
        .fetch_all::<PlotRow>()
        .await
        .map_err(|e| AppError::DataTransformError(format!("ClickHouse query error: {}", e)))?;

    Ok(Json(rows))
}
