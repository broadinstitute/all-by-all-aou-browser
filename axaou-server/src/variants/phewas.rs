//! PheWAS query handlers
//!
//! Provides endpoints for cross-phenotype queries.

use crate::api::AppState;
use crate::clickhouse::models::SignificantVariantRow;
use crate::clickhouse::xpos::{parse_interval_to_xpos, parse_variant_id};
use crate::error::AppError;
use crate::models::VariantAssociationApi;
use crate::response::{LookupResult, QueryTimer};
use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::Deserialize;
use std::sync::Arc;

/// GET /api/variants/associations/phewas/:variant_id
///
/// Returns all phenotypes where this variant is significant (fan-out query).
/// This is the PheWAS endpoint for exploring variant associations across traits.
pub async fn get_phewas_by_variant(
    State(state): State<Arc<AppState>>,
    Path(variant_id): Path<String>,
) -> Result<Json<LookupResult<VariantAssociationApi>>, AppError> {
    let timer = QueryTimer::start();
    let (xpos, ref_allele, alt_allele) = parse_variant_id(&variant_id)?;

    let query = r#"
        SELECT phenotype, ancestry, sequencing_type, xpos, contig, position,
               ref, alt, pvalue, beta, se, af
        FROM significant_variants
        WHERE xpos = ? AND ref = ? AND alt = ?
        ORDER BY pvalue ASC
    "#;

    let rows = state
        .clickhouse
        .query(query)
        .bind(xpos)
        .bind(&ref_allele)
        .bind(&alt_allele)
        .fetch_all::<SignificantVariantRow>()
        .await
        .map_err(|e| AppError::DataTransformError(format!("ClickHouse query error: {}", e)))?;

    let api_rows: Vec<VariantAssociationApi> = rows.into_iter().map(|r| r.to_api()).collect();
    Ok(Json(LookupResult::new(api_rows, timer.elapsed())))
}

/// Query parameters for top variants endpoint
#[derive(Debug, Deserialize)]
pub struct TopVariantsQuery {
    /// Ancestry group (required)
    pub ancestry: String,
    /// Minimum p-value (default: 1e-10)
    pub min_p: Option<f64>,
    /// Maximum p-value (default: 1e-6)
    pub max_p: Option<f64>,
    /// Maximum number of results (default: 1000)
    pub limit: Option<u64>,
    /// Query mode (fast/slow) - accepted but currently ignored
    #[serde(default)]
    pub query_mode: Option<String>,
}

/// GET /api/variants/associations/top
///
/// Returns top variants across all phenotypes within a p-value range.
/// Useful for identifying the most significant associations globally.
pub async fn get_top_variants(
    State(state): State<Arc<AppState>>,
    Query(params): Query<TopVariantsQuery>,
) -> Result<Json<LookupResult<VariantAssociationApi>>, AppError> {
    let timer = QueryTimer::start();
    let min_p = params.min_p.unwrap_or(1e-10);
    let max_p = params.max_p.unwrap_or(1e-6);
    let limit = params.limit.unwrap_or(1000);

    let query = r#"
        SELECT phenotype, ancestry, sequencing_type, xpos, contig, position,
               ref, alt, pvalue, beta, se, af
        FROM significant_variants
        WHERE ancestry = ? AND pvalue >= ? AND pvalue <= ?
        ORDER BY pvalue ASC
        LIMIT ?
    "#;

    let rows = state
        .clickhouse
        .query(query)
        .bind(&params.ancestry)
        .bind(min_p)
        .bind(max_p)
        .bind(limit)
        .fetch_all::<SignificantVariantRow>()
        .await
        .map_err(|e| AppError::DataTransformError(format!("ClickHouse query error: {}", e)))?;

    let api_rows: Vec<VariantAssociationApi> = rows.into_iter().map(|r| r.to_api()).collect();
    Ok(Json(LookupResult::new(api_rows, timer.elapsed())))
}

/// Query parameters for PheWAS interval endpoint
#[derive(Debug, Deserialize)]
pub struct PhewasIntervalQuery {
    /// Ancestry group filter (default: "meta")
    pub ancestry: Option<String>,
    /// Maximum number of results (default: 10000)
    pub limit: Option<u64>,
    /// Query mode (fast/slow) - accepted but currently ignored
    #[serde(default)]
    pub query_mode: Option<String>,
}

