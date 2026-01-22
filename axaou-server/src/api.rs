//! API route handlers for the AxAoU server

use crate::models::AnalysisMetadata;
use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use std::sync::Arc;

/// Application state shared across all handlers
pub struct AppState {
    /// Cached analysis metadata loaded at startup
    pub metadata: Vec<AnalysisMetadata>,
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
