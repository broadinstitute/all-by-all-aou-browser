//! ClickHouse row models
//!
//! These structs map to ClickHouse table schemas for type-safe queries.

use clickhouse::Row;
use serde::{Deserialize, Serialize};

/// Locus metadata from the `loci` table
///
/// Contains summary information about a genomic locus including
/// lead variant, variant counts, and plot URIs.
#[derive(Debug, Clone, Serialize, Deserialize, Row)]
pub struct LocusRow {
    pub locus_id: String,
    pub phenotype: String,
    pub ancestry: String,
    pub contig: String,
    pub start: i32,
    pub stop: i32,
    pub xstart: i64,
    pub xstop: i64,
    pub source: String,
    pub lead_variant: String,
    pub lead_pvalue: f64,
    pub exome_count: u32,
    pub genome_count: u32,
    pub plot_gcs_uri: String,
}

/// Variant within a locus from the `loci_variants` table
///
/// Contains the minimal data needed for Manhattan plot rendering:
/// position, p-value, and significance flag.
#[derive(Debug, Clone, Serialize, Deserialize, Row)]
pub struct LocusVariantRow {
    pub xpos: i64,
    pub position: i32,
    pub pvalue: f64,
    pub neg_log10_p: f32,
    pub is_significant: bool,
}

/// Extended locus variant with locus context
///
/// Includes locus_id for queries that return variants across multiple loci.
#[derive(Debug, Clone, Serialize, Deserialize, Row)]
pub struct LocusVariantExtendedRow {
    pub locus_id: String,
    pub xpos: i64,
    pub position: i32,
    pub pvalue: f64,
    pub neg_log10_p: f32,
    pub is_significant: bool,
}

/// Significant variant from the `significant_variants` table
///
/// Contains full association statistics for variants that pass
/// significance thresholds.
#[derive(Debug, Clone, Serialize, Deserialize, Row)]
pub struct SignificantVariantRow {
    pub phenotype: String,
    pub ancestry: String,
    pub sequencing_type: String,
    pub xpos: i64,
    pub contig: String,
    pub position: i32,
    #[serde(rename = "ref")]
    pub ref_allele: String,
    pub alt: String,
    pub pvalue: f64,
    pub beta: f64,
    pub se: f64,
    pub af: f64,
}

/// Global variant annotation from the `variant_annotations` table
///
/// Contains gene annotations and allele frequencies for a variant.
#[derive(Debug, Clone, Serialize, Deserialize, Row)]
pub struct VariantAnnotationRow {
    pub xpos: i64,
    pub contig: String,
    pub position: u32,
    #[serde(rename = "ref")]
    pub ref_allele: String,
    pub alt: String,
    pub gene_symbol: Option<String>,
    pub consequence: Option<String>,
    pub af_all: Option<f64>,
}

/// Phenotype plot metadata from the `phenotype_plots` table
///
/// Contains GCS URIs for pre-rendered Manhattan plot images.
#[derive(Debug, Clone, Serialize, Deserialize, Row)]
pub struct PlotRow {
    pub phenotype: String,
    pub ancestry: String,
    pub plot_type: String,
    pub gcs_uri: String,
}
