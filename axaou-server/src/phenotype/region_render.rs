//! Region plot rendering endpoints
//!
//! Provides viewport-aware server-rendered PNG locus plots and overlay JSON
//! for the region view. Replaces client-side canvas rendering for large regions.

use crate::api::AppState;
use crate::clickhouse::xpos::compute_xpos;
use crate::error::AppError;
use crate::phenotype::loci::{ImageDimensions, LocusPlotSidecar, ThresholdMarker, YAxisConfig};
use crate::phenotype::manhattan::{HitType, SignificantHit};
use crate::phenotype::render::{LocusPlotConfig, LocusRenderer, RenderVariant, YScale};
use axum::{
    body::Body,
    extract::{Path, Query, State},
    http::{header, StatusCode},
    response::Response,
    Json,
};
use clickhouse::Row;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::debug;

// =============================================================================
// Query Parameters
// =============================================================================

#[derive(Debug, Deserialize)]
pub struct RegionRenderQuery {
    pub contig: String,
    pub start: i32,
    pub stop: i32,
    #[serde(default = "default_ancestry")]
    pub ancestry: String,
    #[serde(default = "default_width")]
    pub width: u32,
    #[serde(default = "default_height")]
    pub height: u32,
    #[serde(default = "default_dpr")]
    pub dpr: f32,
    #[serde(default = "default_threshold")]
    pub threshold: f64,
    pub query_mode: Option<String>,
}

fn default_ancestry() -> String {
    "meta".to_string()
}
fn default_width() -> u32 {
    1200
}
fn default_height() -> u32 {
    400
}
fn default_dpr() -> f32 {
    2.0
}
fn default_threshold() -> f64 {
    5e-8
}

// =============================================================================
// ClickHouse Row Types
// =============================================================================

#[derive(Debug, Clone, Deserialize, Row)]
struct RegionVariantRow {
    pub position: i32,
    pub pvalue: f64,
    pub neg_log10_p: f32,
    pub is_significant: bool,
    pub sequencing_type: String,
    pub beta: Option<f64>,
    pub se: Option<f64>,
    pub af: Option<f64>,
    pub consequence: Option<String>,
    pub gene_symbol: Option<String>,
    pub hgvsc: Option<String>,
    pub hgvsp: Option<String>,
    #[serde(rename = "ref")]
    pub ref_allele: String,
    pub alt: String,
    pub ac: Option<u32>,
}

// =============================================================================
// Overlay Response
// =============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct RegionOverlayResponse {
    pub sidecar: LocusPlotSidecar,
    pub significant_hits: Vec<SignificantHit>,
    pub hit_count: usize,
    pub total_variant_count: usize,
}

// =============================================================================
// Data Fetching
// =============================================================================

