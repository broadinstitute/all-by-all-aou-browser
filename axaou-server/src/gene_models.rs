//! Gene model queries
//!
//! Provides two query backends:
//! - `GeneModelsQuery`: Direct Hail Table queries via hail-decoder (legacy)
//! - `GeneModelsClickHouse`: ClickHouse queries (preferred after migration)

use crate::clickhouse::models::GeneModelRow;
use crate::error::AppError;
use crate::models::{Exon, GeneModel, GnomadConstraint, ManeSelectTranscript, Transcript};
use clickhouse::Client;
use hail_decoder::codec::EncodedValue;
use hail_decoder::query::QueryEngine;
use std::collections::HashMap;
use std::sync::Mutex;
use tracing::info;

/// GCS path to the gene models reference Hail Table
const GENE_MODELS_HT_PATH: &str =
    "gs://axaou-browser-common/reference-data/genes_grch38_annotated_6.ht";

/// On-demand gene model query engine
pub struct GeneModelsQuery {
    engine: Mutex<QueryEngine>,
}

impl GeneModelsQuery {
    /// Open the gene models table (fast - just reads metadata)
    pub fn open() -> Result<Self, AppError> {
        info!("Opening gene models table at {}", GENE_MODELS_HT_PATH);
        let engine = QueryEngine::open_path(GENE_MODELS_HT_PATH)?;
        info!(
            "Gene models table ready: {} partitions, keys: {:?}",
            engine.num_partitions(),
            engine.key_fields()
        );
        Ok(Self {
            engine: Mutex::new(engine),
        })
    }

    /// Query a gene by gene_id (e.g., "ENSG00000139618")
    pub fn get_by_gene_id(&self, gene_id: &str) -> Result<Option<GeneModel>, AppError> {
        let engine = self.engine.lock().map_err(|e| {
            AppError::DataTransformError(format!("Failed to acquire lock: {}", e))
        })?;

        // Query with gene_id as the first key field
        let key_ranges = vec![hail_decoder::query::KeyRange::point(
            "gene_id".to_string(),
            hail_decoder::query::KeyValue::String(gene_id.to_string()),
        )];

        let mut results = Vec::new();
        for row_result in engine.query_iter(&key_ranges)? {
            let encoded_row = row_result?;
            if let Ok(model) = transform_to_gene_model(encoded_row) {
                results.push(model);
            }
        }

        Ok(results.into_iter().next())
    }

    /// Query a gene by symbol (scans all partitions - slower)
    pub fn get_by_symbol(&self, symbol: &str) -> Result<Option<GeneModel>, AppError> {
        let engine = self.engine.lock().map_err(|e| {
            AppError::DataTransformError(format!("Failed to acquire lock: {}", e))
        })?;

        let symbol_upper = symbol.to_uppercase();

        // Full scan - no key filter (symbol is not a key field)
        for row_result in engine.query_iter(&[])? {
            let encoded_row = row_result?;
            if let Ok(model) = transform_to_gene_model(encoded_row) {
                if model.symbol_upper_case == symbol_upper {
                    return Ok(Some(model));
                }
            }
        }

        Ok(None)
    }

    /// Get genes in a genomic interval (scans relevant partitions)
    pub fn get_in_interval(&self, interval: &str) -> Result<Vec<GeneModel>, AppError> {
        let (chrom, start, stop) = parse_interval(interval)?;

        let engine = self.engine.lock().map_err(|e| {
            AppError::DataTransformError(format!("Failed to acquire lock: {}", e))
        })?;

        let mut genes = Vec::new();

        // Full scan for now - could optimize with interval index
        for row_result in engine.query_iter(&[])? {
            let encoded_row = row_result?;
            if let Ok(model) = transform_to_gene_model(encoded_row) {
                let model_chrom = normalize_chrom(&model.chrom);
                if model_chrom == chrom && model.stop >= start && model.start <= stop {
                    genes.push(model);
                }
            }
        }

        Ok(genes)
    }
}

