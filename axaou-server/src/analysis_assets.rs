//! Analysis asset discovery from GCS
//!
//! This module discovers per-phenotype result files (Hail Tables) from GCS
//! by scanning the directory structure:
//!
//! gs://aou_results/414k/ht_results/{ANCESTRY}/{phenotype}/
//!   - exome_variant_results.ht           (single-variant exome associations)
//!   - genome_variant_results.ht          (single-variant genome/ACAF associations)
//!   - exome_variant_results_approx_cdf_expected_p.ht  (Q-Q plot data)
//!   - genome_variant_results_approx_cdf_expected_p.ht (Q-Q plot data)
//!   - gene_results.ht                    (gene-level burden tests)

use crate::error::AppError;
use crate::models::{
    AnalysisAsset, AnalysisAssetType, AnalysisAssets, AncestryGroup, SequencingType,
};
use futures::{stream, StreamExt, TryStreamExt};
use object_store::gcp::GoogleCloudStorageBuilder;
use object_store::path::Path as ObjectPath;
use object_store::ObjectStore;
use std::collections::HashSet;
use std::sync::Arc;
use tracing::{debug, info, warn};

/// Base GCS path for per-phenotype Hail Tables (v8/414k dataset)
/// From: gs://aou_results/414k/ht_results
const PER_PHENOTYPE_BASE: &str = "414k/ht_results";
const BUCKET: &str = "aou_results";

/// Result files to look for in each phenotype directory
/// Based on actual v8/414k GCS structure:
/// gs://aou_results/414k/ht_results/{ANCESTRY}/{phenotype}/
const ASSET_FILES: &[(&str, AnalysisAssetType, Option<SequencingType>)] = &[
    // Variant results (full)
    (
        "exome_variant_results.ht",
        AnalysisAssetType::Variant,
        Some(SequencingType::Exomes),
    ),
    (
        "genome_variant_results.ht",
        AnalysisAssetType::Variant,
        Some(SequencingType::Genomes),
    ),
    // Expected P-values for Q-Q plots
    (
        "exome_variant_results_approx_cdf_expected_p.ht",
        AnalysisAssetType::VariantExpP,
        Some(SequencingType::Exomes),
    ),
    (
        "genome_variant_results_approx_cdf_expected_p.ht",
        AnalysisAssetType::VariantExpP,
        Some(SequencingType::Genomes),
    ),
    // Gene-level burden results
    ("gene_results.ht", AnalysisAssetType::Gene, None),
];

/// Query for discovering analysis assets
pub struct AssetDiscovery {
    store: Arc<dyn ObjectStore>,
}

impl AssetDiscovery {
    /// Create a new asset discovery instance
    pub fn new() -> Result<Self, AppError> {
        let store = GoogleCloudStorageBuilder::new()
            .with_bucket_name(BUCKET)
            .build()
            .map_err(|e| AppError::DataTransformError(format!("Failed to create GCS client: {}", e)))?;

        Ok(Self {
            store: Arc::new(store),
        })
    }

