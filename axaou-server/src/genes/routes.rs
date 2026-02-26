//! Gene route handlers
//!
//! Provides endpoints for cross-phenotype gene queries backed by ClickHouse.

use crate::api::AppState;
use crate::clickhouse::models::GeneAssociationRow;
use crate::error::AppError;
use crate::models::GeneAssociationApi;
use crate::response::{LookupResult, QueryTimer};
use axum::{
    extract::{Path, Query, State},
    Json,
};
use clickhouse::Row;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Query parameters for gene PheWAS endpoint
#[derive(Debug, Deserialize)]
pub struct GeneQuery {
    /// Ancestry group filter (default: "meta")
    pub ancestry: Option<String>,
    /// Annotation type filter (e.g., "pLoF", "missenseLC")
    pub annotation: Option<String>,
    /// Query mode (fast/slow) - accepted but currently ignored
    #[serde(default)]
    pub query_mode: Option<String>,
}

/// GET /api/genes/phewas/:gene_id
///
/// Returns gene association results across all phenotypes for a specific gene.
/// This is the gene-level PheWAS endpoint.
///
/// The gene_id can be either an Ensembl ID (ENSG...) or a gene symbol.
pub async fn get_gene_phewas(
    State(state): State<Arc<AppState>>,
    Path(gene_id): Path<String>,
    Query(params): Query<GeneQuery>,
) -> Result<Json<LookupResult<GeneAssociationApi>>, AppError> {
    let timer = QueryTimer::start();
    let ancestry = params.ancestry.unwrap_or_else(|| "meta".to_string());

    // Determine if we're searching by gene_id or gene_symbol
    let (where_clause, search_value) = if gene_id.starts_with("ENSG") {
        ("gene_id = ?", gene_id.clone())
    } else {
        ("gene_symbol = ?", gene_id.clone())
    };

    let base_query = format!(
        r#"
        SELECT gene_id, gene_symbol, annotation, max_maf, phenotype, ancestry,
               pvalue, pvalue_burden, pvalue_skat, beta_burden, mac,
               contig, gene_start_position, xpos
        FROM gene_associations
        WHERE {} AND ancestry = ?
        {}
        ORDER BY pvalue ASC
        "#,
        where_clause,
        if params.annotation.is_some() {
            "AND annotation = ?"
        } else {
            ""
        }
    );

    let mut query = state.clickhouse.query(&base_query);
    query = query.bind(&search_value).bind(&ancestry);

    if let Some(ref annotation) = params.annotation {
        query = query.bind(annotation);
    }

    let rows = query
        .fetch_all::<GeneAssociationRow>()
        .await
        .map_err(|e| AppError::DataTransformError(format!("ClickHouse query error: {}", e)))?;

    let api_rows: Vec<GeneAssociationApi> = rows.into_iter().map(|r| r.to_api()).collect();
    Ok(Json(LookupResult::new(api_rows, timer.elapsed())))
}

/// Query parameters for top gene associations endpoint
#[derive(Debug, Deserialize)]
pub struct TopGenesQuery {
    /// Ancestry group filter (required)
    pub ancestry: String,
    /// Annotation type filter (e.g., "pLoF")
    pub annotation: Option<String>,
    /// Maximum number of results (default: 100)
    pub limit: Option<u64>,
    /// Minimum p-value threshold (default: 0)
    pub min_p: Option<f64>,
    /// Maximum p-value threshold (default: 1e-6)
    pub max_p: Option<f64>,
    /// Query mode (fast/slow) - accepted but currently ignored
    #[serde(default)]
    pub query_mode: Option<String>,
}

/// GET /api/genes/top-associations
///
/// Returns the most significant gene-phenotype associations globally.
/// Results are ordered by p-value ascending.
pub async fn get_top_associations(
    State(state): State<Arc<AppState>>,
    Query(params): Query<TopGenesQuery>,
) -> Result<Json<LookupResult<GeneAssociationApi>>, AppError> {
    let timer = QueryTimer::start();
    let limit = params.limit.unwrap_or(100);
    let min_p = params.min_p.unwrap_or(0.0);
    let max_p = params.max_p.unwrap_or(1e-6);

    let base_query = format!(
        r#"
        SELECT gene_id, gene_symbol, annotation, max_maf, phenotype, ancestry,
               pvalue, pvalue_burden, pvalue_skat, beta_burden, mac,
               contig, gene_start_position, xpos
        FROM gene_associations
        WHERE ancestry = ?
          AND pvalue IS NOT NULL
          AND pvalue >= ?
          AND pvalue <= ?
          {}
        ORDER BY pvalue ASC
        LIMIT ?
        "#,
        if params.annotation.is_some() {
            "AND annotation = ?"
        } else {
            ""
        }
    );

    let mut query = state.clickhouse.query(&base_query);
    query = query.bind(&params.ancestry).bind(min_p).bind(max_p);

    if let Some(ref annotation) = params.annotation {
        query = query.bind(annotation);
    }

    query = query.bind(limit);

    let rows = query
        .fetch_all::<GeneAssociationRow>()
        .await
        .map_err(|e| AppError::DataTransformError(format!("ClickHouse query error: {}", e)))?;

    let api_rows: Vec<GeneAssociationApi> = rows.into_iter().map(|r| r.to_api()).collect();
    Ok(Json(LookupResult::new(api_rows, timer.elapsed())))
}

