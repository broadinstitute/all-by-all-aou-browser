//! Variant annotation handlers
//!
//! Provides endpoints for retrieving variant annotations by ID, interval, or gene.
//!
//! Supports two table configurations:
//! - Legacy: Single `variant_annotations` table
//! - New: Separate `exome_annotations` and `genome_annotations` tables

use crate::api::AppState;
use crate::clickhouse::models::{
    SignificantVariantRow, VariantAnnotationExtendedRow, VariantAnnotationRow,
};
use crate::clickhouse::xpos::{compute_xpos, parse_interval_to_xpos, parse_variant_id};
use crate::error::AppError;
use crate::models::{VariantAnnotationApi, VariantAssociationApi};
use crate::response::{LookupResult, QueryTimer};
use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::Deserialize;
use std::sync::Arc;

/// Sequencing type for selecting annotation table
#[derive(Debug, Clone, Copy, Default, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SequencingTypeParam {
    Exome,
    #[default]
    Genome,
}

// ============================================================================
// Variant Annotations
// ============================================================================

/// Query parameters for single variant annotation endpoint
#[derive(Debug, Deserialize)]
pub struct SingleAnnotationQuery {
    /// Sequencing type: "exome" or "genome" (default: tries both, prefers exome)
    pub sequencing_type: Option<SequencingTypeParam>,

    /// Use extended schema (new tables with full VEP annotations)
    pub extended: Option<bool>,
}

