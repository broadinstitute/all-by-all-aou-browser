//! Data access layer for the AxAoU analysis metadata Hail Table
//!
//! This module handles fetching, parsing, and transforming data from the Hail Table
//! using hail-decoder to stream data directly from GCS.

use crate::error::AppError;
use crate::models::AnalysisMetadata;
use hail_decoder::codec::EncodedValue;
use hail_decoder::query::QueryEngine;
use tracing::info;

/// GCS path to the v8/414k analysis metadata Hail Table
const METADATA_HT_PATH: &str = "gs://aou_results/414k/utils/aou_phenotype_meta_info.ht";

/// Fetches and transforms all analysis metadata from the Hail Table.
///
/// This runs in a blocking task to avoid blocking the Tokio runtime,
/// since hail-decoder performs synchronous I/O.
pub async fn load_all_metadata() -> Result<Vec<AnalysisMetadata>, AppError> {
    info!("Loading metadata from {}", METADATA_HT_PATH);

    let metadata_task = tokio::task::spawn_blocking(move || {
        let engine = QueryEngine::open_path(METADATA_HT_PATH)?;

        info!(
            "Opened table with {} partitions, key fields: {:?}",
            engine.num_partitions(),
            engine.key_fields()
        );

        let mut results = Vec::new();
        let mut row_count = 0;

        for row_result in engine.query_iter(&[])? {
            let encoded_row = row_result?;
            row_count += 1;

            match transform_encoded_value(encoded_row) {
                Ok(metadata) => results.push(metadata),
                Err(e) => {
                    // Log but don't fail the entire load for individual row errors
                    tracing::warn!("Skipping row {}: {}", row_count, e);
                }
            }
        }

        info!(
            "Successfully transformed {} of {} rows",
            results.len(),
            row_count
        );
        Ok(results)
    });

    metadata_task.await?
}

/// Transforms a single Hail row (`EncodedValue`) into our `AnalysisMetadata` model.
///
/// Uses efficient single-pass field extraction instead of creating a HashMap.
/// The field names used here match the v8/414k dataset schema.
fn transform_encoded_value(value: EncodedValue) -> Result<AnalysisMetadata, AppError> {
    let EncodedValue::Struct(fields) = value else {
        return Err(AppError::DataTransformError(
            "Expected Struct at top level".to_string(),
        ));
    };

    // Extract fields in a single pass - more efficient than creating a HashMap
    let mut phenoname: Option<String> = None;
    let mut ancestry: Option<String> = None;
    let mut pheno_sex: Option<String> = None;
    let mut trait_type: Option<String> = None;
    let mut description: Option<String> = None;
    let mut category: Option<String> = None;
    let mut n_cases: Option<i64> = None;
    let mut n_controls: Option<i64> = None;
    let mut lambda_gc_exome_hq: Option<f64> = None;
    let mut lambda_gc_acaf_hq: Option<f64> = None;
    let mut lambda_gc_gene_burden_001: Option<f64> = None;

    for (key, val) in fields {
        match key.as_str() {
            "phenoname" => phenoname = val.as_string(),
            "ancestry" => ancestry = val.as_string(),
            // Fallback for v2 schema which uses "pop" instead of "ancestry"
            "pop" if ancestry.is_none() => ancestry = val.as_string(),
            "pheno_sex" => pheno_sex = val.as_string(),
            "trait_type" => trait_type = val.as_string(),
            "description" => description = val.as_string(),
            "category" | "phecode_category" => category = val.as_string(),
            "n_cases" => n_cases = extract_int(&val),
            "n_controls" => n_controls = extract_int(&val),
            // v8/414k uses _hq suffix for lambda fields
            "lambda_gc_exome_hq" | "lambda_gc_exome" => {
                lambda_gc_exome_hq = extract_float(&val);
            }
            "lambda_gc_acaf_hq" | "lambda_gc_acaf" => {
                lambda_gc_acaf_hq = extract_float(&val);
            }
            "lambda_gc_gene_burden_001" => {
                lambda_gc_gene_burden_001 = extract_float(&val);
            }
            _ => {} // Ignore other fields
        }
    }

    // Required fields
    let raw_phenoname = phenoname.ok_or_else(|| {
        AppError::DataTransformError("Missing required field: phenoname".to_string())
    })?;
    let ancestry_group = ancestry.ok_or_else(|| {
        AppError::DataTransformError("Missing required field: ancestry/pop".to_string())
    })?;

    // Normalize analysis_id: remove "phenotype_" prefix if present
    let analysis_id = normalize_analysis_id(&raw_phenoname);

    // Use phenoname as fallback for description if missing
    let desc = description.unwrap_or_else(|| analysis_id.clone());

    // Format category with "AxAoU > " prefix (replicates Python logic)
    let category_formatted = format!("AxAoU > {}", category.unwrap_or_else(|| "Unknown".to_string()));

    Ok(AnalysisMetadata {
        analysis_id,
        ancestry_group,
        pheno_sex: pheno_sex.unwrap_or_else(|| "both_sexes".to_string()),
        trait_type: trait_type.unwrap_or_else(|| "unknown".to_string()),
        description: desc.clone(),
        description_more: desc,
        category: category_formatted,
        n_cases: n_cases.unwrap_or(0),
        n_controls,
        lambda_gc_exome: lambda_gc_exome_hq,
        lambda_gc_acaf: lambda_gc_acaf_hq,
        lambda_gc_gene_burden_001,
        // Placeholders - matches Python logic which hardcodes these to true
        keep_pheno_burden: true,
        keep_pheno_skat: true,
        keep_pheno_skato: true,
    })
}

/// Normalize analysis ID by removing "phenotype_" prefix if present.
///
/// This replicates the Python `normalize_analysis_id` function:
/// ```python
/// if "phenotype_" in raw_analysis_id:
///     return raw_analysis_id.split("_")[1]
/// else:
///     return raw_analysis_id
/// ```
fn normalize_analysis_id(raw_id: &str) -> String {
    if raw_id.starts_with("phenotype_") {
        raw_id.strip_prefix("phenotype_").unwrap().to_string()
    } else {
        raw_id.to_string()
    }
}

/// Extract an integer from an EncodedValue (handles both i32 and i64)
fn extract_int(val: &EncodedValue) -> Option<i64> {
    match val {
        EncodedValue::Int64(i) => Some(*i),
        EncodedValue::Int32(i) => Some(*i as i64),
        EncodedValue::Null => None,
        _ => None,
    }
}

/// Extract a float from an EncodedValue (handles both f32 and f64)
fn extract_float(val: &EncodedValue) -> Option<f64> {
    match val {
        EncodedValue::Float64(f) => Some(*f),
        EncodedValue::Float32(f) => Some(*f as f64),
        EncodedValue::Null => None,
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_analysis_id_with_prefix() {
        assert_eq!(normalize_analysis_id("phenotype_height"), "height");
        assert_eq!(normalize_analysis_id("phenotype_S01AA"), "S01AA");
    }

    #[test]
    fn test_normalize_analysis_id_without_prefix() {
        assert_eq!(normalize_analysis_id("height"), "height");
        assert_eq!(normalize_analysis_id("S01AA"), "S01AA");
    }
}
