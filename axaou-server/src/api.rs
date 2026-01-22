//! API route handlers for the AxAoU server

use crate::error::AppError;
use crate::gene_models::GeneModelsQuery;
use crate::models::{AnalysisMetadata, GeneModel};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use std::sync::Arc;

/// Application state shared across all handlers
pub struct AppState {
    /// Cached analysis metadata loaded at startup
    pub metadata: Vec<AnalysisMetadata>,
    /// On-demand gene models query engine (wrapped in Arc for sharing across tasks)
    pub gene_models: Arc<GeneModelsQuery>,
}

/// Query parameters for the /api/analyses endpoint
#[derive(Debug, Deserialize)]
pub struct AnalysisQuery {
    /// Filter by ancestry group (case-insensitive)
    /// e.g., "meta", "EUR", "AFR", etc.
    pub ancestry_group: Option<String>,
}

/// Handler for GET /api/analyses
///
/// Returns all analysis metadata, optionally filtered by ancestry_group.
/// The frontend typically requests `?ancestry_group=meta` to get meta-analysis results.
pub async fn get_analyses(
    State(state): State<Arc<AppState>>,
    Query(params): Query<AnalysisQuery>,
) -> (StatusCode, Json<Vec<AnalysisMetadata>>) {
    // Filter by ancestry_group if provided
    let filtered_data: Vec<AnalysisMetadata> = if let Some(ref ancestry) = params.ancestry_group {
        state
            .metadata
            .iter()
            .filter(|m| m.ancestry_group.eq_ignore_ascii_case(ancestry))
            .cloned()
            .collect()
    } else {
        // Return all data if no filter
        state.metadata.clone()
    };

    (StatusCode::OK, Json(filtered_data))
}

// ============================================================================
// Gene Model Endpoints
// ============================================================================

/// Handler for GET /api/genes/model/{gene_id}
///
/// Returns the gene model for a specific gene ID (e.g., "ENSG00000139618").
pub async fn get_gene_model(
    State(state): State<Arc<AppState>>,
    Path(gene_id): Path<String>,
) -> Result<Json<Vec<GeneModel>>, AppError> {
    let gene_models = Arc::clone(&state.gene_models);

    let result = tokio::task::spawn_blocking(move || gene_models.get_by_gene_id(&gene_id))
        .await??;

    match result {
        Some(model) => Ok(Json(vec![model])),
        None => Err(AppError::NotFound(format!("Gene not found"))),
    }
}

/// Handler for GET /api/genes/model/interval/{interval}
///
/// Returns all gene models within a genomic interval.
/// Interval format: "chr1:12345-67890" or "1:12345-67890"
pub async fn get_gene_models_in_interval(
    State(state): State<Arc<AppState>>,
    Path(interval): Path<String>,
) -> Result<Json<Vec<GeneModel>>, AppError> {
    let gene_models = Arc::clone(&state.gene_models);

    let genes = tokio::task::spawn_blocking(move || gene_models.get_in_interval(&interval))
        .await??;

    Ok(Json(genes))
}