/// Fetch region variants from ClickHouse (fast path) with transparent fallback
/// to Hail tables on GCS when no variants are found (non-significant regions).
async fn fetch_region_variants(
    state: &AppState,
    analysis_id: &str,
    ancestry: &str,
    contig: &str,
    start: i32,
    stop: i32,
    query_mode: Option<&str>,
) -> Result<Vec<RegionVariantRow>, AppError> {
    let force_slow = query_mode == Some("slow");
    let chr_contig = if contig.starts_with("chr") {
        contig.to_string()
    } else {
        format!("chr{}", contig)
    };

    let mut all_variants = if !force_slow {
        let xstart = compute_xpos(&chr_contig, start as u32);
        let xstop = compute_xpos(&chr_contig, stop as u32);

        // Query exome and genome variants concurrently, each with annotation JOIN
        let fetch_seq_type = |seq_type: &'static str, ann_table: &'static str| {
            let query = format!(
                r#"
            SELECT
                lv.position as position,
                lv.pvalue as pvalue,
                lv.neg_log10_p as neg_log10_p,
                lv.is_significant as is_significant,
                toString(lv.sequencing_type) as sequencing_type,
                lv.beta as beta,
                lv.se as se,
                coalesce(ann.af, lv.af) as af,
                toString(ann.consequence) as consequence,
                toString(ann.gene_symbol) as gene_symbol,
                toString(ann.hgvsc) as hgvsc,
                toString(ann.hgvsp) as hgvsp,
                lv.ref as ref,
                lv.alt as alt,
                ann.ac as ac
            FROM loci_variants lv
            LEFT JOIN {ann_table} ann
                ON lv.xpos = ann.xpos AND lv.ref = ann.ref AND lv.alt = ann.alt
            WHERE lv.phenotype = ?
              AND lv.ancestry = ?
              AND lv.sequencing_type = ?
              AND lv.xpos >= ?
              AND lv.xpos <= ?
            ORDER BY lv.position
            "#,
                ann_table = ann_table
            );
            state
                .clickhouse
                .query(&query)
                .bind(analysis_id)
                .bind(ancestry)
                .bind(seq_type)
                .bind(xstart)
                .bind(xstop)
                .fetch_all::<RegionVariantRow>()
        };

        let (exome_res, genome_res) = tokio::join!(
            fetch_seq_type("exome", "exome_annotations"),
            fetch_seq_type("genome", "genome_annotations")
        );

        let mut variants = exome_res
            .map_err(|e| AppError::DataTransformError(format!("Exome query error: {}", e)))?;
        let genome_variants = genome_res
            .map_err(|e| AppError::DataTransformError(format!("Genome query error: {}", e)))?;
        variants.extend(genome_variants);
        variants
    } else {
        Vec::new()
    };

    // Transparent fallback to Hail if no variants found (non-significant region)
    // or if slow mode was explicitly requested
    if all_variants.is_empty() {
        tracing::info!(
            "No variants in ClickHouse (or slow mode forced), falling back to Hail for {} {}: {}:{}-{}",
            analysis_id, ancestry, contig, start, stop
        );

        let make_hail_rows = |variants: Vec<genohype_core::genomic::VariantAssociation>,
                              seq_type: &str|
         -> Vec<RegionVariantRow> {
            variants
                .into_iter()
                .map(|v| RegionVariantRow {
                    position: v.position,
                    pvalue: v.pvalue,
                    neg_log10_p: if v.pvalue <= 0.0 {
                        350.0
                    } else {
                        -v.pvalue.log10() as f32
                    },
                    is_significant: v.pvalue < 5e-8 && v.pvalue > 0.0,
                    sequencing_type: seq_type.to_string(),
                    beta: Some(v.beta),
                    se: Some(v.se),
                    af: v.af,
                    consequence: None,
                    gene_symbol: None,
                    hgvsc: None,
                    hgvsp: None,
                    ref_allele: v.ref_allele,
                    alt: v.alt_allele,
                    ac: v.ac.map(|x| x as u32),
                })
                .collect()
        };

        let ancestry_upper = ancestry.to_uppercase();
        let exome_path = format!(
            "gs://aou_results/414k/ht_results/{}/phenotype_{}/exome_variant_results.ht",
            ancestry_upper, analysis_id
        );
        let genome_path = format!(
            "gs://aou_results/414k/ht_results/{}/phenotype_{}/genome_variant_results.ht",
            ancestry_upper, analysis_id
        );

        let (exome_res, genome_res) = tokio::join!(
            state
                .hail_client
                .query_interval_typed(&exome_path, &chr_contig, start, stop),
            state
                .hail_client
                .query_interval_typed(&genome_path, &chr_contig, start, stop)
        );

        match exome_res {
            Ok(vars) => all_variants.extend(make_hail_rows(vars, "exome")),
            Err(e) => tracing::warn!("Failed to fetch exome Hail data for {}: {}", analysis_id, e),
        }
        match genome_res {
            Ok(vars) => all_variants.extend(make_hail_rows(vars, "genome")),
            Err(e) => tracing::warn!("Failed to fetch genome Hail data for {}: {}", analysis_id, e),
        }
    }

    Ok(deduplicate_variants(all_variants))
}

/// Deduplicate by (position, ref, alt), preferring exome records for richer annotations.
fn deduplicate_variants(variants: Vec<RegionVariantRow>) -> Vec<RegionVariantRow> {
    let mut map: HashMap<(i32, String, String), RegionVariantRow> =
        HashMap::with_capacity(variants.len());

    for v in variants {
        let key = (v.position, v.ref_allele.clone(), v.alt.clone());
        map.entry(key)
            .and_modify(|existing| {
                // Exome overrides genome for richer annotation coverage
                if v.sequencing_type == "exome" && existing.sequencing_type != "exome" {
                    *existing = v.clone();
                }
            })
            .or_insert(v);
    }

    let mut result: Vec<RegionVariantRow> = map.into_values().collect();
    result.sort_by_key(|v| v.position);
    result
}

// =============================================================================
// Endpoint: Render Plot PNG
// =============================================================================

