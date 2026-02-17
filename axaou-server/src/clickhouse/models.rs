//! ClickHouse row models
//!
//! These structs map to ClickHouse table schemas for type-safe queries.

use crate::clickhouse::xpos::{make_variant_id, make_variant_id_from_xpos};
use crate::models::{
    Exon, GeneAssociationApi, GeneModel, GnomadConstraint, Locus, ManeSelectTranscript, Transcript,
    VariantAnnotationApi, VariantAssociationApi,
};
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

impl SignificantVariantRow {
    /// Convert to API model with nested locus and variant_id
    pub fn to_api(&self) -> VariantAssociationApi {
        VariantAssociationApi {
            variant_id: make_variant_id(&self.contig, self.position as u32, &self.ref_allele, &self.alt),
            locus: Locus::new(self.contig.clone(), self.position as u32),
            ref_allele: self.ref_allele.clone(),
            alt: self.alt.clone(),
            pvalue: self.pvalue,
            beta: self.beta,
            se: self.se,
            af: self.af,
            phenotype: self.phenotype.clone(),
            ancestry: self.ancestry.clone(),
            sequencing_type: self.sequencing_type.clone(),
        }
    }
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

impl VariantAnnotationRow {
    /// Convert to API model with nested locus and variant_id
    pub fn to_api(&self) -> VariantAnnotationApi {
        VariantAnnotationApi {
            variant_id: make_variant_id(&self.contig, self.position, &self.ref_allele, &self.alt),
            locus: Locus::new(self.contig.clone(), self.position),
            ref_allele: self.ref_allele.clone(),
            alt: self.alt.clone(),
            gene_symbol: self.gene_symbol.clone(),
            consequence: self.consequence.clone(),
            af: self.af_all,
        }
    }
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

/// Gene association result from the `gene_associations` table
///
/// Contains SKAT-O statistics for gene-level burden tests across phenotypes.
#[derive(Debug, Clone, Serialize, Deserialize, Row)]
pub struct GeneAssociationRow {
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
    pub contig: String,
    pub gene_start_position: i32,
    pub xpos: i64,
}

impl GeneAssociationRow {
    /// Convert to API model with nested locus
    pub fn to_api(&self) -> GeneAssociationApi {
        GeneAssociationApi {
            gene_id: self.gene_id.clone(),
            gene_symbol: self.gene_symbol.clone(),
            annotation: self.annotation.clone(),
            max_maf: self.max_maf,
            phenotype: self.phenotype.clone(),
            ancestry: self.ancestry.clone(),
            pvalue: self.pvalue,
            pvalue_burden: self.pvalue_burden,
            pvalue_skat: self.pvalue_skat,
            beta_burden: self.beta_burden,
            mac: self.mac,
            locus: Locus::new(self.contig.clone(), self.gene_start_position as u32),
        }
    }
}

/// Point for Q-Q plot from the `qq_points` table
///
/// Contains observed and expected p-values for Q-Q plot rendering.
#[derive(Debug, Clone, Serialize, Deserialize, Row)]
pub struct QQRow {
    pub phenotype: String,
    pub ancestry: String,
    pub sequencing_type: String,
    pub contig: String,
    pub position: i32,
    #[serde(rename = "ref")]
    pub ref_allele: String,
    pub alt: String,
    pub pvalue_log10: f64,
    pub pvalue_expected_log10: f64,
}

/// Variant row joined with annotations for Gene Page table
///
/// Used for queries that fetch variants within a gene region
/// and join with annotation data.
#[derive(Debug, Clone, Serialize, Deserialize, Row)]
pub struct GenePageVariantRow {
    pub locus_id: String,
    pub phenotype: String,
    pub xpos: i64,
    pub position: i32,
    #[serde(rename = "ref")]
    pub ref_allele: String,
    pub alt: String,
    pub pvalue: f64,
    pub neg_log10_p: f32,
    pub is_significant: bool,
    // Joined fields from variant_annotations
    pub gene_symbol: Option<String>,
    pub consequence: Option<String>,
}

/// Extended variant annotation from exome_annotations or genome_annotations tables
///
/// Contains full annotation data including VEP fields and population frequencies.
#[derive(Debug, Clone, Serialize, Deserialize, Row)]
pub struct VariantAnnotationExtendedRow {
    pub xpos: i64,
    pub contig: String,
    pub position: u32,
    #[serde(rename = "ref")]
    pub ref_allele: String,
    pub alt: String,
    pub ac: Option<u32>,
    pub af: Option<f64>,
    pub an: Option<u32>,
    pub hom: Option<u32>,
    pub gene_id: Option<String>,
    pub gene_symbol: Option<String>,
    pub consequence: Option<String>,
    pub hgvsc: Option<String>,
    pub hgvsp: Option<String>,
    pub amino_acids: Option<String>,
    pub polyphen2: Option<String>,
    pub lof: Option<String>,
    pub filters: Vec<String>,
}

/// Gene model row from the gene_models ClickHouse table
///
/// Maps to the flattened schema with Nested exons and JSON transcripts.
#[derive(Debug, Clone, Deserialize, Row)]
pub struct GeneModelRow {
    // Key and queryable fields
    pub gene_id: String,
    pub symbol: String,
    pub symbol_upper_case: String,
    pub chrom: String,
    pub start: i32,
    pub stop: i32,
    pub xstart: i64,
    pub xstop: i64,
    pub strand: String,