/// GET /api/variants/associations/phewas/interval/:interval
///
/// Returns all significant variants within a genomic interval across all phenotypes.
/// Interval format: "chr1:12345-67890"
pub async fn get_phewas_by_interval(
    State(state): State<Arc<AppState>>,
    Path(interval): Path<String>,
    Query(params): Query<PhewasIntervalQuery>,
) -> Result<Json<LookupResult<VariantAssociationApi>>, AppError> {
    let timer = QueryTimer::start();
    let (xpos_start, xpos_end) = parse_interval_to_xpos(&interval)?;
    let ancestry = params.ancestry.unwrap_or_else(|| "meta".to_string());
    let limit = params.limit.unwrap_or(10000);

    let query = r#"
        SELECT phenotype, ancestry, sequencing_type, xpos, contig, position,
               ref, alt, pvalue, beta, se, af
        FROM significant_variants
        WHERE xpos >= ? AND xpos <= ? AND ancestry = ?
        ORDER BY pvalue ASC
        LIMIT ?
    "#;

    let rows = state
        .clickhouse
        .query(query)
        .bind(xpos_start)
        .bind(xpos_end)
        .bind(&ancestry)
        .bind(limit)
        .fetch_all::<SignificantVariantRow>()
        .await
        .map_err(|e| AppError::DataTransformError(format!("ClickHouse query error: {}", e)))?;

    let api_rows: Vec<VariantAssociationApi> = rows.into_iter().map(|r| r.to_api()).collect();
    Ok(Json(LookupResult::new(api_rows, timer.elapsed())))
}

/// Query parameters for aggregated top variants endpoint
#[derive(Debug, Deserialize)]
pub struct TopAggregatedVariantsQuery {
    /// Ancestry group (required)
    pub ancestry: String,
    /// Minimum p-value (default: 0.0)
    pub min_p: Option<f64>,
    /// Maximum p-value (default: 1e-6)
    pub max_p: Option<f64>,
    /// Maximum number of results (default: 1000, 0 for all)
    pub limit: Option<u64>,
    /// Optional search text (variant ID, gene symbol, or phenotype)
    pub search: Option<String>,
    /// Optional consequence categories (comma-separated: lof,missense,synonymous,other)
    pub categories: Option<String>,
}

