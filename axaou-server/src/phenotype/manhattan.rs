//! Manhattan plot proxy handlers
//!
//! Provides endpoints for proxying Manhattan plot PNG images and returning
//! significant variant data from ClickHouse. The frontend handles coordinate
//! calculation to match the PNG layout.

use crate::api::AppState;
use crate::clickhouse::models::PlotRow;
use crate::error::AppError;
use axum::{
    body::Body,
    extract::{Path, Query, State},
    http::{header, StatusCode},
    response::Response,
    Json,
};
use clickhouse::Row;
use object_store::gcp::GoogleCloudStorageBuilder;
use object_store::path::Path as ObjectPath;
use object_store::ObjectStore;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::debug;

/// Query parameters for Manhattan endpoints
#[derive(Debug, Deserialize)]
pub struct ManhattanQuery {
    /// Ancestry filter (e.g., "meta", "eur")
    pub ancestry: Option<String>,
    /// Plot type filter (e.g., "genome_manhattan", "exome_manhattan", "gene_manhattan")
    /// Defaults to "genome_manhattan"
    pub plot_type: Option<String>,
}

/// Significant variant row from ClickHouse
#[derive(Debug, Clone, Deserialize, Row)]
struct SignificantVariantRow {
    pub contig: String,
    pub position: i32,
    #[serde(rename = "ref")]
    pub ref_allele: String,
    pub alt: String,
    pub pvalue: f64,
}

/// A significant hit with raw genomic coordinates.
/// The frontend computes display coordinates using ChromosomeLayout.
#[derive(Debug, Serialize)]
pub struct SignificantHit {
    pub variant_id: String,
    /// Chromosome name (e.g., "chr1", "chr22")
    pub contig: String,
    /// Genomic position (1-based)
    pub position: i32,
    /// P-value
    pub pvalue: f64,
}

/// Overlay data with significant hits from ClickHouse
#[derive(Debug, Serialize)]
pub struct ManhattanOverlay {
    pub significant_hits: Vec<SignificantHit>,
    pub hit_count: usize,
}

/// Response structure returned by the API
#[derive(Debug, Serialize)]
pub struct ManhattanResponse {
    pub image_url: String,
    pub overlay: Option<ManhattanOverlay>,
    pub has_overlay: bool,
}

/// Parse a GCS URI into bucket and path components
fn parse_gcs_uri(uri: &str) -> Option<(String, String)> {
    let uri = uri.strip_prefix("gs://")?;
    let mut parts = uri.splitn(2, '/');
    let bucket = parts.next()?.to_string();
    let path = parts.next()?.to_string();
    Some((bucket, path))
}

/// Get the Manhattan plot GCS URI from ClickHouse
async fn get_manhattan_uri(
    state: &AppState,
    analysis_id: &str,
    ancestry: Option<&str>,
    plot_type: Option<&str>,
) -> Result<String, AppError> {
    // Default plot_type to genome_manhattan if not specified
    let plot_type = plot_type.unwrap_or("genome_manhattan");
    // Default ancestry to meta if not specified
    let ancestry = ancestry.unwrap_or("meta");

    let query = r#"
        SELECT phenotype, ancestry, plot_type, gcs_uri
        FROM phenotype_plots
        WHERE phenotype = ? AND plot_type = ? AND ancestry = ?
        LIMIT 1
    "#;

    let row = state
        .clickhouse
        .query(query)
        .bind(analysis_id)
        .bind(plot_type)
        .bind(ancestry)
        .fetch_optional::<PlotRow>()
        .await
        .map_err(|e| AppError::DataTransformError(format!("ClickHouse query error: {}", e)))?;

    match row {
        Some(plot) => Ok(plot.gcs_uri),
        None => Err(AppError::NotFound(format!(
            "Manhattan plot not found for phenotype '{}' with plot_type '{}' and ancestry '{}'",
            analysis_id, plot_type, ancestry
        ))),
    }
}

/// GET /api/phenotype/:analysis_id/manhattan/image
///
/// Streams the Manhattan plot PNG from GCS.
pub async fn get_manhattan_image(
    State(state): State<Arc<AppState>>,
    Path(analysis_id): Path<String>,
    Query(params): Query<ManhattanQuery>,
) -> Result<Response, AppError> {
    debug!("Fetching Manhattan image for phenotype: {}", analysis_id);

    // Get the GCS URI from ClickHouse
    let gcs_uri = get_manhattan_uri(
        &state,
        &analysis_id,
        params.ancestry.as_deref(),
        params.plot_type.as_deref(),
    )
    .await?;

    // Ensure it's a PNG
    if !gcs_uri.ends_with(".png") {
        return Err(AppError::DataTransformError(format!(
            "Expected PNG file, got: {}",
            gcs_uri
        )));
    }

    // Parse the GCS URI
    let (bucket, path) = parse_gcs_uri(&gcs_uri).ok_or_else(|| {
        AppError::DataTransformError(format!("Invalid GCS URI: {}", gcs_uri))
    })?;

    // Create GCS client for this bucket
    let store = GoogleCloudStorageBuilder::new()
        .with_bucket_name(&bucket)
        .build()
        .map_err(|e| AppError::DataTransformError(format!("Failed to create GCS client: {}", e)))?;

    // Fetch the object
    let object_path = ObjectPath::from(path.as_str());
    let result = store
        .get(&object_path)
        .await
        .map_err(|e| AppError::DataTransformError(format!("Failed to fetch from GCS: {}", e)))?;

    // Stream the bytes as response body
    let stream = result.into_stream();
    let body = Body::from_stream(stream);

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "image/png")
        .header(header::CACHE_CONTROL, "public, max-age=86400") // Cache for 1 day
        .body(body)
        .unwrap())
}

