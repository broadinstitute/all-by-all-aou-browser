//! Unified Phenotype Overview endpoint
//!
//! Provides a single endpoint that merges genome GWAS, exome GWAS, and gene burden
//! test results into a unified view for the Overview tab.

use crate::api::AppState;
use crate::error::AppError;
use crate::phenotype::manhattan::{compute_neg_log10_p, fetch_peak_annotations, BurdenResult, GeneInLocus, Peak};
use axum::{
    extract::{Path, Query, State},
    Json,
};
use clickhouse::Row;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::debug;

/// Query parameters for overview endpoint
#[derive(Debug, Deserialize)]
pub struct OverviewQuery {
    /// Ancestry filter (e.g., "meta", "eur")
    pub ancestry: Option<String>,
    /// Data version for cache-busting (e.g., "20260202-0942")
    pub v: Option<String>,
}

/// Coding variant counts by consequence category
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UnifiedCodingHits {
    pub lof: u32,
    pub missense: u32,
}

/// A gene with evidence from multiple sources
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnifiedGene {
    pub gene_symbol: String,
    pub gene_id: String,
    pub distance_kb: f64,
    /// Coding hits from genome GWAS
    #[serde(skip_serializing_if = "Option::is_none")]
    pub genome_coding_hits: Option<UnifiedCodingHits>,
    /// Coding hits from exome GWAS
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exome_coding_hits: Option<UnifiedCodingHits>,
    /// Burden test results
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub burden_results: Vec<BurdenResult>,
}

/// A unified locus combining evidence from genome, exome, and burden tests
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnifiedLocus {
    pub locus_id: String,
    pub start: i32,
    pub stop: i32,
    pub contig: String,
    pub position: i32,
    /// Best p-value from genome GWAS
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pvalue_genome: Option<f64>,
    /// Best p-value from exome GWAS
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pvalue_exome: Option<f64>,
    /// Genes in this locus with combined evidence
    pub genes: Vec<UnifiedGene>,
}

/// Response from the overview endpoint
#[derive(Debug, Serialize, Deserialize)]
pub struct UnifiedOverviewResponse {
    /// URL to genome Manhattan plot image
    pub genome_image_url: String,
    /// URL to exome Manhattan plot image
    pub exome_image_url: String,
    /// Unified loci with merged evidence
    pub unified_loci: Vec<UnifiedLocus>,
}

/// Significant burden test row from ClickHouse
#[derive(Debug, Clone, Deserialize, Row)]
struct SignificantBurdenRow {
    pub gene_id: String,
    pub gene_symbol: String,
    pub contig: String,
    pub gene_start_position: i32,
    pub annotation: String,
    pub pvalue: Option<f64>,
    pub pvalue_burden: Option<f64>,
    pub pvalue_skat: Option<f64>,
}

/// Convert Peak to UnifiedLocus with genome evidence
fn peak_to_unified_locus(peak: &Peak, source: &str) -> UnifiedLocus {
    let genes = peak
        .genes
        .iter()
        .map(|g| {
            let coding_hits = if g.lof_count.unwrap_or(0) > 0 || g.missense_count.unwrap_or(0) > 0 {
                Some(UnifiedCodingHits {
                    lof: g.lof_count.unwrap_or(0),
                    missense: g.missense_count.unwrap_or(0),
                })
            } else {
                None
            };

            UnifiedGene {
                gene_symbol: g.gene_symbol.clone(),
                gene_id: g.gene_id.clone(),
                distance_kb: g.distance_kb,
                genome_coding_hits: if source == "genome" {
                    coding_hits.clone()
                } else {
                    None
                },
                exome_coding_hits: if source == "exome" { coding_hits } else { None },
                burden_results: g.burden_results.clone(),
            }
        })
        .collect();

    UnifiedLocus {
        locus_id: peak.locus_id.clone(),
        start: peak.start,
        stop: peak.stop,
        contig: peak.contig.clone(),
        position: peak.position,
        pvalue_genome: if source == "genome" {
            Some(peak.pvalue)
        } else {
            None
        },
        pvalue_exome: if source == "exome" {
            Some(peak.pvalue)
        } else {
            None
        },
        genes,
    }
}

