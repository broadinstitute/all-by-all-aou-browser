//! AxAoU Server - Rust backend for analysis metadata and gene models
//!
//! This server reads Hail Tables from GCS using hail-decoder and serves
//! them via an HTTP API.
//!
//! ## Commands
//!
//! - `serve` - Run the HTTP server
//! - `discover` - Discover analysis assets from GCS and save to JSON
//! - `analyze` - Analyze/summarize discovered assets

mod analysis_assets;
mod api;
mod cli;
mod clickhouse;
mod data;
mod error;
mod gene_models;
mod gene_queries;
mod genes;
mod models;
mod phenotype;
mod variants;

use api::AppState;
use axum::{routing::get, Router};
use clap::{Parser, Subcommand};
use models::AnalysisAssets;
use std::{env, net::SocketAddr, path::PathBuf, sync::Arc};
use tokio::sync::RwLock;
use tower_http::compression::CompressionLayer;
use tower_http::cors::{Any, CorsLayer};
use tracing::info;

#[derive(Parser)]
#[command(name = "axaou-server")]
#[command(about = "AxAoU Rust server for analysis metadata and gene models")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Run the HTTP server
    Serve {
        /// Port to listen on
        #[arg(short, long, default_value = "3001")]
        port: u16,

        /// Path to pre-computed assets JSON (optional, will discover on-demand if not provided)
        #[arg(long)]
        assets_file: Option<PathBuf>,
    },

    /// Discover analysis assets from GCS and save to JSON
    Discover {
        /// Output file path for the discovered assets JSON
        #[arg(short, long, default_value = "assets.json")]
        output: PathBuf,

        /// Filter by metadata (only discover assets for known phenotypes)
        #[arg(long, default_value = "true")]
        filter_by_metadata: bool,
    },

    /// Analyze/summarize discovered assets
    Analyze {
        /// Input file path for the assets JSON
        #[arg(short, long, default_value = "assets.json")]
        input: PathBuf,
    },

    /// Query analysis assets with filters (outputs JSON)
    QueryAssets {
        /// Input file path for the assets JSON
        #[arg(short, long, default_value = "assets.json")]
        input: PathBuf,

        /// Filter by ancestry (afr, amr, eas, eur, mid, sas, meta)
        #[arg(long)]
        ancestry: Option<String>,

        /// Filter by asset type (variant, gene, variant_exp_p, gene_exp_p)
        #[arg(long, name = "type")]
        asset_type: Option<String>,

        /// Filter by sequencing type (exomes, genomes)
        #[arg(long)]
        seq_type: Option<String>,

        /// Filter by analysis ID / phenotype name (case-insensitive, supports partial match)
        #[arg(long)]
        analysis_id: Option<String>,

        /// Output only URIs (one per line) instead of full JSON
        #[arg(long)]
        uris_only: bool,

        /// Output only analysis IDs (unique, one per line)
        #[arg(long)]
        ids_only: bool,

        /// Limit number of results
        #[arg(long)]
        limit: Option<usize>,

        /// Sample a fraction of results (0.0-1.0, e.g., 0.1 for 10%)
        #[arg(long)]
        sample: Option<f64>,
    },

    /// Load data into ClickHouse from Hail Tables
    Ingest {
        #[command(subcommand)]
        command: cli::IngestCommand,
    },
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing subscriber for logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("axaou_server=info".parse()?)
                .add_directive("hail_decoder=info".parse()?),
        )
        .init();

    let cli = Cli::parse();

    match cli.command {
        Commands::Serve { port, assets_file } => {
            run_server(port, assets_file).await?;
        }
        Commands::Discover {
            output,
            filter_by_metadata,
        } => {
            run_discover(output, filter_by_metadata).await?;
        }
        Commands::Analyze { input } => {
            run_analyze(input).await?;
        }
        Commands::QueryAssets {
            input,
            ancestry,
            asset_type,
            seq_type,
            analysis_id,
            uris_only,
            ids_only,
            limit,
            sample,
        } => {
            run_query_assets(
                input,
                ancestry,
                asset_type,
                seq_type,
                analysis_id,
                uris_only,
                ids_only,
                limit,
                sample,
            )
            .await?;
        }
        Commands::Ingest { command } => {
            cli::run_ingest(command).await?;
        }
    }

    Ok(())
}

