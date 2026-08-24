//! Data ingestion CLI for loading Hail Tables into ClickHouse
//!
//! Annotation reloads are fail-closed and publication-safe:
//! 1. Inspect exact immutable source identity/count
//! 2. Export raw rows into a uniquely named candidate staging table
//! 3. Require an exact zero-failure terminal summary and key parity
//! 4. Transform and validate an isolated candidate table
//! 5. Promote only through a separate, explicitly approved atomic exchange

use anyhow::{bail, Context, Result};
use chrono::Utc;
use clap::{Args, Subcommand};
use serde::Deserialize;
use std::collections::BTreeMap;
use std::process::Command;
use tracing::info;

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
    annotation: bool,
}

impl TableConfig {
    fn exome_annotations() -> Self {
        Self {
            name: "exome_annotations",
            staging_name: "staging_exome_raw",
            default_path: DEFAULT_EXOME_ANNOTATIONS_PATH,
            ddl_sql: EXOME_ANNOTATIONS_DDL,
            transform_sql: EXOME_ANNOTATIONS_TRANSFORM,
            annotation: true,
        }
    }

    fn genome_annotations() -> Self {
        Self {
            name: "genome_annotations",
            staging_name: "staging_genome_raw",
            default_path: DEFAULT_GENOME_ANNOTATIONS_PATH,
            ddl_sql: GENOME_ANNOTATIONS_DDL,
            transform_sql: GENOME_ANNOTATIONS_TRANSFORM,
            annotation: true,
        }
    }

    fn gene_models() -> Self {
        Self {
            name: "gene_models",
            staging_name: "staging_gene_models_raw",
            default_path: DEFAULT_GENE_MODELS_PATH,
            ddl_sql: GENE_MODELS_DDL,
            transform_sql: GENE_MODELS_TRANSFORM,
            annotation: false,
        }
    }

    fn analysis_metadata() -> Self {
        Self {
            name: "analysis_metadata",
            staging_name: "staging_analysis_metadata_raw",
            default_path: DEFAULT_ANALYSIS_METADATA_PATH,
            ddl_sql: ANALYSIS_METADATA_DDL,
            transform_sql: ANALYSIS_METADATA_TRANSFORM,
            annotation: false,
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

    /// Atomically exchange a validated annotation candidate with its serving table
    PromoteAnnotation(PromoteAnnotationArgs),

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

    /// Path to genohype binary (for distributed pool operations)
    #[arg(long, default_value = "genohype")]
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

    /// Explicit candidate table name. Annotation loads never write the serving table.
    /// Defaults to <serving>_candidate_<UTC timestamp>.
    #[arg(long)]
    pub candidate_name: Option<String>,
}

#[derive(Debug, Clone, Copy, clap::ValueEnum)]
pub enum AnnotationTable {
    Exome,
    Genome,
}

#[derive(Debug, Args)]
pub struct PromoteAnnotationArgs {
    /// Serving annotation table to promote
    #[arg(long, value_enum)]
    pub table: AnnotationTable,

    /// Validated candidate table. After exchange this name retains the old serving data.
    #[arg(long)]
    pub candidate: String,

    /// ClickHouse URL
    #[arg(long, default_value = "http://localhost:8123")]
    pub clickhouse_url: String,

    /// ClickHouse database
    #[arg(long, default_value = "default")]
    pub database: String,

    /// Override the managed Hail source path
    #[arg(long)]
    pub input: Option<String>,

    /// Path to the exact genohype binary used to inspect source identity/count
    #[arg(long, default_value = "genohype")]
    pub hail_decoder: String,

    /// Required explicit acknowledgement that this command changes a serving table name
    #[arg(long)]
    pub approved: bool,
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
                // Fail closed: a failed export or validation stops the sequence.
                orchestrate_table_load(&config, &args).await?;
            }
        }
        IngestCommand::PromoteAnnotation(args) => {
            promote_annotation_candidate(&args).await?;
        }
        IngestCommand::Status { clickhouse_url } => {
            show_status(&clickhouse_url).await?;
        }
    }

    Ok(())
}

/// Orchestrate the full ETL pipeline for a single table
async fn orchestrate_table_load(config: &TableConfig, args: &IngestArgs) -> Result<()> {
    if config.annotation {
        return orchestrate_annotation_candidate_load(config, args).await;
    }

    orchestrate_legacy_table_load(config, args).await
}