/// Build variant ID from components
fn make_variant_id(contig: &str, position: i32, ref_allele: &str, alt: &str) -> String {
    format!("{}-{}-{}-{}", contig, position, ref_allele, alt)
}

/// GET /api/phenotype/:analysis_id/manhattan/overlay
///
/// Returns Manhattan plot overlay JSON with significant hits from ClickHouse.
/// Returns raw genomic coordinates; frontend computes display positions.
pub async fn get_manhattan_overlay(
    State(state): State<Arc<AppState>>,
    Path(analysis_id): Path<String>,
    Query(params): Query<ManhattanQuery>,
) -> Result<Json<ManhattanOverlay>, AppError> {
    debug!("Building Manhattan overlay from ClickHouse for phenotype: {}", analysis_id);

    let ancestry = params.ancestry.as_deref().unwrap_or("meta");

    // Determine sequencing type from plot_type
    let sequencing_type = match params.plot_type.as_deref().unwrap_or("genome_manhattan") {
        "exome_manhattan" => "exome",
        _ => "genome",
    };

    // Query significant variants from ClickHouse
    let query = r#"
        SELECT contig, position, ref, alt, pvalue
        FROM significant_variants
        WHERE phenotype = ? AND ancestry = ? AND sequencing_type = ?
        ORDER BY pvalue ASC
    "#;

    let rows: Vec<SignificantVariantRow> = state
        .clickhouse
        .query(query)
        .bind(&analysis_id)
        .bind(ancestry)
        .bind(sequencing_type)
        .fetch_all()
        .await
        .map_err(|e| AppError::DataTransformError(format!("ClickHouse query error: {}", e)))?;

    // Convert to SignificantHit with raw coordinates
    let significant_hits: Vec<SignificantHit> = rows
        .into_iter()
        .map(|row| SignificantHit {
            variant_id: make_variant_id(&row.contig, row.position, &row.ref_allele, &row.alt),
            contig: row.contig,
            position: row.position,
            pvalue: row.pvalue,
        })
        .collect();

    let hit_count = significant_hits.len();

    Ok(Json(ManhattanOverlay {
        significant_hits,
        hit_count,
    }))
}

/// GET /api/phenotype/:analysis_id/manhattan
///
/// Returns both the image URL and overlay with significant hits from ClickHouse.
pub async fn get_manhattan_data(
    State(state): State<Arc<AppState>>,
    Path(analysis_id): Path<String>,
    Query(params): Query<ManhattanQuery>,
) -> Result<Json<ManhattanResponse>, AppError> {
    debug!("Fetching Manhattan data for phenotype: {}", analysis_id);

    // First verify the plot exists by checking the URI
    let _gcs_uri = get_manhattan_uri(
        &state,
        &analysis_id,
        params.ancestry.as_deref(),
        params.plot_type.as_deref(),
    )
    .await?;

    // Get the overlay from ClickHouse
    let overlay_result = get_manhattan_overlay(
        State(Arc::clone(&state)),
        Path(analysis_id.clone()),
        Query(ManhattanQuery {
            ancestry: params.ancestry.clone(),
            plot_type: params.plot_type.clone(),
        }),
    )
    .await;

    let (overlay, has_overlay) = match overlay_result {
        Ok(json) => {
            let has_hits = json.hit_count > 0;
            (Some(json.0), has_hits)
        }
        Err(e) => {
            debug!("Sidecar query failed for {}: {}", analysis_id, e);
            (None, false)
        }
    };

    // Construct the image URL that points to our proxy endpoint
    let mut query_params = Vec::new();
    if let Some(ref anc) = params.ancestry {
        query_params.push(format!("ancestry={}", anc));
    }
    if let Some(ref pt) = params.plot_type {
        query_params.push(format!("plot_type={}", pt));
    }
    let query_string = if query_params.is_empty() {
        String::new()
    } else {
        format!("?{}", query_params.join("&"))
    };
    let image_url = format!(
        "/api/phenotype/{}/manhattan/image{}",
        analysis_id, query_string
    );

    Ok(Json(ManhattanResponse {
        image_url,
        overlay,
        has_overlay,
    }))
}
