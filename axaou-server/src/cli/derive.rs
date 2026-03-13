//! Derived table CLI for computing aggregate/materialized tables from existing ClickHouse data
//!
//! Unlike `ingest` which loads external Hail Tables, `derive` creates tables
//! by running aggregation queries over already-ingested data.

use anyhow::{bail, Context, Result};
use clap::{Args, Subcommand};
use std::process::Command;
use tracing::info;

/// SQL files are embedded at compile time
const TOP_VARIANTS_AGGREGATED_DDL: &str = include_str!("../sql/top_variants_aggregated.sql");
const TOP_VARIANTS_AGGREGATED_POPULATE: &str =
    include_str!("../sql/top_variants_aggregated_populate.sql");
const PHENOTYPE_SUMMARY_DDL: &str = include_str!("../sql/phenotype_summary.sql");
const PHENOTYPE_SUMMARY_POPULATE: &str = include_str!("../sql/phenotype_summary_populate.sql");
const GENE_SUMMARY_DDL: &str = include_str!("../sql/gene_summary.sql");
const GENE_SUMMARY_POPULATE: &str = include_str!("../sql/gene_summary_populate.sql");

/// Configuration for a derived table
#[derive(Debug, Clone)]
struct DerivedTableConfig {
    name: &'static str,
    ddl_sql: &'static str,
    populate_sql: &'static str,
}

impl DerivedTableConfig {
    fn top_variants_aggregated() -> Self {
        Self {
            name: "top_variants_aggregated",
            ddl_sql: TOP_VARIANTS_AGGREGATED_DDL,
            populate_sql: TOP_VARIANTS_AGGREGATED_POPULATE,
        }
    }

    fn phenotype_summary() -> Self {
        Self {
            name: "phenotype_summary",
            ddl_sql: PHENOTYPE_SUMMARY_DDL,
            populate_sql: PHENOTYPE_SUMMARY_POPULATE,
        }
    }

    fn gene_summary() -> Self {
        Self {
            name: "gene_summary",
            ddl_sql: GENE_SUMMARY_DDL,
            populate_sql: GENE_SUMMARY_POPULATE,
        }
    }

    fn all() -> Vec<Self> {
        vec![
            Self::top_variants_aggregated(),
            Self::phenotype_summary(),
            Self::gene_summary(),
        ]
    }
}

/// Derive subcommands
#[derive(Debug, Subcommand)]
pub enum DeriveCommand {
    /// Build the top_variants_aggregated table (variant-level PheWAS summary)
    TopVariantsAggregated(DeriveArgs),

    /// Build the phenotype_summary table (phenotype index with counts)
    PhenotypeSummary(DeriveArgs),

    /// Build the gene_summary table (gene index with counts)
    GeneSummary(DeriveArgs),

    /// Build all derived tables
    All(DeriveArgs),

    /// Show row counts for all derived tables
    Status {
        /// ClickHouse URL
        #[arg(long, default_value = "http://localhost:8123")]
        clickhouse_url: String,
    },
}

/// Common arguments for derive commands
#[derive(Debug, Args, Clone)]
pub struct DeriveArgs {
    /// ClickHouse URL
    #[arg(long, default_value = "http://localhost:8123")]
    pub clickhouse_url: String,

    /// ClickHouse database name
    #[arg(long, default_value = "default")]
    pub database: String,

    /// Drop and recreate the table (default: true)
    #[arg(long, default_value = "true")]
    pub replace: bool,
}

/// Run the derive command
pub async fn run_derive(command: DeriveCommand) -> Result<()> {
    match command {
        DeriveCommand::TopVariantsAggregated(args) => {
            let config = DerivedTableConfig::top_variants_aggregated();
            build_derived_table(&config, &args).await?;
        }
        DeriveCommand::PhenotypeSummary(args) => {
            let config = DerivedTableConfig::phenotype_summary();
            build_derived_table(&config, &args).await?;
        }
        DeriveCommand::GeneSummary(args) => {
            let config = DerivedTableConfig::gene_summary();
            build_derived_table(&config, &args).await?;
        }
        DeriveCommand::All(args) => {
            info!("Building all derived tables...");
            for config in DerivedTableConfig::all() {
                info!("--- Building {} ---", config.name);
                if let Err(e) = build_derived_table(&config, &args).await {
                    tracing::warn!("Failed to build {}: {}", config.name, e);
                }
            }
        }
        DeriveCommand::Status { clickhouse_url } => {
            show_status(&clickhouse_url).await?;
        }
    }
    Ok(())
}

/// Build a single derived table
async fn build_derived_table(config: &DerivedTableConfig, args: &DeriveArgs) -> Result<()> {
    info!("Building derived table '{}'...", config.name);

    // Step 1: Prepare table (drop if replacing)
    if args.replace {
        info!("Step 1: Dropping existing table '{}'...", config.name);
        execute_sql(
            &args.clickhouse_url,
            &args.database,
            &format!("DROP TABLE IF EXISTS {}", config.name),
        )
        .await?;
    }

    // Step 2: Create table
    info!("Step 2: Creating table '{}'...", config.name);
    execute_sql(&args.clickhouse_url, &args.database, config.ddl_sql).await?;

    // Step 3: Populate from source tables
    info!("Step 3: Populating from source tables...");
    execute_sql(&args.clickhouse_url, &args.database, config.populate_sql).await?;

    // Step 4: Verify
    let count = get_row_count(&args.clickhouse_url, &args.database, config.name).await?;
    info!("Built '{}' with {} rows", config.name, count);

    Ok(())
}

/// Show status of all derived tables
async fn show_status(url: &str) -> Result<()> {
    let database = "default";

    println!("\n=== Derived Table Status ===\n");

    for config in DerivedTableConfig::all() {
        let count = get_row_count(url, database, config.name).await.unwrap_or(0);
        let status = if count > 0 {
            format!("{:>12} rows", format_number(count))
        } else {
            "      (empty)".to_string()
        };
        println!("  {:<30} {}", config.name, status);
    }

    println!();
    Ok(())
}

/// Execute SQL against ClickHouse using curl
async fn execute_sql(url: &str, database: &str, sql: &str) -> Result<()> {
    let statements = split_sql_statements(sql);
    for statement in &statements {
        let full_url = format!("{}/?database={}", url, database);
        let output = Command::new("curl")
            .arg("-sS")
            .arg("--fail-with-body")
            .arg(&full_url)
            .arg("-d")
            .arg(statement)
            .output()
            .context("Failed to execute curl command")?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);
            bail!(
                "ClickHouse SQL failed:\nSQL: {}\nstderr: {}\nstdout: {}",
                statement.chars().take(200).collect::<String>(),
                stderr,
                stdout
            );
        }
    }
    Ok(())
}

/// Split SQL text into individual statements
fn split_sql_statements(sql: &str) -> Vec<String> {
    sql.split(';')
        .map(|s| s.trim())
        .filter(|s| {
            !s.is_empty()
                && !s
                    .lines()
                    .all(|line| {
                        let trimmed = line.trim();
                        trimmed.is_empty() || trimmed.starts_with("--")
                    })
        })
        .map(|s| s.to_string())
        .collect()
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
        return Ok(0);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    stdout.trim().parse().context("Failed to parse row count")
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