/// Merge gene from another source into existing gene list
fn merge_gene(
    existing_genes: &mut Vec<UnifiedGene>,
    new_gene: &GeneInLocus,
    source: &str,
) {
    let coding_hits = if new_gene.lof_count.unwrap_or(0) > 0 || new_gene.missense_count.unwrap_or(0) > 0 {
        Some(UnifiedCodingHits {
            lof: new_gene.lof_count.unwrap_or(0),
            missense: new_gene.missense_count.unwrap_or(0),
        })
    } else {
        None
    };

    // Try to find existing gene
    if let Some(existing) = existing_genes.iter_mut().find(|g| g.gene_id == new_gene.gene_id) {
        // Merge coding hits based on source
        if source == "genome" && coding_hits.is_some() {
            existing.genome_coding_hits = coding_hits;
        } else if source == "exome" && coding_hits.is_some() {
            existing.exome_coding_hits = coding_hits;
        }
        // Merge burden results
        for br in &new_gene.burden_results {
            if !existing.burden_results.iter().any(|b| b.annotation == br.annotation) {
                existing.burden_results.push(br.clone());
            }
        }
    } else {
        // Add new gene
        existing_genes.push(UnifiedGene {
            gene_symbol: new_gene.gene_symbol.clone(),
            gene_id: new_gene.gene_id.clone(),
            distance_kb: new_gene.distance_kb,
            genome_coding_hits: if source == "genome" { coding_hits.clone() } else { None },
            exome_coding_hits: if source == "exome" { coding_hits } else { None },
            burden_results: new_gene.burden_results.clone(),
        });
    }
}

