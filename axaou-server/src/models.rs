//! Data models for the AxAoU API
//!
//! These structs match the TypeScript interfaces expected by the frontend:
//! - `AnalysisMetadataHds` for analysis metadata
//! - `GeneModelsHds` for gene model data
//! - `AnalysisAsset` for discovered analysis result assets

use serde::{Deserialize, Serialize};
use std::fmt;

// ============================================================================
// API Response Models - Frontend-compatible types with nested structures
// ============================================================================

/// Genomic locus (chromosome + position) for frontend compatibility.
///
/// Matches the frontend's expected nested `locus` object structure.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Locus {
    pub contig: String,
    pub position: u32,
}

impl Locus {
    /// Create a new Locus from contig and position
    pub fn new(contig: String, position: u32) -> Self {
        Self { contig, position }
    }

    /// Create a Locus from an xpos value
    pub fn from_xpos(xpos: i64) -> Self {
        let (contig, position) = crate::clickhouse::xpos::reverse_xpos(xpos);
        Self { contig, position }
    }
}

/// Variant association data for API responses.
///
/// This struct matches the frontend's expected shape with:
/// - `variant_id`: Generated string ID (chr1-12345-A-T)
/// - `locus`: Nested object with contig + position
#[derive(Debug, Clone, Serialize)]
pub struct VariantAssociationApi {
    pub variant_id: String,
    pub locus: Locus,
    #[serde(rename = "ref")]
    pub ref_allele: String,
    pub alt: String,
    pub pvalue: f64,
    pub beta: f64,
    pub se: f64,
    pub af: f64,
    pub phenotype: String,
    pub ancestry: String,
    pub sequencing_type: String,
}

/// Variant annotation data for API responses.
///
/// Includes nested locus and computed variant_id.
#[derive(Debug, Clone, Serialize)]
pub struct VariantAnnotationApi {
    pub variant_id: String,
    pub locus: Locus,
    #[serde(rename = "ref")]
    pub ref_allele: String,
    pub alt: String,
    pub gene_symbol: Option<String>,
    pub consequence: Option<String>,
    pub af: Option<f64>,
    pub hgvsc: Option<String>,
    pub hgvsp: Option<String>,
    pub ac: Option<u32>,
    pub an: Option<u32>,
    pub hom: Option<u32>,
}

/// Gene association data for API responses.
///
/// Includes nested locus for gene position.
#[derive(Debug, Clone, Serialize)]
pub struct GeneAssociationApi {
    pub gene_id: String,
    pub gene_symbol: String,
    pub annotation: String,
    pub max_maf: f64,
    pub phenotype: String,
    pub ancestry: String,
    pub pvalue: Option<f64>,
    pub pvalue_burden: Option<f64>,
    pub pvalue_skat: Option<f64>,
    pub beta_burden: Option<f64>,
    pub mac: Option<i64>,
    pub locus: Locus,
}

// ============================================================================
// Analysis Assets - Discovery of per-phenotype result files
// ============================================================================

/// Ancestry groups available in the All of Us dataset
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AncestryGroup {
    Afr,
    Amr,
    Eas,
    Eur,
    Mid,
    Sas,
    Meta,
}

impl AncestryGroup {
    /// Directory name used in GCS paths (uppercase)
    pub fn dir_name(&self) -> &'static str {
        match self {
            AncestryGroup::Afr => "AFR",
            AncestryGroup::Amr => "AMR",
            AncestryGroup::Eas => "EAS",
            AncestryGroup::Eur => "EUR",
            AncestryGroup::Mid => "MID",
            AncestryGroup::Sas => "SAS",
            AncestryGroup::Meta => "META",
        }
    }

    /// Try to parse from a directory name (case-insensitive)
    pub fn from_dir_name(s: &str) -> Option<Self> {
        match s.to_uppercase().as_str() {
            "AFR" => Some(AncestryGroup::Afr),
            "AMR" => Some(AncestryGroup::Amr),
            "EAS" => Some(AncestryGroup::Eas),
            "EUR" => Some(AncestryGroup::Eur),
            "MID" => Some(AncestryGroup::Mid),
            "SAS" => Some(AncestryGroup::Sas),
            "META" => Some(AncestryGroup::Meta),
            _ => None,
        }
    }

    /// All ancestry groups
    pub fn all() -> &'static [AncestryGroup] {
        &[
            AncestryGroup::Afr,
            AncestryGroup::Amr,
            AncestryGroup::Eas,
            AncestryGroup::Eur,
            AncestryGroup::Mid,
            AncestryGroup::Sas,
            AncestryGroup::Meta,
        ]
    }
}

