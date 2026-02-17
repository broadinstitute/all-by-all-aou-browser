//! Data ingestion CLI for loading Hail Tables into ClickHouse
//!
//! Orchestrates the ETL pipeline:
//! 1. Create/replace target table
//! 2. Load raw data to staging table via hail-decoder
//! 3. Transform staging -> target using SQL
//! 4. Drop staging table

use anyhow::{bail, Context, Result};
use clap::{Args, Subcommand};
use std::process::Command;
use tracing::{info, warn};

/// SQL files are embedded at compile time
const EXOME_ANNOTATIONS_DDL: &str = include_str!("../sql/exome_annotations.sql");
const EXOME_ANNOTATIONS_TRANSFORM: &str = include_str!("../sql/exome_annotations_transform.sql");
const GENOME_ANNOTATIONS_DDL: &str = include_str!("../sql/genome_annotations.sql");
const GENOME_ANNOTATIONS_TRANSFORM: &str = include_str!("../sql/genome_annotations_transform.sql");
const GENE_MODELS_DDL: &str = include_str!("../sql/gene_models.sql");
const GENE_MODELS_TRANSFORM: &str = include_str!("../sql/gene_models_transform.sql");
const ANALYSIS_METADATA_DDL: &str = include_str!("../sql/analysis_metadata.sql");
const ANALYSIS_METADATA_TRANSFORM: &str = include_str!("../sql/analysis_metadata_transform.sql");

/// Default source paths for each table
const DEFAULT_EXOME_ANNOTATIONS_PATH: &str =
    "gs://aou_results/414k/utils/aou_all_exome_variant_info_pruned_414k_annotated_filtered.ht";
const DEFAULT_GENOME_ANNOTATIONS_PATH: &str =
    "gs://aou_results/414k/utils/aou_all_ACAF_variant_info_pruned_414k_annotated_filtered.ht";
const DEFAULT_GENE_MODELS_PATH: &str =
    "gs://axaou-browser-common/reference-data/genes_grch38_annotated_6.ht";
const DEFAULT_ANALYSIS_METADATA_PATH: &str =
    "gs://aou_results/414k/utils/aou_phenotype_meta_info.ht";

/// Table configuration
#[derive(Debug, Clone)]
struct TableConfig {
    name: &'static str,
    staging_name: &'static str,
    default_path: &'static str,
    ddl_sql: &'static str,
    transform_sql: &'static str,
}

impl TableConfig {
    fn exome_annotations() -> Self {
        Self {
            name: "exome_annotations",
            staging_name: "staging_exome_raw",
            default_path: DEFAULT_EXOME_ANNOTATIONS_PATH,
            ddl_sql: EXOME_ANNOTATIONS_DDL,
            transform_sql: EXOME_ANNOTATIONS_TRANSFORM,
        }
    }

    fn genome_annotations() -> Self {
        Self {
            name: "genome_annotations",
            staging_name: "staging_genome_raw",
            default_path: DEFAULT_GENOME_ANNOTATIONS_PATH,
            ddl_sql: GENOME_ANNOTATIONS_DDL,
            transform_sql: GENOME_ANNOTATIONS_TRANSFORM,
        }
    }

    fn gene_models() -> Self {
        Self {
            name: "gene_models",
            staging_name: "staging_gene_models_raw",
            default_path: DEFAULT_GENE_MODELS_PATH,
            ddl_sql: GENE_MODELS_DDL,
            transform_sql: GENE_MODELS_TRANSFORM,
        }
    }

    fn analysis_metadata() -> Self {
        Self {
            name: "analysis_metadata",
            staging_name: "staging_analysis_metadata_raw",
            default_path: DEFAULT_ANALYSIS_METADATA_PATH,
            ddl_sql: ANALYSIS_METADATA_DDL,
            transform_sql: ANALYSIS_METADATA_TRANSFORM,
        }
    }
}

/// Ingest subcommands
#[derive(Debug, Subcommand)]
pub enum IngestCommand {
    /// Load exome variant annotations
    ExomeAnnotations(IngestArgs),

    /// Load genome variant annotations
    GenomeAnnotations(IngestArgs),