/// Parse genomic interval string into (chrom, start, stop)
fn parse_interval(interval: &str) -> Result<(String, i64, i64), AppError> {
    let parts: Vec<&str> = interval.split(':').collect();
    if parts.len() != 2 {
        return Err(AppError::InvalidInterval(format!(
            "Invalid interval format: {}",
            interval
        )));
    }

    let chrom = normalize_chrom(parts[0]);
    let range_parts: Vec<&str> = parts[1].split('-').collect();
    if range_parts.len() != 2 {
        return Err(AppError::InvalidInterval(format!(
            "Invalid interval format: {}",
            interval
        )));
    }

    let start: i64 = range_parts[0].parse().map_err(|_| {
        AppError::InvalidInterval(format!("Invalid start position: {}", range_parts[0]))
    })?;
    let stop: i64 = range_parts[1].parse().map_err(|_| {
        AppError::InvalidInterval(format!("Invalid stop position: {}", range_parts[1]))
    })?;

    Ok((chrom, start, stop))
}

/// Normalize chromosome name (remove "chr" prefix)
fn normalize_chrom(chrom: &str) -> String {
    chrom.strip_prefix("chr").unwrap_or(chrom).to_string()
}

/// Transform an EncodedValue row into a GeneModel
fn transform_to_gene_model(value: EncodedValue) -> Result<GeneModel, AppError> {
    let EncodedValue::Struct(fields) = value else {
        return Err(AppError::DataTransformError(
            "Expected Struct at top level".to_string(),
        ));
    };

    let fields_map: HashMap<String, EncodedValue> = fields.into_iter().collect();

    // Required fields
    let gene_id = get_string(&fields_map, "gene_id")?;
    let symbol = get_string(&fields_map, "symbol")?;
    let chrom = get_string(&fields_map, "chrom")?;
    let start = get_i64(&fields_map, "start")?;
    let stop = get_i64(&fields_map, "stop")?;

    // Optional fields with defaults
    let symbol_upper_case = get_string_opt(&fields_map, "symbol_upper_case")
        .unwrap_or_else(|| symbol.to_uppercase());
    let strand = get_string_opt(&fields_map, "strand").unwrap_or_else(|| "+".to_string());
    let xstart = get_i64_opt(&fields_map, "xstart").unwrap_or(0);
    let xstop = get_i64_opt(&fields_map, "xstop").unwrap_or(0);
    let canonical_transcript_id =
        get_string_opt(&fields_map, "canonical_transcript_id").unwrap_or_default();
    let preferred_transcript_id =
        get_string_opt(&fields_map, "preferred_transcript_id").unwrap_or_default();
    let preferred_transcript_source =
        get_string_opt(&fields_map, "preferred_transcript_source").unwrap_or_default();
    let gencode_symbol = get_string_opt(&fields_map, "gencode_symbol").unwrap_or_default();
    let gene_version = get_string_opt(&fields_map, "gene_version").unwrap_or_default();
    let name = get_string_opt(&fields_map, "name").unwrap_or_default();
    let hgnc_id = get_string_opt(&fields_map, "hgnc_id").unwrap_or_default();
    let ncbi_id = get_string_opt(&fields_map, "ncbi_id").unwrap_or_default();
    let omim_id = get_string_opt(&fields_map, "omim_id").unwrap_or_default();
    let reference_genome =
        get_string_opt(&fields_map, "reference_genome").unwrap_or_else(|| "GRCh38".to_string());

    // Array fields
    let alias_symbols = get_string_array(&fields_map, "alias_symbols");
    let previous_symbols = get_optional_string_array(&fields_map, "previous_symbols");
    let search_terms = get_string_array(&fields_map, "search_terms");
    let flags = get_string_array(&fields_map, "flags");

    // Nested structs
    let exons = get_exons(&fields_map, "exons");
    let transcripts = get_transcripts(&fields_map, "transcripts");
    let mane_select_transcript = get_mane_select(&fields_map, "mane_select_transcript");
    let gnomad_constraint = get_gnomad_constraint(&fields_map, "gnomad_constraint");

    Ok(GeneModel {
        gene_id,
        symbol,
        symbol_upper_case,
        chrom,
        start,
        stop,
        strand,
        xstart,
        xstop,
        canonical_transcript_id,
        preferred_transcript_id,
        preferred_transcript_source,
        gencode_symbol,
        gene_version,
        name,
        hgnc_id,
        ncbi_id,
        omim_id,
        reference_genome,
        alias_symbols,
        previous_symbols,
        search_terms,
        flags,
        exons,
        transcripts,
        mane_select_transcript,
        gnomad_constraint,
    })
}

// Helper functions for extracting values

