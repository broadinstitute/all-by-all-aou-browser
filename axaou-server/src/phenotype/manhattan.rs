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

/// Significant variant row from ClickHouse (with annotations)
#[derive(Debug, Clone, Deserialize, Row)]
struct SignificantVariantRow {
    pub contig: String,
    pub position: i32,
    #[serde(rename = "ref")]
    pub ref_allele: String,
    pub alt: String,
    pub pvalue: f64,
    pub beta: f64,
    pub gene_symbol: Option<String>,
    pub consequence: Option<String>,
    pub hgvsc: Option<String>,
    pub hgvsp: Option<String>,
    pub ac: Option<u32>,
}

/// Significant gene row from ClickHouse gene_associations table
#[derive(Debug, Clone, Deserialize, Row)]
struct SignificantGeneRow {
    pub gene_id: String,
    pub gene_symbol: String,
    pub contig: String,
    pub position: i32,
    pub pvalue: f64,
    pub pvalue_burden: Option<f64>,
    pub pvalue_skat: Option<f64>,
    pub beta_burden: Option<f64>,
}

/// Peak gene row from ClickHouse for peak annotations
#[derive(Debug, Clone, Deserialize, Row)]
struct PeakGeneRow {
    pub contig: String,
    pub peak_position: i32,
    pub peak_pvalue: f64,
    pub gene_symbol: String,
    pub gene_id: String,
    pub distance_kb: f64,
    pub coding_variant_count: u32,
    pub burden_pvalue: Option<f64>,
    pub burden_beta: Option<f64>,
}

/// A gene in the locus near a GWAS peak
#[derive(Debug, Clone, Serialize)]
pub struct GeneInLocus {
    pub gene_symbol: String,
    pub gene_id: String,
    pub distance_kb: f64,
    pub coding_variant_count: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub burden_pvalue: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub burden_beta: Option<f64>,
}

/// A GWAS peak with nearby genes
#[derive(Debug, Clone, Serialize)]
pub struct Peak {
    pub contig: String,
    pub position: i32,
    pub pvalue: f64,
    pub genes: Vec<GeneInLocus>,
}

/// Type of Manhattan plot hit (Variant or Gene)
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum HitType {
    Variant,
    Gene,
}

/// A significant hit with raw genomic coordinates and annotations.
/// The frontend computes display coordinates using ChromosomeLayout.
/// Supports both variant hits (from exome/genome Manhattan plots) and
/// gene hits (from gene burden Manhattan plots).
#[derive(Debug, Serialize)]
pub struct SignificantHit {
    /// Type of hit (variant or gene)
    pub hit_type: HitType,
    /// Primary ID: variant_id for variants, gene_id for genes
    pub id: String,
    /// Display label: variant_id for variants, gene_symbol for genes
    pub label: String,
    /// Chromosome name (e.g., "chr1", "chr22")
    pub contig: String,
    /// Genomic position (1-based)
    pub position: i32,
    /// P-value
    pub pvalue: f64,
    /// Effect size (beta coefficient for variants, beta_burden for genes)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub beta: Option<f64>,
    /// Gene symbol from annotations (for variants) or primary gene symbol (for genes)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gene_symbol: Option<String>,
    /// Variant consequence (e.g., "missense_variant", "intron_variant") - variants only
    #[serde(skip_serializing_if = "Option::is_none")]
    pub consequence: Option<String>,
    /// HGVS coding notation - variants only
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hgvsc: Option<String>,
    /// HGVS protein notation - variants only
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hgvsp: Option<String>,
    /// Allele count - variants only
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ac: Option<u32>,
    /// P-value for burden test - genes only
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pvalue_burden: Option<f64>,
    /// P-value for SKAT test - genes only
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pvalue_skat: Option<f64>,
}

