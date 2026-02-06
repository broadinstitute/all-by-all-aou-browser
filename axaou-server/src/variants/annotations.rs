//! Variant annotation handlers
//!
//! Provides endpoints for retrieving variant annotations by ID, interval, or gene.

use crate::api::AppState;
use crate::clickhouse::models::{SignificantVariantRow, VariantAnnotationRow};
use crate::clickhouse::xpos::{compute_xpos, parse_interval_to_xpos, parse_variant_id};
use crate::error::AppError;
use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::Deserialize;
use std::sync::Arc;

// ============================================================================
// Variant Annotations
// ============================================================================

/// GET /api/variants/annotations/:variant_id
///
/// Returns annotation data for a single variant by ID.
/// Variant ID format: "chr1-12345-A-T" or "1-12345-A-T"
pub async fn get_annotation_by_id(
    State(state): State<Arc<AppState>>,
    Path(variant_id): Path<String>,
) -> Result<Json<Option<VariantAnnotationRow>>, AppError> {
    let (xpos, ref_allele, alt_allele) = parse_variant_id(&variant_id)?;

    let query = r#"
        SELECT xpos, contig, position, ref, alt, gene_symbol, consequence, af_all
        FROM variant_annotations
        WHERE xpos = ? AND ref = ? AND alt = ?
        LIMIT 1
    "#;

    let row = state
        .clickhouse
        .query(query)
        .bind(xpos)
        .bind(&ref_allele)
        .bind(&alt_allele)
        .fetch_optional::<VariantAnnotationRow>()
        .await
        .map_err(|e| AppError::DataTransformError(format!("ClickHouse query error: {}", e)))?;

    Ok(Json(row))
}

/// Query parameters for interval annotation endpoint
#[derive(Debug, Deserialize)]
pub struct IntervalQuery {
    /// Maximum number of results (default: 1000)
    pub limit: Option<u64>,
}

/// GET /api/variants/annotations/interval/:interval
///
/// Returns all variant annotations within a genomic interval.
/// Interval format: "chr1:12345-67890" or "1:12345-67890"
pub async fn get_annotations_by_interval(
    State(state): State<Arc<AppState>>,
    Path(interval): Path<String>,
    Query(params): Query<IntervalQuery>,
) -> Result<Json<Vec<VariantAnnotationRow>>, AppError> {
    let (xpos_start, xpos_end) = parse_interval_to_xpos(&interval)?;
    let limit = params.limit.unwrap_or(1000);

    let query = r#"
        SELECT xpos, contig, position, ref, alt, gene_symbol, consequence, af_all
        FROM variant_annotations
        WHERE xpos >= ? AND xpos <= ?
        LIMIT ?
    "#;

    let rows = state
        .clickhouse
        .query(query)
        .bind(xpos_start)
        .bind(xpos_end)
        .bind(limit)
        .fetch_all::<VariantAnnotationRow>()
        .await
        .map_err(|e| AppError::DataTransformError(format!("ClickHouse query error: {}", e)))?;

    Ok(Json(rows))
}

/// GET /api/variants/annotations/gene/:gene_id
///
/// Returns all variant annotations within a gene's exons.
/// Two-step query: (1) lookup gene exons, (2) query annotations in exon intervals.
pub async fn get_annotations_by_gene(
    State(state): State<Arc<AppState>>,
    Path(gene_id): Path<String>,
) -> Result<Json<Vec<VariantAnnotationRow>>, AppError> {
    // Step 1: Get gene model from Hail Table
    let gene_models = Arc::clone(&state.gene_models);
    let gene_id_clone = gene_id.clone();
    let gene = tokio::task::spawn_blocking(move || gene_models.get_by_gene_id(&gene_id_clone))
        .await??;

    let Some(gene) = gene else {
        return Ok(Json(vec![]));
    };

    // Step 2: Build query for exon ranges
    if gene.exons.is_empty() {
        return Ok(Json(vec![]));
    }

    let contig = gene.chrom.trim_start_matches("chr");

    // Build OR clauses for each exon
    let mut conditions = Vec::new();
    for exon in &gene.exons {
        let start_xpos = compute_xpos(contig, exon.start as u32);
        let end_xpos = compute_xpos(contig, exon.stop as u32);
        conditions.push(format!("(xpos >= {} AND xpos <= {})", start_xpos, end_xpos));
    }

    let where_clause = conditions.join(" OR ");
    let query = format!(
        r#"
        SELECT xpos, contig, position, ref, alt, gene_symbol, consequence, af_all
        FROM variant_annotations
        WHERE {}
        "#,
        where_clause
    );

    let rows = state
        .clickhouse
        .query(&query)
        .fetch_all::<VariantAnnotationRow>()
        .await
        .map_err(|e| AppError::DataTransformError(format!("ClickHouse query error: {}", e)))?;

    Ok(Json(rows))
}

// ============================================================================
// Variant Associations
// ============================================================================

/// Query parameters for association queries
#[derive(Debug, Deserialize)]
pub struct AssociationQuery {
    /// Analysis ID / phenotype (required)
    pub analysis_id: String,
}

/// GET /api/variants/associations/variant/:variant_id
///
/// Returns association stats for a specific variant in a specific phenotype.
/// Only returns data if the variant is in the significant_variants table.
pub async fn get_association_by_variant(
    State(state): State<Arc<AppState>>,
    Path(variant_id): Path<String>,
    Query(params): Query<AssociationQuery>,
) -> Result<Json<Option<SignificantVariantRow>>, AppError> {
    let (xpos, ref_allele, alt_allele) = parse_variant_id(&variant_id)?;

    let query = r#"
        SELECT phenotype, ancestry, sequencing_type, xpos, contig, position,
               ref, alt, pvalue, beta, se, af
        FROM significant_variants
        WHERE phenotype = ? AND xpos = ? AND ref = ? AND alt = ?
        LIMIT 1
    "#;

    let row = state
        .clickhouse
        .query(query)
        .bind(&params.analysis_id)
        .bind(xpos)
        .bind(&ref_allele)
        .bind(&alt_allele)
        .fetch_optional::<SignificantVariantRow>()
        .await
        .map_err(|e| AppError::DataTransformError(format!("ClickHouse query error: {}", e)))?;

    Ok(Json(row))
}

/// GET /api/variants/associations/interval/:interval
///
/// Returns association stats for all significant variants in an interval
/// for a specific phenotype.
pub async fn get_associations_by_interval(
    State(state): State<Arc<AppState>>,
    Path(interval): Path<String>,
    Query(params): Query<AssociationQuery>,
) -> Result<Json<Vec<SignificantVariantRow>>, AppError> {
    let (xpos_start, xpos_end) = parse_interval_to_xpos(&interval)?;

    let query = r#"
        SELECT phenotype, ancestry, sequencing_type, xpos, contig, position,
               ref, alt, pvalue, beta, se, af
        FROM significant_variants
        WHERE phenotype = ? AND xpos >= ? AND xpos <= ?
    "#;

    let rows = state
        .clickhouse
        .query(query)
        .bind(&params.analysis_id)
        .bind(xpos_start)
        .bind(xpos_end)
        .fetch_all::<SignificantVariantRow>()
        .await
        .map_err(|e| AppError::DataTransformError(format!("ClickHouse query error: {}", e)))?;

    Ok(Json(rows))
}