    /// Discover all analysis assets from GCS
    ///
    /// This scans the directory structure to find all available result files.
    /// It filters by valid ancestry groups and checks which result files exist.
    /// Uses parallel processing for ancestry groups to speed up discovery.
    pub async fn discover_all(&self, valid_phenotypes: Option<&HashSet<String>>) -> Result<AnalysisAssets, AppError> {
        info!("Starting analysis asset discovery from gs://{}/{}", BUCKET, PER_PHENOTYPE_BASE);
        let start = std::time::Instant::now();

        // Clone valid_phenotypes for sharing across tasks
        let valid_phenotypes_arc = valid_phenotypes.map(|p| Arc::new(p.clone()));

        // Spawn parallel tasks for each ancestry group
        let mut handles = Vec::new();
        for ancestry in AncestryGroup::all() {
            let store = Arc::clone(&self.store);
            let valid = valid_phenotypes_arc.clone();
            let ancestry = *ancestry;

            let handle = tokio::spawn(async move {
                let discovery = AssetDiscoveryWorker { store };
                discovery.discover_for_ancestry(ancestry, valid.as_deref()).await
            });
            handles.push((ancestry, handle));
        }

        // Collect results from all tasks
        let mut all_assets = Vec::new();
        for (ancestry, handle) in handles {
            match handle.await {
                Ok(Ok(assets)) => {
                    info!(
                        "Found {} assets for ancestry {}",
                        assets.len(),
                        ancestry.dir_name()
                    );
                    all_assets.extend(assets);
                }
                Ok(Err(e)) => {
                    warn!("Error discovering assets for {}: {}", ancestry.dir_name(), e);
                }
                Err(e) => {
                    warn!("Task panicked for {}: {}", ancestry.dir_name(), e);
                }
            }
        }

        let elapsed = start.elapsed();
        info!("Total assets discovered: {} in {:.2}s", all_assets.len(), elapsed.as_secs_f64());
        Ok(AnalysisAssets { assets: all_assets })
    }

}

/// Worker for parallel asset discovery (can be sent across task boundaries)
struct AssetDiscoveryWorker {
    store: Arc<dyn ObjectStore>,
}

/// Max concurrent GCS requests per ancestry group
const MAX_CONCURRENT_REQUESTS: usize = 50;

impl AssetDiscoveryWorker {
    /// Discover assets for a single ancestry group
    ///
    /// Strategy: Use list_with_delimiter at each level to avoid descending into .ht directories
    /// - Level 1: List phenotype directories under ancestry (1 call)
    /// - Level 2: List .ht directories under each phenotype (parallel with concurrency limit)
    async fn discover_for_ancestry(
        &self,
        ancestry: AncestryGroup,
        valid_phenotypes: Option<&HashSet<String>>,
    ) -> Result<Vec<AnalysisAsset>, AppError> {
        use std::sync::atomic::{AtomicUsize, Ordering};

        let start = std::time::Instant::now();
        let ancestry_prefix = ObjectPath::from(format!("{}/{}", PER_PHENOTYPE_BASE, ancestry.dir_name()));

        info!("[{}] Listing phenotype directories...", ancestry.dir_name());

        // Step 1: List all phenotype directories (shallow, one API call)
        let phenotype_list = self.store
            .list_with_delimiter(Some(&ancestry_prefix))
            .await
            .map_err(|e| AppError::DataTransformError(format!("Failed to list {}: {}", ancestry_prefix, e)))?;

        let phenotype_dirs: Vec<_> = phenotype_list.common_prefixes;
        let total_phenotypes = phenotype_dirs.len();
        info!("[{}] Found {} phenotype directories, processing with {} concurrent requests...",
              ancestry.dir_name(), total_phenotypes, MAX_CONCURRENT_REQUESTS);

        // Filter phenotypes first
        let filtered_phenotypes: Vec<_> = phenotype_dirs
            .into_iter()
            .filter_map(|phenotype_path| {
                let phenotype_name = phenotype_path.filename()?.to_string();
                if phenotype_name.is_empty() {
                    return None;
                }
                let analysis_id = normalize_analysis_id(&phenotype_name);

                // Filter by valid phenotypes if provided
                if let Some(valid) = valid_phenotypes {
                    if !valid.contains(&analysis_id) && !valid.contains(&phenotype_name) {
                        return None;
                    }
                }
                Some((phenotype_path, phenotype_name, analysis_id))
            })
            .collect();

        let filtered_count = filtered_phenotypes.len();
        info!("[{}] {} phenotypes after filtering", ancestry.dir_name(), filtered_count);

        // Progress counter
        let processed = AtomicUsize::new(0);
        let store = Arc::clone(&self.store);

        // Step 2: Process phenotypes in parallel with concurrency limit
        let results: Vec<Vec<AnalysisAsset>> = stream::iter(filtered_phenotypes)
            .map(|(phenotype_path, _phenotype_name, analysis_id)| {
                let store = Arc::clone(&store);
                let processed = &processed;
                let ancestry = ancestry;

                async move {
                    let mut assets = Vec::new();

                    // List .ht directories within this phenotype
                    if let Ok(result) = store.list_with_delimiter(Some(&phenotype_path)).await {
                        for ht_dir in result.common_prefixes {
                            let filename = ht_dir.filename().map(|s| s.to_string()).unwrap_or_default();

                            if let Some((asset_type, seq_type)) = match_asset_file(&filename) {
                                let uri = format!("gs://{}/{}", BUCKET, ht_dir.as_ref().trim_end_matches('/'));

                                assets.push(AnalysisAsset {
                                    ancestry_group: ancestry,
                                    analysis_id: analysis_id.clone(),
                                    uri,
                                    asset_type,
                                    sequencing_type: seq_type,
                                });
                            }
                        }
                    }

                    let count = processed.fetch_add(1, Ordering::Relaxed) + 1;
                    if count % 500 == 0 || count == filtered_count {
                        debug!("[{}] Processed {}/{} phenotypes", ancestry.dir_name(), count, filtered_count);
                    }

                    assets
                }
            })
            .buffer_unordered(MAX_CONCURRENT_REQUESTS)
            .collect()
            .await;

        // Flatten results
        let assets: Vec<AnalysisAsset> = results.into_iter().flatten().collect();

        let elapsed = start.elapsed().as_secs_f64();
        let rate = filtered_count as f64 / elapsed;
        info!(
            "[{}] Complete: {} phenotypes → {} assets in {:.1}s ({:.0} phenotypes/sec)",
            ancestry.dir_name(), filtered_count, assets.len(), elapsed, rate
        );

        Ok(assets)
    }
}

