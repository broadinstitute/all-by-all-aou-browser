//! AxAoU Server - Rust backend for analysis metadata
//!
//! This server reads the analysis metadata Hail Table from GCS using hail-decoder
//! and serves it via an HTTP API at GET /api/analyses.

mod api;
mod data;
mod error;
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

    // Create shared application state
    let state = Arc::new(AppState { metadata });

    // Build the router with /api prefix to match proxy behavior
    let app = Router::new()
        .nest(
            "/api",
            Router::new().route("/analyses", get(api::get_analyses)),
        )
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .with_state(state);

    // Bind to configurable port (default 3000)
    let port: u16 = env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(3000);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    info!("Server listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