/// GET /api/variants/annotations/:variant_id
///
/// Returns annotation data for a single variant by ID.
/// Variant ID format: "chr1-12345-A-T" or "1-12345-A-T"
///
/// Query parameters:
/// - `sequencing_type`: "exome" or "genome" (when using extended, defaults to checking both)
/// - `extended`: Use new extended tables (default: false)
pub async fn get_annotation_by_id(
    State(state): State<Arc<AppState>>,
    Path(variant_id): Path<String>,
    Query(params): Query<SingleAnnotationQuery>,
) -> Result<Json<Option<VariantAnnotationRow>>, AppError> {
    let (xpos, ref_allele, alt_allele) = parse_variant_id(&variant_id)?;
    let use_extended = params.extended.unwrap_or(false);

    if use_extended {
        // If sequencing_type is specified, query that table only
        // Otherwise, try exome first, then genome
        let tables = match params.sequencing_type {
            Some(SequencingTypeParam::Exome) => vec!["exome_annotations"],
            Some(SequencingTypeParam::Genome) => vec!["genome_annotations"],
            None => vec!["exome_annotations", "genome_annotations"],
        };

        for table in tables {
            let query = format!(
                r#"
                SELECT xpos, contig, position, ref, alt, gene_symbol, consequence, af AS af_all
                FROM {}
                WHERE xpos = ? AND ref = ? AND alt = ?
                LIMIT 1
                "#,
                table
            );

            let row = state
                .clickhouse
                .query(&query)
                .bind(xpos)
                .bind(&ref_allele)
                .bind(&alt_allele)
                .fetch_optional::<VariantAnnotationRow>()
                .await
                .map_err(|e| {
                    AppError::DataTransformError(format!("ClickHouse query error: {}", e))
                })?;

            if row.is_some() {
                return Ok(Json(row));
            }
        }

        Ok(Json(None))
    } else {
        // Use legacy single table
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
}

/// Query parameters for annotation endpoints
#[derive(Debug, Deserialize)]
pub struct AnnotationQuery {
    /// Maximum number of results (default: 1000)
    pub limit: Option<u64>,

    /// Sequencing type: "exome" or "genome" (default: genome)
    /// Used to select between exome_annotations and genome_annotations tables
    pub sequencing_type: Option<SequencingTypeParam>,

    /// Use extended schema (new tables with full VEP annotations)
    /// When true, queries exome_annotations/genome_annotations
    /// When false (default), queries legacy variant_annotations
    pub extended: Option<bool>,

    /// Query mode (fast/slow) - accepted but currently ignored
    #[serde(default)]
    pub query_mode: Option<String>,
}

/// GET /api/variants/annotations/interval/:interval
///
/// Returns all variant annotations within a genomic interval.
/// Interval format: "chr1:12345-67890" or "1:12345-67890"
///
/// Query parameters:
/// - `limit`: Maximum number of results (default: 1000)
/// - `sequencing_type`: "exome" or "genome" (default: genome)
/// - `extended`: Use new extended tables (default: false for backward compatibility)
pub async fn get_annotations_by_interval(
    State(state): State<Arc<AppState>>,
    Path(interval): Path<String>,
    Query(params): Query<AnnotationQuery>,
) -> Result<Json<LookupResult<VariantAnnotationApi>>, AppError> {
    let timer = QueryTimer::start();
    let (xpos_start, xpos_end) = parse_interval_to_xpos(&interval)?;
    let limit = params.limit.unwrap_or(1000);
    let use_extended = params.extended.unwrap_or(false);

    let rows = if use_extended {
        // Use new separate tables
        let table = match params.sequencing_type.unwrap_or_default() {
            SequencingTypeParam::Exome => "exome_annotations",
            SequencingTypeParam::Genome => "genome_annotations",
        };

        let query = format!(
            r#"
            SELECT xpos, contig, position, ref, alt, gene_symbol, consequence, af AS af_all
            FROM {}
            WHERE xpos >= ? AND xpos <= ?
            LIMIT ?
            "#,
            table
        );

        state
            .clickhouse
            .query(&query)
            .bind(xpos_start)
            .bind(xpos_end)
            .bind(limit)
            .fetch_all::<VariantAnnotationRow>()
            .await
            .map_err(|e| AppError::DataTransformError(format!("ClickHouse query error: {}", e)))?
    } else {
        // Use legacy single table
        let query = r#"
            SELECT xpos, contig, position, ref, alt, gene_symbol, consequence, af_all
            FROM variant_annotations
            WHERE xpos >= ? AND xpos <= ?
            LIMIT ?
        "#;

        state
            .clickhouse
            .query(query)
            .bind(xpos_start)
            .bind(xpos_end)
            .bind(limit)
            .fetch_all::<VariantAnnotationRow>()
            .await
            .map_err(|e| AppError::DataTransformError(format!("ClickHouse query error: {}", e)))?
    };

    // Convert to API format
    let api_rows: Vec<VariantAnnotationApi> = rows.into_iter().map(|r| r.to_api()).collect();
    Ok(Json(LookupResult::new(api_rows, timer.elapsed())))
}

/// Query parameters for gene annotation endpoint
#[derive(Debug, Deserialize)]
pub struct GeneAnnotationQuery {
    /// Sequencing type: "exome" or "genome" (default: genome)
    pub sequencing_type: Option<SequencingTypeParam>,

    /// Use extended schema (new tables with full VEP annotations)
    pub extended: Option<bool>,

    /// Query mode (fast/slow) - accepted but currently ignored
    #[serde(default)]
    pub query_mode: Option<String>,
}

/// GET /api/variants/annotations/gene/:gene_id
///
/// Returns all variant annotations within a gene's exons.
/// Two-step query: (1) lookup gene exons, (2) query annotations in exon intervals.
///
/// Query parameters:
/// - `sequencing_type`: "exome" or "genome" (default: genome)
/// - `extended`: Use new extended tables (default: false)
pub async fn get_annotations_by_gene(
    State(state): State<Arc<AppState>>,
    Path(gene_id): Path<String>,
    Query(params): Query<GeneAnnotationQuery>,
) -> Result<Json<LookupResult<VariantAnnotationApi>>, AppError> {
    let timer = QueryTimer::start();

    // Step 1: Get gene model from Hail Table
    let gene_models = Arc::clone(&state.gene_models);
    let gene_id_clone = gene_id.clone();
    let gene = tokio::task::spawn_blocking(move || gene_models.get_by_gene_id(&gene_id_clone))
        .await??;

    let Some(gene) = gene else {
        return Ok(Json(LookupResult::new(vec![], timer.elapsed())));
    };

    // Step 2: Build query for exon ranges
    if gene.exons.is_empty() {
        return Ok(Json(LookupResult::new(vec![], timer.elapsed())));
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
    let use_extended = params.extended.unwrap_or(false);

    let query = if use_extended {
        let table = match params.sequencing_type.unwrap_or_default() {
            SequencingTypeParam::Exome => "exome_annotations",
            SequencingTypeParam::Genome => "genome_annotations",
        };
        format!(
            r#"
            SELECT xpos, contig, position, ref, alt, gene_symbol, consequence, af AS af_all
            FROM {}
            WHERE {}
            "#,
            table, where_clause
        )
    } else {
        format!(
            r#"
            SELECT xpos, contig, position, ref, alt, gene_symbol, consequence, af_all
            FROM variant_annotations
            WHERE {}
            "#,
            where_clause
        )
    };

    let rows = state
        .clickhouse
        .query(&query)
        .fetch_all::<VariantAnnotationRow>()
        .await
        .map_err(|e| AppError::DataTransformError(format!("ClickHouse query error: {}", e)))?;

    // Convert to API format
    let api_rows: Vec<VariantAnnotationApi> = rows.into_iter().map(|r| r.to_api()).collect();
    Ok(Json(LookupResult::new(api_rows, timer.elapsed())))
}

// ============================================================================
// Variant Associations
// ============================================================================

/// Query parameters for association queries
#[derive(Debug, Deserialize)]
pub struct AssociationQuery {
    /// Analysis ID / phenotype (required)
    pub analysis_id: String,

    /// Query mode (fast/slow) - accepted but currently ignored
    #[serde(default)]
    pub query_mode: Option<String>,
}

/// GET /api/variants/associations/variant/:variant_id
///
/// Returns association stats for a specific variant in a specific phenotype.
/// Only returns data if the variant is in the significant_variants table.
pub async fn get_association_by_variant(
    State(state): State<Arc<AppState>>,
    Path(variant_id): Path<String>,
    Query(params): Query<AssociationQuery>,
) -> Result<Json<LookupResult<VariantAssociationApi>>, AppError> {
    let timer = QueryTimer::start();
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

    let api_rows: Vec<VariantAssociationApi> = row.into_iter().map(|r| r.to_api()).collect();
    Ok(Json(LookupResult::new(api_rows, timer.elapsed())))
}

/// GET /api/variants/associations/interval/:interval
///
/// Returns association stats for all significant variants in an interval
/// for a specific phenotype.
pub async fn get_associations_by_interval(
    State(state): State<Arc<AppState>>,
    Path(interval): Path<String>,
    Query(params): Query<AssociationQuery>,
) -> Result<Json<LookupResult<VariantAssociationApi>>, AppError> {
    let timer = QueryTimer::start();
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

    let api_rows: Vec<VariantAssociationApi> = rows.into_iter().map(|r| r.to_api()).collect();
    Ok(Json(LookupResult::new(api_rows, timer.elapsed())))
}