/// Parse an object path to extract phenotype and filename
/// Path format: 414k/ht_results/{ANCESTRY}/{phenotype}/{filename}.ht/...
fn parse_asset_path(path: &str, ancestry_dir: &str) -> Option<(String, String)> {
    // Split by ancestry directory to get the rest
    let parts: Vec<&str> = path.split('/').collect();

    // Find the ancestry index
    let ancestry_idx = parts.iter().position(|&p| p == ancestry_dir)?;

    // We need at least: ancestry/phenotype/filename.ht/...
    if parts.len() <= ancestry_idx + 2 {
        return None;
    }

    let phenotype = parts[ancestry_idx + 1].to_string();
    let filename_part = parts[ancestry_idx + 2];

    // Only return if it looks like a .ht directory
    if filename_part.ends_with(".ht") {
        Some((phenotype, filename_part.to_string()))
    } else {
        None
    }
}

/// Match a filename against known asset types
fn match_asset_file(filename: &str) -> Option<(AnalysisAssetType, Option<SequencingType>)> {
    for (pattern, asset_type, seq_type) in ASSET_FILES {
        if filename == *pattern {
            return Some((*asset_type, *seq_type));
        }
    }
    None
}

/// Normalize analysis ID by removing "phenotype_" prefix if present
fn normalize_analysis_id(raw_id: &str) -> String {
    raw_id
        .strip_prefix("phenotype_")
        .unwrap_or(raw_id)
        .to_string()
}

/// Load the set of valid phenotype names from the metadata
/// This is used to filter the asset discovery to only known phenotypes
pub fn get_valid_phenotypes(metadata: &[crate::models::AnalysisMetadata]) -> HashSet<String> {
    let mut phenotypes = HashSet::new();
    for m in metadata {
        // Add both normalized and prefixed forms
        phenotypes.insert(m.analysis_id.clone());
        phenotypes.insert(format!("phenotype_{}", m.analysis_id));
    }
    phenotypes
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_analysis_id() {
        assert_eq!(normalize_analysis_id("phenotype_height"), "height");
        assert_eq!(normalize_analysis_id("height"), "height");
        assert_eq!(normalize_analysis_id("phenotype_S01AA"), "S01AA");
    }
}
