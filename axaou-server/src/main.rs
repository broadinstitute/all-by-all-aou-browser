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
mod data;
mod error;
mod gene_models;
mod models;

use api::AppState;
use axum::{routing::get, Router};
use clap::{Parser, Subcommand};
use models::AnalysisAssets;
use std::{env, net::SocketAddr, path::PathBuf, sync::Arc};
use tokio::sync::RwLock;
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

    // Create shared application state
    let state = Arc::new(AppState {
        metadata,
        gene_models: Arc::new(gene_models),
        assets: RwLock::new(assets),
    });

    // Build the router with /api prefix to match proxy behavior
    let app = Router::new()
        .nest(
            "/api",
            Router::new()
                .route("/analyses", get(api::get_analyses))
                .route("/genes/model/:gene_id", get(api::get_gene_model))
                .route(
                    "/genes/model/interval/:interval",
                    get(api::get_gene_models_in_interval),
                )
                // Analysis assets discovery endpoints
                .route("/assets", get(api::get_assets))
                .route("/assets/summary", get(api::get_assets_summary)),
        )
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