/// Legacy path retained for small non-annotation tables. Annotation reloads use the
/// fail-closed candidate path and can never destructively prepare a serving target.
async fn orchestrate_legacy_table_load(config: &TableConfig, args: &IngestArgs) -> Result<()> {
    let input_path = args.input.as_deref().unwrap_or(config.default_path);

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
    run_hail_decoder_export(config, args, input_path, config.staging_name)?;

    // Step 4: Transform staging -> target
    info!("Step 4: Transforming staging -> target...");
    execute_clickhouse_sql(&args.clickhouse_url, &args.database, config.transform_sql).await?;

    // Step 5: Verify row counts
    info!("Step 5: Verifying row counts...");
    let staging_count =
        get_row_count(&args.clickhouse_url, &args.database, config.staging_name).await?;
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
        info!(
            "Step 6: Dropping staging table '{}'...",
            config.staging_name
        );
        execute_clickhouse_sql(
            &args.clickhouse_url,
            &args.database,
            &format!("DROP TABLE IF EXISTS {}", config.staging_name),
        )
        .await?;
    }

    info!(
        "Successfully loaded {} ({} rows)",
        config.name, target_count
    );
    Ok(())
}

#[derive(Debug, Deserialize)]
struct SourceInfo {
    path: String,
    format: String,
    key_fields: Vec<String>,
    partitions: u64,
    total_rows: u64,
    #[serde(default)]
    file_version: Option<u64>,
    #[serde(default)]
    hail_version: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct TerminalSummary {
    total_partitions: u64,
    failed_partitions: u64,
    total_rows: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) struct TableStats {
    pub(super) rows: u64,
    pub(super) unique_keys: u64,
}

/// Build and validate an isolated annotation candidate. This path intentionally has no
/// promotion flag: an operator must inspect the receipt and invoke `promote-annotation`
/// as a separate, explicit action immediately before changing a serving table name.
async fn orchestrate_annotation_candidate_load(
    config: &TableConfig,
    args: &IngestArgs,
) -> Result<()> {
    if args.pool.is_none() {
        bail!(
            "full annotation candidate loads require --pool so an exact partition terminal summary is available"
        );
    }
    if !matches!(args.init_strategy, InitStrategy::Replace) {
        bail!("annotation candidates do not support create/append strategies");
    }

    let input_path = args.input.as_deref().unwrap_or(config.default_path);
    // Source identity/count is established before the first DDL statement.
    let source = inspect_source(&args.hail_decoder, input_path)?;
    validate_source_info(&source, input_path)?;

    let candidate = args.candidate_name.clone().unwrap_or_else(|| {
        format!(
            "{}_candidate_{}",
            config.name,
            Utc::now().format("%Y%m%dT%H%M%SZ")
        )
    });
    validate_candidate_name(config.name, &candidate)?;
    let staging = format!("{}_raw", candidate);
    validate_identifier(&staging)?;

    ensure_table_absent(&args.clickhouse_url, &args.database, &candidate).await?;
    ensure_table_absent(&args.clickhouse_url, &args.database, &staging).await?;

    info!(
        source_path = %source.path,
        source_format = %source.format,
        source_partitions = source.partitions,
        source_rows = source.total_rows,
        source_file_version = ?source.file_version,
        source_hail_version = ?source.hail_version,
        candidate = %candidate,
        staging = %staging,
        "annotation candidate source receipt"
    );

    let candidate_ddl = render_ddl(config.ddl_sql, config.name, &candidate)?;
    execute_clickhouse_sql(&args.clickhouse_url, &args.database, &candidate_ddl).await?;

    let summary = run_hail_decoder_export(config, args, input_path, &staging)?
        .context("pool export completed without an exact terminal summary")?;
    if summary.failed_partitions != 0
        || summary.total_partitions != source.partitions
        || summary.total_rows != source.total_rows
    {
        bail!(
            "export terminal summary does not match source: summary={summary:?}, source_partitions={}, source_rows={}",
            source.partitions,
            source.total_rows
        );
    }

    let raw_stats = get_table_stats(
        &args.clickhouse_url,
        &args.database,
        &staging,
        "tuple(locus.contig, locus.position, alleles[1], alleles[2])",
    )
    .await?;
    require_exact_stats("raw candidate", raw_stats, source.total_rows)?;

    let transform = render_transform(
        config.transform_sql,
        config.name,
        config.staging_name,
        &candidate,
        &staging,
    )?;
    execute_clickhouse_sql(&args.clickhouse_url, &args.database, &transform).await?;

    let candidate_stats = get_table_stats(
        &args.clickhouse_url,
        &args.database,
        &candidate,
        "tuple(xpos, ref, alt)",
    )
    .await?;
    require_exact_stats("transformed candidate", candidate_stats, source.total_rows)?;

    let raw_contigs = get_contig_counts(
        &args.clickhouse_url,
        &args.database,
        &staging,
        "locus.contig",
    )
    .await?;
    let candidate_contigs =
        get_contig_counts(&args.clickhouse_url, &args.database, &candidate, "contig").await?;
    if raw_contigs != candidate_contigs {
        bail!("candidate chromosome strata differ from the exact raw export");
    }

    let raw_null_strata = query_clickhouse(
        &args.clickhouse_url,
        &args.database,
        &format!(
            "SELECT countIf(isNull(vep)), countIf(isNull(vep.most_severe_consequence)), countIf(isNull(most_severe_csq_variant)), countIf(empty(vep.transcript_consequences)) FROM {staging} FORMAT TabSeparated"
        ),
    )
    .await?;
    let candidate_null_strata = query_clickhouse(
        &args.clickhouse_url,
        &args.database,
        &format!(
            "SELECT countIf(isNull(consequence)), countIf(isNull(gene_symbol) OR ifNull(gene_symbol, '') = ''), countIf(isNull(hgvsc) OR ifNull(hgvsc, '') = ''), countIf(isNull(hgvsp) OR ifNull(hgvsp, '') = '') FROM {candidate} FORMAT TabSeparated"
        ),
    )
    .await?;
    info!(
        candidate = %candidate,
        raw_source_strata = %raw_null_strata.trim(),
        transformed_strata = %candidate_null_strata.trim(),
        "annotation source/null-field strata receipt"
    );

    if config.name == "exome_annotations" {
        validate_nod2_regression(&args.clickhouse_url, &args.database, &candidate).await?;
    }

    let executable = std::env::current_exe()
        .map(|path| path.display().to_string())
        .unwrap_or_else(|_| "axaou-server".to_string());
    println!("\nCandidate validated; serving table was not changed.");
    println!("  source:     {}", source.path);
    println!(
        "  candidate:  {} ({} exact unique rows)",
        candidate, candidate_stats.rows
    );
    println!(
        "  staging:    {} (preserved for publication receipt)",
        staging
    );
    println!("  serving:    {} (untouched)", config.name);
    println!("\nPromotion command (requires a fresh operator gate):");
    println!(
        "  {executable} ingest promote-annotation --table {} --candidate {} --clickhouse-url {} --database {} --hail-decoder {} --approved",
        if config.name == "exome_annotations" { "exome" } else { "genome" },
        candidate,
        args.clickhouse_url,
        args.database,
        args.hail_decoder
    );
    println!("Rollback after promotion uses the same atomic exchange:");
    println!(
        "  curl -sS --fail-with-body '{}/?database={}' --data-binary 'EXCHANGE TABLES {} AND {}'",
        args.clickhouse_url, args.database, config.name, candidate
    );

    Ok(())
}

async fn promote_annotation_candidate(args: &PromoteAnnotationArgs) -> Result<()> {
    if !args.approved {
        bail!("refusing promotion without --approved from the immediate operator gate");
    }
    let config = match args.table {
        AnnotationTable::Exome => TableConfig::exome_annotations(),
        AnnotationTable::Genome => TableConfig::genome_annotations(),
    };
    validate_candidate_name(config.name, &args.candidate)?;

    let input_path = args.input.as_deref().unwrap_or(config.default_path);
    let source = inspect_source(&args.hail_decoder, input_path)?;
    validate_source_info(&source, input_path)?;

    let candidate_stats = get_table_stats(
        &args.clickhouse_url,
        &args.database,
        &args.candidate,
        "tuple(xpos, ref, alt)",
    )
    .await?;
    require_exact_stats("promotion candidate", candidate_stats, source.total_rows)?;

    let serving_schema =
        get_schema_signature(&args.clickhouse_url, &args.database, config.name).await?;
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

    let active_mutations: u64 = query_clickhouse(
        &args.clickhouse_url,
        &args.database,
        "SELECT count() FROM system.mutations WHERE NOT is_done",
    )
    .await?
    .trim()
    .parse()
    .context("failed to parse active-mutation count")?;
    if active_mutations != 0 {
        bail!("{active_mutations} active ClickHouse mutation(s); refusing promotion");
    }

    let exchange = format!("EXCHANGE TABLES {} AND {}", config.name, args.candidate);
    info!(
        serving = config.name,
        candidate = %args.candidate,
        rollback_sql = %exchange,
        "executing approved atomic annotation promotion"
    );
    execute_single_sql(&args.clickhouse_url, &args.database, &exchange).await?;

    let promoted_stats = get_table_stats(
        &args.clickhouse_url,
        &args.database,
        config.name,
        "tuple(xpos, ref, alt)",
    )
    .await?;
    require_exact_stats("promoted serving table", promoted_stats, source.total_rows)?;
    if config.name == "exome_annotations" {
        validate_nod2_regression(&args.clickhouse_url, &args.database, config.name).await?;
    }

    println!("Atomic promotion complete.");
    println!("  serving: {} (new candidate data)", config.name);
    println!(
        "  rollback: {} (old serving data; preserved)",
        args.candidate
    );
    println!("  rollback SQL: {}", exchange);
    Ok(())
}

fn inspect_source(binary: &str, input_path: &str) -> Result<SourceInfo> {
    let output = Command::new(binary)
        .arg("info")
        .arg(input_path)
        .arg("--json")
        .output()
        .with_context(|| format!("failed to run {binary} info --json"))?;
    if !output.status.success() {
        bail!(
            "genohype info failed with {}: {}",
            output.status,
            String::from_utf8_lossy(&output.stderr)
        );
    }
    serde_json::from_slice(&output.stdout).context("failed to parse genohype info --json")
}

fn validate_source_info(source: &SourceInfo, requested_path: &str) -> Result<()> {
    if source.path != requested_path {
        bail!(
            "genohype source path mismatch: requested {requested_path}, got {}",
            source.path
        );
    }
    if source.format != "hail_table" {
        bail!("expected hail_table source, got {}", source.format);
    }
    if source.key_fields != ["locus", "alleles"] {
        bail!("unexpected source keys: {:?}", source.key_fields);
    }
    if source.partitions == 0 || source.total_rows == 0 {
        bail!("source metadata has zero partitions or rows");
    }
    Ok(())
}

pub(super) fn validate_identifier(identifier: &str) -> Result<()> {
    let mut chars = identifier.chars();
    let first = chars.next().context("empty ClickHouse identifier")?;
    if !(first.is_ascii_alphabetic() || first == '_')
        || !chars.all(|c| c.is_ascii_alphanumeric() || c == '_')
    {
        bail!("unsafe ClickHouse identifier: {identifier}");
    }
    Ok(())
}

fn validate_candidate_name(serving: &str, candidate: &str) -> Result<()> {
    validate_identifier(candidate)?;
    let prefix = format!("{serving}_candidate_");
    if !candidate.starts_with(&prefix) {
        bail!("candidate must start with {prefix}");
    }
    Ok(())
}

pub(super) fn render_ddl(ddl: &str, serving: &str, candidate: &str) -> Result<String> {
    let needle = format!("CREATE TABLE IF NOT EXISTS {serving}");
    if ddl.matches(&needle).count() != 1 {
        bail!("managed DDL does not contain exactly one serving-table declaration");
    }
    Ok(ddl.replacen(&needle, &format!("CREATE TABLE {candidate}"), 1))
}

fn render_transform(
    transform: &str,
    serving: &str,
    managed_staging: &str,
    candidate: &str,
    candidate_staging: &str,
) -> Result<String> {
    let insert = format!("INSERT INTO {serving}");
    let source = format!("FROM {managed_staging}");
    if transform.matches(&insert).count() != 1 || transform.matches(&source).count() != 1 {
        bail!("managed transform does not have one exact target and staging source");
    }
    Ok(transform
        .replacen(&insert, &format!("INSERT INTO {candidate}"), 1)
        .replacen(&source, &format!("FROM {candidate_staging}"), 1))
}

async fn ensure_table_absent(url: &str, database: &str, table: &str) -> Result<()> {
    validate_identifier(table)?;
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
        bail!("table {database}.{table} already exists; candidate loads never replace it");
    }
    Ok(())
}