/// Response type for gene symbol list
#[derive(Debug, Clone, Serialize, Deserialize, Row)]
pub struct GeneSymbolRow {
    pub gene_symbol: String,
}

/// GET /api/genes/all-symbols
///
/// Returns distinct gene symbols for autocomplete functionality.
/// Results are ordered alphabetically.
pub async fn get_all_symbols(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<String>>, AppError> {
    let query = r#"
        SELECT DISTINCT gene_symbol
        FROM gene_associations
        WHERE gene_symbol != ''
        ORDER BY gene_symbol
    "#;

    let rows = state
        .clickhouse
        .query(query)
        .fetch_all::<GeneSymbolRow>()
        .await
        .map_err(|e| AppError::DataTransformError(format!("ClickHouse query error: {}", e)))?;

    let symbols: Vec<String> = rows.into_iter().map(|r| r.gene_symbol).collect();
    Ok(Json(symbols))
}

/// Query parameters for specific gene associations via query string
#[derive(Debug, Deserialize)]
pub struct GeneAssociationsQueryParams {
    pub gene_id: String,
    pub analysis_id: String,
    pub ancestry_group: String,
    #[serde(default)]
    pub use_index: Option<String>,
}

/// GET /api/genes/associations
///
/// Returns gene associations for a specific gene, phenotype, and ancestry.
/// Maps to the frontend's specific query parameter format.
pub async fn get_genes_associations(
    State(state): State<Arc<AppState>>,
    Query(params): Query<GeneAssociationsQueryParams>,
) -> Result<Json<Vec<crate::models::GeneAssociationApi>>, AppError> {
    let base_query = r#"
        SELECT gene_id, gene_symbol, annotation, max_maf, phenotype, ancestry,
               pvalue, pvalue_burden, pvalue_skat, beta_burden, mac,
               contig, gene_start_position, xpos
        FROM gene_associations
        WHERE gene_id = ? AND phenotype = ? AND ancestry = ?
        ORDER BY pvalue ASC
    "#;

    let rows = state
        .clickhouse
        .query(base_query)
        .bind(&params.gene_id)
        .bind(&params.analysis_id)
        .bind(&params.ancestry_group)
        .fetch_all::<GeneAssociationRow>()
        .await
        .map_err(|e| AppError::DataTransformError(format!("ClickHouse query error: {}", e)))?;

    let api_rows: Vec<crate::models::GeneAssociationApi> =
        rows.into_iter().map(|r| r.to_api()).collect();
    Ok(Json(api_rows))
}

/// Query parameters for gene associations interval endpoint
#[derive(Debug, Deserialize)]
pub struct GeneIntervalQuery {
    /// Ancestry group filter (default: "meta")
    pub ancestry: Option<String>,
    /// Annotation type filter
    pub annotation: Option<String>,
    /// Maximum number of results (default: 1000)
    pub limit: Option<u64>,
    /// Query mode (fast/slow) - accepted but currently ignored
    #[serde(default)]
    pub query_mode: Option<String>,
}

/// GET /api/genes/associations/interval/:interval
///
/// Returns gene associations within a genomic interval.
/// Interval format: "chr1:12345-67890"
pub async fn get_genes_in_interval(
    State(state): State<Arc<AppState>>,
    Path(interval): Path<String>,
    Query(params): Query<GeneIntervalQuery>,
) -> Result<Json<LookupResult<GeneAssociationApi>>, AppError> {
    use crate::clickhouse::xpos::parse_interval_to_xpos;

    let timer = QueryTimer::start();
    let (xpos_start, xpos_end) = parse_interval_to_xpos(&interval)?;
    let ancestry = params.ancestry.unwrap_or_else(|| "meta".to_string());
    let limit = params.limit.unwrap_or(1000);

    let base_query = format!(
        r#"
        SELECT gene_id, gene_symbol, annotation, max_maf, phenotype, ancestry,
               pvalue, pvalue_burden, pvalue_skat, beta_burden, mac,
               contig, gene_start_position, xpos
        FROM gene_associations
        WHERE ancestry = ?
          AND xpos >= ?
          AND xpos <= ?
          {}
        ORDER BY pvalue ASC
        LIMIT ?
        "#,
        if params.annotation.is_some() {
            "AND annotation = ?"
        } else {
            ""
        }
    );

    let mut query = state.clickhouse.query(&base_query);
    query = query.bind(&ancestry).bind(xpos_start).bind(xpos_end);

    if let Some(ref annotation) = params.annotation {
        query = query.bind(annotation);
    }

    query = query.bind(limit);

    let rows = query
        .fetch_all::<GeneAssociationRow>()
        .await
        .map_err(|e| AppError::DataTransformError(format!("ClickHouse query error: {}", e)))?;

    let api_rows: Vec<GeneAssociationApi> = rows.into_iter().map(|r| r.to_api()).collect();
    Ok(Json(LookupResult::new(api_rows, timer.elapsed())))
}