fn get_string(map: &HashMap<String, EncodedValue>, key: &str) -> Result<String, AppError> {
    map.get(key)
        .and_then(|v| v.as_string())
        .ok_or_else(|| AppError::DataTransformError(format!("Missing required field: {}", key)))
}

fn get_string_opt(map: &HashMap<String, EncodedValue>, key: &str) -> Option<String> {
    map.get(key).and_then(|v| v.as_string())
}

fn get_i64(map: &HashMap<String, EncodedValue>, key: &str) -> Result<i64, AppError> {
    map.get(key)
        .and_then(|v| extract_i64(v))
        .ok_or_else(|| AppError::DataTransformError(format!("Missing required field: {}", key)))
}

fn get_i64_opt(map: &HashMap<String, EncodedValue>, key: &str) -> Option<i64> {
    map.get(key).and_then(|v| extract_i64(v))
}

fn extract_i64(val: &EncodedValue) -> Option<i64> {
    match val {
        EncodedValue::Int64(i) => Some(*i),
        EncodedValue::Int32(i) => Some(*i as i64),
        _ => None,
    }
}

fn get_string_array(map: &HashMap<String, EncodedValue>, key: &str) -> Vec<String> {
    map.get(key)
        .and_then(|v| {
            if let EncodedValue::Array(arr) = v {
                Some(arr.iter().filter_map(|e| e.as_string()).collect())
            } else {
                None
            }
        })
        .unwrap_or_default()
}

fn get_optional_string_array(map: &HashMap<String, EncodedValue>, key: &str) -> Vec<Option<String>> {
    map.get(key)
        .and_then(|v| {
            if let EncodedValue::Array(arr) = v {
                Some(
                    arr.iter()
                        .map(|e| match e {
                            EncodedValue::Null => None,
                            _ => e.as_string(),
                        })
                        .collect(),
                )
            } else {
                None
            }
        })
        .unwrap_or_default()
}

fn get_exons(map: &HashMap<String, EncodedValue>, key: &str) -> Vec<Exon> {
    map.get(key)
        .and_then(|v| {
            if let EncodedValue::Array(arr) = v {
                Some(arr.iter().filter_map(transform_exon).collect())
            } else {
                None
            }
        })
        .unwrap_or_default()
}

fn transform_exon(val: &EncodedValue) -> Option<Exon> {
    if let EncodedValue::Struct(fields) = val {
        let fields_map: HashMap<String, EncodedValue> = fields.iter().cloned().collect();
        Some(Exon {
            feature_type: get_string_opt(&fields_map, "feature_type").unwrap_or_default(),
            start: get_i64_opt(&fields_map, "start").unwrap_or(0),
            stop: get_i64_opt(&fields_map, "stop").unwrap_or(0),
            xstart: get_i64_opt(&fields_map, "xstart").unwrap_or(0),
            xstop: get_i64_opt(&fields_map, "xstop").unwrap_or(0),
        })
    } else {
        None
    }
}

fn get_transcripts(map: &HashMap<String, EncodedValue>, key: &str) -> Vec<Transcript> {
    map.get(key)
        .and_then(|v| {
            if let EncodedValue::Array(arr) = v {
                Some(arr.iter().filter_map(transform_transcript).collect())
            } else {
                None
            }
        })
        .unwrap_or_default()
}

fn transform_transcript(val: &EncodedValue) -> Option<Transcript> {
    if let EncodedValue::Struct(fields) = val {
        let fields_map: HashMap<String, EncodedValue> = fields.iter().cloned().collect();
        Some(Transcript {
            transcript_id: get_string_opt(&fields_map, "transcript_id").unwrap_or_default(),
            transcript_version: get_string_opt(&fields_map, "transcript_version").unwrap_or_default(),
            gene_id: get_string_opt(&fields_map, "gene_id").unwrap_or_default(),
            gene_version: get_string_opt(&fields_map, "gene_version").unwrap_or_default(),
            chrom: get_string_opt(&fields_map, "chrom").unwrap_or_default(),
            strand: get_string_opt(&fields_map, "strand").unwrap_or_default(),
            start: get_i64_opt(&fields_map, "start").unwrap_or(0),
            stop: get_i64_opt(&fields_map, "stop").unwrap_or(0),
            xstart: get_i64_opt(&fields_map, "xstart").unwrap_or(0),
            xstop: get_i64_opt(&fields_map, "xstop").unwrap_or(0),
            reference_genome: get_string_opt(&fields_map, "reference_genome").unwrap_or_default(),
            refseq_id: get_string_opt(&fields_map, "refseq_id"),
            refseq_version: get_string_opt(&fields_map, "refseq_version"),
            exons: get_exons(&fields_map, "exons"),
        })
    } else {
        None
    }
}

