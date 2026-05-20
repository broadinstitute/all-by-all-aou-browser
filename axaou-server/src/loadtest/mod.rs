//! Load testing infrastructure with real-time streaming, SQLite persistence,
//! and HTTP API for the live dashboard.

pub mod api;
pub mod db;
pub mod runner;

use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Shared event types for broadcast between runner → SSE → frontend
// ---------------------------------------------------------------------------

/// Events emitted by the load test runner, consumed by SSE subscribers.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type")]
pub enum LoadTestEvent {
    /// Batch of request records (sent every ~500ms)
    #[serde(rename = "request_batch")]
    RequestBatch { records: Vec<RequestRecord> },
    /// ClickHouse active query count
    #[serde(rename = "ch_metric")]
    ChMetric(ChMetricEvent),
    /// Periodic rolling summary (sent every 1s)
    #[serde(rename = "summary")]
    Summary(RollingSummary),
    /// Run completed
    #[serde(rename = "run_completed")]
    RunCompleted { run_id: String },
    /// GCP metrics are now available (arrives ~60s after completion)
    #[serde(rename = "gcp_metrics_ready")]
    GcpMetricsReady { run_id: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestRecord {
    pub timestamp_ms: i64,
    pub endpoint: String,
    pub status: u16,
    pub latency_ms: u64,
    pub error: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChMetricEvent {
    pub timestamp_ms: i64,
    pub active_queries: u64,
    #[serde(default)]
    pub memory_used_gb: f64,
    #[serde(default)]
    pub memory_total_gb: f64,
    #[serde(default)]
    pub cpu_usage_pct: f64,
    #[serde(default)]
    pub read_bytes_sec: f64,
    #[serde(default)]
    pub merges_running: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct RollingSummary {
    pub elapsed_secs: f64,
    pub active_users: usize,
    pub total_sessions: usize,
    pub total_requests: usize,
    pub rps: f64,
    pub p50_ms: u64,
    pub p95_ms: u64,
    pub error_rate: f64,
}

// ---------------------------------------------------------------------------
// Config types (shared between CLI and API)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadTestConfig {
    pub target: TargetConfig,
    pub load: LoadConfig,
    #[serde(default)]
    pub abort: AbortConfig,
    #[serde(default)]
    pub gcp: Option<GcpConfig>,
    #[serde(default)]
    pub output: OutputConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TargetConfig {
    pub url: String,
    pub clickhouse_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadConfig {
    #[serde(default = "default_mode")]
    pub mode: String,
    #[serde(default = "default_concurrency")]
    pub concurrency: usize,
    #[serde(default = "default_ramp_start")]
    pub ramp_start: usize,
    #[serde(default = "default_ramp_step")]
    pub ramp_step: usize,
    #[serde(default = "default_ramp_interval")]
    pub ramp_interval_secs: u64,
    #[serde(default = "default_duration")]
    pub max_duration_secs: u64,
    #[serde(default)]
    pub sessions: usize,
    #[serde(default)]
    pub seed: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AbortConfig {
    #[serde(default = "default_p95_limit")]
    pub p95_latency_ms: u64,
    #[serde(default = "default_error_rate")]
    pub error_rate: f64,
}

impl Default for AbortConfig {
    fn default() -> Self {
        Self {
            p95_latency_ms: default_p95_limit(),
            error_rate: default_error_rate(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GcpConfig {
    pub project_id: String,
    pub service_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct OutputConfig {
    #[serde(default = "default_json_file")]
    pub json_file: String,
    #[serde(default = "default_html_file")]
    pub html_file: String,
}

fn default_mode() -> String { "static".into() }
fn default_concurrency() -> usize { 10 }
fn default_ramp_start() -> usize { 5 }
fn default_ramp_step() -> usize { 5 }
fn default_ramp_interval() -> u64 { 10 }
fn default_duration() -> u64 { 60 }
fn default_p95_limit() -> u64 { 5000 }
fn default_error_rate() -> f64 { 0.05 }
fn default_json_file() -> String { "loadtest-results.json".into() }
fn default_html_file() -> String { "loadtest-report.html".into() }

// ---------------------------------------------------------------------------
// Report types (shared between CLI output and API response)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EndpointStats {
    pub endpoint: String,
    pub count: usize,
    pub errors: usize,
    pub p50_ms: u64,
    pub p95_ms: u64,
    pub p99_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Report {
    pub test_start: String,
    pub test_end: String,
    pub duration_secs: f64,
    pub total_sessions: usize,
    pub total_requests: usize,
    pub total_errors: usize,
    pub error_rate: f64,
    pub throughput_rps: f64,
    pub sessions_per_sec: f64,
    pub max_concurrency: usize,
    pub endpoints: Vec<EndpointStats>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub clickhouse_metrics: Vec<ChMetricEvent>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub cloud_run_metrics: Vec<CrMetric>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrMetric {
    pub timestamp_ms: i64,
    pub value: f64,
    pub metric_type: String,
}

/// Shared state for load test API routes.
pub struct LoadTestState {
    pub db: db::LoadTestDb,
    /// Active runs: run_id → broadcast sender
    pub active_runs: tokio::sync::RwLock<
        std::collections::HashMap<String, tokio::sync::broadcast::Sender<LoadTestEvent>>,
    >,
}

impl LoadTestState {
    pub fn new(db: db::LoadTestDb) -> Self {
        Self {
            db,
            active_runs: tokio::sync::RwLock::new(std::collections::HashMap::new()),
        }
    }
}