    // Metadata
    pub gene_version: Option<String>,
    pub gencode_symbol: Option<String>,
    pub name: Option<String>,
    pub hgnc_id: Option<String>,
    pub ncbi_id: Option<String>,
    pub omim_id: Option<String>,
    pub reference_genome: String,
    pub canonical_transcript_id: Option<String>,
    pub preferred_transcript_id: Option<String>,
    pub preferred_transcript_source: Option<String>,

    // Simple arrays
    pub alias_symbols: Vec<String>,
    pub previous_symbols: Vec<Option<String>>,
    pub search_terms: Vec<String>,
    pub flags: Vec<String>,

    // Exons Nested columns (parallel arrays)
    #[serde(rename = "exons.feature_type")]
    pub exons_feature_type: Vec<String>,
    #[serde(rename = "exons.start")]
    pub exons_start: Vec<i32>,
    #[serde(rename = "exons.stop")]
    pub exons_stop: Vec<i32>,
    #[serde(rename = "exons.xstart")]
    pub exons_xstart: Vec<i64>,
    #[serde(rename = "exons.xstop")]
    pub exons_xstop: Vec<i64>,

    // Flattened gnomad_constraint
    pub gnomad_gene: Option<String>,
    pub gnomad_gene_id: Option<String>,
    pub gnomad_transcript: Option<String>,
    pub gnomad_mane_select: Option<u8>,
    pub gnomad_flags: Vec<String>,
    pub gnomad_pli: Option<f64>,
    pub gnomad_lof_z: Option<f64>,
    pub gnomad_mis_z: Option<f64>,
    pub gnomad_syn_z: Option<f64>,
    pub gnomad_oe_lof: Option<f64>,
    pub gnomad_oe_lof_lower: Option<f64>,
    pub gnomad_oe_lof_upper: Option<f64>,
    pub gnomad_oe_mis: Option<f64>,
    pub gnomad_oe_mis_lower: Option<f64>,
    pub gnomad_oe_mis_upper: Option<f64>,
    pub gnomad_oe_syn: Option<f64>,
    pub gnomad_oe_syn_lower: Option<f64>,
    pub gnomad_oe_syn_upper: Option<f64>,
    pub gnomad_exp_lof: Option<f64>,
    pub gnomad_exp_mis: Option<f64>,
    pub gnomad_exp_syn: Option<f64>,
    pub gnomad_obs_lof: Option<i64>,
    pub gnomad_obs_mis: Option<i64>,
    pub gnomad_obs_syn: Option<i64>,

    // Flattened mane_select_transcript
    pub mane_ensembl_id: Option<String>,
    pub mane_ensembl_version: Option<String>,
    pub mane_refseq_id: Option<String>,
    pub mane_refseq_version: Option<String>,
    pub mane_matched_gene_version: Option<String>,

    // Transcripts as JSON string
    pub transcripts_json: String,
}

impl GeneModelRow {
    /// Convert the ClickHouse row to the API GeneModel struct
    pub fn to_api_model(self) -> GeneModel {
        // Zip exons arrays into Vec<Exon>
        let exons = self.exons_to_vec();

        // Parse transcripts JSON
        let transcripts = self.transcripts_to_vec();

        // Build GnomadConstraint from flattened fields
        let gnomad_constraint = self.gnomad_to_struct();

        // Build ManeSelectTranscript from flattened fields
        let mane_select_transcript = self.mane_to_struct();

        GeneModel {
            gene_id: self.gene_id,
            symbol: self.symbol,
            symbol_upper_case: self.symbol_upper_case,
            chrom: self.chrom,
            start: self.start as i64,
            stop: self.stop as i64,
            strand: self.strand,
            xstart: self.xstart,
            xstop: self.xstop,
            canonical_transcript_id: self.canonical_transcript_id.unwrap_or_default(),
            preferred_transcript_id: self.preferred_transcript_id.unwrap_or_default(),
            preferred_transcript_source: self.preferred_transcript_source.unwrap_or_default(),
            gencode_symbol: self.gencode_symbol.unwrap_or_default(),
            gene_version: self.gene_version.unwrap_or_default(),
            name: self.name.unwrap_or_default(),
            hgnc_id: self.hgnc_id.unwrap_or_default(),
            ncbi_id: self.ncbi_id.unwrap_or_default(),
            omim_id: self.omim_id.unwrap_or_default(),
            reference_genome: self.reference_genome,
            alias_symbols: self.alias_symbols,
            previous_symbols: self.previous_symbols,
            search_terms: self.search_terms,
            flags: self.flags,
            exons,
            transcripts,
            mane_select_transcript,
            gnomad_constraint,
        }
    }