impl fmt::Display for AncestryGroup {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AncestryGroup::Afr => write!(f, "afr"),
            AncestryGroup::Amr => write!(f, "amr"),
            AncestryGroup::Eas => write!(f, "eas"),
            AncestryGroup::Eur => write!(f, "eur"),
            AncestryGroup::Mid => write!(f, "mid"),
            AncestryGroup::Sas => write!(f, "sas"),
            AncestryGroup::Meta => write!(f, "meta"),
        }
    }
}

/// Sequencing type for variant results
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SequencingType {
    Exomes,
    Genomes,
}

impl fmt::Display for SequencingType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SequencingType::Exomes => write!(f, "exomes"),
            SequencingType::Genomes => write!(f, "genomes"),
        }
    }
}

/// Type of analysis asset (result file)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AnalysisAssetType {
    /// Full variant results
    Variant,
    /// Downsampled variant results (for visualization)
    VariantDs,
    /// Expected P-values for Q-Q plots
    VariantExpP,
    /// Gene-level burden test results
    Gene,
    /// Expected P-values for gene results
    GeneExpP,
}

impl AnalysisAssetType {
    /// Get the filename pattern for this asset type and sequencing type
    pub fn filename(&self, seq_type: Option<SequencingType>) -> &'static str {
        match (self, seq_type) {
            (AnalysisAssetType::Variant, Some(SequencingType::Exomes)) => "exome_results.ht",
            (AnalysisAssetType::Variant, Some(SequencingType::Genomes)) => "genome_results.ht",
            (AnalysisAssetType::VariantDs, Some(SequencingType::Exomes)) => {
                "exome_downsampled_results.ht"
            }
            (AnalysisAssetType::VariantDs, Some(SequencingType::Genomes)) => {
                "genome_downsampled_results.ht"
            }
            (AnalysisAssetType::VariantExpP, Some(SequencingType::Exomes)) => "exome_expected_p.ht",
            (AnalysisAssetType::VariantExpP, Some(SequencingType::Genomes)) => {
                "genome_expected_p.ht"
            }
            (AnalysisAssetType::Gene, _) => "gene_results.ht",
            (AnalysisAssetType::GeneExpP, _) => "gene_expected_p.ht",
            // Fallback - shouldn't happen
            _ => "results.ht",
        }
    }

    /// Parse asset type from filename
    pub fn from_filename(filename: &str) -> Option<(Self, Option<SequencingType>)> {
        match filename {
            "exome_results.ht" => Some((AnalysisAssetType::Variant, Some(SequencingType::Exomes))),
            "genome_results.ht" => Some((AnalysisAssetType::Variant, Some(SequencingType::Genomes))),
            "exome_downsampled_results.ht" => {
                Some((AnalysisAssetType::VariantDs, Some(SequencingType::Exomes)))
            }
            "genome_downsampled_results.ht" => {
                Some((AnalysisAssetType::VariantDs, Some(SequencingType::Genomes)))
            }
            "exome_expected_p.ht" => {
                Some((AnalysisAssetType::VariantExpP, Some(SequencingType::Exomes)))
            }
            "genome_expected_p.ht" => {
                Some((AnalysisAssetType::VariantExpP, Some(SequencingType::Genomes)))
            }
            "gene_results.ht" => Some((AnalysisAssetType::Gene, None)),
            "gene_expected_p.ht" => Some((AnalysisAssetType::GeneExpP, None)),
            _ => None,
        }
    }
}

/// An analysis asset represents a single result file (Hail Table) for a phenotype
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisAsset {
    /// The ancestry group this result belongs to
    pub ancestry_group: AncestryGroup,
    /// The phenotype/analysis ID (normalized, without "phenotype_" prefix)
    pub analysis_id: String,
    /// Full GCS URI to the Hail Table
    pub uri: String,
    /// Type of asset (variant, gene, etc.)
    pub asset_type: AnalysisAssetType,
    /// Sequencing type (exomes/genomes) - None for gene-level results
    pub sequencing_type: Option<SequencingType>,
}

