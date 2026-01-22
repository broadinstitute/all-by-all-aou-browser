//! Data models for the AxAoU API
//!
//! These structs match the TypeScript interfaces expected by the frontend:
//! - `AnalysisMetadataHds` for analysis metadata
//! - `GeneModelsHds` for gene model data

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

// ============================================================================
// Gene Models
// ============================================================================

/// Represents a gene model served to the frontend.
/// Corresponds to the TypeScript type `GeneModelsHds`.
#[derive(Debug, Clone, Serialize)]
pub struct GeneModel {
    pub gene_id: String,
    pub symbol: String,
    pub symbol_upper_case: String,
    pub chrom: String,
    pub start: i64,
    pub stop: i64,
    pub strand: String,
    pub xstart: i64,
    pub xstop: i64,
    pub canonical_transcript_id: String,
    pub preferred_transcript_id: String,
    pub preferred_transcript_source: String,
    pub gencode_symbol: String,
    pub gene_version: String,
    pub name: String,
    pub hgnc_id: String,
    pub ncbi_id: String,
    pub omim_id: String,
    pub reference_genome: String,
    pub alias_symbols: Vec<String>,
    pub previous_symbols: Vec<Option<String>>,
    pub search_terms: Vec<String>,
    pub flags: Vec<String>,
    pub exons: Vec<Exon>,
    pub transcripts: Vec<Transcript>,
    pub mane_select_transcript: Option<ManeSelectTranscript>,
    pub gnomad_constraint: Option<GnomadConstraint>,
}

/// Exon coordinates
#[derive(Debug, Clone, Serialize)]
pub struct Exon {
    pub feature_type: String,
    pub start: i64,
    pub stop: i64,
    pub xstart: i64,
    pub xstop: i64,
}

/// Transcript information
#[derive(Debug, Clone, Serialize)]
pub struct Transcript {
    pub transcript_id: String,
    pub transcript_version: String,
    pub gene_id: String,
    pub gene_version: String,
    pub chrom: String,
    pub strand: String,
    pub start: i64,
    pub stop: i64,
    pub xstart: i64,
    pub xstop: i64,
    pub reference_genome: String,
    pub refseq_id: Option<String>,
    pub refseq_version: Option<String>,
    pub exons: Vec<Exon>,
}

/// MANE Select transcript information
#[derive(Debug, Clone, Serialize)]
pub struct ManeSelectTranscript {
    pub ensembl_id: String,
    pub ensembl_version: String,
    pub refseq_id: String,
    pub refseq_version: String,
    pub matched_gene_version: String,
}

/// gnomAD constraint metrics for a gene
#[derive(Debug, Clone, Serialize)]
pub struct GnomadConstraint {
    pub gene: String,
    pub gene_id: String,
    pub transcript: String,
    pub mane_select: bool,
    pub flags: Vec<String>,
    // Observed counts
    pub obs_lof: i64,
    pub obs_mis: i64,
    pub obs_syn: i64,
    // Expected counts
    pub exp_lof: f64,
    pub exp_mis: f64,
    pub exp_syn: f64,
    // Observed/Expected ratios
    pub oe_lof: f64,
    pub oe_lof_lower: f64,
    pub oe_lof_upper: f64,
    pub oe_mis: f64,
    pub oe_mis_lower: f64,
    pub oe_mis_upper: f64,
    pub oe_syn: f64,
    pub oe_syn_lower: f64,
    pub oe_syn_upper: f64,
    // Z-scores
    pub lof_z: f64,
    pub mis_z: f64,
    pub syn_z: f64,
    // pLI score
    pub pli: f64,
}