pub(super) async fn get_table_stats(
    url: &str,
    database: &str,
    table: &str,
    key_expression: &str,
) -> Result<TableStats> {
    validate_identifier(table)?;
    let output = query_clickhouse(
        url,
        database,
        &format!("SELECT count(), uniqExact({key_expression}) FROM {table} FORMAT TabSeparated"),
    )
    .await?;
    let mut fields = output.trim().split('\t');
    let rows = fields
        .next()
        .context("missing row count")?
        .parse()
        .context("invalid row count")?;
    let unique_keys = fields
        .next()
        .context("missing unique-key count")?
        .parse()
        .context("invalid unique-key count")?;
    if fields.next().is_some() {
        bail!("unexpected table-stat fields: {output}");
    }
    Ok(TableStats { rows, unique_keys })
}

pub(super) fn require_exact_stats(
    label: &str,
    stats: TableStats,
    expected_rows: u64,
) -> Result<()> {
    if stats.rows != expected_rows || stats.unique_keys != expected_rows {
        bail!(
            "{label} validation failed: rows={}, unique_keys={}, expected={expected_rows}",
            stats.rows,
            stats.unique_keys
        );
    }
    Ok(())
}

async fn get_contig_counts(
    url: &str,
    database: &str,
    table: &str,
    contig_expression: &str,
) -> Result<BTreeMap<String, u64>> {
    validate_identifier(table)?;
    let output = query_clickhouse(
        url,
        database,
        &format!(
            "SELECT {contig_expression}, count() FROM {table} GROUP BY {contig_expression} ORDER BY {contig_expression} FORMAT TabSeparated"
        ),
    )
    .await?;
    output
        .lines()
        .map(|line| {
            let (contig, count) = line
                .split_once('\t')
                .with_context(|| format!("invalid contig stratum: {line}"))?;
            Ok((contig.to_string(), count.parse()?))
        })
        .collect()
}

