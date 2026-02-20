//! Locus query handlers
//!
//! Provides endpoints for retrieving locus metadata and variants within loci
//! for Manhattan plot rendering.

use crate::api::AppState;
use crate::clickhouse::models::{LocusRow, LocusVariantRow};
use crate::error::AppError;
use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Query parameters for loci list endpoint
#[derive(Debug, Deserialize)]
pub struct LociQuery {
    /// Ancestry group filter (default: "meta")
    pub ancestry: Option<String>,
}

/// GET /api/phenotype/:analysis_id/loci
///
/// Returns all loci for a phenotype with their metadata including
/// lead variant, variant counts, and plot URIs.
pub async fn get_phenotype_loci(
    State(state): State<Arc<AppState>>,
    Path(analysis_id): Path<String>,
    Query(params): Query<LociQuery>,
) -> Result<Json<Vec<LocusRow>>, AppError> {
    let ancestry = params.ancestry.unwrap_or_else(|| "meta".to_string());

    let query = r#"
        SELECT
            locus_id, phenotype, ancestry, contig, start, stop,
            xstart, xstop, source, lead_variant, lead_pvalue,
            exome_count, genome_count, plot_gcs_uri
        FROM loci
        WHERE phenotype = ? AND ancestry = ?
    "#;

    let rows = state
        .clickhouse
        .query(query)
        .bind(&analysis_id)
        .bind(&ancestry)
        .fetch_all::<LocusRow>()
        .await
        .map_err(|e| AppError::DataTransformError(format!("ClickHouse query error: {}", e)))?;

    Ok(Json(rows))
}

/// Query parameters for locus variants endpoint
#[derive(Debug, Deserialize)]
pub struct LocusVariantsQuery {
    /// Ancestry group filter (default: "meta")
    pub ancestry: Option<String>,
    /// Sequencing type (required: "exome" or "genome")
    pub sequencing_type: String,
}

/// GET /api/phenotype/:analysis_id/loci/:locus_id/variants
///
/// Returns all variants within a specific locus for Manhattan plot rendering.
/// Variants are sorted by position for efficient rendering.
pub async fn get_locus_variants(
    State(state): State<Arc<AppState>>,
    Path((analysis_id, locus_id)): Path<(String, String)>,
    Query(params): Query<LocusVariantsQuery>,
) -> Result<Json<Vec<LocusVariantRow>>, AppError> {
    let ancestry = params.ancestry.unwrap_or_else(|| "meta".to_string());

    let query = r#"
        SELECT xpos, position, pvalue, neg_log10_p, is_significant
        FROM loci_variants
        WHERE phenotype = ? AND locus_id = ? AND ancestry = ? AND sequencing_type = ?
        ORDER BY position
    "#;

    let rows = state
        .clickhouse
        .query(query)
        .bind(&analysis_id)
        .bind(&locus_id)
        .bind(&ancestry)
        .bind(&params.sequencing_type)
        .fetch_all::<LocusVariantRow>()
        .await
        .map_err(|e| AppError::DataTransformError(format!("ClickHouse query error: {}", e)))?;

    Ok(Json(rows))
}

// =============================================================================
// Locus Plot API - Returns PNG URL + sidecar for coordinate mapping
// =============================================================================

/// Y-axis configuration for locus plot coordinate mapping
/// Matches the hybrid linear-log scale used by hail-decoder
#[derive(Debug, Clone, Serialize)]
pub struct YAxisConfig {
    /// Threshold where scale switches from linear to log (-log10(p) value)
    pub log_threshold: f64,
    /// Fraction of plot height for the linear portion
    pub linear_fraction: f64,
    /// Maximum -log10(p) value for scaling
    pub max_neg_log_p: f64,
}

/// Image dimensions
#[derive(Debug, Clone, Serialize)]
pub struct ImageDimensions {
    pub width: u32,
    pub height: u32,
}

/// Significance threshold marker
#[derive(Debug, Clone, Serialize)]
pub struct ThresholdMarker {
    pub pvalue: f64,
    pub y_px: u32,
}

/// Sidecar metadata for locus plot coordinate mapping
#[derive(Debug, Clone, Serialize)]
pub struct LocusPlotSidecar {
    /// Image dimensions
    pub image: ImageDimensions,
    /// Y-axis configuration for coordinate calculation
    pub y_axis: YAxisConfig,
    /// Significance threshold line position
    pub threshold: ThresholdMarker,
}

/// Response for locus plot endpoint
#[derive(Debug, Clone, Serialize)]
pub struct LocusPlotResponse {
    /// URL to the locus plot PNG image
    pub image_url: String,
    /// Sidecar metadata for coordinate mapping
    pub sidecar: LocusPlotSidecar,
    /// Locus genomic coordinates (for RegionViewer X-axis mapping)
    pub locus_start: i32,
    pub locus_stop: i32,
    pub contig: String,
}

/// Query parameters for locus plot endpoint
#[derive(Debug, Deserialize)]
pub struct LocusPlotQuery {
    /// Ancestry group filter (default: "meta")
    pub ancestry: Option<String>,
}