impl AnalysisAsset {
    /// Generate a unique hash ID for this asset (for caching/lookups)
    pub fn hash_id(&self) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        format!(
            "phenotype_{}_{:?}_{:?}",
            self.analysis_id, self.ancestry_group, self.sequencing_type
        )
        .hash(&mut hasher);
        format!("{:012x}", hasher.finish())
    }
}

/// Collection of discovered analysis assets
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AnalysisAssets {
    pub assets: Vec<AnalysisAsset>,
}

impl AnalysisAssets {
    /// Filter assets by criteria
    pub fn filter(
        &self,
        ancestry: Option<AncestryGroup>,
        asset_type: Option<AnalysisAssetType>,
        sequencing_type: Option<SequencingType>,
    ) -> Vec<&AnalysisAsset> {
        self.assets
            .iter()
            .filter(|a| ancestry.map_or(true, |anc| a.ancestry_group == anc))
            .filter(|a| asset_type.map_or(true, |at| a.asset_type == at))
            .filter(|a| sequencing_type.map_or(true, |st| a.sequencing_type == Some(st)))
            .collect()
    }

    /// Get unique analysis IDs
    pub fn analysis_ids(&self) -> Vec<String> {
        let mut ids: Vec<String> = self.assets.iter().map(|a| a.analysis_id.clone()).collect();
        ids.sort();
        ids.dedup();
        ids
    }
}

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
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Exon {
    #[serde(default)]
    pub feature_type: String,
    #[serde(default)]
    pub start: i64,
    #[serde(default)]
    pub stop: i64,
    #[serde(default)]
    pub xstart: i64,
    #[serde(default)]
    pub xstop: i64,
}

/// Transcript information
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Transcript {
    #[serde(default)]
    pub transcript_id: String,
    #[serde(default)]
    pub transcript_version: String,
    #[serde(default)]
    pub gene_id: String,
    #[serde(default)]
    pub gene_version: String,
    #[serde(default)]
    pub chrom: String,
    #[serde(default)]
    pub strand: String,
    #[serde(default)]
    pub start: i64,
    #[serde(default)]
    pub stop: i64,
    #[serde(default)]
    pub xstart: i64,
    #[serde(default)]
    pub xstop: i64,
    #[serde(default)]
    pub reference_genome: String,
    pub refseq_id: Option<String>,
    pub refseq_version: Option<String>,
    #[serde(default)]
    pub exons: Vec<Exon>,
}

/// MANE Select transcript information
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ManeSelectTranscript {
    #[serde(default)]
    pub ensembl_id: String,
    #[serde(default)]
    pub ensembl_version: String,
    #[serde(default)]
    pub refseq_id: String,
    #[serde(default)]
    pub refseq_version: String,
    #[serde(default)]
    pub matched_gene_version: String,
}

// ============================================================================
// Gene Association Results (from per-phenotype gene_results.ht)
// ============================================================================

/// Gene association result from burden/SKAT tests
/// Matches the schema of gene_results.ht in per-phenotype directories
#[derive(Debug, Clone, Serialize)]
pub struct GeneAssociationResult {
    // Key fields
    pub gene_id: String,
    pub gene_symbol: String,
    pub annotation: String,
    pub max_maf: f64,

    // Context fields (added during query)
    pub analysis_id: String,
    pub ancestry_group: String,

    // Statistical results
    pub pvalue: Option<f64>,
    pub pvalue_burden: Option<f64>,
    pub pvalue_skat: Option<f64>,
    pub beta_burden: Option<f64>,
    pub se_burden: Option<f64>,

    // Variant counts
    pub mac: Option<i64>,
    pub number_rare: Option<i32>,
    pub number_ultra_rare: Option<i32>,
    pub total_variants: Option<i32>,

    // Derived/convenience fields
    pub pvalue_log10: Option<f64>,

    // Genomic location
    pub chrom: Option<String>,
    pub pos: Option<i32>,
}

/// Response wrapper for gene association queries
#[derive(Debug, Clone, Serialize)]
pub struct GeneAssociationResponse {
    pub gene_id: String,
    pub gene_symbol: String,
    pub results: Vec<GeneAssociationResult>,
}

/// Query parameters for gene association queries
#[derive(Debug, Clone, Default)]
pub struct GeneQueryParams {
    /// Filter by ancestry group (default: META only)
    pub ancestry: Option<AncestryGroup>,
    /// Filter by annotation type (e.g., "pLoF", "missenseLC")
    pub annotation: Option<String>,
    /// Filter by max MAF (default: 0.001)
    pub max_maf: Option<f64>,
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