    /// Convert parallel exon arrays to Vec<Exon>
    fn exons_to_vec(&self) -> Vec<Exon> {
        let len = self.exons_feature_type.len();
        (0..len)
            .map(|i| Exon {
                feature_type: self.exons_feature_type.get(i).cloned().unwrap_or_default(),
                start: self.exons_start.get(i).copied().unwrap_or(0) as i64,
                stop: self.exons_stop.get(i).copied().unwrap_or(0) as i64,
                xstart: self.exons_xstart.get(i).copied().unwrap_or(0),
                xstop: self.exons_xstop.get(i).copied().unwrap_or(0),
            })
            .collect()
    }

    /// Parse transcripts JSON string to Vec<Transcript>
    fn transcripts_to_vec(&self) -> Vec<Transcript> {
        if self.transcripts_json.is_empty() || self.transcripts_json == "[]" {
            return Vec::new();
        }

        // Try to parse as JSON
        serde_json::from_str(&self.transcripts_json).unwrap_or_default()
    }

    /// Build GnomadConstraint from flattened fields
    fn gnomad_to_struct(&self) -> Option<GnomadConstraint> {
        // Only return Some if we have any gnomad data
        if self.gnomad_gene.is_none() && self.gnomad_pli.is_none() {
            return None;
        }

        Some(GnomadConstraint {
            gene: self.gnomad_gene.clone().unwrap_or_default(),
            gene_id: self.gnomad_gene_id.clone().unwrap_or_default(),
            transcript: self.gnomad_transcript.clone().unwrap_or_default(),
            mane_select: self.gnomad_mane_select.map(|v| v != 0).unwrap_or(false),
            flags: self.gnomad_flags.clone(),
            obs_lof: self.gnomad_obs_lof.unwrap_or(0),
            obs_mis: self.gnomad_obs_mis.unwrap_or(0),
            obs_syn: self.gnomad_obs_syn.unwrap_or(0),
            exp_lof: self.gnomad_exp_lof.unwrap_or(0.0),
            exp_mis: self.gnomad_exp_mis.unwrap_or(0.0),
            exp_syn: self.gnomad_exp_syn.unwrap_or(0.0),
            oe_lof: self.gnomad_oe_lof.unwrap_or(0.0),
            oe_lof_lower: self.gnomad_oe_lof_lower.unwrap_or(0.0),
            oe_lof_upper: self.gnomad_oe_lof_upper.unwrap_or(0.0),
            oe_mis: self.gnomad_oe_mis.unwrap_or(0.0),
            oe_mis_lower: self.gnomad_oe_mis_lower.unwrap_or(0.0),
            oe_mis_upper: self.gnomad_oe_mis_upper.unwrap_or(0.0),
            oe_syn: self.gnomad_oe_syn.unwrap_or(0.0),
            oe_syn_lower: self.gnomad_oe_syn_lower.unwrap_or(0.0),
            oe_syn_upper: self.gnomad_oe_syn_upper.unwrap_or(0.0),
            lof_z: self.gnomad_lof_z.unwrap_or(0.0),
            mis_z: self.gnomad_mis_z.unwrap_or(0.0),
            syn_z: self.gnomad_syn_z.unwrap_or(0.0),
            pli: self.gnomad_pli.unwrap_or(0.0),
        })
    }

    /// Build ManeSelectTranscript from flattened fields
    fn mane_to_struct(&self) -> Option<ManeSelectTranscript> {
        // Only return Some if we have any mane data
        if self.mane_ensembl_id.is_none() {
            return None;
        }

        Some(ManeSelectTranscript {
            ensembl_id: self.mane_ensembl_id.clone().unwrap_or_default(),
            ensembl_version: self.mane_ensembl_version.clone().unwrap_or_default(),
            refseq_id: self.mane_refseq_id.clone().unwrap_or_default(),
            refseq_version: self.mane_refseq_version.clone().unwrap_or_default(),
            matched_gene_version: self.mane_matched_gene_version.clone().unwrap_or_default(),
        })
    }
}
