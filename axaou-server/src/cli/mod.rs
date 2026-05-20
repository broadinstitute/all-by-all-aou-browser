//! CLI subcommands for axaou-server
//!
//! Contains orchestration commands for data loading and maintenance tasks.

pub mod derive;
pub mod ingest;

pub use derive::*;
pub use ingest::*;

/// Run the load test from a CLI config file path.
pub async fn run_loadtest(config: std::path::PathBuf) -> anyhow::Result<()> {
    crate::loadtest::runner::run_loadtest_cli(config).await
}
