//! API route handlers for the AxAoU server

use crate::error::AppError;
use crate::gene_models::GeneModelsQuery;
use crate::gene_queries::GeneQueryEngine;
use crate::models::{
    AnalysisAsset, AnalysisAssets, AnalysisMetadata, AncestryGroup, GeneAssociationResponse,
    GeneAssociationResult, GeneModel, GeneQueryParams,
};
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
    pub assets: Arc<RwLock<Option<AnalysisAssets>>>,
    /// On-demand gene association query engine
    pub gene_queries: GeneQueryEngine,
    /// ClickHouse client for variant queries
    pub clickhouse: clickhouse::Client,
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

/// Application configuration returned to the frontend
#[derive(Debug, Clone, serde::Serialize)]
pub struct AxaouConfig {
    pub ancestry_codes: Vec<String>,
    pub burden_sets: Vec<String>,
    pub burden_pvalue_fields: Vec<String>,
    pub default_max_maf: String,
    pub reference_genome: String,
    pub test_analyses: Vec<String>,
    pub test_ancestry_codes: Vec<String>,
    pub test_gene_symbols: Vec<String>,
    pub test_intervals: Vec<String>,
    pub variant_pvalue_threshold: f64,
    pub top_gene_associations_threshold: f64,
}

/// Handler for GET /api/config
///
/// Returns static application configuration for the frontend.
pub async fn get_config() -> Json<AxaouConfig> {
    Json(AxaouConfig {
        ancestry_codes: vec![
            "afr".to_string(),
            "amr".to_string(),
            "eas".to_string(),
            "eur".to_string(),
            "mid".to_string(),
            "sas".to_string(),
            "meta".to_string(),
        ],
        burden_sets: vec![
            "pLoF".to_string(),
            "missenseLC".to_string(),
            "synonymous".to_string(),
        ],
        burden_pvalue_fields: vec![
            "pvalue".to_string(),
            "pvalue_burden".to_string(),
            "pvalue_skat".to_string(),
        ],
        default_max_maf: "0.001".to_string(),
        reference_genome: "GRCh38".to_string(),
        test_analyses: vec!["height".to_string()],
        test_ancestry_codes: vec!["eur".to_string(), "meta".to_string()],
        test_gene_symbols: vec![
            "FGFR2".to_string(),
            "GDF5".to_string(),
            "SHOX".to_string(),
        ],
        test_intervals: vec![
            "chr10:121478332-121598458".to_string(),
            "chr20:35433347-35454746".to_string(),
            "chrX:624344-659411".to_string(),
        ],
        variant_pvalue_threshold: 1.0,
        top_gene_associations_threshold: 1e-6,
    })
}

/// Category summary derived from analysis metadata
#[derive(Debug, Clone, serde::Serialize)]
pub struct AnalysisCategory {
    pub category: String,
    pub classification_group: String,
    pub color: String,
    pub analyses: Vec<String>,
    #[serde(rename = "analysisCount")]
    pub analysis_count: usize,
    pub phenocodes: Vec<String>,
    #[serde(rename = "phenoCount")]
    pub pheno_count: usize,
}

/// Generate a deterministic color from a category name
fn category_color(category: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();
    category.hash(&mut hasher);
    let hash = hasher.finish();

    // Generate a pleasing color by using HSL with fixed saturation/lightness
    // Use the hash to determine the hue
    let hue: f64 = (hash % 360) as f64;
    let saturation: f64 = 0.65;
    let lightness: f64 = 0.55;

    // Convert HSL to RGB
    let c: f64 = (1.0 - (2.0 * lightness - 1.0).abs()) * saturation;
    let x = c * (1.0 - ((hue / 60.0) % 2.0 - 1.0).abs());
    let m = lightness - c / 2.0;

    let (r, g, b) = match (hue / 60.0) as u32 {
        0 => (c, x, 0.0),
        1 => (x, c, 0.0),
        2 => (0.0, c, x),
        3 => (0.0, x, c),
        4 => (x, 0.0, c),
        _ => (c, 0.0, x),
    };

    let r = ((r + m) * 255.0) as u8;
    let g = ((g + m) * 255.0) as u8;
    let b = ((b + m) * 255.0) as u8;

    format!("#{:02X}{:02X}{:02X}", r, g, b)
}

/// Handler for GET /api/categories
///
/// Returns category summaries derived from analysis metadata.
/// Each category includes the list of analyses and counts.
pub async fn get_categories(
    State(state): State<Arc<AppState>>,
) -> Json<Vec<AnalysisCategory>> {
    use std::collections::HashMap;

    // Group analyses by category
    let mut by_category: HashMap<String, Vec<String>> = HashMap::new();

    for meta in &state.metadata {
        by_category
            .entry(meta.category.clone())
            .or_default()
            .push(meta.analysis_id.clone());
    }

    // Build category summaries
    let mut categories: Vec<AnalysisCategory> = by_category
        .into_iter()
        .map(|(category, mut analyses)| {
            analyses.sort();
            analyses.dedup();
            let count = analyses.len();
            AnalysisCategory {
                color: category_color(&category),
                classification_group: "axaou_category".to_string(),
                phenocodes: analyses.clone(),
                pheno_count: count,
                analyses,
                analysis_count: count,
                category,
            }
        })
        .collect();

    // Sort by category name
    categories.sort_by(|a, b| a.category.cmp(&b.category));

    Json(categories)
}

