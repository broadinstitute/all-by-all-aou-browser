//! SQLite persistence for load test runs, request records, and metrics.
//!
//! All writes go through a dedicated OS thread (via mpsc channel) to avoid
//! blocking the Tokio runtime, since rusqlite is synchronous.

use anyhow::{Context, Result};
use rusqlite::Connection;
use std::path::Path;
use tokio::sync::{mpsc, oneshot};

use super::{
    ChMetricEvent, CrMetric, EndpointStats, LoadTestConfig, Report, RequestRecord,
};

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    config_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    start_time TEXT NOT NULL,
    end_time TEXT,
    duration_secs REAL,
    total_sessions INTEGER DEFAULT 0,
    total_requests INTEGER DEFAULT 0,
    total_errors INTEGER DEFAULT 0,
    error_rate REAL DEFAULT 0.0,
    throughput_rps REAL DEFAULT 0.0,
    max_concurrency INTEGER DEFAULT 0,
    endpoints_json TEXT
);

CREATE TABLE IF NOT EXISTS request_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    timestamp_ms INTEGER NOT NULL,
    endpoint TEXT NOT NULL,
    status INTEGER NOT NULL,
    latency_ms INTEGER NOT NULL,
    error INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (run_id) REFERENCES runs(id)
);

CREATE INDEX IF NOT EXISTS idx_request_records_run_id ON request_records(run_id);

CREATE TABLE IF NOT EXISTS ch_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    timestamp_ms INTEGER NOT NULL,
    active_queries INTEGER NOT NULL,
    memory_used_gb REAL NOT NULL DEFAULT 0.0,
    memory_total_gb REAL NOT NULL DEFAULT 0.0,
    cpu_usage_pct REAL NOT NULL DEFAULT 0.0,
    read_bytes_sec REAL NOT NULL DEFAULT 0.0,
    merges_running INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (run_id) REFERENCES runs(id)
);

CREATE TABLE IF NOT EXISTS cr_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    timestamp_ms INTEGER NOT NULL,
    metric_type TEXT NOT NULL,
    value REAL NOT NULL,
    FOREIGN KEY (run_id) REFERENCES runs(id)
);
"#;

// ---------------------------------------------------------------------------
// Commands sent to the writer thread
// ---------------------------------------------------------------------------