/// Overlay data with significant hits from ClickHouse
#[derive(Debug, Serialize)]
pub struct ManhattanOverlay {
    pub significant_hits: Vec<SignificantHit>,
    pub hit_count: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub peaks: Option<Vec<Peak>>,
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

/// Fetch peak annotations with nearby genes from ClickHouse
///
/// Returns top N GWAS peaks with genes in locus (±200kb), coding variant counts,
/// and burden test p-values where available.
async fn fetch_peak_annotations(
    state: &AppState,
    analysis_id: &str,
    ancestry: &str,
    sequencing_type: &str,
    annotation_table: &str,
    limit: u32,
) -> Result<Vec<Peak>, AppError> {
    // Complex CTE query to aggregate peaks and annotate with nearby genes
    let query = format!(
        r#"
        WITH peak_variants AS (
            SELECT
                sv.contig,
                sv.position,
                sv.pvalue,
                ann.gene_symbol,
                ann.consequence
            FROM significant_variants sv
            LEFT JOIN (
                SELECT xpos, ref, alt, gene_symbol, consequence
                FROM {annotation_table}
                WHERE xpos IN (SELECT xpos FROM significant_variants WHERE phenotype = ?)
            ) ann ON sv.xpos = ann.xpos AND sv.ref = ann.ref AND sv.alt = ann.alt
            WHERE sv.phenotype = ?
              AND sv.ancestry = ?
              AND sv.sequencing_type = ?
        ),
        -- Cluster peaks into 1Mb bins, take top variant per bin
        peaks AS (
            SELECT
                contig,
                argMin(position, pvalue) as peak_position,
                min(pvalue) as peak_pvalue
            FROM peak_variants
            GROUP BY contig, intDiv(position, 1000000)
            ORDER BY peak_pvalue ASC
            LIMIT ?
        ),
        -- Get genes within 200kb of each peak (named genes only)
        locus_genes AS (
            SELECT
                p.contig,
                p.peak_position,
                p.peak_pvalue,
                gm.gene_id,
                gm.symbol as gene_symbol,
                abs(p.peak_position - (gm.start + gm.stop) / 2) as distance_to_peak
            FROM peaks p
            JOIN gene_models gm
                ON gm.chrom = substring(p.contig, 4)
                AND gm.start < p.peak_position + 200000
                AND gm.stop > p.peak_position - 200000
            WHERE gm.symbol != ''
              AND gm.symbol NOT LIKE 'ENSG%'
        ),
        -- Count coding variants per gene at each peak
        coding_variants AS (
            SELECT
                pv.contig,
                intDiv(pv.position, 1000000) as bin,
                pv.gene_symbol,
                count(*) as coding_count
            FROM peak_variants pv
            WHERE pv.gene_symbol IS NOT NULL
            GROUP BY pv.contig, bin, pv.gene_symbol
        ),
        -- Get burden results (deduplicated by gene)
        burden AS (
            SELECT
                gene_id,
                min(pvalue) as burden_pvalue,
                argMin(beta_burden, pvalue) as burden_beta
            FROM gene_associations
            WHERE phenotype = ?
              AND ancestry = ?
              AND annotation = 'pLoF'
            GROUP BY gene_id
        )
        SELECT
            lg.contig,
            lg.peak_position,
            lg.peak_pvalue,
            lg.gene_symbol,
            lg.gene_id,
            round(lg.distance_to_peak / 1000, 1) as distance_kb,
            toUInt32(coalesce(cv.coding_count, 0)) as coding_variant_count,
            b.burden_pvalue,
            b.burden_beta
        FROM locus_genes lg
        LEFT JOIN coding_variants cv
            ON cv.contig = lg.contig
            AND cv.bin = intDiv(lg.peak_position, 1000000)
            AND cv.gene_symbol = lg.gene_symbol
        LEFT JOIN burden b ON b.gene_id = lg.gene_id
        ORDER BY lg.peak_pvalue ASC, lg.distance_to_peak ASC
        "#,
        annotation_table = annotation_table
    );

    let rows: Vec<PeakGeneRow> = state
        .clickhouse
        .query(&query)
        .bind(analysis_id) // for annotation subquery
        .bind(analysis_id) // for peak_variants
        .bind(ancestry)
        .bind(sequencing_type)
        .bind(limit)
        .bind(analysis_id) // for burden
        .bind(ancestry) // for burden (lowercase)
        .fetch_all()
        .await
        .map_err(|e| AppError::DataTransformError(format!("Peak annotation query error: {}", e)))?;

    // Group rows by (contig, peak_position) into Peak structs
    let mut peaks: Vec<Peak> = Vec::new();
    let mut current_peak: Option<Peak> = None;

    for row in rows {
        let key = (row.contig.clone(), row.peak_position);

        match &mut current_peak {
            Some(peak) if peak.contig == key.0 && peak.position == key.1 => {
                // Add gene to existing peak
                peak.genes.push(GeneInLocus {
                    gene_symbol: row.gene_symbol,
                    gene_id: row.gene_id,
                    distance_kb: row.distance_kb,
                    coding_variant_count: row.coding_variant_count,
                    burden_pvalue: row.burden_pvalue,
                    burden_beta: row.burden_beta,
                });
            }
            _ => {
                // Save previous peak and start new one
                if let Some(peak) = current_peak.take() {
                    peaks.push(peak);
                }
                current_peak = Some(Peak {
                    contig: row.contig,
                    position: row.peak_position,
                    pvalue: row.peak_pvalue,
                    genes: vec![GeneInLocus {
                        gene_symbol: row.gene_symbol,
                        gene_id: row.gene_id,
                        distance_kb: row.distance_kb,
                        coding_variant_count: row.coding_variant_count,
                        burden_pvalue: row.burden_pvalue,
                        burden_beta: row.burden_beta,
                    }],
                });
            }
        }
    }

    // Don't forget the last peak
    if let Some(peak) = current_peak {
        peaks.push(peak);
    }

    Ok(peaks)
}

/// GET /api/phenotype/:analysis_id/manhattan/overlay
///
/// Returns Manhattan plot overlay JSON with significant hits from ClickHouse.
/// Returns raw genomic coordinates; frontend computes display positions.
/// Supports both variant hits (exome/genome Manhattan) and gene hits (gene Manhattan).
pub async fn get_manhattan_overlay(
    State(state): State<Arc<AppState>>,
    Path(analysis_id): Path<String>,
    Query(params): Query<ManhattanQuery>,
) -> Result<Json<ManhattanOverlay>, AppError> {
    debug!("Building Manhattan overlay from ClickHouse for phenotype: {}", analysis_id);

    let ancestry = params.ancestry.as_deref().unwrap_or("meta");
    let plot_type = params.plot_type.as_deref().unwrap_or("genome_manhattan");

    // Handle gene Manhattan separately
    if plot_type == "gene_manhattan" {
        return get_gene_manhattan_overlay(&state, &analysis_id, ancestry).await;
    }

    // Determine sequencing type from plot_type for variant Manhattan
    let sequencing_type = match plot_type {
        "exome_manhattan" => "exome",
        _ => "genome",
    };

    // Query significant variants with annotations from ClickHouse
    // Use IN subquery for efficient index usage on annotation tables
    let annotation_table = match sequencing_type {
        "exome" => "exome_annotations",
        _ => "genome_annotations",
    };

    let query = format!(
        r#"
        SELECT
            sv.contig, sv.position, sv.ref, sv.alt, sv.pvalue, sv.beta,
            ann.gene_symbol, ann.consequence, ann.hgvsc, ann.hgvsp, ann.ac
        FROM significant_variants sv
        LEFT JOIN (
            SELECT xpos, ref, alt, gene_symbol, consequence, hgvsc, hgvsp, ac
            FROM {annotation_table}
            WHERE xpos IN (
                SELECT xpos FROM significant_variants
                WHERE phenotype = ?
            )
        ) ann ON sv.xpos = ann.xpos AND sv.ref = ann.ref AND sv.alt = ann.alt
        WHERE sv.phenotype = ?
            AND sv.ancestry = ?
            AND sv.sequencing_type = ?
        ORDER BY sv.pvalue ASC
        "#,
        annotation_table = annotation_table
    );

    let rows: Vec<SignificantVariantRow> = state
        .clickhouse
        .query(&query)
        .bind(&analysis_id)  // for IN subquery
        .bind(&analysis_id)  // for outer WHERE
        .bind(ancestry)
        .bind(sequencing_type)
        .fetch_all()
        .await
        .map_err(|e| AppError::DataTransformError(format!("ClickHouse query error: {}", e)))?;

    // Convert to SignificantHit with raw coordinates and annotations
    let significant_hits: Vec<SignificantHit> = rows
        .into_iter()
        .map(|row| {
            let variant_id = make_variant_id(&row.contig, row.position, &row.ref_allele, &row.alt);
            SignificantHit {
                hit_type: HitType::Variant,
                id: variant_id.clone(),
                label: variant_id,
                contig: row.contig,
                position: row.position,
                pvalue: row.pvalue,
                beta: Some(row.beta),
                gene_symbol: row.gene_symbol,
                consequence: row.consequence,
                hgvsc: row.hgvsc,
                hgvsp: row.hgvsp,
                ac: row.ac,
                pvalue_burden: None,
                pvalue_skat: None,
            }
        })
        .collect();

    let hit_count = significant_hits.len();

    // Fetch peak annotations (top 20 peaks with nearby genes)
    let peaks = fetch_peak_annotations(
        &state,
        &analysis_id,
        ancestry,
        sequencing_type,
        annotation_table,
        20,
    )
    .await
    .ok(); // Convert error to None - peaks are optional

    Ok(Json(ManhattanOverlay {
        significant_hits,
        hit_count,
        peaks,
    }))
}

/// Get gene Manhattan overlay from gene_associations table
async fn get_gene_manhattan_overlay(
    state: &AppState,
    analysis_id: &str,
    ancestry: &str,
) -> Result<Json<ManhattanOverlay>, AppError> {
    // Query significant genes from gene_associations
    // Filter by phenotype, ancestry, and significant p-value threshold
    let query = r#"
        SELECT
            gene_id, gene_symbol, contig, gene_start_position AS position,
            pvalue, pvalue_burden, pvalue_skat, beta_burden
        FROM gene_associations
        WHERE phenotype = ?
            AND ancestry = ?
            AND pvalue IS NOT NULL
            AND pvalue < 0.05
        ORDER BY pvalue ASC
        LIMIT 500
    "#;

    let rows: Vec<SignificantGeneRow> = state
        .clickhouse
        .query(query)
        .bind(analysis_id)
        .bind(ancestry)
        .fetch_all()
        .await
        .map_err(|e| AppError::DataTransformError(format!("ClickHouse query error: {}", e)))?;

    // Convert to SignificantHit for genes
    let significant_hits: Vec<SignificantHit> = rows
        .into_iter()
        .map(|row| SignificantHit {
            hit_type: HitType::Gene,
            id: row.gene_id,
            label: row.gene_symbol.clone(),
            contig: row.contig,
            position: row.position,
            pvalue: row.pvalue,
            beta: row.beta_burden,
            gene_symbol: Some(row.gene_symbol),
            consequence: None,
            hgvsc: None,
            hgvsp: None,
            ac: None,
            pvalue_burden: row.pvalue_burden,
            pvalue_skat: row.pvalue_skat,
        })
        .collect();

    let hit_count = significant_hits.len();

    Ok(Json(ManhattanOverlay {
        significant_hits,
        hit_count,
        peaks: None, // Gene Manhattan doesn't have peak annotations
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