    /// Load gene models
    GeneModels(IngestArgs),

    /// Load analysis metadata (phenotype info)
    AnalysisMetadata(IngestArgs),

    /// Load all tables
    All(IngestArgs),

    /// Show row counts for all managed tables
    Status {
        /// ClickHouse URL
        #[arg(long, default_value = "http://localhost:8123")]
        clickhouse_url: String,
    },
}

/// Common arguments for ingest commands
#[derive(Debug, Args, Clone)]
pub struct IngestArgs {
    /// ClickHouse URL for local operations (DDL, transforms)
    #[arg(long, default_value = "http://localhost:8123")]
    pub clickhouse_url: String,

    /// ClickHouse URL for remote/pool workers (used by hail-decoder export).
    /// If not specified, uses --clickhouse-url.
    /// Example: --remote-clickhouse-url http://10.128.15.247:8123
    #[arg(long)]
    pub remote_clickhouse_url: Option<String>,

    /// Initialization strategy: create, replace, or append
    #[arg(long, default_value = "replace")]
    pub init_strategy: InitStrategy,

    /// Custom Hail table input path (overrides default)
    #[arg(long)]
    pub input: Option<String>,

    /// Row limit for testing
    #[arg(long)]
    pub limit: Option<u64>,

    /// Keep staging table for debugging
    #[arg(long)]
    pub keep_staging: bool,

    /// Path to hail-decoder binary
    #[arg(long, default_value = "hail-decoder")]
    pub hail_decoder: String,

    /// ClickHouse database name
    #[arg(long, default_value = "default")]
    pub database: String,

    /// Submit to a worker pool instead of running locally
    /// Example: --pool heavy
    #[arg(long)]
    pub pool: Option<String>,

    /// Force pool submission (skip confirmation)
    #[arg(long)]
    pub force: bool,

    /// Redeploy binary to pool workers before running
    #[arg(long)]
    pub redeploy_binary: bool,

    /// Batch size for pool workers (partitions per worker assignment)
    #[arg(long)]
    pub batch_size: Option<u32>,
}

/// Initialization strategy for table loading
#[derive(Debug, Clone, Copy, Default, clap::ValueEnum)]
pub enum InitStrategy {
    /// Create table if it doesn't exist, fail if it does
    Create,
    /// Drop and recreate table
    #[default]
    Replace,
    /// Append to existing table
    Append,
}

/// Run the ingest command
pub async fn run_ingest(command: IngestCommand) -> Result<()> {
    match command {
        IngestCommand::ExomeAnnotations(args) => {
            let config = TableConfig::exome_annotations();
            orchestrate_table_load(&config, &args).await?;
        }
        IngestCommand::GenomeAnnotations(args) => {
            let config = TableConfig::genome_annotations();
            orchestrate_table_load(&config, &args).await?;
        }
        IngestCommand::GeneModels(args) => {
            let config = TableConfig::gene_models();
            orchestrate_table_load(&config, &args).await?;
        }
        IngestCommand::AnalysisMetadata(args) => {
            let config = TableConfig::analysis_metadata();
            orchestrate_table_load(&config, &args).await?;
        }
        IngestCommand::All(args) => {
            info!("Loading all tables...");

            let configs = [
                TableConfig::exome_annotations(),
                TableConfig::genome_annotations(),
                TableConfig::gene_models(),
                TableConfig::analysis_metadata(),
            ];

            for config in configs {
                info!("--- Loading {} ---", config.name);
                if let Err(e) = orchestrate_table_load(&config, &args).await {
                    warn!("Failed to load {}: {}", config.name, e);
                }
            }
        }
        IngestCommand::Status { clickhouse_url } => {
            show_status(&clickhouse_url).await?;
        }
    }

    Ok(())
}

