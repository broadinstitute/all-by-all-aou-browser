//! Data models for the AxAoU API
//!
//! These structs match the TypeScript `AnalysisMetadataHds` interface
//! expected by the frontend.

use serde::Serialize;

/// Represents the analysis metadata served to the frontend.
/// Corresponds to the TypeScript type `AnalysisMetadataHds`.
#[derive(Debug, Clone, Serialize)]
pub struct AnalysisMetadata {
    pub analysis_id: String,
    pub ancestry_group: String,
    pub category: String,
    pub description: String,
    pub description_more: String,
    pub keep_pheno_burden: bool,
    pub keep_pheno_skat: bool,
    pub keep_pheno_skato: bool,
    pub lambda_gc_acaf: Option<f64>,
    pub lambda_gc_exome: Option<f64>,
    pub lambda_gc_gene_burden_001: Option<f64>,
    pub n_cases: i64,
    pub n_controls: Option<i64>,
    pub pheno_sex: String,
    pub trait_type: String,
}