pub(super) async fn get_schema_signature(url: &str, database: &str, table: &str) -> Result<String> {
    validate_identifier(table)?;
    query_clickhouse(
        url,
        database,
        &format!(
            "SELECT groupArray(concat(name, ':', type)) FROM (SELECT name, type FROM system.columns WHERE database = currentDatabase() AND table = '{table}' ORDER BY position) FORMAT TabSeparated"
        ),
    )
    .await
}

async fn validate_nod2_regression(url: &str, database: &str, table: &str) -> Result<()> {
    validate_identifier(table)?;
    let output = query_clickhouse(
        url,
        database,
        &format!(
            "SELECT ifNull(consequence, ''), ifNull(gene_symbol, ''), ifNull(hgvsc, ''), ifNull(hgvsp, '') FROM {table} WHERE xpos = 16050711288 AND ref = 'C' AND alt = 'T' FORMAT TabSeparated"
        ),
    )
    .await?;
    let rows: Vec<_> = output.lines().collect();
    if rows.len() != 1 {
        bail!(
            "NOD2 regression key returned {} rows, expected one",
            rows.len()
        );
    }
    let fields: Vec<_> = rows[0].split('\t').collect();
    if fields.len() != 4
        || fields[0] != "synonymous_variant"
        || fields[1] != "NOD2"
        || fields[2].is_empty()
        || fields[3].is_empty()
    {
        bail!("NOD2 regression mismatch: {}", rows[0]);
    }
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
            !s.is_empty()
                && !s.lines().all(|line| {
                    let trimmed = line.trim();
                    trimmed.is_empty() || trimmed.starts_with("--")
                })
        })
        .map(|s| s.to_string())
        .collect()
}