/// GET /api/phenotype/:analysis_id/region/render
///
/// Returns a viewport-aware server-rendered PNG locus plot.
pub async fn render_region_plot(
    State(state): State<Arc<AppState>>,
    Path(analysis_id): Path<String>,
    Query(params): Query<RegionRenderQuery>,
) -> Result<Response, AppError> {
    // Quantize for cache efficiency: start/stop to 1kb, width to 50px
    let q_start = (params.start / 1000) * 1000;
    let q_stop = ((params.stop + 999) / 1000) * 1000;
    let q_width = ((params.width + 49) / 50) * 50;

    let cache_key = format!(
        "region_render:{}-{}-{}-{}-{}-{}-{}-{}-{}",
        analysis_id,
        params.ancestry,
        params.contig,
        q_start,
        q_stop,
        q_width,
        params.height,
        params.dpr,
        params.query_mode.as_deref().unwrap_or("fast")
    );

    // Check cache
    if let Some(cached_bytes) = state.api_cache.get(&cache_key).await {
        debug!("Cache hit for region render: {}", cache_key);
        return Ok(Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "image/png")
            .header(header::CACHE_CONTROL, "public, max-age=300")
            .body(Body::from(cached_bytes))
            .unwrap());
    }

    debug!("Cache miss for region render: {}", cache_key);

    let variants = fetch_region_variants(
        &state,
        &analysis_id,
        &params.ancestry,
        &params.contig,
        params.start,
        params.stop,
        params.query_mode.as_deref(),
    )
    .await?;

    let render_variants: Vec<RenderVariant> = variants
        .iter()
        .filter(|v| v.pvalue > 0.0 && v.pvalue.is_finite())
        .map(|v| RenderVariant {
            position: v.position,
            pvalue: v.pvalue,
            neg_log10_p: Some(v.neg_log10_p as f64),
            consequence: v.consequence.clone(),
            af: v.af,
        })
        .collect();

    let render_width = (params.width as f32 * params.dpr) as u32;
    let render_height = (params.height as f32 * params.dpr) as u32;

    let config = LocusPlotConfig {
        width: render_width,
        height: render_height,
        dpr: params.dpr,
        start_pos: params.start,
        end_pos: params.stop,
    };

    // Render on a blocking thread to avoid blocking the async runtime
    let png_bytes = tokio::task::spawn_blocking(move || {
        let mut renderer = LocusRenderer::new(config);
        renderer.draw_threshold_line(5e-8);
        renderer.draw_variants(&render_variants);
        renderer.encode_png()
    })
    .await
    .map_err(|e| AppError::DataTransformError(format!("Render task failed: {}", e)))??;

    // Cache the result
    state
        .api_cache
        .insert(cache_key, png_bytes.clone())
        .await;

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "image/png")
        .header(header::CACHE_CONTROL, "public, max-age=300")
        .body(Body::from(png_bytes))
        .unwrap())
}

// =============================================================================
// Endpoint: Overlay JSON
// =============================================================================

/// GET /api/phenotype/:analysis_id/region/render/overlay
///
/// Returns overlay JSON with significant variants and sidecar metadata
/// for SVG overlay rendering.
pub async fn render_region_overlay(
    State(state): State<Arc<AppState>>,
    Path(analysis_id): Path<String>,
    Query(params): Query<RegionRenderQuery>,
) -> Result<Json<RegionOverlayResponse>, AppError> {
    // Quantize for cache consistency
    let q_start = (params.start / 1000) * 1000;
    let q_stop = ((params.stop + 999) / 1000) * 1000;

    let cache_key = format!(
        "region_overlay:{}-{}-{}-{}-{}-{}-{}",
        analysis_id, params.ancestry, params.contig, q_start, q_stop, params.threshold,
        params.query_mode.as_deref().unwrap_or("fast")
    );

    // Check cache
    if let Some(cached_bytes) = state.api_cache.get(&cache_key).await {
        debug!("Cache hit for region overlay: {}", cache_key);
        let resp: RegionOverlayResponse = serde_json::from_slice(&cached_bytes)
            .map_err(|e| AppError::DataTransformError(format!("Deserialize error: {}", e)))?;
        return Ok(Json(resp));
    }

    debug!("Cache miss for region overlay: {}", cache_key);

    let variants = fetch_region_variants(
        &state,
        &analysis_id,
        &params.ancestry,
        &params.contig,
        params.start,
        params.stop,
        params.query_mode.as_deref(),
    )
    .await?;

    let total_variant_count = variants.len();

    // Filter to significant variants for the overlay
    let chr_contig = if params.contig.starts_with("chr") {
        params.contig.clone()
    } else {
        format!("chr{}", params.contig)
    };

    let significant_hits: Vec<SignificantHit> = variants
        .iter()
        .filter(|v| v.pvalue < params.threshold && v.pvalue > 0.0)
        .map(|v| {
            let variant_id = format!(
                "{}-{}-{}-{}",
                chr_contig, v.position, v.ref_allele, v.alt
            );
            SignificantHit {
                hit_type: HitType::Variant,
                id: variant_id.clone(),
                label: variant_id,
                contig: chr_contig.clone(),
                position: v.position,
                pvalue: v.pvalue,
                neg_log10_p: Some(v.neg_log10_p as f64),
                beta: v.beta,
                gene_symbol: v.gene_symbol.clone(),
                consequence: v.consequence.clone(),
                hgvsc: v.hgvsc.clone(),
                hgvsp: v.hgvsp.clone(),
                ac: v.ac,
                pvalue_burden: None,
                pvalue_skat: None,
            }
        })
        .collect();

    let hit_count = significant_hits.len();

    // Compute threshold y-pixel using the same YScale as the renderer
    let scale = YScale::new(params.height);
    let y_px = scale.get_y(params.threshold, None) as u32;

    let response = RegionOverlayResponse {
        sidecar: LocusPlotSidecar {
            image: ImageDimensions {
                width: params.width,
                height: params.height,
            },
            y_axis: YAxisConfig {
                log_threshold: 10.0,
                linear_fraction: 0.6,
                max_neg_log_p: 300.0,
            },
            threshold: ThresholdMarker {
                pvalue: params.threshold,
                y_px,
            },
        },
        significant_hits,
        hit_count,
        total_variant_count,
    };

    // Cache the overlay
    if let Ok(json_bytes) = serde_json::to_vec(&response) {
        state.api_cache.insert(cache_key, json_bytes).await;
    }

    Ok(Json(response))
}
