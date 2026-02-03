//! On-demand gene association queries from per-phenotype Hail Tables
//!
//! Queries gene_results.ht files directly from GCS for gene-level burden/SKAT results.
//! Each phenotype has its own gene_results.ht with the following schema:
//!
//! Key: (gene_id, gene_symbol, annotation, max_MAF)
//! Values: Pvalue, Pvalue_Burden, Pvalue_SKAT, BETA_Burden, SE_Burden, MAC, etc.

use crate::error::AppError;
use crate::models::{
    AnalysisAssetType, AnalysisAssets, AncestryGroup, GeneAssociationResponse,
    GeneAssociationResult, GeneQueryParams,
};
use hail_decoder::codec::EncodedValue;
use hail_decoder::query::{KeyRange, KeyValue, QueryEngine};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

/// Default max_MAF filter value (from shared.py config)
pub const DEFAULT_MAX_MAF: f64 = 0.001;

/// On-demand gene association query engine
pub struct GeneQueryEngine {
    /// Shared reference to discovered assets
    assets: Arc<RwLock<Option<AnalysisAssets>>>,
}

impl GeneQueryEngine {
    /// Create a new query engine with access to the assets cache
    pub fn new(assets: Arc<RwLock<Option<AnalysisAssets>>>) -> Self {
        Self { assets }
    }

    /// Query gene associations for a specific phenotype and gene
    ///
    /// This queries the gene_results.ht for the given analysis_id and returns
    /// all associations for the specified gene, filtered by ancestry and max_maf.
    pub async fn query_gene(
        &self,
        analysis_id: &str,
        gene_id: &str,
        params: GeneQueryParams,
    ) -> Result<GeneAssociationResponse, AppError> {
        let assets = self.assets.read().await;
        let assets = assets.as_ref().ok_or_else(|| {
            AppError::DataTransformError("Assets not loaded".to_string())
        })?;

        // Determine which ancestries to query
        let ancestries: Vec<AncestryGroup> = match params.ancestry {
            Some(anc) => vec![anc],
            None => vec![AncestryGroup::Meta], // Default to META only
        };

        // Find gene_results.ht URIs for this analysis
        let gene_assets: Vec<_> = assets
            .assets
            .iter()
            .filter(|a| {
                a.analysis_id.eq_ignore_ascii_case(analysis_id)
                    && a.asset_type == AnalysisAssetType::Gene
                    && ancestries.contains(&a.ancestry_group)
            })
            .collect();

        if gene_assets.is_empty() {
            return Err(AppError::NotFound(format!(
                "No gene results found for analysis_id: {}",
                analysis_id
            )));
        }

        info!(
            "Querying gene {} across {} ancestry HTs for phenotype {}",
            gene_id,
            gene_assets.len(),
            analysis_id
        );

        // Query each HT and collect results
        let mut all_results = Vec::new();
        let max_maf = params.max_maf.unwrap_or(DEFAULT_MAX_MAF);
        let annotation_filter = params.annotation.clone();

        for asset in gene_assets {
            let uri = asset.uri.clone();
            let ancestry = asset.ancestry_group;
            let aid = analysis_id.to_string();
            let gid = gene_id.to_string();
            let ann_filter = annotation_filter.clone();

            // Query in a blocking task since hail-decoder is sync
            let results = tokio::task::spawn_blocking(move || {
                query_gene_ht(&uri, &gid, &aid, ancestry, max_maf, ann_filter.as_deref())
            })
            .await
            .map_err(|e| AppError::DataTransformError(format!("Task join error: {}", e)))??;

            all_results.extend(results);
        }

        // Extract gene_symbol from results (should be consistent)
        let gene_symbol = all_results
            .first()
            .map(|r| r.gene_symbol.clone())
            .unwrap_or_default();

        Ok(GeneAssociationResponse {
            gene_id: gene_id.to_string(),
            gene_symbol,
            results: all_results,
        })
    }