/// Execute a single SQL statement
pub(super) async fn execute_single_sql(url: &str, database: &str, sql: &str) -> Result<()> {
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

pub(super) async fn query_clickhouse(url: &str, database: &str, sql: &str) -> Result<String> {
    let full_url = format!("{}/?database={}", url, database);
    let output = Command::new("curl")
        .arg("-sS")
        .arg("--fail-with-body")
        .arg(&full_url)
        .arg("--data-binary")
        .arg(sql)
        .output()
        .context("failed to execute ClickHouse query")?;
    if !output.status.success() {
        bail!(
            "ClickHouse query failed:\nSQL: {}\nstderr: {}\nstdout: {}",
            sql.chars().take(300).collect::<String>(),
            String::from_utf8_lossy(&output.stderr),
            String::from_utf8_lossy(&output.stdout)
        );
    }
    String::from_utf8(output.stdout).context("ClickHouse returned non-UTF8 output")
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
    stdout.trim().parse().context("Failed to parse row count")
}

/// Run genohype export clickhouse. Every nonzero exit fails closed. Pool exports must
/// also expose one exact terminal summary and a coordinator completion marker.
fn run_hail_decoder_export(
    _config: &TableConfig,
    args: &IngestArgs,
    input_path: &str,
    staging_table: &str,
) -> Result<Option<TerminalSummary>> {
    validate_identifier(staging_table)?;
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
        .arg(staging_table);

    // Add optional arguments
    if let Some(limit) = args.limit {
        cmd.arg("--limit").arg(limit.to_string());
    }

    info!("Running: {:?}", cmd);

    let output = cmd.output().context("failed to run genohype export")?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    print!("{stdout}");
    eprint!("{stderr}");
    let combined = format!("{stdout}\n{stderr}");
    let summary = parse_terminal_summary(&combined)?;

    if !output.status.success() {
        bail!(
            "genohype export failed closed with status {} (terminal summary: {:?})",
            output.status,
            summary
        );
    }

    if args.pool.is_some() {
        let summary = summary.context("successful pool export omitted exact terminal summary")?;
        if summary.failed_partitions != 0 {
            bail!("pool export reported failed partitions: {summary:?}");
        }
        if !combined.contains("Job complete. Coordinator returning to idle mode") {
            bail!("pool export omitted exact coordinator completion marker");
        }
        return Ok(Some(summary));
    }

    Ok(summary)
}

fn parse_terminal_summary(output: &str) -> Result<Option<TerminalSummary>> {
    let mut summaries = Vec::new();
    for line in output.lines() {
        if let Some(start) = line.find("All ") {
            let text = &line[start + 4..];
            if let Some((partitions, rows)) = text.split_once(" partitions completed! Total rows: ")
            {
                summaries.push(TerminalSummary {
                    total_partitions: partitions
                        .trim()
                        .parse()
                        .context("invalid completed partition count")?,
                    failed_partitions: 0,
                    total_rows: rows.trim().parse().context("invalid completed row count")?,
                });
            }
        }
        if let Some(start) = line.find("Job finished with ") {
            let text = &line[start + "Job finished with ".len()..];
            if let Some((failed, remainder)) = text.split_once(" failed partitions out of ") {
                if let Some((partitions, rows)) = remainder.split_once(". Total rows: ") {
                    summaries.push(TerminalSummary {
                        total_partitions: partitions
                            .trim()
                            .parse()
                            .context("invalid terminal partition count")?,
                        failed_partitions: failed
                            .trim()
                            .parse()
                            .context("invalid failed partition count")?,
                        total_rows: rows.trim().parse().context("invalid terminal row count")?,
                    });
                }
            }
        }
    }

    match summaries.as_slice() {
        [] => Ok(None),
        [summary] => Ok(Some(*summary)),
        _ => bail!(
            "ambiguous export output contained {} terminal summaries",
            summaries.len()
        ),
    }
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
        (
            "top_variants_aggregated",
            "Aggregated top variants (derived)",
        ),
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

    #[derive(Debug, Deserialize)]
    struct SelectionFixture {
        name: String,
        vep_consequence: Option<String>,
        top_level_consequence: Option<String>,
        transcripts: Vec<TranscriptFixture>,
        expected_transcript: Option<String>,
        expected_consequence: Option<String>,
    }

    #[derive(Debug, Deserialize)]
    struct TranscriptFixture {
        id: String,
        canonical: bool,
        mane: bool,
        consequences: Vec<String>,
        gene_symbol: Option<String>,
    }

    fn select_transcript<'a>(
        transcripts: &'a [TranscriptFixture],
        selected_consequence: Option<&str>,
    ) -> Option<&'a TranscriptFixture> {
        let matches_consequence = |transcript: &&TranscriptFixture| {
            selected_consequence
                .map(|value| transcript.consequences.iter().any(|term| term == value))
                .unwrap_or(false)
        };
        transcripts
            .iter()
            .find(|transcript| transcript.canonical && matches_consequence(transcript))
            .or_else(|| transcripts.iter().find(|transcript| transcript.canonical))
            .or_else(|| transcripts.iter().find(matches_consequence))
            .or_else(|| transcripts.first())
    }

    #[test]
    fn annotation_selection_fixtures_cover_all_priority_and_null_fallbacks() {
        let fixtures: Vec<SelectionFixture> = serde_json::from_str(include_str!(
            "../../tests/fixtures/annotation_transcript_selection.json"
        ))
        .unwrap();
        assert_eq!(fixtures.len(), 7);

        for fixture in fixtures {
            let selected_consequence = fixture
                .vep_consequence
                .as_deref()
                .or(fixture.top_level_consequence.as_deref());
            let selected = select_transcript(&fixture.transcripts, selected_consequence);
            assert_eq!(
                selected.map(|transcript| transcript.id.as_str()),
                fixture.expected_transcript.as_deref(),
                "{}",
                fixture.name
            );
            assert_eq!(
                selected_consequence,
                fixture.expected_consequence.as_deref(),
                "{}",
                fixture.name
            );
            if fixture.name.contains("nod2") {
                let selected = selected.unwrap();
                assert!(selected.mane);
                assert_eq!(selected.gene_symbol.as_deref(), Some("NOD2"));
            }
        }
    }

    #[test]
    fn both_sql_transforms_select_the_first_priority_candidate_once() {
        for sql in [EXOME_ANNOTATIONS_TRANSFORM, GENOME_ANNOTATIONS_TRANSFORM] {
            assert!(sql.contains("coalesce(vep.most_severe_consequence, most_severe_csq_variant) AS selected_consequence"));
            assert!(sql.contains(") AS selected_transcript\nSELECT"));
            assert!(sql.contains("selected_transcript.gene_id AS gene_id"));
            assert!(sql.contains("selected_transcript.hgvsc AS hgvsc"));
            assert!(sql.contains("selected_consequence AS consequence"));
            assert_eq!(sql.matches("arrayElement(").count(), 1);
            assert!(!sql.contains("arrayFirst("));
        }
    }

    #[test]
    fn terminal_summary_is_exact_and_ambiguous_output_is_rejected() {
        assert_eq!(
            parse_terminal_summary(
                "All 956 partitions completed! Total rows: 40535147\nJob complete. Coordinator returning to idle mode."
            )
            .unwrap(),
            Some(TerminalSummary {
                total_partitions: 956,
                failed_partitions: 0,
                total_rows: 40_535_147,
            })
        );
        assert_eq!(
            parse_terminal_summary(
                "Job finished with 2 failed partitions out of 956. Total rows: 40437403"
            )
            .unwrap(),
            Some(TerminalSummary {
                total_partitions: 956,
                failed_partitions: 2,
                total_rows: 40_437_403,
            })
        );
        assert!(parse_terminal_summary(
            "All 1 partitions completed! Total rows: 1\nAll 1 partitions completed! Total rows: 1"
        )
        .is_err());
    }

    #[test]
    fn candidate_rendering_is_scoped_and_identifiers_fail_closed() {
        let ddl = render_ddl(
            EXOME_ANNOTATIONS_DDL,
            "exome_annotations",
            "exome_annotations_candidate_test",
        )
        .unwrap();
        assert!(ddl.contains("CREATE TABLE exome_annotations_candidate_test"));
        assert!(!ddl.contains("CREATE TABLE IF NOT EXISTS exome_annotations"));

        let transform = render_transform(
            EXOME_ANNOTATIONS_TRANSFORM,
            "exome_annotations",
            "staging_exome_raw",
            "exome_annotations_candidate_test",
            "exome_annotations_candidate_test_raw",
        )
        .unwrap();
        assert!(transform.contains("INSERT INTO exome_annotations_candidate_test"));
        assert!(transform.contains("FROM exome_annotations_candidate_test_raw"));
        assert!(
            validate_candidate_name("exome_annotations", "exome_annotations_candidate_test")
                .is_ok()
        );
        assert!(validate_candidate_name("exome_annotations", "genome_annotations").is_err());
        assert!(validate_identifier("candidate; DROP TABLE gene_models").is_err());
    }

    #[test]
    fn test_format_number() {
        assert_eq!(format_number(1234567890), "1,234,567,890");
        assert_eq!(format_number(1000), "1,000");
        assert_eq!(format_number(100), "100");
        assert_eq!(format_number(0), "0");
    }
}