enum DbCommand {
    InsertRun {
        id: String,
        config_json: String,
        start_time: String,
    },
    InsertRecords {
        run_id: String,
        records: Vec<RequestRecord>,
    },
    InsertChMetrics {
        run_id: String,
        metrics: Vec<ChMetricEvent>,
    },
    InsertCrMetrics {
        run_id: String,
        metrics: Vec<CrMetric>,
    },
    CompleteRun {
        run_id: String,
        report: Box<Report>,
    },
    AbortRun {
        run_id: String,
    },
    ListRuns {
        reply: oneshot::Sender<Result<Vec<RunSummary>>>,
    },
    GetRun {
        run_id: String,
        reply: oneshot::Sender<Result<Option<RunDetail>>>,
    },
}

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RunSummary {
    pub id: String,
    pub status: String,
    pub start_time: String,
    pub end_time: Option<String>,
    pub duration_secs: Option<f64>,
    pub total_sessions: i64,
    pub total_requests: i64,
    pub total_errors: i64,
    pub error_rate: f64,
    pub throughput_rps: f64,
    pub max_concurrency: i64,
    pub config: serde_json::Value,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RunDetail {
    pub summary: RunSummary,
    pub endpoints: Vec<EndpointStats>,
    pub time_series: Vec<RequestRecord>,
    pub clickhouse_metrics: Vec<ChMetricEvent>,
    pub cloud_run_metrics: Vec<CrMetric>,
}

// ---------------------------------------------------------------------------
// LoadTestDb handle (cloneable, async-safe)
// ---------------------------------------------------------------------------

#[derive(Clone)]
pub struct LoadTestDb {
    tx: mpsc::Sender<DbCommand>,
}

impl LoadTestDb {
    /// Open (or create) the database and spawn the writer thread.
    pub fn open(path: impl AsRef<Path>) -> Result<Self> {
        let path = path.as_ref().to_path_buf();
        let conn = Connection::open(&path)
            .with_context(|| format!("Failed to open SQLite at {:?}", path))?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;")?;
        conn.execute_batch(SCHEMA)?;

        let (tx, rx) = mpsc::channel::<DbCommand>(4096);

        // Spawn a dedicated OS thread for synchronous SQLite operations
        std::thread::Builder::new()
            .name("loadtest-db".into())
            .spawn(move || db_writer_loop(conn, rx))
            .context("Failed to spawn DB writer thread")?;

        Ok(Self { tx })
    }

    pub async fn insert_run(&self, id: &str, config: &LoadTestConfig, start_time: &str) -> Result<()> {
        let config_json = serde_json::to_string(config)?;
        self.tx
            .send(DbCommand::InsertRun {
                id: id.to_string(),
                config_json,
                start_time: start_time.to_string(),
            })
            .await
            .map_err(|_| anyhow::anyhow!("DB writer thread gone"))?;
        Ok(())
    }

    pub async fn insert_records(&self, run_id: &str, records: Vec<RequestRecord>) -> Result<()> {
        if records.is_empty() {
            return Ok(());
        }
        self.tx
            .send(DbCommand::InsertRecords {
                run_id: run_id.to_string(),
                records,
            })
            .await
            .map_err(|_| anyhow::anyhow!("DB writer thread gone"))?;
        Ok(())
    }

    pub async fn insert_ch_metrics(&self, run_id: &str, metrics: Vec<ChMetricEvent>) -> Result<()> {
        if metrics.is_empty() {
            return Ok(());
        }
        self.tx
            .send(DbCommand::InsertChMetrics {
                run_id: run_id.to_string(),
                metrics,
            })
            .await
            .map_err(|_| anyhow::anyhow!("DB writer thread gone"))?;
        Ok(())
    }

    pub async fn insert_cr_metrics(&self, run_id: &str, metrics: Vec<CrMetric>) -> Result<()> {
        if metrics.is_empty() {
            return Ok(());
        }
        self.tx
            .send(DbCommand::InsertCrMetrics {
                run_id: run_id.to_string(),
                metrics,
            })
            .await
            .map_err(|_| anyhow::anyhow!("DB writer thread gone"))?;
        Ok(())
    }

    pub async fn complete_run(&self, run_id: &str, report: Report) -> Result<()> {
        self.tx
            .send(DbCommand::CompleteRun {
                run_id: run_id.to_string(),
                report: Box::new(report),
            })
            .await
            .map_err(|_| anyhow::anyhow!("DB writer thread gone"))?;
        Ok(())
    }

    pub async fn abort_run(&self, run_id: &str) -> Result<()> {
        self.tx
            .send(DbCommand::AbortRun {
                run_id: run_id.to_string(),
            })
            .await
            .map_err(|_| anyhow::anyhow!("DB writer thread gone"))?;
        Ok(())
    }

    pub async fn list_runs(&self) -> Result<Vec<RunSummary>> {
        let (reply_tx, reply_rx) = oneshot::channel();
        self.tx
            .send(DbCommand::ListRuns { reply: reply_tx })
            .await
            .map_err(|_| anyhow::anyhow!("DB writer thread gone"))?;
        reply_rx.await?
    }

    pub async fn get_run(&self, run_id: &str) -> Result<Option<RunDetail>> {
        let (reply_tx, reply_rx) = oneshot::channel();
        self.tx
            .send(DbCommand::GetRun {
                run_id: run_id.to_string(),
                reply: reply_tx,
            })
            .await
            .map_err(|_| anyhow::anyhow!("DB writer thread gone"))?;
        reply_rx.await?
    }
}

// ---------------------------------------------------------------------------
// Writer thread event loop
// ---------------------------------------------------------------------------

fn db_writer_loop(conn: Connection, mut rx: mpsc::Receiver<DbCommand>) {
    // Use a blocking recv in a runtime-less thread
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .expect("mini runtime for db writer");

    rt.block_on(async move {
        while let Some(cmd) = rx.recv().await {
            match cmd {
                DbCommand::InsertRun {
                    id,
                    config_json,
                    start_time,
                } => {
                    let _ = conn.execute(
                        "INSERT INTO runs (id, config_json, status, start_time) VALUES (?1, ?2, 'running', ?3)",
                        rusqlite::params![id, config_json, start_time],
                    );
                }
                DbCommand::InsertRecords { run_id, records } => {
                    let tx = conn.unchecked_transaction();
                    if let Ok(tx) = tx {
                        for r in &records {
                            let _ = tx.execute(
                                "INSERT INTO request_records (run_id, timestamp_ms, endpoint, status, latency_ms, error) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                                rusqlite::params![run_id, r.timestamp_ms, r.endpoint, r.status, r.latency_ms, r.error as i32],
                            );
                        }
                        let _ = tx.commit();
                    }
                }
                DbCommand::InsertChMetrics { run_id, metrics } => {
                    let tx = conn.unchecked_transaction();
                    if let Ok(tx) = tx {
                        for m in &metrics {
                            let _ = tx.execute(
                                "INSERT INTO ch_metrics (run_id, timestamp_ms, active_queries, memory_used_gb, memory_total_gb, cpu_usage_pct, read_bytes_sec, merges_running) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                                rusqlite::params![run_id, m.timestamp_ms, m.active_queries, m.memory_used_gb, m.memory_total_gb, m.cpu_usage_pct, m.read_bytes_sec, m.merges_running],
                            );
                        }
                        let _ = tx.commit();
                    }
                }
                DbCommand::InsertCrMetrics { run_id, metrics } => {
                    let tx = conn.unchecked_transaction();
                    if let Ok(tx) = tx {
                        for m in &metrics {
                            let _ = tx.execute(
                                "INSERT INTO cr_metrics (run_id, timestamp_ms, metric_type, value) VALUES (?1, ?2, ?3, ?4)",
                                rusqlite::params![run_id, m.timestamp_ms, m.metric_type, m.value],
                            );
                        }
                        let _ = tx.commit();
                    }
                }
                DbCommand::CompleteRun { run_id, report } => {
                    let endpoints_json = serde_json::to_string(&report.endpoints).unwrap_or_default();
                    let _ = conn.execute(
                        "UPDATE runs SET status = 'completed', end_time = ?1, duration_secs = ?2, \
                         total_sessions = ?3, total_requests = ?4, total_errors = ?5, \
                         error_rate = ?6, throughput_rps = ?7, max_concurrency = ?8, \
                         endpoints_json = ?9 WHERE id = ?10",
                        rusqlite::params![
                            report.test_end,
                            report.duration_secs,
                            report.total_sessions,
                            report.total_requests,
                            report.total_errors,
                            report.error_rate,
                            report.throughput_rps,
                            report.max_concurrency,
                            endpoints_json,
                            run_id,
                        ],
                    );
                }
                DbCommand::AbortRun { run_id } => {
                    let _ = conn.execute(
                        "UPDATE runs SET status = 'aborted' WHERE id = ?1",
                        rusqlite::params![run_id],
                    );
                }
                DbCommand::ListRuns { reply } => {
                    let result = list_runs_impl(&conn);
                    let _ = reply.send(result);
                }
                DbCommand::GetRun { run_id, reply } => {
                    let result = get_run_impl(&conn, &run_id);
                    let _ = reply.send(result);
                }
            }
        }
    });
}

fn list_runs_impl(conn: &Connection) -> Result<Vec<RunSummary>> {
    let mut stmt = conn.prepare(
        "SELECT id, status, config_json, start_time, end_time, duration_secs, \
         total_sessions, total_requests, total_errors, error_rate, throughput_rps, max_concurrency \
         FROM runs ORDER BY start_time DESC LIMIT 100",
    )?;
    let rows = stmt.query_map([], |row| {
        let config_str: String = row.get(2)?;
        let config: serde_json::Value =
            serde_json::from_str(&config_str).unwrap_or(serde_json::Value::Null);
        Ok(RunSummary {
            id: row.get(0)?,
            status: row.get(1)?,
            config,
            start_time: row.get(3)?,
            end_time: row.get(4)?,
            duration_secs: row.get(5)?,
            total_sessions: row.get::<_, Option<i64>>(6)?.unwrap_or(0),
            total_requests: row.get::<_, Option<i64>>(7)?.unwrap_or(0),
            total_errors: row.get::<_, Option<i64>>(8)?.unwrap_or(0),
            error_rate: row.get::<_, Option<f64>>(9)?.unwrap_or(0.0),
            throughput_rps: row.get::<_, Option<f64>>(10)?.unwrap_or(0.0),
            max_concurrency: row.get::<_, Option<i64>>(11)?.unwrap_or(0),
        })
    })?;
    rows.collect::<std::result::Result<Vec<_>, _>>()
        .map_err(|e| anyhow::anyhow!("Failed to list runs: {}", e))
}

fn get_run_impl(conn: &Connection, run_id: &str) -> Result<Option<RunDetail>> {
    // Get run summary
    let summary = {
        let mut stmt = conn.prepare(
            "SELECT id, status, config_json, start_time, end_time, duration_secs, \
             total_sessions, total_requests, total_errors, error_rate, throughput_rps, \
             max_concurrency, endpoints_json FROM runs WHERE id = ?1",
        )?;
        let mut rows = stmt.query_map(rusqlite::params![run_id], |row| {
            let config_str: String = row.get(2)?;
            let config: serde_json::Value =
                serde_json::from_str(&config_str).unwrap_or(serde_json::Value::Null);
            let endpoints_str: Option<String> = row.get(12)?;
            Ok((
                RunSummary {
                    id: row.get(0)?,
                    status: row.get(1)?,
                    config,
                    start_time: row.get(3)?,
                    end_time: row.get(4)?,
                    duration_secs: row.get(5)?,
                    total_sessions: row.get::<_, Option<i64>>(6)?.unwrap_or(0),
                    total_requests: row.get::<_, Option<i64>>(7)?.unwrap_or(0),
                    total_errors: row.get::<_, Option<i64>>(8)?.unwrap_or(0),
                    error_rate: row.get::<_, Option<f64>>(9)?.unwrap_or(0.0),
                    throughput_rps: row.get::<_, Option<f64>>(10)?.unwrap_or(0.0),
                    max_concurrency: row.get::<_, Option<i64>>(11)?.unwrap_or(0),
                },
                endpoints_str,
            ))
        })?;
        match rows.next() {
            Some(Ok((summary, endpoints_str))) => {
                let endpoints: Vec<EndpointStats> = endpoints_str
                    .and_then(|s| serde_json::from_str(&s).ok())
                    .unwrap_or_default();
                (summary, endpoints)
            }
            _ => return Ok(None),
        }
    };

    let (summary, endpoints) = summary;

    // Get time series
    let time_series = {
        let mut stmt = conn.prepare(
            "SELECT timestamp_ms, endpoint, status, latency_ms, error \
             FROM request_records WHERE run_id = ?1 ORDER BY timestamp_ms ASC",
        )?;
        let rows = stmt.query_map(rusqlite::params![run_id], |row| {
            Ok(RequestRecord {
                timestamp_ms: row.get(0)?,
                endpoint: row.get(1)?,
                status: row.get(2)?,
                latency_ms: row.get(3)?,
                error: row.get::<_, i32>(4)? != 0,
            })
        })?;
        rows.collect::<std::result::Result<Vec<_>, _>>()?
    };

    // Get CH metrics
    let clickhouse_metrics = {
        let mut stmt = conn.prepare(
            "SELECT timestamp_ms, active_queries, memory_used_gb, memory_total_gb, cpu_usage_pct, read_bytes_sec, merges_running FROM ch_metrics WHERE run_id = ?1 ORDER BY timestamp_ms ASC",
        )?;
        let rows = stmt.query_map(rusqlite::params![run_id], |row| {
            Ok(ChMetricEvent {
                timestamp_ms: row.get(0)?,
                active_queries: row.get(1)?,
                memory_used_gb: row.get::<_, Option<f64>>(2)?.unwrap_or(0.0),
                memory_total_gb: row.get::<_, Option<f64>>(3)?.unwrap_or(0.0),
                cpu_usage_pct: row.get::<_, Option<f64>>(4)?.unwrap_or(0.0),
                read_bytes_sec: row.get::<_, Option<f64>>(5)?.unwrap_or(0.0),
                merges_running: row.get::<_, Option<u64>>(6)?.unwrap_or(0),
            })
        })?;
        rows.collect::<std::result::Result<Vec<_>, _>>()?
    };

    // Get CR metrics
    let cloud_run_metrics = {
        let mut stmt = conn.prepare(
            "SELECT timestamp_ms, metric_type, value FROM cr_metrics WHERE run_id = ?1 ORDER BY timestamp_ms ASC",
        )?;
        let rows = stmt.query_map(rusqlite::params![run_id], |row| {
            Ok(CrMetric {
                timestamp_ms: row.get(0)?,
                metric_type: row.get(1)?,
                value: row.get(2)?,
            })
        })?;
        rows.collect::<std::result::Result<Vec<_>, _>>()?
    };

    Ok(Some(RunDetail {
        summary,
        endpoints,
        time_series,
        clickhouse_metrics,
        cloud_run_metrics,
    }))
}