/// Handler for GET /api/analyses/:analysis_id
///
/// Returns a single analysis metadata record by its ID (wrapped in array for frontend compatibility).
pub async fn get_analysis_by_id(
    State(state): State<Arc<AppState>>,
    Path(analysis_id): Path<String>,
) -> Result<Json<Vec<AnalysisMetadata>>, AppError> {
    state
        .metadata
        .iter()
        .find(|m| m.analysis_id.eq_ignore_ascii_case(&analysis_id))
        .cloned()
        .map(|m| Json(vec![m]))
        .ok_or_else(|| AppError::NotFound(format!("Analysis '{}' not found", analysis_id)))
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
    // Use ClickHouse for fast queries
    let gene_models = crate::gene_models::GeneModelsClickHouse::new(state.clickhouse.clone());

    match gene_models.get_by_gene_id(&gene_id).await? {
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
    // Use ClickHouse for fast queries
    let gene_models = crate::gene_models::GeneModelsClickHouse::new(state.clickhouse.clone());

    let genes = gene_models.get_in_interval(&interval).await?;
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

// ============================================================================
// Gene Association Query Endpoints
// ============================================================================

/// Query parameters for the gene association endpoints
#[derive(Debug, Deserialize)]
pub struct GeneAssocQuery {
    /// Filter by ancestry group (default: "meta")
    pub ancestry: Option<String>,
    /// Filter by annotation type (e.g., "pLoF", "missenseLC")
    pub annotation: Option<String>,
    /// Filter by max MAF (default: 0.001)
    pub max_maf: Option<f64>,
}

impl GeneAssocQuery {
    fn to_params(&self) -> GeneQueryParams {
        GeneQueryParams {
            ancestry: self
                .ancestry
                .as_ref()
                .and_then(|s| AncestryGroup::from_dir_name(s)),
            annotation: self.annotation.clone(),
            max_maf: self.max_maf,
        }
    }
}

/// Query parameters for listing all genes
#[derive(Debug, Deserialize)]
pub struct GeneListQuery {
    /// Filter by ancestry group (default: "meta")
    pub ancestry: Option<String>,
    /// Filter by annotation type
    pub annotation: Option<String>,
    /// Filter by max MAF (default: 0.001)
    pub max_maf: Option<f64>,
    /// Maximum number of results to return (default: 1000)
    pub limit: Option<usize>,
    /// Number of results to skip (default: 0)
    pub offset: Option<usize>,
}

impl GeneListQuery {
    fn to_params(&self) -> GeneQueryParams {
        GeneQueryParams {
            ancestry: self
                .ancestry
                .as_ref()
                .and_then(|s| AncestryGroup::from_dir_name(s)),
            annotation: self.annotation.clone(),
            max_maf: self.max_maf,
        }
    }
}

/// Handler for GET /api/phenotype/{analysis_id}/genes/{gene_id}
///
/// Returns gene association results for a specific gene within a phenotype.
/// The gene_id can be an Ensembl ID (e.g., "ENSG00000139618") or symbol (e.g., "BRCA2").
pub async fn get_gene_associations(
    State(state): State<Arc<AppState>>,
    Path((analysis_id, gene_id)): Path<(String, String)>,
    Query(params): Query<GeneAssocQuery>,
) -> Result<Json<GeneAssociationResponse>, AppError> {
    // Ensure assets are loaded
    ensure_assets_loaded(&state).await?;

    let response = state
        .gene_queries
        .query_gene(&analysis_id, &gene_id, params.to_params())
        .await?;

    Ok(Json(response))
}

/// Handler for GET /api/phenotype/{analysis_id}/genes
///
/// Returns all gene association results for a phenotype (paginated).
/// Useful for building gene-level Manhattan plots or tables.
pub async fn list_gene_associations(
    State(state): State<Arc<AppState>>,
    Path(analysis_id): Path<String>,
    Query(params): Query<GeneListQuery>,
) -> Result<Json<Vec<GeneAssociationResult>>, AppError> {
    // Ensure assets are loaded
    ensure_assets_loaded(&state).await?;

    let results = state
        .gene_queries
        .query_all_genes(
            &analysis_id,
            params.to_params(),
            params.limit,
            params.offset,
        )
        .await?;

    Ok(Json(results))
}

/// Ensure assets are loaded (discover if needed)
async fn ensure_assets_loaded(state: &AppState) -> Result<(), AppError> {
    let needs_discovery = {
        let assets = state.assets.read().await;
        assets.is_none()
    };

    if needs_discovery {
        tracing::info!("Discovering analysis assets from GCS...");
        let discovery = crate::analysis_assets::AssetDiscovery::new()?;
        let valid_phenotypes = crate::analysis_assets::get_valid_phenotypes(&state.metadata);
        let discovered = discovery.discover_all(Some(&valid_phenotypes)).await?;
        tracing::info!("Discovered {} assets", discovered.assets.len());

        let mut assets_lock = state.assets.write().await;
        *assets_lock = Some(discovered);
    }

    Ok(())
}
