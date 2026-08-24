//! Derived table CLI for computing aggregate/materialized tables from existing ClickHouse data
//!
//! Unlike `ingest` which loads external Hail Tables, `derive` creates tables
//! by running aggregation queries over already-ingested data.

use super::ingest::{
    execute_single_sql, get_schema_signature, get_table_stats, query_clickhouse, render_ddl,
    require_exact_stats, validate_identifier,
};
use anyhow::{bail, Context, Result};
use chrono::Utc;
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
const GENE_ASSOCIATIONS_BY_GENE_DDL: &str = include_str!("../sql/gene_associations_by_gene.sql");
const GENE_ASSOCIATIONS_BY_GENE_POPULATE: &str =
    include_str!("../sql/gene_associations_by_gene_populate.sql");

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

    fn gene_associations_by_gene() -> Self {
        Self {
            name: "gene_associations_by_gene",
            ddl_sql: GENE_ASSOCIATIONS_BY_GENE_DDL,
            populate_sql: GENE_ASSOCIATIONS_BY_GENE_POPULATE,
        }
    }

    fn all() -> Vec<Self> {
        vec![
            Self::top_variants_aggregated(),
            Self::phenotype_summary(),
            Self::gene_summary(),
            Self::gene_associations_by_gene(),
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

    /// Build the gene_associations_by_gene table (gene_associations re-sorted by gene_id for fast lookups)
    GeneAssociationsByGene(DeriveArgs),

    /// Build all derived tables
    All(DeriveArgs),

    /// Atomically exchange a validated top-variants candidate with the serving table
    PromoteTopVariants(PromoteTopVariantsArgs),

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

    /// Drop and recreate the table (legacy derived tables only)
    #[arg(long, default_value = "true")]
    pub replace: bool,

    /// Explicit candidate name for top_variants_aggregated
    #[arg(long)]
    pub candidate_name: Option<String>,
}

#[derive(Debug, Args)]
pub struct PromoteTopVariantsArgs {
    /// Validated candidate. After exchange this name retains the old serving data.
    #[arg(long)]
    pub candidate: String,

    /// ClickHouse URL
    #[arg(long, default_value = "http://localhost:8123")]
    pub clickhouse_url: String,

    /// ClickHouse database
    #[arg(long, default_value = "default")]
    pub database: String,

    /// Required explicit acknowledgement that this changes a serving table name
    #[arg(long)]
    pub approved: bool,
}

/// Run the derive command
pub async fn run_derive(command: DeriveCommand) -> Result<()> {
    match command {
        DeriveCommand::TopVariantsAggregated(args) => {
            build_top_variants_candidate(&args).await?;
        }
        DeriveCommand::PhenotypeSummary(args) => {
            let config = DerivedTableConfig::phenotype_summary();
            build_derived_table(&config, &args).await?;
        }
        DeriveCommand::GeneSummary(args) => {
            let config = DerivedTableConfig::gene_summary();
            build_derived_table(&config, &args).await?;
        }
        DeriveCommand::GeneAssociationsByGene(args) => {
            let config = DerivedTableConfig::gene_associations_by_gene();
            build_derived_table(&config, &args).await?;
        }
        DeriveCommand::All(args) => {
            bail!("derive all is disabled because top_variants_aggregated requires candidate publication; run each derived table explicitly");
        }
        DeriveCommand::PromoteTopVariants(args) => {
            promote_top_variants_candidate(&args).await?;
        }
        DeriveCommand::Status { clickhouse_url } => {
            show_status(&clickhouse_url).await?;
        }
    }
    Ok(())
}

const TOP_VARIANTS_SERVING: &str = "top_variants_aggregated";

async fn build_top_variants_candidate(args: &DeriveArgs) -> Result<()> {
    if !args.replace {
        bail!("top-variants candidate builds do not support append mode");
    }
    let candidate = args.candidate_name.clone().unwrap_or_else(|| {
        format!(
            "{}_candidate_{}",
            TOP_VARIANTS_SERVING,
            Utc::now().format("%Y%m%dT%H%M%SZ")
        )
    });
    validate_top_variants_candidate(&candidate)?;
    ensure_derived_table_absent(&args.clickhouse_url, &args.database, &candidate).await?;

    let expected_rows = expected_top_variants_rows(&args.clickhouse_url, &args.database).await?;
    if expected_rows == 0 {
        bail!("significant_variants produced zero expected top-variant groups");
    }

    let ddl = render_ddl(
        TOP_VARIANTS_AGGREGATED_DDL,
        TOP_VARIANTS_SERVING,
        &candidate,
    )?;
    execute_sql(&args.clickhouse_url, &args.database, &ddl).await?;
    let populate = render_top_variants_populate(&candidate)?;
    execute_sql(&args.clickhouse_url, &args.database, &populate).await?;

    let stats = get_table_stats(
        &args.clickhouse_url,
        &args.database,
        &candidate,
        "tuple(xpos, ref, alt, ancestry)",
    )
    .await?;
    require_exact_stats("top-variants candidate", stats, expected_rows)?;
    validate_top_variants_nod2(&args.clickhouse_url, &args.database, &candidate).await?;

    let executable = std::env::current_exe()
        .map(|path| path.display().to_string())
        .unwrap_or_else(|_| "axaou-server".to_string());
    println!("\nTop-variants candidate validated; serving table was not changed.");
    println!(
        "  candidate: {} ({} exact unique rows)",
        candidate, stats.rows
    );
    println!("  serving:   {} (untouched)", TOP_VARIANTS_SERVING);
    println!("\nPromotion command (requires a fresh operator gate):");
    println!(
        "  {executable} derive promote-top-variants --candidate {} --clickhouse-url {} --database {} --approved",
        candidate, args.clickhouse_url, args.database
    );
    println!("Rollback after promotion uses the same atomic exchange:");
    println!(
        "  curl -sS --fail-with-body '{}/?database={}' --data-binary 'EXCHANGE TABLES {} AND {}'",
        args.clickhouse_url, args.database, TOP_VARIANTS_SERVING, candidate
    );
    Ok(())
}

async fn promote_top_variants_candidate(args: &PromoteTopVariantsArgs) -> Result<()> {
    if !args.approved {
        bail!("refusing promotion without --approved from the immediate operator gate");
    }
    validate_top_variants_candidate(&args.candidate)?;
    let expected_rows = expected_top_variants_rows(&args.clickhouse_url, &args.database).await?;
    let stats = get_table_stats(
        &args.clickhouse_url,
        &args.database,
        &args.candidate,
        "tuple(xpos, ref, alt, ancestry)",
    )
    .await?;
    require_exact_stats("top-variants promotion candidate", stats, expected_rows)?;
    validate_top_variants_nod2(&args.clickhouse_url, &args.database, &args.candidate).await?;

    let serving_schema =
        get_schema_signature(&args.clickhouse_url, &args.database, TOP_VARIANTS_SERVING).await?;
    let candidate_schema =
        get_schema_signature(&args.clickhouse_url, &args.database, &args.candidate).await?;
    if serving_schema != candidate_schema {
        bail!("candidate and serving schemas differ; refusing atomic exchange");
    }

    let active_writers: u64 = query_clickhouse(
        &args.clickhouse_url,
        &args.database,
        "SELECT count() FROM system.processes WHERE query_kind IN ('Insert', 'Alter', 'Create', 'Drop', 'Rename')",
    )
    .await?
    .trim()
    .parse()
    .context("failed to parse active-writer count")?;
    if active_writers != 0 {
        bail!("{active_writers} active ClickHouse writer(s); refusing promotion");
    }

    let exchange = format!(
        "EXCHANGE TABLES {} AND {}",
        TOP_VARIANTS_SERVING, args.candidate
    );
    execute_single_sql(&args.clickhouse_url, &args.database, &exchange).await?;
    let promoted = get_table_stats(
        &args.clickhouse_url,
        &args.database,
        TOP_VARIANTS_SERVING,
        "tuple(xpos, ref, alt, ancestry)",
    )
    .await?;
    require_exact_stats("promoted top-variants table", promoted, expected_rows)?;
    validate_top_variants_nod2(&args.clickhouse_url, &args.database, TOP_VARIANTS_SERVING).await?;

    println!("Atomic top-variants promotion complete.");
    println!("  serving: {} (new data)", TOP_VARIANTS_SERVING);
    println!(
        "  rollback: {} (old serving data; preserved)",
        args.candidate
    );
    println!("  rollback SQL: {}", exchange);
    Ok(())
}

fn validate_top_variants_candidate(candidate: &str) -> Result<()> {
    validate_identifier(candidate)?;
    let prefix = format!("{TOP_VARIANTS_SERVING}_candidate_");
    if !candidate.starts_with(&prefix) {
        bail!("candidate must start with {prefix}");
    }
    Ok(())
}

fn render_top_variants_populate(candidate: &str) -> Result<String> {
    let needle = format!("INSERT INTO {TOP_VARIANTS_SERVING}");
    if TOP_VARIANTS_AGGREGATED_POPULATE.matches(&needle).count() != 1 {
        bail!("top-variants populate SQL has an ambiguous target");
    }
    Ok(TOP_VARIANTS_AGGREGATED_POPULATE.replacen(&needle, &format!("INSERT INTO {candidate}"), 1))
}

async fn ensure_derived_table_absent(url: &str, database: &str, table: &str) -> Result<()> {
    let exists: u64 = query_clickhouse(
        url,
        database,
        &format!(
            "SELECT count() FROM system.tables WHERE database = currentDatabase() AND name = '{table}'"
        ),
    )
    .await?
    .trim()
    .parse()
    .context("failed to parse table-existence check")?;
    if exists != 0 {
        bail!("table {database}.{table} already exists; candidate builds never replace it");
    }
    Ok(())
}

async fn expected_top_variants_rows(url: &str, database: &str) -> Result<u64> {
    query_clickhouse(
        url,
        database,
        "SELECT count() FROM (SELECT xpos, contig, position, ref, alt, ancestry FROM significant_variants WHERE ancestry = 'meta' GROUP BY xpos, contig, position, ref, alt, ancestry)",
    )
    .await?
    .trim()
    .parse()
    .context("failed to parse expected top-variants row count")
}

async fn validate_top_variants_nod2(url: &str, database: &str, table: &str) -> Result<()> {
    validate_identifier(table)?;
    let output = query_clickhouse(
        url,
        database,
        &format!(
            "SELECT count(), countIf(ifNull(gene_symbol, '') = 'NOD2' AND ifNull(consequence, '') = 'synonymous_variant') FROM {table} WHERE xpos = 16050711288 AND ref = 'C' AND alt = 'T' FORMAT TabSeparated"
        ),
    )
    .await?;
    let (rows, correct) = output
        .trim()
        .split_once('\t')
        .context("invalid top-variants NOD2 validation output")?;
    let rows: u64 = rows.parse()?;
    let correct: u64 = correct.parse()?;
    if rows == 0 || rows != correct {
        bail!("top-variants NOD2 regression mismatch: rows={rows}, correct={correct}");
    }
    Ok(())
}

/// Build a single legacy derived table
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
                && !s.lines().all(|line| {
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

#[cfg(test)]
mod tests {
    use super::{
        render_top_variants_populate, validate_top_variants_candidate,
        GENE_ASSOCIATIONS_BY_GENE_DDL, GENE_ASSOCIATIONS_BY_GENE_POPULATE,
    };

    #[test]
    fn top_variants_candidate_rendering_never_targets_serving_table() {
        let sql = render_top_variants_populate("top_variants_aggregated_candidate_test").unwrap();
        assert!(sql.contains("INSERT INTO top_variants_aggregated_candidate_test"));
        assert!(!sql.contains("INSERT INTO top_variants_aggregated\n"));
        assert!(validate_top_variants_candidate("top_variants_aggregated_candidate_test").is_ok());
        assert!(validate_top_variants_candidate("top_variants_aggregated").is_err());
        assert!(validate_top_variants_candidate("gene_models_candidate_test").is_err());
    }

    #[test]
    fn by_gene_schema_and_population_include_split_mac_explicitly() {
        assert!(GENE_ASSOCIATIONS_BY_GENE_DDL.contains("mac_case Nullable(Int64)"));
        assert!(GENE_ASSOCIATIONS_BY_GENE_DDL.contains("mac_control Nullable(Int64)"));
        assert!(GENE_ASSOCIATIONS_BY_GENE_POPULATE.contains("mac_case"));
        assert!(GENE_ASSOCIATIONS_BY_GENE_POPULATE.contains("mac_control"));
        assert!(!GENE_ASSOCIATIONS_BY_GENE_POPULATE.contains("SELECT *"));
    }
}