/// Run the HTTP server
async fn run_server(port: u16, assets_file: Option<PathBuf>) -> anyhow::Result<()> {
    info!("Starting AxAoU Server...");

    // Load analysis metadata from GCS at startup
    info!("Loading analysis metadata from GCS...");
    let metadata = data::load_all_metadata().await?;
    info!("Successfully loaded {} metadata records.", metadata.len());

    // Open gene models table (on-demand queries, no pre-loading)
    info!("Opening gene models table...");
    let gene_models = tokio::task::spawn_blocking(gene_models::GeneModelsQuery::open).await??;

    // Load pre-computed assets if provided
    let assets = if let Some(path) = assets_file {
        info!("Loading pre-computed assets from {:?}...", path);
        let contents = tokio::fs::read_to_string(&path).await?;
        let assets: AnalysisAssets = serde_json::from_str(&contents)?;
        info!("Loaded {} assets from file.", assets.assets.len());
        Some(assets)
    } else {
        info!("No pre-computed assets file provided, will discover on-demand.");
        None
    };

    // Create shared assets with Arc<RwLock> for sharing with gene query engine
    let assets = Arc::new(RwLock::new(assets));

    // Create gene query engine with access to assets
    let gene_queries = gene_queries::GeneQueryEngine::new(Arc::clone(&assets));

    // Initialize ClickHouse client
    let clickhouse_client = clickhouse::client::connect();
    match clickhouse::client::health_check(&clickhouse_client).await {
        Ok(_) => info!("Connected to ClickHouse"),
        Err(e) => tracing::warn!("ClickHouse connection warning: {}", e),
    }

    // Create shared application state
    let state = Arc::new(AppState {
        metadata,
        gene_models: Arc::new(gene_models),
        assets,
        gene_queries,
        clickhouse: clickhouse_client,
    });

    // Build the router with /api prefix to match proxy behavior
    let app = Router::new()
        .nest(
            "/api",
            Router::new()
                .route("/config", get(api::get_config))
                .route("/analyses", get(api::get_analyses))
                .route("/analyses/:analysis_id", get(api::get_analysis_by_id))
                .route("/categories", get(api::get_categories))
                .route("/genes/model/:gene_id", get(api::get_gene_model))
                .route(
                    "/genes/model/interval/:interval",
                    get(api::get_gene_models_in_interval),
                )
                // Analysis assets discovery endpoints
                .route("/assets", get(api::get_assets))
                .route("/assets/summary", get(api::get_assets_summary))
                // Gene association query endpoints
                .route(
                    "/phenotype/:analysis_id/genes",
                    get(api::list_gene_associations),
                )
                .route(
                    "/phenotype/:analysis_id/genes/:gene_id",
                    get(api::get_gene_associations),
                )
                // --- Phenotype / Manhattan Routes (ClickHouse-backed) ---
                .route(
                    "/phenotype/:analysis_id/loci",
                    get(phenotype::loci::get_phenotype_loci),
                )
                .route(
                    "/phenotype/:analysis_id/loci/:locus_id/variants",
                    get(phenotype::loci::get_locus_variants),
                )
                .route(
                    "/phenotype/:analysis_id/significant",
                    get(phenotype::significant::get_significant_variants),
                )
                .route(
                    "/phenotype/:analysis_id/plots",
                    get(phenotype::plots::get_phenotype_plots),
                )
                // --- Variant Annotation Routes (ClickHouse-backed) ---
                .route(
                    "/variants/annotations/:variant_id",
                    get(variants::annotations::get_annotation_by_id),
                )
                .route(
                    "/variants/annotations/interval/:interval",
                    get(variants::annotations::get_annotations_by_interval),
                )
                .route(
                    "/variants/annotations/gene/:gene_id",
                    get(variants::annotations::get_annotations_by_gene),
                )
                // --- Association / PheWAS Routes (ClickHouse-backed) ---
                .route(
                    "/variants/associations/variant/:variant_id",
                    get(variants::annotations::get_association_by_variant),
                )
                .route(
                    "/variants/associations/interval/:interval",
                    get(variants::annotations::get_associations_by_interval),
                )
                .route(
                    "/variants/associations/phewas/:variant_id",
                    get(variants::phewas::get_phewas_by_variant),
                )
                .route(
                    "/variants/associations/phewas/interval/:interval",
                    get(variants::phewas::get_phewas_by_interval),
                )
                .route(
                    "/variants/associations/top",
                    get(variants::phewas::get_top_variants),
                )
                .route(
                    "/variants/associations/gene/:gene_id",
                    get(variants::associations::get_variants_by_gene),
                )
                .route(
                    "/variants/associations/manhattan/:analysis_id/top",
                    get(variants::associations::get_manhattan_top),
                )
                // --- Gene Routes (ClickHouse-backed) ---
                .route(
                    "/genes/phewas/:gene_id",
                    get(genes::routes::get_gene_phewas),
                )
                .route(
                    "/genes/top-associations",
                    get(genes::routes::get_top_associations),
                )
                .route(
                    "/genes/all-symbols",
                    get(genes::routes::get_all_symbols),
                )
                .route(
                    "/genes/associations/interval/:interval",
                    get(genes::routes::get_genes_in_interval),
                )
                // --- QQ Plot Route (ClickHouse-backed) ---
                .route(
                    "/phenotype/:analysis_id/qq",
                    get(phenotype::qq::get_qq_plot),
                ),
        )
        .layer(CompressionLayer::new())
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .with_state(state);

    // Bind to configurable port
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    info!("Server listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

/// Discover analysis assets from GCS and save to JSON
async fn run_discover(output: PathBuf, filter_by_metadata: bool) -> anyhow::Result<()> {
    info!("Starting asset discovery...");

    // Load metadata for filtering if requested
    let valid_phenotypes = if filter_by_metadata {
        info!("Loading metadata to filter phenotypes...");
        let metadata = data::load_all_metadata().await?;
        info!("Loaded {} metadata records.", metadata.len());
        Some(analysis_assets::get_valid_phenotypes(&metadata))
    } else {
        None
    };

    // Discover assets
    let discovery = analysis_assets::AssetDiscovery::new()?;
    let assets = discovery.discover_all(valid_phenotypes.as_ref()).await?;

    info!(
        "Discovered {} assets across {} unique phenotypes",
        assets.assets.len(),
        assets.analysis_ids().len()
    );

    // Save to JSON
    let json = serde_json::to_string_pretty(&assets)?;
    tokio::fs::write(&output, &json).await?;
    info!("Saved assets to {:?}", output);

    // Print summary
    print_summary(&assets);

    Ok(())
}

/// Analyze/summarize discovered assets
async fn run_analyze(input: PathBuf) -> anyhow::Result<()> {
    info!("Loading assets from {:?}...", input);

    let contents = tokio::fs::read_to_string(&input).await?;
    let assets: AnalysisAssets = serde_json::from_str(&contents)?;

    print_summary(&assets);

    Ok(())
}

/// Query assets with filters and output JSON
async fn run_query_assets(
    input: PathBuf,
    ancestry: Option<String>,
    asset_type: Option<String>,
    seq_type: Option<String>,
    analysis_id: Option<String>,
    uris_only: bool,
    ids_only: bool,
    limit: Option<usize>,
    sample: Option<f64>,
) -> anyhow::Result<()> {
    let contents = tokio::fs::read_to_string(&input).await?;
    let assets: AnalysisAssets = serde_json::from_str(&contents)?;

    // Apply filters
    let filtered: Vec<_> = assets
        .assets
        .iter()
        .filter(|a| {
            // Filter by ancestry
            if let Some(ref anc) = ancestry {
                if !a.ancestry_group.to_string().eq_ignore_ascii_case(anc)
                    && !a.ancestry_group.dir_name().eq_ignore_ascii_case(anc)
                {
                    return false;
                }
            }
            // Filter by asset type (exact match with common aliases)
            if let Some(ref at) = asset_type {
                let at_lower = at.to_lowercase();
                let matches = match at_lower.as_str() {
                    "variant" => matches!(a.asset_type, crate::models::AnalysisAssetType::Variant),
                    "gene" => matches!(a.asset_type, crate::models::AnalysisAssetType::Gene),
                    "variant_exp_p" | "variantexpp" | "exp_p" | "expected_p" => {
                        matches!(a.asset_type, crate::models::AnalysisAssetType::VariantExpP)
                    }
                    "variant_ds" | "variantds" | "downsampled" => {
                        matches!(a.asset_type, crate::models::AnalysisAssetType::VariantDs)
                    }
                    "gene_exp_p" | "geneexpp" => {
                        matches!(a.asset_type, crate::models::AnalysisAssetType::GeneExpP)
                    }
                    _ => {
                        // Fallback to contains for flexibility
                        let type_str = format!("{:?}", a.asset_type).to_lowercase();
                        type_str.contains(&at_lower)
                    }
                };
                if !matches {
                    return false;
                }
            }
            // Filter by sequencing type
            if let Some(ref st) = seq_type {
                match &a.sequencing_type {
                    Some(seq) if seq.to_string().eq_ignore_ascii_case(st) => {}
                    _ => return false,
                }
            }
            // Filter by analysis ID (partial match, case-insensitive)
            if let Some(ref aid) = analysis_id {
                if !a.analysis_id.to_lowercase().contains(&aid.to_lowercase()) {
                    return false;
                }
            }
            true
        })
        .collect();

    // Apply sampling
    let sampled: Vec<_> = if let Some(frac) = sample {
        use rand::Rng;
        let mut rng = rand::rng();
        filtered
            .into_iter()
            .filter(|_| rng.random_bool(frac))
            .collect()
    } else {
        filtered
    };

    // Apply limit
    let results: Vec<_> = if let Some(n) = limit {
        sampled.into_iter().take(n).collect()
    } else {
        sampled
    };

    // Output based on mode
    if ids_only {
        // Unique analysis IDs
        let mut ids: Vec<_> = results.iter().map(|a| a.analysis_id.as_str()).collect();
        ids.sort();
        ids.dedup();
        for id in ids {
            println!("{}", id);
        }
    } else if uris_only {
        // Just URIs
        for asset in results {
            println!("{}", asset.uri);
        }
    } else {
        // Full JSON
        let json = serde_json::to_string_pretty(&results)?;
        println!("{}", json);
    }

    Ok(())
}

/// Print a summary of discovered assets
fn print_summary(assets: &AnalysisAssets) {
    use std::collections::HashMap;

    let mut by_ancestry: HashMap<String, usize> = HashMap::new();
    let mut by_asset_type: HashMap<String, usize> = HashMap::new();
    let mut by_sequencing_type: HashMap<String, usize> = HashMap::new();
    let mut unique_phenotypes = std::collections::HashSet::new();

    for asset in &assets.assets {
        *by_ancestry
            .entry(asset.ancestry_group.to_string())
            .or_insert(0) += 1;
        *by_asset_type
            .entry(format!("{:?}", asset.asset_type).to_lowercase())
            .or_insert(0) += 1;
        if let Some(ref st) = asset.sequencing_type {
            *by_sequencing_type.entry(st.to_string()).or_insert(0) += 1;
        }
        unique_phenotypes.insert(&asset.analysis_id);
    }

    println!("\n=== Asset Discovery Summary ===\n");
    println!("Total assets: {}", assets.assets.len());
    println!("Unique phenotypes: {}", unique_phenotypes.len());

    println!("\nBy Ancestry:");
    let mut ancestry_vec: Vec<_> = by_ancestry.iter().collect();
    ancestry_vec.sort_by_key(|(k, _)| k.to_string());
    for (ancestry, count) in ancestry_vec {
        println!("  {}: {}", ancestry, count);
    }

    println!("\nBy Asset Type:");
    let mut type_vec: Vec<_> = by_asset_type.iter().collect();
    type_vec.sort_by_key(|(k, _)| k.to_string());
    for (asset_type, count) in type_vec {
        println!("  {}: {}", asset_type, count);
    }

    println!("\nBy Sequencing Type:");
    let mut seq_vec: Vec<_> = by_sequencing_type.iter().collect();
    seq_vec.sort_by_key(|(k, _)| k.to_string());
    for (seq_type, count) in seq_vec {
        println!("  {}: {}", seq_type, count);
    }

    println!();
}