    /// Query all genes for a phenotype (paginated)
    ///
    /// This is useful for building gene-level Manhattan plots or tables.
    pub async fn query_all_genes(
        &self,
        analysis_id: &str,
        params: GeneQueryParams,
        limit: Option<usize>,
        offset: Option<usize>,
    ) -> Result<Vec<GeneAssociationResult>, AppError> {
        let assets = self.assets.read().await;
        let assets = assets.as_ref().ok_or_else(|| {
            AppError::DataTransformError("Assets not loaded".to_string())
        })?;

        // Default to META ancestry
        let ancestry = params.ancestry.unwrap_or(AncestryGroup::Meta);

        // Find gene_results.ht URI for this analysis + ancestry
        let gene_asset = assets
            .assets
            .iter()
            .find(|a| {
                a.analysis_id.eq_ignore_ascii_case(analysis_id)
                    && a.asset_type == AnalysisAssetType::Gene
                    && a.ancestry_group == ancestry
            })
            .ok_or_else(|| {
                AppError::NotFound(format!(
                    "No gene results found for analysis_id: {} ancestry: {}",
                    analysis_id, ancestry
                ))
            })?;

        let uri = gene_asset.uri.clone();
        let aid = analysis_id.to_string();
        let max_maf = params.max_maf.unwrap_or(DEFAULT_MAX_MAF);
        let annotation_filter = params.annotation.clone();
        let limit = limit.unwrap_or(1000);
        let offset = offset.unwrap_or(0);

        info!(
            "Querying all genes for phenotype {} (ancestry: {}, max_maf: {}, limit: {}, offset: {})",
            analysis_id, ancestry, max_maf, limit, offset
        );

        // Query in a blocking task
        let results = tokio::task::spawn_blocking(move || {
            query_all_genes_ht(&uri, &aid, ancestry, max_maf, annotation_filter.as_deref(), limit, offset)
        })
        .await
        .map_err(|e| AppError::DataTransformError(format!("Task join error: {}", e)))??;

        Ok(results)
    }
}

/// Query a gene_results.ht file for a specific gene
fn query_gene_ht(
    uri: &str,
    gene_id: &str,
    analysis_id: &str,
    ancestry: AncestryGroup,
    max_maf: f64,
    annotation_filter: Option<&str>,
) -> Result<Vec<GeneAssociationResult>, AppError> {
    debug!("Opening HT: {}", uri);
    let engine = QueryEngine::open_path(uri)?;

    // Query by gene_id (first key field)
    let key_ranges = vec![KeyRange::point(
        "gene_id".to_string(),
        KeyValue::String(gene_id.to_string()),
    )];

    let mut results = Vec::new();

    for row_result in engine.query_iter(&key_ranges)? {
        let encoded_row = row_result?;
        if let Ok(result) = transform_gene_result(encoded_row, analysis_id, &ancestry.to_string()) {
            // Apply max_maf filter
            if (result.max_maf - max_maf).abs() < 0.0001 || result.max_maf < 0.0 {
                // Include if max_maf matches or is -1 (Cauchy)
                // Apply annotation filter if specified
                if let Some(ann) = annotation_filter {
                    if result.annotation.eq_ignore_ascii_case(ann) {
                        results.push(result);
                    }
                } else {
                    results.push(result);
                }
            }
        }
    }

    debug!(
        "Found {} results for gene {} in {}",
        results.len(),
        gene_id,
        uri
    );
    Ok(results)
}

/// Query all genes from a gene_results.ht file
fn query_all_genes_ht(
    uri: &str,
    analysis_id: &str,
    ancestry: AncestryGroup,
    max_maf: f64,
    annotation_filter: Option<&str>,
    limit: usize,
    offset: usize,
) -> Result<Vec<GeneAssociationResult>, AppError> {
    debug!("Opening HT for full scan: {}", uri);
    let engine = QueryEngine::open_path(uri)?;

    // Full scan (no key filter)
    let mut results = Vec::new();
    let mut skipped = 0;

    for row_result in engine.query_iter(&[])? {
        let encoded_row = row_result?;
        if let Ok(result) = transform_gene_result(encoded_row, analysis_id, &ancestry.to_string()) {
            // Apply max_maf filter
            if (result.max_maf - max_maf).abs() < 0.0001 {
                // Apply annotation filter if specified
                let include = if let Some(ann) = annotation_filter {
                    result.annotation.eq_ignore_ascii_case(ann)
                } else {
                    true
                };

                if include {
                    if skipped < offset {
                        skipped += 1;
                    } else {
                        results.push(result);
                        if results.len() >= limit {
                            break;
                        }
                    }
                }
            }
        }
    }

    debug!(
        "Found {} results (offset: {}, limit: {}) from {}",
        results.len(),
        offset,
        limit,
        uri
    );
    Ok(results)
}