fn get_mane_select(
    map: &HashMap<String, EncodedValue>,
    key: &str,
) -> Option<ManeSelectTranscript> {
    map.get(key).and_then(|v| {
        if let EncodedValue::Struct(fields) = v {
            let fields_map: HashMap<String, EncodedValue> = fields.iter().cloned().collect();
            Some(ManeSelectTranscript {
                ensembl_id: get_string_opt(&fields_map, "ensembl_id").unwrap_or_default(),
                ensembl_version: get_string_opt(&fields_map, "ensembl_version").unwrap_or_default(),
                refseq_id: get_string_opt(&fields_map, "refseq_id").unwrap_or_default(),
                refseq_version: get_string_opt(&fields_map, "refseq_version").unwrap_or_default(),
                matched_gene_version: get_string_opt(&fields_map, "matched_gene_version")
                    .unwrap_or_default(),
            })
        } else {
            None
        }
    })
}

fn get_gnomad_constraint(
    map: &HashMap<String, EncodedValue>,
    key: &str,
) -> Option<GnomadConstraint> {
    map.get(key).and_then(|v| {
        if let EncodedValue::Struct(fields) = v {
            let fields_map: HashMap<String, EncodedValue> = fields.iter().cloned().collect();
            Some(GnomadConstraint {
                gene: get_string_opt(&fields_map, "gene").unwrap_or_default(),
                gene_id: get_string_opt(&fields_map, "gene_id").unwrap_or_default(),
                transcript: get_string_opt(&fields_map, "transcript").unwrap_or_default(),
                mane_select: get_bool(&fields_map, "mane_select"),
                flags: get_string_array(&fields_map, "flags"),
                obs_lof: get_i64_opt(&fields_map, "obs_lof").unwrap_or(0),
                obs_mis: get_i64_opt(&fields_map, "obs_mis").unwrap_or(0),
                obs_syn: get_i64_opt(&fields_map, "obs_syn").unwrap_or(0),
                exp_lof: get_f64(&fields_map, "exp_lof"),
                exp_mis: get_f64(&fields_map, "exp_mis"),
                exp_syn: get_f64(&fields_map, "exp_syn"),
                oe_lof: get_f64(&fields_map, "oe_lof"),
                oe_lof_lower: get_f64(&fields_map, "oe_lof_lower"),
                oe_lof_upper: get_f64(&fields_map, "oe_lof_upper"),
                oe_mis: get_f64(&fields_map, "oe_mis"),
                oe_mis_lower: get_f64(&fields_map, "oe_mis_lower"),
                oe_mis_upper: get_f64(&fields_map, "oe_mis_upper"),
                oe_syn: get_f64(&fields_map, "oe_syn"),
                oe_syn_lower: get_f64(&fields_map, "oe_syn_lower"),
                oe_syn_upper: get_f64(&fields_map, "oe_syn_upper"),
                lof_z: get_f64(&fields_map, "lof_z"),
                mis_z: get_f64(&fields_map, "mis_z"),
                syn_z: get_f64(&fields_map, "syn_z"),
                pli: get_f64(&fields_map, "pli"),
            })
        } else {
            None
        }
    })
}

fn get_bool(map: &HashMap<String, EncodedValue>, key: &str) -> bool {
    map.get(key)
        .and_then(|v| {
            if let EncodedValue::Boolean(b) = v {
                Some(*b)
            } else {
                None
            }
        })
        .unwrap_or(false)
}

fn get_f64(map: &HashMap<String, EncodedValue>, key: &str) -> f64 {
    map.get(key)
        .and_then(|v| match v {
            EncodedValue::Float64(f) => Some(*f),
            EncodedValue::Float32(f) => Some(*f as f64),
            _ => None,
        })
        .unwrap_or(0.0)
}

// ============================================================================
// ClickHouse-based Gene Model Queries
// ============================================================================