/// Orchestrate the full ETL pipeline for a single table
async fn orchestrate_table_load(config: &TableConfig, args: &IngestArgs) -> Result<()> {
    let input_path = args
        .input
        .as_deref()
        .unwrap_or(config.default_path);

    info!(
        "Loading {} from {} -> {}",
        config.name, input_path, args.clickhouse_url
    );

    // Step 1: Prepare target table based on init strategy
    info!("Step 1: Preparing target table '{}'...", config.name);
    prepare_target_table(config, args).await?;

    // Step 2: Drop old staging table if exists
    info!(
        "Step 2: Dropping staging table '{}' if exists...",
        config.staging_name
    );
    execute_clickhouse_sql(
        &args.clickhouse_url,
        &args.database,
        &format!("DROP TABLE IF EXISTS {}", config.staging_name),
    )
    .await?;

    // Step 3: Load raw data to staging via hail-decoder
    info!(
        "Step 3: Loading raw data to staging table '{}'...",
        config.staging_name
    );
    run_hail_decoder_export(config, args, input_path)?;

    // Step 4: Transform staging -> target
    info!("Step 4: Transforming staging -> target...");
    execute_clickhouse_sql(&args.clickhouse_url, &args.database, config.transform_sql).await?;

    // Step 5: Verify row counts
    info!("Step 5: Verifying row counts...");
    let staging_count = get_row_count(&args.clickhouse_url, &args.database, config.staging_name).await?;
    let target_count = get_row_count(&args.clickhouse_url, &args.database, config.name).await?;
    info!(
        "  Staging table '{}': {} rows",
        config.staging_name, staging_count
    );
    info!("  Target table '{}': {} rows", config.name, target_count);

    // Step 6: Drop staging table (unless --keep-staging)
    if args.keep_staging {
        info!(
            "Step 6: Keeping staging table '{}' (--keep-staging)",
            config.staging_name
        );
    } else {
        info!("Step 6: Dropping staging table '{}'...", config.staging_name);
        execute_clickhouse_sql(
            &args.clickhouse_url,
            &args.database,
            &format!("DROP TABLE IF EXISTS {}", config.staging_name),
        )
        .await?;
    }

    info!("Successfully loaded {} ({} rows)", config.name, target_count);
    Ok(())
}

/// Prepare the target table based on init strategy
async fn prepare_target_table(config: &TableConfig, args: &IngestArgs) -> Result<()> {
    match args.init_strategy {
        InitStrategy::Create => {
            // Just run DDL - it has IF NOT EXISTS
            execute_clickhouse_sql(&args.clickhouse_url, &args.database, config.ddl_sql).await?;
        }
        InitStrategy::Replace => {
            // Drop and recreate
            execute_clickhouse_sql(
                &args.clickhouse_url,
                &args.database,
                &format!("DROP TABLE IF EXISTS {}", config.name),
            )
            .await?;
            execute_clickhouse_sql(&args.clickhouse_url, &args.database, config.ddl_sql).await?;
        }
        InitStrategy::Append => {
            // Ensure table exists, don't drop
            execute_clickhouse_sql(&args.clickhouse_url, &args.database, config.ddl_sql).await?;
        }
    }
    Ok(())
}

/// Execute SQL against ClickHouse using curl
/// Handles multi-statement SQL by splitting on semicolons
async fn execute_clickhouse_sql(url: &str, database: &str, sql: &str) -> Result<()> {
    // Split SQL into individual statements
    let statements = split_sql_statements(sql);

    for statement in &statements {
        execute_single_sql(url, database, statement).await?;
    }

    Ok(())
}

/// Split SQL text into individual statements by semicolons
fn split_sql_statements(sql: &str) -> Vec<String> {
    // Simple approach: split on semicolons, filter out empty/comment-only chunks
    sql.split(';')
        .map(|s| s.trim())
        .filter(|s| {
            // Keep non-empty statements that aren't just comments
            !s.is_empty() && !s.lines().all(|line| {
                let trimmed = line.trim();
                trimmed.is_empty() || trimmed.starts_with("--")
            })
        })
        .map(|s| s.to_string())
        .collect()
}