/// GET /api/variants/associations/top-aggregated
///
/// Returns top variants aggregated across all phenotypes, yielding the single most significant
/// phenotype per variant, along with the total count of significant associations.
pub async fn get_top_variants_aggregated(
    State(state): State<Arc<AppState>>,
    Query(params): Query<TopAggregatedVariantsQuery>,
) -> Result<Json<LookupResult<crate::models::AggregatedVariantApi>>, AppError> {
    let timer = QueryTimer::start();
    let min_p = params.min_p.unwrap_or(0.0);
    let max_p = params.max_p.unwrap_or(1e-6);
    const MAX_LIMIT: u64 = 50_000;
    let limit = match params.limit.unwrap_or(1000) {
        0 => MAX_LIMIT,
        n => n.min(MAX_LIMIT),
    };

    let select_cols = r#"
        SELECT tva.xpos, tva.contig, tva.position, tva.ref, tva.alt,
               tva.top_pvalue, tva.top_neg_log10_p, tva.top_phenotype, tva.num_associations,
               tva.gene_id, tva.gene_symbol, tva.consequence
    "#;

    let mut query_string = String::new();
    let mut join_sql = "".to_string();
    let mut is_pheno_search = false;
    let mut where_sql = r#"
        WHERE tva.ancestry = ?
          AND tva.top_pvalue >= ?
          AND tva.top_pvalue <= ?
          AND tva.top_phenotype NOT IN (
              SELECT analysis_id FROM analysis_metadata
              WHERE category = 'random_phenotype'
                 OR description LIKE '%random%'
          )
    "#.to_string();

    let mut search_variant_binds = None;
    let mut search_gene_binds = None;
    let mut search_pheno_bind = None;

    // Handle search parameter heuristics
    if let Some(ref s) = params.search {
        let s_trim = s.trim();
        if !s_trim.is_empty() {
            if let Ok((xpos, ref_allele, alt_allele)) = parse_variant_id(s_trim) {
                where_sql.push_str(" AND tva.xpos = ? AND tva.ref = ? AND tva.alt = ?");
                search_variant_binds = Some((xpos, ref_allele, alt_allele));
            } else {
                #[derive(Debug, Deserialize, clickhouse::Row)]
                struct GeneXCoords {
                    xstart: i64,
                    xstop: i64,
                }

                let gene_query = "SELECT xstart, xstop FROM gene_models WHERE symbol_upper_case = ? LIMIT 1";
                let gene_coords = state.clickhouse.query(gene_query)
                    .bind(s_trim.to_uppercase())
                    .fetch_optional::<GeneXCoords>()
                    .await
                    .map_err(|e| AppError::DataTransformError(format!("Gene lookup error: {}", e)))?;

                if let Some(coords) = gene_coords {
                    where_sql.push_str(" AND tva.xpos >= ? AND tva.xpos <= ?");
                    search_gene_binds = Some((coords.xstart, coords.xstop));
                } else {
                    join_sql = r#"
                        INNER JOIN (
                            SELECT xpos, ref, alt,
                                   argMin(phenotype, pvalue) AS matched_phenotype,
                                   min(pvalue) AS matched_pvalue
                            FROM significant_variants sv
                            JOIN analysis_metadata am ON sv.phenotype = am.analysis_id
                            WHERE am.description ILIKE ? OR am.analysis_id ILIKE ?
                            GROUP BY xpos, ref, alt
                        ) AS sq ON tva.xpos = sq.xpos AND tva.ref = sq.ref AND tva.alt = sq.alt
                    "#.to_string();
                    search_pheno_bind = Some(format!("%{}%", s_trim));
                    is_pheno_search = true;
                }
            }
        }
    }

    // Handle consequence categories
    if let Some(ref cats) = params.categories {
        let all_lof = ["transcript_ablation", "splice_acceptor_variant", "splice_donor_variant", "stop_gained", "frameshift_variant", "pLoF"];
        let all_missense = ["missense", "stop_lost", "start_lost", "inframe_insertion", "inframe_deletion", "missense_variant"];
        let all_synonymous = ["synonymous_variant", "synonymous"];

        let cats_list: Vec<&str> = cats.split(',').map(|s| s.trim()).collect();
        let mut selected_terms = Vec::new();
        let mut unselected_terms = Vec::new();
        let mut has_other = false;

        if cats_list.contains(&"lof") { selected_terms.extend_from_slice(&all_lof); } else { unselected_terms.extend_from_slice(&all_lof); }
        if cats_list.contains(&"missense") { selected_terms.extend_from_slice(&all_missense); } else { unselected_terms.extend_from_slice(&all_missense); }
        if cats_list.contains(&"synonymous") { selected_terms.extend_from_slice(&all_synonymous); } else { unselected_terms.extend_from_slice(&all_synonymous); }
        if cats_list.contains(&"other") { has_other = true; }

        let category_sql = if has_other {
            if unselected_terms.is_empty() {
                "".to_string()
            } else {
                let list = unselected_terms.iter().map(|s| format!("'{}'", s)).collect::<Vec<_>>().join(", ");
                format!(" AND (tva.consequence NOT IN ({}) OR tva.consequence IS NULL)", list)
            }
        } else {
            if selected_terms.is_empty() {
                " AND 1=0".to_string()
            } else {
                let list = selected_terms.iter().map(|s| format!("'{}'", s)).collect::<Vec<_>>().join(", ");
                format!(" AND tva.consequence IN ({})", list)
            }
        };
        where_sql.push_str(&category_sql);
    }

    if is_pheno_search {
        query_string.push_str(&format!("{}, sq.matched_phenotype, sq.matched_pvalue FROM top_variants_aggregated tva\n", select_cols));
    } else {
        query_string.push_str(&format!("{}, '' AS matched_phenotype, 0.0 AS matched_pvalue FROM top_variants_aggregated tva\n", select_cols));
    }
    query_string.push_str(&join_sql);
    query_string.push_str(&where_sql);
    query_string.push_str(" ORDER BY tva.num_associations DESC, tva.top_pvalue ASC");

    if limit > 0 {
        query_string.push_str(" LIMIT ?");
    }

    let mut query = state.clickhouse.query(&query_string);

    // Bindings must strictly match positional placeholders (?)
    if let Some(ref search_str) = search_pheno_bind {
        query = query.bind(search_str.clone()).bind(search_str.clone());
    }

    query = query.bind(&params.ancestry).bind(min_p).bind(max_p);

    if let Some((xpos, ref_a, alt_a)) = search_variant_binds {
        query = query.bind(xpos).bind(ref_a).bind(alt_a);
    } else if let Some((xstart, xstop)) = search_gene_binds {
        query = query.bind(xstart).bind(xstop);
    }

    if limit > 0 {
        query = query.bind(limit);
    }

    let rows = query
        .fetch_all::<crate::clickhouse::models::AggregatedVariantRow>()
        .await
        .map_err(|e| AppError::DataTransformError(format!("ClickHouse query error: {}", e)))?;

    let api_rows: Vec<crate::models::AggregatedVariantApi> =
        rows.into_iter().map(|r| r.to_api()).collect();
    Ok(Json(LookupResult::new(api_rows, timer.elapsed())))
}
