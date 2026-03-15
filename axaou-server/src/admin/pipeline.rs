//! Pipeline Control Center API endpoints.
//!
//! Provides endpoints for monitoring the Manhattan pipeline status,
//! viewing storage metrics, and generating projections.

use crate::api::AppState;
use crate::error::AppError;
use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// A single phenotype's pipeline status row.
#[derive(Debug, Clone, Serialize)]
pub struct PipelineStatusRow {
    pub phenotype: String,
    pub ancestry: String,
    pub status: String,
    pub loci_count: u32,
    pub significant_variants: u32,
    pub original_gcs_bytes: u64,
    pub derived_gcs_bytes: u64,
    pub error_message: Option<String>,
    pub updated_at: String,
}

/// Summary statistics for pipeline analytics.
#[derive(Debug, Clone, Serialize, Default)]
pub struct PipelineSummary {
    /// Number of phenotypes that have been processed (any status)
    pub total_processed: usize,
    /// Number of phenotypes successfully ingested
    pub total_ingested: usize,
    /// Number of phenotypes that failed
    pub total_failed: usize,
    /// Current GCS storage in terabytes
    pub current_gcs_tb: f64,
    /// Current ClickHouse storage in terabytes
    pub current_ch_tb: f64,
    /// Projected total GCS storage in terabytes
    pub projected_gcs_tb: f64,
    /// Projected total ClickHouse storage in terabytes
    pub projected_ch_tb: f64,
    /// Total number of phenotypes in the universe (expected)
    pub universe_size: usize,
}

/// Full pipeline statistics response.
#[derive(Debug, Clone, Serialize)]
pub struct PipelineStats {
    /// Per-phenotype status rows
    pub rows: Vec<PipelineStatusRow>,
    /// Summary statistics
    pub summary: PipelineSummary,
}

/// ClickHouse row for pipeline_status table.
#[derive(Debug, Clone, Deserialize, clickhouse::Row)]
struct StatusDbRow {
    phenotype: String,
    ancestry: String,
    status: String,
    loci_count: u32,
    significant_variants: u32,
    original_gcs_bytes: u64,
    derived_gcs_bytes: u64,
    error_message: Option<String>,
    updated_at: String,
}

/// ClickHouse row for table size info.
#[derive(Debug, Clone, Deserialize, clickhouse::Row)]
struct TableSizeRow {
    table: String,
    bytes: u64,
    rows: u64,
}

/// Handler for GET /api/admin/pipeline/stats
///
/// Returns pipeline status for all phenotypes along with summary statistics
/// and projections for storage requirements.
pub async fn get_pipeline_stats(
    State(state): State<Arc<AppState>>,
) -> Result<Json<PipelineStats>, AppError> {
    // Query the pipeline_status table (using FINAL to get deduplicated rows)
    let query = r#"
        SELECT phenotype, ancestry, status, loci_count, significant_variants,
               original_gcs_bytes, derived_gcs_bytes, error_message, toString(updated_at) as updated_at
        FROM pipeline_status FINAL
        ORDER BY updated_at DESC
    "#;

    let rows = state
        .clickhouse
        .query(query)
        .fetch_all::<StatusDbRow>()
        .await
        .unwrap_or_default();

    // Query ClickHouse table sizes to estimate disk footprint per row
    let size_query = r#"
        SELECT table, sum(bytes_on_disk) as bytes, sum(rows) as rows
        FROM system.parts
        WHERE active AND database = 'default' AND table IN ('significant_variants', 'loci')
        GROUP BY table
    "#;

    let size_info = state
        .clickhouse
        .query(size_query)
        .fetch_all::<TableSizeRow>()
        .await
        .unwrap_or_default();

    // Calculate bytes-per-row for each table
    let mut bytes_per_variant: f64 = 0.0;
    let mut bytes_per_locus: f64 = 0.0;

    for s in size_info {
        if s.rows > 0 {
            if s.table == "significant_variants" {
                bytes_per_variant = s.bytes as f64 / s.rows as f64;
            } else if s.table == "loci" {
                bytes_per_locus = s.bytes as f64 / s.rows as f64;
            }
        }
    }

    // Process rows and calculate summary
    let mut summary = PipelineSummary::default();
    // TODO: Get actual universe size from v8-assets.json or config
    summary.universe_size = 3400;

    let mut total_gcs_bytes: u64 = 0;
    let mut total_ch_bytes: f64 = 0.0;
    let mut ingested_phenos: usize = 0;

    let api_rows: Vec<PipelineStatusRow> = rows
        .into_iter()
        .map(|r| {
            summary.total_processed += 1;

            if r.status == "INGESTED" {
                summary.total_ingested += 1;
                ingested_phenos += 1;
                total_gcs_bytes += r.original_gcs_bytes + r.derived_gcs_bytes;
                total_ch_bytes += (r.significant_variants as f64 * bytes_per_variant)
                    + (r.loci_count as f64 * bytes_per_locus);
            } else if r.status.contains("FAILED") {
                summary.total_failed += 1;
            }

            PipelineStatusRow {
                phenotype: r.phenotype,
                ancestry: r.ancestry,
                status: r.status,
                loci_count: r.loci_count,
                significant_variants: r.significant_variants,
                original_gcs_bytes: r.original_gcs_bytes,
                derived_gcs_bytes: r.derived_gcs_bytes,
                error_message: r.error_message,
                updated_at: r.updated_at,
            }
        })
        .collect();

    // Calculate terabytes (1 TB = 1024^4 bytes)
    const TB: f64 = 1_099_511_627_776.0;

    summary.current_gcs_tb = total_gcs_bytes as f64 / TB;
    summary.current_ch_tb = total_ch_bytes / TB;

    // Project totals based on completion ratio
    if ingested_phenos > 0 {
        let completion_ratio = summary.universe_size as f64 / ingested_phenos as f64;
        summary.projected_gcs_tb = summary.current_gcs_tb * completion_ratio;
        summary.projected_ch_tb = summary.current_ch_tb * completion_ratio;
    }

    Ok(Json(PipelineStats {
        rows: api_rows,
        summary,
    }))
}

/// Handler for POST /api/admin/cache/clear
///
/// Clears the in-memory API response and plot cache.
pub async fn clear_cache(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, AppError> {
    state.api_cache.invalidate_all();
    Ok(Json(serde_json::json!({
        "status": "success",
        "message": "API cache cleared successfully"
    })))
}
