//! AxAoU Server - Rust backend for analysis metadata and gene models
//!
//! This server reads Hail Tables from GCS using hail-decoder and serves
//! them via an HTTP API:
//! - GET /api/analyses - Analysis metadata
//! - GET /api/genes/model/{gene_id} - Gene model by ID or symbol
//! - GET /api/genes/model/interval/{interval} - Genes in a genomic interval

mod api;
mod data;
mod error;
mod gene_models;
mod models;

use api::AppState;
use axum::{routing::get, Router};
use std::{env, net::SocketAddr, sync::Arc};
use tower_http::cors::{Any, CorsLayer};
use tracing::info;

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

    info!("Starting AxAoU Server...");

    // Load analysis metadata from GCS at startup
    info!("Loading analysis metadata from GCS...");
    let metadata = data::load_all_metadata().await?;
    info!("Successfully loaded {} metadata records.", metadata.len());

    // Open gene models table (on-demand queries, no pre-loading)
    info!("Opening gene models table...");
    let gene_models = tokio::task::spawn_blocking(gene_models::GeneModelsQuery::open).await??;

    // Create shared application state
    let state = Arc::new(AppState {
        metadata,
        gene_models: Arc::new(gene_models),
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
                ),
        )
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .with_state(state);

    // Bind to configurable port (default 3001)
    let port: u16 = env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(3001);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    info!("Server listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