/// Execute a single SQL statement
async fn execute_single_sql(url: &str, database: &str, sql: &str) -> Result<()> {
    let full_url = format!("{}/?database={}", url, database);

    let output = Command::new("curl")
        .arg("-sS")
        .arg("--fail-with-body")
        .arg(&full_url)
        .arg("-d")
        .arg(sql)
        .output()
        .context("Failed to execute curl command")?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        bail!(
            "ClickHouse SQL failed:\nSQL: {}\nstderr: {}\nstdout: {}",
            sql.chars().take(200).collect::<String>(),
            stderr,
            stdout
        );
    }

    Ok(())
}

/// Get row count from a table
async fn get_row_count(url: &str, database: &str, table: &str) -> Result<u64> {
    let full_url = format!("{}/?database={}", url, database);
    let sql = format!("SELECT count() FROM {}", table);

    let output = Command::new("curl")
        .arg("-sS")
        .arg(&full_url)
        .arg("-d")
        .arg(&sql)
        .output()
        .context("Failed to execute curl command")?;

    if !output.status.success() {
        // Table might not exist
        return Ok(0);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    stdout
        .trim()
        .parse()
        .context("Failed to parse row count")
}

/// Run hail-decoder export clickhouse command (locally or via pool)
fn run_hail_decoder_export(config: &TableConfig, args: &IngestArgs, input_path: &str) -> Result<()> {
    let mut cmd = Command::new(&args.hail_decoder);

    // Determine which ClickHouse URL to use for hail-decoder
    // - If pool submission and remote URL specified, use remote URL
    // - Otherwise use the regular clickhouse_url
    let export_clickhouse_url = if args.pool.is_some() {
        args.remote_clickhouse_url
            .as_ref()
            .unwrap_or(&args.clickhouse_url)
    } else {
        &args.clickhouse_url
    };

    if let Some(pool_name) = &args.pool {
        // Submit to worker pool:
        // hail-decoder pool submit <POOL> [--force] [--redeploy-binary] [--batch-size N] -- export clickhouse ...
        cmd.arg("pool").arg("submit").arg(pool_name);

        if args.force {
            cmd.arg("--force");
        }
        if args.redeploy_binary {
            cmd.arg("--redeploy-binary");
        }
        if let Some(batch_size) = args.batch_size {
            cmd.arg("--batch-size").arg(batch_size.to_string());
        }

        // Separator between pool args and the actual command
        cmd.arg("--");
    }

    // The actual export command
    cmd.arg("export")
        .arg("clickhouse")
        .arg(input_path)
        .arg(export_clickhouse_url)
        .arg(config.staging_name);

    // Add optional arguments
    if let Some(limit) = args.limit {
        cmd.arg("--limit").arg(limit.to_string());
    }

    info!("Running: {:?}", cmd);

    let status = cmd.status().context("Failed to run hail-decoder")?;

    if !status.success() {
        bail!("hail-decoder export failed with status: {}", status);
    }

    Ok(())
}

/// Show status of all managed tables
async fn show_status(url: &str) -> Result<()> {
    let database = "default";

    println!("\n=== ClickHouse Table Status ===\n");

    let tables = [
        ("exome_annotations", "Exome variant annotations"),
        ("genome_annotations", "Genome variant annotations"),
        ("gene_models", "Gene models"),
        ("analysis_metadata", "Analysis/phenotype metadata"),
        ("analysis_categories", "Analysis categories (derived)"),
        ("variant_annotations", "Legacy combined annotations"),
    ];

    for (table, description) in tables {
        let count = get_row_count(url, database, table).await.unwrap_or(0);
        let status = if count > 0 {
            format!("{:>12} rows", format_number(count))
        } else {
            "      (empty)".to_string()
        };
        println!("  {:<25} {} - {}", table, status, description);
    }

    println!();
    Ok(())
}

/// Format a number with thousands separators
fn format_number(n: u64) -> String {
    let s = n.to_string();
    let mut result = String::new();
    for (i, c) in s.chars().rev().enumerate() {
        if i > 0 && i % 3 == 0 {
            result.push(',');
        }
        result.push(c);
    }
    result.chars().rev().collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_number() {
        assert_eq!(format_number(1234567890), "1,234,567,890");
        assert_eq!(format_number(1000), "1,000");
        assert_eq!(format_number(100), "100");
        assert_eq!(format_number(0), "0");
    }
}