/// ClickHouse-based gene model query engine
///
/// Queries the `gene_models` table in ClickHouse for gene model data.
/// This is the preferred backend after migration from Hail Tables.
pub struct GeneModelsClickHouse {
    client: Client,
}

impl GeneModelsClickHouse {
    /// Create a new ClickHouse gene models query engine
    pub fn new(client: Client) -> Self {
        Self { client }
    }

    /// Query a gene by gene_id (e.g., "ENSG00000139618")
    pub async fn get_by_gene_id(&self, gene_id: &str) -> Result<Option<GeneModel>, AppError> {
        let query = Self::build_select_query("WHERE gene_id = ?");

        let result = self
            .client
            .query(&query)
            .bind(gene_id)
            .fetch_optional::<GeneModelRow>()
            .await
            .map_err(|e| AppError::DataTransformError(format!("ClickHouse query error: {}", e)))?;

        Ok(result.map(|row| row.to_api_model()))
    }

    /// Query a gene by symbol (case-insensitive)
    pub async fn get_by_symbol(&self, symbol: &str) -> Result<Option<GeneModel>, AppError> {
        let query = Self::build_select_query("WHERE symbol_upper_case = ?");

        let result = self
            .client
            .query(&query)
            .bind(symbol.to_uppercase())
            .fetch_optional::<GeneModelRow>()
            .await
            .map_err(|e| AppError::DataTransformError(format!("ClickHouse query error: {}", e)))?;

        Ok(result.map(|row| row.to_api_model()))
    }

    /// Get genes in a genomic interval
    pub async fn get_in_interval(&self, interval: &str) -> Result<Vec<GeneModel>, AppError> {
        let (chrom, start, stop) = parse_interval(interval)?;

        // Query by xstart/xstop overlap
        // Gene overlaps interval if: gene.start <= interval.stop AND gene.stop >= interval.start
        let query = Self::build_select_query(
            "WHERE chrom = ? AND stop >= ? AND start <= ? ORDER BY start",
        );

        // Normalize chromosome (ensure 'chr' prefix)
        let chrom_with_prefix = if chrom.starts_with("chr") {
            chrom
        } else {
            format!("chr{}", chrom)
        };

        let results = self
            .client
            .query(&query)
            .bind(&chrom_with_prefix)
            .bind(start)
            .bind(stop)
            .fetch_all::<GeneModelRow>()
            .await
            .map_err(|e| AppError::DataTransformError(format!("ClickHouse query error: {}", e)))?;

        Ok(results.into_iter().map(|row| row.to_api_model()).collect())
    }

    /// Build the SELECT query with all gene_models columns
    fn build_select_query(where_clause: &str) -> String {
        format!(
            r#"
            SELECT
                gene_id, symbol, symbol_upper_case, chrom, start, stop, xstart, xstop, strand,
                gene_version, gencode_symbol, name, hgnc_id, ncbi_id, omim_id, reference_genome,
                canonical_transcript_id, preferred_transcript_id, preferred_transcript_source,
                alias_symbols, previous_symbols, search_terms, flags,
                `exons.feature_type`, `exons.start`, `exons.stop`, `exons.xstart`, `exons.xstop`,
                gnomad_gene, gnomad_gene_id, gnomad_transcript, gnomad_mane_select, gnomad_flags,
                gnomad_pli, gnomad_lof_z, gnomad_mis_z, gnomad_syn_z,
                gnomad_oe_lof, gnomad_oe_lof_lower, gnomad_oe_lof_upper,
                gnomad_oe_mis, gnomad_oe_mis_lower, gnomad_oe_mis_upper,
                gnomad_oe_syn, gnomad_oe_syn_lower, gnomad_oe_syn_upper,
                gnomad_exp_lof, gnomad_exp_mis, gnomad_exp_syn,
                gnomad_obs_lof, gnomad_obs_mis, gnomad_obs_syn,
                mane_ensembl_id, mane_ensembl_version, mane_refseq_id, mane_refseq_version, mane_matched_gene_version,
                transcripts_json
            FROM gene_models
            {}
            "#,
            where_clause
        )
    }
}

/// Check if the gene_models table exists in ClickHouse
pub async fn gene_models_table_exists(client: &Client) -> bool {
    let result = client
        .query("SELECT 1 FROM gene_models LIMIT 1")
        .fetch_optional::<u8>()
        .await;

    result.is_ok()
}
