//! API route handlers for the AxAoU server

use crate::error::AppError;
use crate::gene_models::GeneModelsQuery;
use crate::models::{AnalysisAsset, AnalysisAssets, AnalysisMetadata, GeneModel};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Application state shared across all handlers
pub struct AppState {
    /// Cached analysis metadata loaded at startup
    pub metadata: Vec<AnalysisMetadata>,
    /// On-demand gene models query engine (wrapped in Arc for sharing across tasks)
    pub gene_models: Arc<GeneModelsQuery>,
    /// Discovered analysis assets (lazily loaded)
    pub assets: RwLock<Option<AnalysisAssets>>,
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

// ============================================================================
// Analysis Assets Endpoints
// ============================================================================

/// Query parameters for the /api/assets endpoint
#[derive(Debug, Deserialize)]
pub struct AssetsQuery {
    /// Filter by ancestry group (e.g., "eur", "meta")
    pub ancestry: Option<String>,
    /// Filter by asset type (e.g., "variant", "gene")
    pub asset_type: Option<String>,
    /// Filter by sequencing type (e.g., "exomes", "genomes")
    pub sequencing_type: Option<String>,
    /// Filter by analysis ID (phenotype name)
    pub analysis_id: Option<String>,
    /// Force refresh of cached assets
    #[serde(default)]
    pub refresh: bool,
}

/// Handler for GET /api/assets
///
/// Returns discovered analysis assets (per-phenotype result files).
/// Assets are lazily discovered on first request and cached.
pub async fn get_assets(
    State(state): State<Arc<AppState>>,
    Query(params): Query<AssetsQuery>,
) -> Result<Json<Vec<AnalysisAsset>>, AppError> {
    // Check if we need to discover assets
    let needs_discovery = {
        let assets = state.assets.read().await;
        assets.is_none() || params.refresh
    };

    if needs_discovery {
        // Perform discovery
        tracing::info!("Discovering analysis assets from GCS...");
        let discovery = crate::analysis_assets::AssetDiscovery::new()?;

        // Get valid phenotypes from metadata for filtering
        let valid_phenotypes = crate::analysis_assets::get_valid_phenotypes(&state.metadata);

        let discovered = discovery.discover_all(Some(&valid_phenotypes)).await?;
        tracing::info!("Discovered {} assets", discovered.assets.len());

        // Cache the results
        let mut assets_lock = state.assets.write().await;
        *assets_lock = Some(discovered);
    }

    // Read from cache and filter
    let assets = state.assets.read().await;
    let assets_ref = assets.as_ref().unwrap();

    // Apply filters
    let filtered: Vec<AnalysisAsset> = assets_ref
        .assets
        .iter()
        .filter(|a| {
            // Filter by ancestry
            if let Some(ref anc) = params.ancestry {
                if !a.ancestry_group.to_string().eq_ignore_ascii_case(anc) {
                    return false;
                }
            }
            // Filter by asset type
            if let Some(ref at) = params.asset_type {
                let asset_type_str = format!("{:?}", a.asset_type).to_lowercase();
                if !asset_type_str.contains(&at.to_lowercase()) {
                    return false;
                }
            }
            // Filter by sequencing type
            if let Some(ref st) = params.sequencing_type {
                match &a.sequencing_type {
                    Some(seq) if seq.to_string().eq_ignore_ascii_case(st) => {}
                    None if st.is_empty() => {}
                    _ => return false,
                }
            }
            // Filter by analysis ID
            if let Some(ref aid) = params.analysis_id {
                if !a.analysis_id.eq_ignore_ascii_case(aid) {
                    return false;
                }
            }
            true
        })
        .cloned()
        .collect();

    Ok(Json(filtered))
}

/// Handler for GET /api/assets/summary
///
/// Returns a summary of available assets (counts by ancestry, type, etc.)
pub async fn get_assets_summary(
    State(state): State<Arc<AppState>>,
) -> Result<Json<AssetsSummary>, AppError> {
    // Ensure assets are loaded
    let needs_discovery = {
        let assets = state.assets.read().await;
        assets.is_none()
    };

    if needs_discovery {
        tracing::info!("Discovering analysis assets from GCS for summary...");
        let discovery = crate::analysis_assets::AssetDiscovery::new()?;
        let valid_phenotypes = crate::analysis_assets::get_valid_phenotypes(&state.metadata);
        let discovered = discovery.discover_all(Some(&valid_phenotypes)).await?;

        let mut assets_lock = state.assets.write().await;
        *assets_lock = Some(discovered);
    }

    let assets = state.assets.read().await;
    let assets_ref = assets.as_ref().unwrap();

    // Calculate summary
    let mut summary = AssetsSummary::default();
    summary.total_assets = assets_ref.assets.len();

    for asset in &assets_ref.assets {
        // Count by ancestry
        *summary
            .by_ancestry
            .entry(asset.ancestry_group.to_string())
            .or_insert(0) += 1;

        // Count by asset type
        *summary
            .by_asset_type
            .entry(format!("{:?}", asset.asset_type).to_lowercase())
            .or_insert(0) += 1;

        // Count by sequencing type
        if let Some(ref st) = asset.sequencing_type {
            *summary
                .by_sequencing_type
                .entry(st.to_string())
                .or_insert(0) += 1;
        }

        // Collect unique analysis IDs
        summary.unique_analysis_ids.insert(asset.analysis_id.clone());
    }

    summary.total_phenotypes = summary.unique_analysis_ids.len();

    Ok(Json(summary))
}

/// Summary of discovered assets
#[derive(Debug, Default, serde::Serialize)]
pub struct AssetsSummary {
    pub total_assets: usize,
    pub total_phenotypes: usize,
    pub by_ancestry: std::collections::HashMap<String, usize>,
    pub by_asset_type: std::collections::HashMap<String, usize>,
    pub by_sequencing_type: std::collections::HashMap<String, usize>,
    #[serde(skip)]
    unique_analysis_ids: std::collections::HashSet<String>,
}