/// GET /api/phenotype/:analysis_id/overview
///
/// Returns unified overview data combining genome Manhattan, exome Manhattan,
/// and gene burden test results with server-side caching.
pub async fn get_phenotype_overview(
    State(state): State<Arc<AppState>>,
    Path(analysis_id): Path<String>,
    Query(params): Query<OverviewQuery>,
) -> Result<Json<UnifiedOverviewResponse>, AppError> {
    debug!("Fetching unified overview for phenotype: {}", analysis_id);

    let ancestry = params.ancestry.as_deref().unwrap_or("meta");
    let data_version = params.v.as_deref().unwrap_or("");

    // Construct cache key with data version
    let cache_key = format!("{}-{}-{}-overview-v2", analysis_id, ancestry, data_version);

    // Check cache first
    if let Some(cached_bytes) = state.plot_cache.get(&cache_key).await {
        debug!("Cache hit for overview: {}", cache_key);
        let response: UnifiedOverviewResponse = serde_json::from_slice(&cached_bytes)
            .map_err(|e| AppError::DataTransformError(format!("Failed to deserialize cached overview: {}", e)))?;
        return Ok(Json(response));
    }

    debug!("Cache miss for overview: {}", cache_key);

    // Fetch genome peaks
    let genome_peaks = fetch_peak_annotations(
        &state,
        &analysis_id,
        ancestry,
        "genome",
        "genome_annotations",
        "all",
        10000,
    )
    .await
    .unwrap_or_default();

    // Fetch exome peaks
    let exome_peaks = fetch_peak_annotations(
        &state,
        &analysis_id,
        ancestry,
        "exome",
        "exome_annotations",
        "all",
        10000,
    )
    .await
    .unwrap_or_default();

    // Fetch significant burden hits
    let burden_threshold = 2.5e-6;
    let burden_query = r#"
        SELECT
            gene_id, gene_symbol, contig, gene_start_position, annotation,
            pvalue, pvalue_burden, pvalue_skat
        FROM gene_associations
        WHERE phenotype = ?
          AND ancestry = ?
          AND annotation IN ('pLoF', 'missenseLC', 'synonymous')
          AND (pvalue < ? OR pvalue_burden < ? OR pvalue_skat < ?)
        ORDER BY pvalue ASC
    "#;

    let burden_rows: Vec<SignificantBurdenRow> = state
        .clickhouse
        .query(burden_query)
        .bind(&analysis_id)
        .bind(ancestry)
        .bind(burden_threshold)
        .bind(burden_threshold)
        .bind(burden_threshold)
        .fetch_all()
        .await
        .unwrap_or_default();

    // Build unified loci map
    let mut loci_map: HashMap<String, UnifiedLocus> = HashMap::new();

    // Add genome peaks
    for peak in &genome_peaks {
        let key = peak.locus_id.clone();
        loci_map.insert(key, peak_to_unified_locus(peak, "genome"));
    }

    // Merge exome peaks
    for peak in &exome_peaks {
        let key = peak.locus_id.clone();
        if let Some(existing) = loci_map.get_mut(&key) {
            // Update exome p-value if lower (or if genome didn't have one)
            if existing.pvalue_exome.is_none()
                || existing.pvalue_exome.map(|p| p > peak.pvalue).unwrap_or(true)
            {
                existing.pvalue_exome = Some(peak.pvalue);
            }
            // Merge genes
            for gene in &peak.genes {
                merge_gene(&mut existing.genes, gene, "exome");
            }
        } else {
            // New locus from exome
            loci_map.insert(key, peak_to_unified_locus(peak, "exome"));
        }
    }

    // Merge burden hits
    // Group by gene first to get all annotations for each gene
    let mut gene_burden_map: HashMap<String, Vec<&SignificantBurdenRow>> = HashMap::new();
    for row in &burden_rows {
        gene_burden_map.entry(row.gene_id.clone()).or_default().push(row);
    }

    for (gene_id, rows) in gene_burden_map {
        let first_row = rows[0];

        // Build burden results for this gene
        let burden_results: Vec<BurdenResult> = rows
            .iter()
            .map(|r| BurdenResult {
                annotation: r.annotation.clone(),
                pvalue: r.pvalue,
                pvalue_neg_log10: compute_neg_log10_p(r.pvalue),
                pvalue_burden: r.pvalue_burden,
                pvalue_burden_neg_log10: compute_neg_log10_p(r.pvalue_burden),
                pvalue_skat: r.pvalue_skat,
                pvalue_skat_neg_log10: compute_neg_log10_p(r.pvalue_skat),
            })
            .collect();

        // First, try to find an existing locus that already contains this gene
        // (e.g., from a GWAS peak where this gene was within ±200kb)
        let existing_locus_key = loci_map.iter().find_map(|(k, locus)| {
            if locus.genes.iter().any(|g| g.gene_id == gene_id) {
                Some(k.clone())
            } else {
                None
            }
        });

        if let Some(key) = existing_locus_key {
            // Merge burden results into the gene in the existing locus
            let existing = loci_map.get_mut(&key).unwrap();
            if let Some(gene) = existing.genes.iter_mut().find(|g| g.gene_id == gene_id) {
                for br in burden_results {
                    if !gene.burden_results.iter().any(|b| b.annotation == br.annotation) {
                        gene.burden_results.push(br);
                    }
                }
            }
        } else {
            // No existing locus contains this gene — create a burden-only locus
            let key = format!("burden-{}", gene_id);
            loci_map.insert(
                key.clone(),
                UnifiedLocus {
                    locus_id: key,
                    start: first_row.gene_start_position,
                    stop: first_row.gene_start_position,
                    contig: first_row.contig.clone(),
                    position: first_row.gene_start_position,
                    pvalue_genome: None,
                    pvalue_exome: None,
                    genes: vec![UnifiedGene {
                        gene_symbol: first_row.gene_symbol.clone(),
                        gene_id: gene_id.clone(),
                        distance_kb: 0.0,
                        genome_coding_hits: None,
                        exome_coding_hits: None,
                        burden_results,
                    }],
                },
            );
        }
    }

    // Convert to sorted vec (by best p-value)
    let mut unified_loci: Vec<UnifiedLocus> = loci_map.into_values().collect();
    unified_loci.sort_by(|a, b| {
        let best_a = a.pvalue_genome.unwrap_or(f64::MAX).min(a.pvalue_exome.unwrap_or(f64::MAX));
        let best_b = b.pvalue_genome.unwrap_or(f64::MAX).min(b.pvalue_exome.unwrap_or(f64::MAX));
        best_a.partial_cmp(&best_b).unwrap_or(std::cmp::Ordering::Equal)
    });

    // Construct image URLs
    let genome_image_url = format!(
        "/api/phenotype/{}/manhattan/image?ancestry={}&plot_type=genome_manhattan",
        analysis_id, ancestry
    );
    let exome_image_url = format!(
        "/api/phenotype/{}/manhattan/image?ancestry={}&plot_type=exome_manhattan",
        analysis_id, ancestry
    );

    let response = UnifiedOverviewResponse {
        genome_image_url,
        exome_image_url,
        unified_loci,
    };

    // Cache the response as JSON bytes
    if let Ok(json_bytes) = serde_json::to_vec(&response) {
        state.plot_cache.insert(cache_key.clone(), json_bytes).await;
        debug!("Cached overview: {}", cache_key);
    }

    Ok(Json(response))
}