/// GET /api/phenotype/:analysis_id/loci/:locus_id/plot
///
/// Returns the pre-rendered locus plot PNG URL and sidecar metadata
/// for coordinate mapping.
pub async fn get_locus_plot(
    State(state): State<Arc<AppState>>,
    Path((analysis_id, locus_id)): Path<(String, String)>,
    Query(params): Query<LocusPlotQuery>,
) -> Result<Json<LocusPlotResponse>, AppError> {
    let ancestry = params.ancestry.unwrap_or_else(|| "meta".to_string());

    // Query the loci table for plot URI
    let query = r#"
        SELECT
            locus_id, phenotype, ancestry, contig, start, stop,
            xstart, xstop, source, lead_variant, lead_pvalue,
            exome_count, genome_count, plot_gcs_uri
        FROM loci
        WHERE phenotype = ? AND locus_id = ? AND ancestry = ?
        LIMIT 1
    "#;

    let rows = state
        .clickhouse
        .query(query)
        .bind(&analysis_id)
        .bind(&locus_id)
        .bind(&ancestry)
        .fetch_all::<LocusRow>()
        .await
        .map_err(|e| AppError::DataTransformError(format!("ClickHouse query error: {}", e)))?;

    let locus = rows.into_iter().next().ok_or_else(|| {
        AppError::NotFound(format!(
            "Locus {} not found for phenotype {} ancestry {}",
            locus_id, analysis_id, ancestry
        ))
    })?;

    // Check if plot URI is available
    if locus.plot_gcs_uri.is_empty() {
        return Err(AppError::NotFound(format!(
            "No plot available for locus {}",
            locus_id
        )));
    }

    // Convert GCS URI to signed URL or proxy URL
    // For now, we'll use a simple proxy pattern
    let image_url = format!(
        "/api/phenotype/{}/loci/{}/plot/image?ancestry={}",
        analysis_id, locus_id, ancestry
    );

    // Default sidecar configuration matching hail-decoder locus plots
    // These are the standard dimensions and scale parameters
    let sidecar = LocusPlotSidecar {
        image: ImageDimensions {
            width: 800,
            height: 400,
        },
        y_axis: YAxisConfig {
            log_threshold: 10.0,
            linear_fraction: 0.6,
            max_neg_log_p: 50.0,
        },
        threshold: ThresholdMarker {
            pvalue: 5e-8,
            y_px: 160, // Approximate pixel position of threshold line
        },
    };

    Ok(Json(LocusPlotResponse {
        image_url,
        sidecar,
        locus_start: locus.start,
        locus_stop: locus.stop,
        contig: locus.contig,
    }))
}

/// GET /api/phenotype/:analysis_id/loci/:locus_id/plot/image
///
/// Proxies the locus plot PNG image from GCS.
pub async fn get_locus_plot_image(
    State(state): State<Arc<AppState>>,
    Path((analysis_id, locus_id)): Path<(String, String)>,
    Query(params): Query<LocusPlotQuery>,
) -> Result<axum::response::Response, AppError> {
    use axum::body::Body;
    use axum::http::{header, Response, StatusCode};

    let ancestry = params.ancestry.unwrap_or_else(|| "meta".to_string());

    // Query the loci table for plot URI
    let query = r#"
        SELECT plot_gcs_uri
        FROM loci
        WHERE phenotype = ? AND locus_id = ? AND ancestry = ?
        LIMIT 1
    "#;

    #[derive(Debug, Clone, serde::Deserialize, clickhouse::Row)]
    struct PlotUriRow {
        plot_gcs_uri: String,
    }

    let rows = state
        .clickhouse
        .query(query)
        .bind(&analysis_id)
        .bind(&locus_id)
        .bind(&ancestry)
        .fetch_all::<PlotUriRow>()
        .await
        .map_err(|e| AppError::DataTransformError(format!("ClickHouse query error: {}", e)))?;

    let plot_uri = rows
        .into_iter()
        .next()
        .map(|r| r.plot_gcs_uri)
        .ok_or_else(|| AppError::NotFound(format!("Locus {} not found", locus_id)))?;

    if plot_uri.is_empty() {
        return Err(AppError::NotFound(format!(
            "No plot available for locus {}",
            locus_id
        )));
    }

    // Fetch image from GCS using object_store
    use object_store::gcp::GoogleCloudStorageBuilder;
    use object_store::path::Path as ObjectPath;
    use object_store::ObjectStore;

    // Parse GCS URI: gs://bucket/path/to/file.png
    let uri_parts: Vec<&str> = plot_uri
        .strip_prefix("gs://")
        .ok_or_else(|| AppError::DataTransformError("Invalid GCS URI".to_string()))?
        .splitn(2, '/')
        .collect();

    if uri_parts.len() != 2 {
        return Err(AppError::DataTransformError(
            "Invalid GCS URI format".to_string(),
        ));
    }

    let bucket = uri_parts[0];
    let path = uri_parts[1];

    let store = GoogleCloudStorageBuilder::new()
        .with_bucket_name(bucket)
        .build()
        .map_err(|e| AppError::DataTransformError(format!("Failed to create GCS client: {}", e)))?;

    let object_path = ObjectPath::from(path);
    let data = store
        .get(&object_path)
        .await
        .map_err(|e| AppError::NotFound(format!("Failed to fetch plot image: {}", e)))?
        .bytes()
        .await
        .map_err(|e| AppError::DataTransformError(format!("Failed to read image data: {}", e)))?;

    // Build response with image/png content type and caching headers
    let response = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "image/png")
        .header(header::CACHE_CONTROL, "public, max-age=86400") // Cache for 24 hours
        .body(Body::from(data.to_vec()))
        .map_err(|e| AppError::DataTransformError(format!("Failed to build response: {}", e)))?;

    Ok(response)
}