/// Transform an EncodedValue row into a GeneAssociationResult
fn transform_gene_result(
    value: EncodedValue,
    analysis_id: &str,
    ancestry_group: &str,
) -> Result<GeneAssociationResult, AppError> {
    let EncodedValue::Struct(fields) = value else {
        return Err(AppError::DataTransformError(
            "Expected Struct at top level".to_string(),
        ));
    };

    let fields_map: HashMap<String, EncodedValue> = fields.into_iter().collect();

    // Key fields (required)
    let gene_id = get_string(&fields_map, "gene_id")?;
    let gene_symbol = get_string(&fields_map, "gene_symbol")?;
    let annotation = get_string(&fields_map, "annotation")?;
    let max_maf = get_f64(&fields_map, "max_MAF");

    // Statistical results (optional, may be NaN)
    let pvalue = get_f64_opt(&fields_map, "Pvalue");
    let pvalue_burden = get_f64_opt(&fields_map, "Pvalue_Burden");
    let pvalue_skat = get_f64_opt(&fields_map, "Pvalue_SKAT");
    let beta_burden = get_f64_opt(&fields_map, "BETA_Burden");
    let se_burden = get_f64_opt(&fields_map, "SE_Burden");

    // Variant counts
    let mac = get_i64_opt(&fields_map, "MAC");
    let number_rare = get_i32_opt(&fields_map, "Number_rare");
    let number_ultra_rare = get_i32_opt(&fields_map, "Number_ultra_rare");
    let total_variants = get_i32_opt(&fields_map, "total_variants");

    // Derived fields
    let pvalue_log10 = get_f64_opt(&fields_map, "Pvalue_log10");

    // Genomic location
    let chrom = get_string_opt(&fields_map, "CHR");
    let pos = get_i32_opt(&fields_map, "POS");

    Ok(GeneAssociationResult {
        gene_id,
        gene_symbol,
        annotation,
        max_maf,
        analysis_id: analysis_id.to_string(),
        ancestry_group: ancestry_group.to_string(),
        pvalue,
        pvalue_burden,
        pvalue_skat,
        beta_burden,
        se_burden,
        mac,
        number_rare,
        number_ultra_rare,
        total_variants,
        pvalue_log10,
        chrom,
        pos,
    })
}

// ============================================================================
// Helper functions for extracting values from EncodedValue
// ============================================================================

fn get_string(map: &HashMap<String, EncodedValue>, key: &str) -> Result<String, AppError> {
    map.get(key)
        .and_then(|v| v.as_string())
        .ok_or_else(|| AppError::DataTransformError(format!("Missing required field: {}", key)))
}

fn get_string_opt(map: &HashMap<String, EncodedValue>, key: &str) -> Option<String> {
    map.get(key).and_then(|v| v.as_string())
}

fn get_f64(map: &HashMap<String, EncodedValue>, key: &str) -> f64 {
    map.get(key)
        .and_then(|v| extract_f64(v))
        .unwrap_or(0.0)
}

fn get_f64_opt(map: &HashMap<String, EncodedValue>, key: &str) -> Option<f64> {
    map.get(key).and_then(|v| extract_f64(v)).and_then(|f| {
        // Return None for NaN values
        if f.is_nan() {
            None
        } else {
            Some(f)
        }
    })
}

fn extract_f64(val: &EncodedValue) -> Option<f64> {
    match val {
        EncodedValue::Float64(f) => Some(*f),
        EncodedValue::Float32(f) => Some(*f as f64),
        EncodedValue::Int64(i) => Some(*i as f64),
        EncodedValue::Int32(i) => Some(*i as f64),
        _ => None,
    }
}

fn get_i64_opt(map: &HashMap<String, EncodedValue>, key: &str) -> Option<i64> {
    map.get(key).and_then(|v| match v {
        EncodedValue::Int64(i) => Some(*i),
        EncodedValue::Int32(i) => Some(*i as i64),
        _ => None,
    })
}

fn get_i32_opt(map: &HashMap<String, EncodedValue>, key: &str) -> Option<i32> {
    map.get(key).and_then(|v| match v {
        EncodedValue::Int32(i) => Some(*i),
        EncodedValue::Int64(i) => Some(*i as i32),
        _ => None,
    })
}
