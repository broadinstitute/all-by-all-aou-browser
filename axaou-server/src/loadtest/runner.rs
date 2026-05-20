//! Load test runner — core simulation logic.
//!
//! Refactored from the original `cli/loadtest.rs` to support:
//! - Running via CLI (with stdout TUI) or API (with broadcast + SQLite)
//! - Optional broadcast channel for SSE streaming
//! - Optional SQLite persistence

use anyhow::{Context, Result};
use chrono::Utc;
use rand::Rng;
use serde::Deserialize;
use std::collections::HashMap;
use std::io::Write as IoWrite;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{broadcast, mpsc};

use super::{
    ChMetricEvent, CrMetric, EndpointStats, GcpConfig, LoadTestConfig, LoadTestEvent,
    Report, RequestRecord, RollingSummary,
};
use super::db::LoadTestDb;

// ---------------------------------------------------------------------------
// Seed Data (fetched via HTTP from target server)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
struct SeedData {
    analysis_ids: Vec<String>,
    gene_ids: Vec<String>,
    loci: Vec<Locus>,
}

#[derive(Debug, Clone)]
struct Locus {
    contig: String,
    start: i64,
    stop: i64,
}

#[derive(Deserialize)]
struct PhenotypeSummaryResponse {
    #[serde(default)]
    data: Vec<PhenotypeSummaryItem>,
}

#[derive(Deserialize)]
struct PhenotypeSummaryItem {
    #[serde(default)]
    analysis_id: String,
}

#[derive(Deserialize)]
struct GeneSummaryResponse {
    #[serde(default)]
    data: Vec<GeneSummaryItem>,
}

#[derive(Deserialize)]
struct GeneSummaryItem {
    #[serde(default)]
    gene_id: String,
}

#[derive(Deserialize)]
struct LocusItem {
    #[serde(default)]
    contig: String,
    #[serde(default)]
    start: i64,
    #[serde(default)]
    stop: i64,
}

async fn fetch_seed_data(client: &reqwest::Client, base_url: &str) -> Result<SeedData> {
    println!("Seeding: fetching phenotype summary...");
    let resp: PhenotypeSummaryResponse = client
        .get(format!("{}/api/phenotypes/summary", base_url))
        .send()
        .await?
        .json()
        .await
        .context("Failed to parse phenotypes/summary")?;
    let analysis_ids: Vec<String> = resp
        .data
        .into_iter()
        .map(|p| p.analysis_id)
        .filter(|id| !id.is_empty())
        .collect();
    println!("  Found {} analysis IDs", analysis_ids.len());

    println!("Seeding: fetching gene summary...");
    let resp: GeneSummaryResponse = client
        .get(format!("{}/api/genes/summary", base_url))
        .send()
        .await?
        .json()
        .await
        .context("Failed to parse genes/summary")?;
    let mut gene_ids: Vec<String> = resp
        .data
        .into_iter()
        .map(|g| g.gene_id)
        .filter(|id| !id.is_empty())
        .collect();
    gene_ids.truncate(5000);
    println!("  Found {} gene IDs", gene_ids.len());

    println!("Seeding: fetching loci for sample phenotypes...");
    let mut loci = Vec::new();
    for aid in analysis_ids.iter().take(5) {
        let url = format!(
            "{}/api/phenotype/{}/loci?ancestry=meta",
            base_url, aid
        );
        match client.get(&url).send().await {
            Ok(r) => {
                if let Ok(items) = r.json::<Vec<LocusItem>>().await {
                    for l in items {
                        if !l.contig.is_empty() && l.stop > l.start {
                            loci.push(Locus {
                                contig: l.contig,
                                start: l.start,
                                stop: l.stop,
                            });
                        }
                    }
                }
            }
            Err(e) => {
                tracing::warn!("Failed to fetch loci for {}: {}", aid, e);
            }
        }
    }
    println!("  Found {} loci coordinates", loci.len());

    if analysis_ids.is_empty() || gene_ids.is_empty() {
        anyhow::bail!("Seed data is insufficient: need at least 1 analysis_id and 1 gene_id");
    }

    Ok(SeedData {
        analysis_ids,
        gene_ids,
        loci,
    })
}

// ---------------------------------------------------------------------------
// Request firing
// ---------------------------------------------------------------------------

async fn fire_req(
    client: &reqwest::Client,
    endpoint: &'static str,
    url: String,
) -> RequestRecord {
    let start = Instant::now();
    let timestamp_ms = Utc::now().timestamp_millis();
    match client.get(&url).send().await {
        Ok(resp) => {
            let status = resp.status().as_u16();
            let _ = resp.bytes().await;
            let latency_ms = start.elapsed().as_millis() as u64;
            RequestRecord {
                timestamp_ms,
                endpoint: endpoint.to_string(),
                status,
                latency_ms,
                error: status >= 400,
            }
        }
        Err(_) => {
            let latency_ms = start.elapsed().as_millis() as u64;
            RequestRecord {
                timestamp_ms,
                endpoint: endpoint.to_string(),
                status: 0,
                latency_ms,
                error: true,
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Session Simulation
// ---------------------------------------------------------------------------

async fn run_session(
    client: &reqwest::Client,
    base_url: &str,
    seed: &SeedData,
    tx: &mpsc::UnboundedSender<RequestRecord>,
) {
    let (aid, gid) = {
        let mut rng = rand::rng();
        let aid = seed.analysis_ids[rng.random_range(0..seed.analysis_ids.len())].clone();
        let gid = seed.gene_ids[rng.random_range(0..seed.gene_ids.len())].clone();
        (aid, gid)
    };
    let aid = &aid;
    let gid = &gid;

    let rec = fire_req(
        client,
        "phenotypes_summary",
        format!("{}/api/phenotypes/summary", base_url),
    )
    .await;
    let _ = tx.send(rec);

    let rec = fire_req(
        client,
        "phenotype_overview",
        format!(
            "{}/api/phenotype/{}/overview?ancestry=meta",
            base_url, aid
        ),
    )
    .await;
    let _ = tx.send(rec);

    let rec = fire_req(
        client,
        "phenotype_loci",
        format!(
            "{}/api/phenotype/{}/loci?ancestry=meta",
            base_url, aid
        ),
    )
    .await;
    let _ = tx.send(rec);

    if !seed.loci.is_empty() {
        let locus_idx = {
            let mut rng = rand::rng();
            rng.random_range(0..seed.loci.len())
        };
        let locus = &seed.loci[locus_idx];
        let (r1, r2, r3) = tokio::join!(
            fire_req(
                client,
                "region_render",
                format!(
                    "{}/api/phenotype/{}/region/render?ancestry=meta&contig={}&start={}&stop={}&width=1200&height=400&dpr=2",
                    base_url, aid, locus.contig, locus.start, locus.stop
                ),
            ),
            fire_req(
                client,
                "region_overlay",
                format!(
                    "{}/api/phenotype/{}/region/render/overlay?ancestry=meta&contig={}&start={}&stop={}&threshold=5e-8",
                    base_url, aid, locus.contig, locus.start, locus.stop
                ),
            ),
            fire_req(
                client,
                "genes_interval",
                format!(
                    "{}/api/genes/model/interval/{}:{}-{}",
                    base_url, locus.contig, locus.start, locus.stop
                ),
            ),
        );
        let _ = tx.send(r1);
        let _ = tx.send(r2);
        let _ = tx.send(r3);
    }

    let (r1, r2, r3, r4, r5, r6) = tokio::join!(
        fire_req(
            client,
            "gene_model",
            format!("{}/api/genes/model/{}", base_url, gid),
        ),
        fire_req(
            client,
            "annotations_exome",
            format!(
                "{}/api/variants/annotations/gene/{}?sequencing_type=exome&extended=true",
                base_url, gid
            ),
        ),
        fire_req(
            client,
            "annotations_genome",
            format!(
                "{}/api/variants/annotations/gene/{}?sequencing_type=genome&extended=true",
                base_url, gid
            ),
        ),
        fire_req(
            client,
            "associations_exome",
            format!(
                "{}/api/variants/associations/gene/{}?analysis_id={}&sequencing_type=exome&ancestry_group=meta",
                base_url, gid, aid
            ),
        ),
        fire_req(
            client,
            "associations_genome",
            format!(
                "{}/api/variants/associations/gene/{}?analysis_id={}&sequencing_type=genome&ancestry_group=meta",
                base_url, gid, aid
            ),
        ),
        fire_req(
            client,
            "genes_associations",
            format!(
                "{}/api/genes/associations?gene_id={}&analysis_id={}&ancestry_group=meta",
                base_url, gid, aid
            ),
        ),
    );
    let _ = tx.send(r1);
    let _ = tx.send(r2);
    let _ = tx.send(r3);
    let _ = tx.send(r4);
    let _ = tx.send(r5);
    let _ = tx.send(r6);

    let do_phewas = {
        let mut rng = rand::rng();
        rng.random_range(0.0..1.0f64) < 0.3
    };
    if do_phewas {
        let rec = fire_req(
            client,
            "gene_phewas",
            format!("{}/api/genes/phewas/{}", base_url, gid),
        )
        .await;
        let _ = tx.send(rec);
    }
}

// ---------------------------------------------------------------------------
// ClickHouse Queue Monitor
// ---------------------------------------------------------------------------

/// Query to fetch ClickHouse system metrics in a single roundtrip.
/// Fields: active_queries, memory_used_gb, memory_total_gb, cpu_user_sum, read_bytes_sum,
///         merges, query_memory_gb, thread_active, thread_total, cpu_wait_us, io_wait_us, page_cache_miss
const CH_METRICS_QUERY: &str = r#"
SELECT
    (SELECT count() FROM system.processes) AS active_queries,
    (SELECT value FROM system.asynchronous_metrics WHERE metric = 'MemoryResident') / 1073741824 AS memory_used_gb,
    (SELECT value FROM system.asynchronous_metrics WHERE metric = 'OSMemoryTotal') / 1073741824 AS memory_total_gb,
    (SELECT sum(value) FROM system.asynchronous_metrics WHERE metric LIKE 'OSUserTimeCPU%') AS cpu_user_sum,
    (SELECT sum(value) FROM system.asynchronous_metrics WHERE metric LIKE 'BlockReadBytes_%') AS read_bytes_sum,
    (SELECT count() FROM system.merges WHERE is_mutation = 0) AS merges_running,
    (SELECT value FROM system.metrics WHERE metric = 'MemoryTracking') / 1073741824 AS query_memory_gb,
    (SELECT value FROM system.metrics WHERE metric = 'GlobalThreadActive') AS thread_active,
    (SELECT value FROM system.metrics WHERE metric = 'GlobalThread') AS thread_total,
    (SELECT value FROM system.events WHERE event = 'OSCPUWaitMicroseconds') AS cpu_wait_us,
    (SELECT value FROM system.events WHERE event = 'SynchronousReadWaitMicroseconds') AS io_wait_us,
    (SELECT value FROM system.events WHERE event = 'ThreadPoolReaderPageCacheMiss') AS page_cache_miss
FORMAT TabSeparated
"#;

async fn monitor_clickhouse(
    client: reqwest::Client,
    ch_url: String,
    cancel: Arc<AtomicBool>,
    event_tx: Option<broadcast::Sender<LoadTestEvent>>,
) -> Vec<ChMetricEvent> {
    let mut metrics = Vec::new();
    // Previous values for computing deltas on cumulative counters
    struct PrevCounters {
        cpu_user: f64,
        read_bytes: f64,
        cpu_wait_us: f64,
        io_wait_us: f64,
        page_cache_miss: f64,
        time: Instant,
    }
    let mut prev: Option<PrevCounters> = None;

    while !cancel.load(Ordering::Relaxed) {
        let ts = Utc::now().timestamp_millis();
        let now = Instant::now();

        if let Ok(resp) = client
            .post(format!("{}/?default_format=TabSeparated", ch_url))
            .body(CH_METRICS_QUERY)
            .send()
            .await
        {
            if let Ok(body) = resp.text().await {
                let fields: Vec<&str> = body.trim().split('\t').collect();
                if fields.len() >= 12 {
                    let active_queries = fields[0].parse::<u64>().unwrap_or(0);
                    let memory_used_gb = fields[1].parse::<f64>().unwrap_or(0.0);
                    let memory_total_gb = fields[2].parse::<f64>().unwrap_or(0.0);
                    let cpu_raw = fields[3].parse::<f64>().unwrap_or(0.0);
                    let read_raw = fields[4].parse::<f64>().unwrap_or(0.0);
                    let merges_running = fields[5].parse::<u64>().unwrap_or(0);
                    let query_memory_gb = fields[6].parse::<f64>().unwrap_or(0.0);
                    let thread_active = fields[7].parse::<f64>().unwrap_or(0.0);
                    let thread_total = fields[8].parse::<f64>().unwrap_or(1.0);
                    let cpu_wait_raw = fields[9].parse::<f64>().unwrap_or(0.0);
                    let io_wait_raw = fields[10].parse::<f64>().unwrap_or(0.0);
                    let page_cache_miss_raw = fields[11].parse::<f64>().unwrap_or(0.0);

                    // Compute rates from deltas
                    let dt = prev.as_ref().map(|p| now.duration_since(p.time).as_secs_f64()).unwrap_or(2.0);
                    let (cpu_usage_pct, read_bytes_sec, cpu_wait_us_sec, io_wait_us_sec, page_cache_miss_sec) =
                        if let Some(ref p) = prev {
                            (
                                ((cpu_raw - p.cpu_user) / dt) * 100.0,
                                (read_raw - p.read_bytes) / dt,
                                (cpu_wait_raw - p.cpu_wait_us) / dt,
                                (io_wait_raw - p.io_wait_us) / dt,
                                (page_cache_miss_raw - p.page_cache_miss) / dt,
                            )
                        } else {
                            (0.0, 0.0, 0.0, 0.0, 0.0)
                        };

                    prev = Some(PrevCounters {
                        cpu_user: cpu_raw,
                        read_bytes: read_raw,
                        cpu_wait_us: cpu_wait_raw,
                        io_wait_us: io_wait_raw,
                        page_cache_miss: page_cache_miss_raw,
                        time: now,
                    });

                    let thread_saturation = if thread_total > 0.0 { thread_active / thread_total } else { 0.0 };

                    let metric = ChMetricEvent {
                        timestamp_ms: ts,
                        active_queries,
                        memory_used_gb,
                        memory_total_gb,
                        cpu_usage_pct: cpu_usage_pct.max(0.0),
                        read_bytes_sec: read_bytes_sec.max(0.0),
                        merges_running,
                        query_memory_gb,
                        thread_saturation,
                        cpu_wait_us_sec: cpu_wait_us_sec.max(0.0),
                        io_wait_us_sec: io_wait_us_sec.max(0.0),
                        page_cache_miss_sec: page_cache_miss_sec.max(0.0),
                    };
                    if let Some(ref etx) = event_tx {
                        let _ = etx.send(LoadTestEvent::ChMetric(metric.clone()));
                    }
                    metrics.push(metric);
                }
            }
        }
        tokio::time::sleep(Duration::from_secs(2)).await;
    }
    metrics
}

// ---------------------------------------------------------------------------
// GCP Cloud Run Metrics (post-test)
// ---------------------------------------------------------------------------

/// Metric configs: (metric_type, aligner, reducer) — different metrics need different aggregation.
const CR_METRIC_CONFIGS: &[(&str, &str, &str)] = &[
    // Instance count: use ALIGN_MAX to see peak instances
    ("run.googleapis.com/container/instance_count", "ALIGN_MAX", "REDUCE_SUM"),
    // CPU: use p95 to see the spikes, not averaged away
    ("run.googleapis.com/container/cpu/utilizations", "ALIGN_PERCENTILE_95", "REDUCE_MAX"),
    // Memory: use p95
    ("run.googleapis.com/container/memory/utilizations", "ALIGN_PERCENTILE_95", "REDUCE_MAX"),
    // Billable instance time
    ("run.googleapis.com/container/billable_instance_time", "ALIGN_RATE", "REDUCE_SUM"),
    // Network sent bytes
    ("run.googleapis.com/container/network/sent_bytes_count", "ALIGN_RATE", "REDUCE_SUM"),
    // Network received bytes
    ("run.googleapis.com/container/network/received_bytes_count", "ALIGN_RATE", "REDUCE_SUM"),
];

async fn fetch_gcp_metrics(
    gcp: &GcpConfig,
    test_start: chrono::DateTime<Utc>,
    test_end: chrono::DateTime<Utc>,
) -> Vec<CrMetric> {
    let token = match std::process::Command::new("gcloud")
        .args(["auth", "print-access-token"])
        .output()
    {
        Ok(output) if output.status.success() => {
            String::from_utf8_lossy(&output.stdout).trim().to_string()
        }
        _ => {
            tracing::warn!("Could not get gcloud access token; skipping CR metrics");
            return Vec::new();
        }
    };

    let client = reqwest::Client::new();
    let mut all_metrics = Vec::new();

    let start_rfc = test_start.to_rfc3339();
    let end_rfc = test_end.to_rfc3339();

    for &(metric_type, aligner, reducer) in CR_METRIC_CONFIGS {
        let filter = format!(
            "metric.type=\"{}\" AND resource.labels.service_name=\"{}\"",
            metric_type, gcp.service_name
        );
        let url = format!(
            "https://monitoring.googleapis.com/v3/projects/{}/timeSeries",
            gcp.project_id
        );
        let resp = client
            .get(&url)
            .bearer_auth(&token)
            .query(&[
                ("filter", filter.as_str()),
                ("interval.startTime", &start_rfc),
                ("interval.endTime", &end_rfc),
                ("aggregation.alignmentPeriod", "60s"),
                ("aggregation.perSeriesAligner", aligner),
                ("aggregation.crossSeriesReducer", reducer),
                ("aggregation.groupByFields", "resource.labels.service_name"),
            ])
            .send()
            .await;

        if let Ok(resp) = resp {
            if let Ok(body) = resp.json::<serde_json::Value>().await {
                if let Some(series) = body["timeSeries"].as_array() {
                    for ts in series {
                        if let Some(points) = ts["points"].as_array() {
                            for pt in points {
                                let val = pt["value"]["doubleValue"]
                                    .as_f64()
                                    .or_else(|| {
                                        pt["value"]["int64Value"]
                                            .as_str()
                                            .and_then(|s| s.parse().ok())
                                            .or_else(|| pt["value"]["int64Value"].as_i64().map(|v| v as f64))
                                    })
                                    .unwrap_or(0.0);
                                let ts_str = pt["interval"]["endTime"]
                                    .as_str()
                                    .unwrap_or_default();
                                let timestamp_ms = chrono::DateTime::parse_from_rfc3339(ts_str)
                                    .map(|dt| dt.timestamp_millis())
                                    .unwrap_or(0);
                                all_metrics.push(CrMetric {
                                    timestamp_ms,
                                    value: val,
                                    metric_type: metric_type.to_string(),
                                });
                            }
                        }
                    }
                }
            } else {
                tracing::warn!("Failed to parse GCP response for {}", metric_type);
            }
        } else {
            tracing::warn!("Failed to fetch GCP metric {}", metric_type);
        }
    }

    tracing::info!("Fetched {} Cloud Run metric points", all_metrics.len());
    all_metrics
}

// ---------------------------------------------------------------------------
// Rolling Metrics (for abort decisions + live summary)
// ---------------------------------------------------------------------------

fn percentile(sorted: &[u64], p: f64) -> u64 {
    if sorted.is_empty() {
        return 0;
    }
    let idx = ((sorted.len() as f64) * p).floor() as usize;
    sorted[idx.min(sorted.len() - 1)]
}

struct RollingMetrics {
    records: Vec<RequestRecord>,
}

impl RollingMetrics {
    fn new() -> Self {
        Self {
            records: Vec::new(),
        }
    }

    fn add(&mut self, rec: RequestRecord) {
        self.records.push(rec);
    }

    fn rolling_p95(&self, window_ms: i64) -> u64 {
        let now = Utc::now().timestamp_millis();
        let cutoff = now - window_ms;
        let mut recent: Vec<u64> = self
            .records
            .iter()
            .filter(|r| r.timestamp_ms >= cutoff)
            .map(|r| r.latency_ms)
            .collect();
        if recent.is_empty() {
            return 0;
        }
        recent.sort_unstable();
        percentile(&recent, 0.95)
    }

    fn rolling_p50(&self, window_ms: i64) -> u64 {
        let now = Utc::now().timestamp_millis();
        let cutoff = now - window_ms;
        let mut recent: Vec<u64> = self
            .records
            .iter()
            .filter(|r| r.timestamp_ms >= cutoff)
            .map(|r| r.latency_ms)
            .collect();
        if recent.is_empty() {
            return 0;
        }
        recent.sort_unstable();
        percentile(&recent, 0.50)
    }

    fn rolling_error_rate(&self, window_ms: i64) -> f64 {
        let now = Utc::now().timestamp_millis();
        let cutoff = now - window_ms;
        let recent: Vec<&RequestRecord> = self
            .records
            .iter()
            .filter(|r| r.timestamp_ms >= cutoff)
            .collect();
        if recent.is_empty() {
            return 0.0;
        }
        let errors = recent.iter().filter(|r| r.error).count();
        errors as f64 / recent.len() as f64
    }

    fn rolling_rps(&self, window_ms: i64) -> f64 {
        let now = Utc::now().timestamp_millis();
        let cutoff = now - window_ms;
        let count = self
            .records
            .iter()
            .filter(|r| r.timestamp_ms >= cutoff)
            .count();
        if window_ms <= 0 {
            return 0.0;
        }
        count as f64 / (window_ms as f64 / 1000.0)
    }
}

fn format_duration_ms(ms: u64) -> String {
    if ms < 1000 {
        format!("{}ms", ms)
    } else {
        format!("{:.1}s", ms as f64 / 1000.0)
    }
}

// ---------------------------------------------------------------------------
// Report building
// ---------------------------------------------------------------------------

fn build_report(
    records: &[RequestRecord],
    session_count: usize,
    max_concurrency: usize,
    wall_duration: Duration,
    ch_metrics: Vec<ChMetricEvent>,
    cr_metrics: Vec<CrMetric>,
    test_start: chrono::DateTime<Utc>,
) -> Report {
    let total = records.len();
    let errors = records.iter().filter(|r| r.error).count();
    let duration_secs = wall_duration.as_secs_f64();

    let mut by_endpoint: HashMap<&str, Vec<u64>> = HashMap::new();
    let mut error_by_endpoint: HashMap<&str, usize> = HashMap::new();
    for r in records {
        by_endpoint.entry(&r.endpoint).or_default().push(r.latency_ms);
        if r.error {
            *error_by_endpoint.entry(&r.endpoint).or_default() += 1;
        }
    }

    let mut endpoints: Vec<EndpointStats> = by_endpoint
        .into_iter()
        .map(|(ep, mut lats)| {
            lats.sort_unstable();
            EndpointStats {
                endpoint: ep.to_string(),
                count: lats.len(),
                errors: *error_by_endpoint.get(ep).unwrap_or(&0),
                p50_ms: percentile(&lats, 0.50),
                p95_ms: percentile(&lats, 0.95),
                p99_ms: percentile(&lats, 0.99),
            }
        })
        .collect();
    endpoints.sort_by(|a, b| a.endpoint.cmp(&b.endpoint));

    let test_end = test_start + chrono::Duration::from_std(wall_duration).unwrap_or_default();

    Report {
        test_start: test_start.to_rfc3339(),
        test_end: test_end.to_rfc3339(),
        duration_secs,
        total_sessions: session_count,
        total_requests: total,
        total_errors: errors,
        error_rate: if total > 0 {
            errors as f64 / total as f64
        } else {
            0.0
        },
        throughput_rps: if duration_secs > 0.0 {
            total as f64 / duration_secs
        } else {
            0.0
        },
        sessions_per_sec: if duration_secs > 0.0 {
            session_count as f64 / duration_secs
        } else {
            0.0
        },
        max_concurrency,
        endpoints,
        clickhouse_metrics: ch_metrics,
        cloud_run_metrics: cr_metrics,
    }
}

fn print_report(report: &Report) {
    println!("\n=== Load Test Report ===");
    println!(
        "Duration: {:.1}s | Sessions: {} | Requests: {} | Errors: {} ({:.1}%)",
        report.duration_secs,
        report.total_sessions,
        report.total_requests,
        report.total_errors,
        report.error_rate * 100.0
    );
    println!(
        "Throughput: {:.1} req/s | {:.1} sessions/s | Max concurrency: {}",
        report.throughput_rps, report.sessions_per_sec, report.max_concurrency
    );
    println!();
    println!(
        "{:<25} {:>7} {:>8} {:>8} {:>8} {:>8}",
        "Endpoint", "Count", "p50", "p95", "p99", "Errors"
    );
    println!("{}", "─".repeat(73));
    for ep in &report.endpoints {
        println!(
            "{:<25} {:>7} {:>7}ms {:>7}ms {:>7}ms {:>7}",
            ep.endpoint, ep.count, ep.p50_ms, ep.p95_ms, ep.p99_ms, ep.errors
        );
    }
    println!();
}

// ---------------------------------------------------------------------------
// HTML report (unchanged from original)
// ---------------------------------------------------------------------------

fn write_html_report(report: &Report, path: &str) -> Result<()> {
    let json_data = serde_json::to_string(report)?;
    let html = format!(
        r##"<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Load Test Report</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<style>
body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; background: #f5f5f5; }}
h1 {{ color: #333; }}
.summary {{ background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }}
.summary .stat {{ display: inline-block; margin-right: 30px; }}
.summary .stat .value {{ font-size: 24px; font-weight: bold; color: #2563eb; }}
.summary .stat .label {{ font-size: 12px; color: #666; text-transform: uppercase; }}
table {{ width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }}
th {{ background: #2563eb; color: white; padding: 12px; text-align: left; }}
td {{ padding: 10px 12px; border-bottom: 1px solid #eee; }}
tr:hover {{ background: #f8fafc; }}
.chart-container {{ background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }}
</style>
</head>
<body>
<h1>Load Test Report</h1>
<div class="summary">
  <div class="stat"><div class="value" id="duration"></div><div class="label">Duration</div></div>
  <div class="stat"><div class="value" id="sessions"></div><div class="label">Sessions</div></div>
  <div class="stat"><div class="value" id="requests"></div><div class="label">Requests</div></div>
  <div class="stat"><div class="value" id="rps"></div><div class="label">Req/s</div></div>
  <div class="stat"><div class="value" id="errors"></div><div class="label">Error Rate</div></div>
  <div class="stat"><div class="value" id="concurrency"></div><div class="label">Max Concurrency</div></div>
</div>
<table>
  <thead><tr><th>Endpoint</th><th>Count</th><th>p50</th><th>p95</th><th>p99</th><th>Errors</th></tr></thead>
  <tbody id="endpoint-table"></tbody>
</table>
<div class="chart-container"><canvas id="latencyChart"></canvas></div>
<div class="chart-container"><canvas id="throughputChart"></canvas></div>
<div class="chart-container" id="chContainer" style="display:none"><canvas id="chChart"></canvas></div>
<div class="chart-container" id="crContainer" style="display:none"><canvas id="crChart"></canvas></div>
<script>
const DATA = {json_data};
document.getElementById('duration').textContent = DATA.duration_secs.toFixed(1) + 's';
document.getElementById('sessions').textContent = DATA.total_sessions.toLocaleString();
document.getElementById('requests').textContent = DATA.total_requests.toLocaleString();
document.getElementById('rps').textContent = DATA.throughput_rps.toFixed(1);
document.getElementById('errors').textContent = (DATA.error_rate * 100).toFixed(1) + '%';
document.getElementById('concurrency').textContent = DATA.max_concurrency;
const tbody = document.getElementById('endpoint-table');
DATA.endpoints.forEach(ep => {{
  const row = tbody.insertRow();
  [ep.endpoint, ep.count, ep.p50_ms + 'ms', ep.p95_ms + 'ms', ep.p99_ms + 'ms', ep.errors].forEach(v => {{
    row.insertCell().textContent = v;
  }});
}});
const startMs = DATA.time_series && DATA.time_series.length ? Math.min(...DATA.time_series.map(r => r.timestamp_ms)) : 0;
const bucketSize = 1000;
const latBuckets = {{}};
if (DATA.time_series) DATA.time_series.forEach(r => {{
  const t = Math.floor((r.timestamp_ms - startMs) / bucketSize);
  if (!latBuckets[t]) latBuckets[t] = [];
  latBuckets[t].push(r.latency_ms);
}});
const latLabels = Object.keys(latBuckets).map(Number).sort((a,b) => a-b);
const p50Data = latLabels.map(t => {{
  const sorted = latBuckets[t].sort((a,b) => a-b);
  return sorted[Math.floor(sorted.length * 0.5)];
}});
const p95Data = latLabels.map(t => {{
  const sorted = latBuckets[t].sort((a,b) => a-b);
  return sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length-1];
}});
new Chart(document.getElementById('latencyChart'), {{
  type: 'line',
  data: {{
    labels: latLabels.map(t => t + 's'),
    datasets: [
      {{ label: 'p50 (ms)', data: p50Data, borderColor: '#2563eb', fill: false, tension: 0.3, pointRadius: 0 }},
      {{ label: 'p95 (ms)', data: p95Data, borderColor: '#dc2626', fill: false, tension: 0.3, pointRadius: 0 }},
    ]
  }},
  options: {{ plugins: {{ title: {{ display: true, text: 'Latency Over Time' }} }} }}
}});
const tpData = latLabels.map(t => latBuckets[t] ? latBuckets[t].length : 0);
new Chart(document.getElementById('throughputChart'), {{
  type: 'line',
  data: {{
    labels: latLabels.map(t => t + 's'),
    datasets: [{{ label: 'Requests/sec', data: tpData, borderColor: '#059669', fill: true, backgroundColor: 'rgba(5,150,105,0.1)', tension: 0.3, pointRadius: 0 }}]
  }},
  options: {{ plugins: {{ title: {{ display: true, text: 'Throughput Over Time' }} }} }}
}});
if (DATA.clickhouse_metrics && DATA.clickhouse_metrics.length) {{
  document.getElementById('chContainer').style.display = 'block';
  const chStart = Math.min(...DATA.clickhouse_metrics.map(m => m.timestamp_ms));
  new Chart(document.getElementById('chChart'), {{
    type: 'line',
    data: {{
      labels: DATA.clickhouse_metrics.map(m => ((m.timestamp_ms - chStart) / 1000).toFixed(0) + 's'),
      datasets: [{{ label: 'Active ClickHouse Queries', data: DATA.clickhouse_metrics.map(m => m.active_queries), borderColor: '#f59e0b', fill: true, backgroundColor: 'rgba(245,158,11,0.1)', tension: 0.3 }}]
    }},
    options: {{ plugins: {{ title: {{ display: true, text: 'ClickHouse Active Queries' }} }} }}
  }});
}}
if (DATA.cloud_run_metrics && DATA.cloud_run_metrics.length) {{
  document.getElementById('crContainer').style.display = 'block';
  const byType = {{}};
  DATA.cloud_run_metrics.forEach(m => {{
    const short = m.metric_type.split('/').pop();
    if (!byType[short]) byType[short] = [];
    byType[short].push(m);
  }});
  const datasets = Object.entries(byType).map(([name, pts], i) => ({{
    label: name,
    data: pts.map(p => ({{ x: new Date(p.timestamp_ms), y: p.value }})),
    borderColor: ['#7c3aed','#0891b2','#e11d48'][i % 3],
    fill: false, tension: 0.3
  }}));
  new Chart(document.getElementById('crChart'), {{
    type: 'line',
    data: {{ datasets }},
    options: {{
      plugins: {{ title: {{ display: true, text: 'Cloud Run Metrics' }} }},
      scales: {{ x: {{ type: 'linear', title: {{ display: true, text: 'Time' }} }} }}
    }}
  }});
}}
</script>
</body>
</html>"##,
        json_data = json_data
    );
    std::fs::write(path, html)?;
    println!("HTML report written to {}", path);
    Ok(())
}

// ---------------------------------------------------------------------------
// Options controlling runner behavior
// ---------------------------------------------------------------------------

pub struct RunnerOptions {
    /// If set, write records to SQLite
    pub db: Option<LoadTestDb>,
    /// If set, broadcast events for SSE streaming
    pub event_tx: Option<broadcast::Sender<LoadTestEvent>>,
    /// Run ID (used for DB and event tagging)
    pub run_id: Option<String>,
    /// If true, suppress stdout TUI output (API mode)
    pub quiet: bool,
}

impl Default for RunnerOptions {
    fn default() -> Self {
        Self {
            db: None,
            event_tx: None,
            run_id: None,
            quiet: false,
        }
    }
}

// ---------------------------------------------------------------------------
// Main Entrypoint (shared by CLI and API)
// ---------------------------------------------------------------------------

/// Run a load test with the given config and options.
/// Returns the final report.
pub async fn run_loadtest(config: LoadTestConfig, opts: RunnerOptions) -> Result<Report> {
    let base_url = config.target.url.trim_end_matches('/').to_string();
    let run_id = opts.run_id.clone().unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    if !opts.quiet {
        println!("Load test target: {}", base_url);
        println!(
            "Mode: {} | Max duration: {}s",
            config.load.mode, config.load.max_duration_secs
        );
    }

    // Insert run into DB
    if let Some(ref db) = opts.db {
        let start_time = Utc::now().to_rfc3339();
        db.insert_run(&run_id, &config, &start_time).await?;
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .pool_max_idle_per_host(100)
        .build()?;

    let seed = fetch_seed_data(&client, &base_url).await?;
    let seed = Arc::new(seed);

    let (tx, mut rx) = mpsc::unbounded_channel::<RequestRecord>();

    let cancel = Arc::new(AtomicBool::new(false));
    let session_counter = Arc::new(AtomicUsize::new(0));
    let active_users = Arc::new(AtomicUsize::new(0));

    let test_start_chrono = Utc::now();
    let test_start = Instant::now();
    let max_duration = Duration::from_secs(config.load.max_duration_secs);
    let max_sessions = config.load.sessions;

    // Optional ClickHouse monitoring (streams metrics live via broadcast)
    let ch_cancel = cancel.clone();
    let ch_event_tx = opts.event_tx.clone();
    let ch_handle = config.target.clickhouse_url.as_ref().map(|url| {
        let ch_client = client.clone();
        let ch_url = url.clone();
        tokio::spawn(monitor_clickhouse(ch_client, ch_url, ch_cancel, ch_event_tx))
    });

    // Worker spawner closure
    let spawn_worker = |tx: mpsc::UnboundedSender<RequestRecord>,
                        client: reqwest::Client,
                        base_url: String,
                        seed: Arc<SeedData>,
                        cancel: Arc<AtomicBool>,
                        session_counter: Arc<AtomicUsize>,
                        active_users: Arc<AtomicUsize>,
                        max_sessions: usize,
                        test_start: Instant,
                        max_duration: Duration| {
        tokio::spawn(async move {
            active_users.fetch_add(1, Ordering::Relaxed);
            loop {
                if cancel.load(Ordering::Relaxed) {
                    break;
                }
                if test_start.elapsed() >= max_duration {
                    break;
                }
                if max_sessions > 0 {
                    let prev = session_counter.fetch_add(1, Ordering::Relaxed);
                    if prev >= max_sessions {
                        session_counter.fetch_sub(1, Ordering::Relaxed);
                        break;
                    }
                }
                run_session(&client, &base_url, &seed, &tx).await;
                if max_sessions == 0 {
                    session_counter.fetch_add(1, Ordering::Relaxed);
                }
            }
            active_users.fetch_sub(1, Ordering::Relaxed);
        })
    };

    let initial_count = if config.load.mode == "ramp" {
        config.load.ramp_start
    } else {
        config.load.concurrency
    };

    let mut worker_handles = Vec::new();
    for _ in 0..initial_count {
        worker_handles.push(spawn_worker(
            tx.clone(),
            client.clone(),
            base_url.clone(),
            seed.clone(),
            cancel.clone(),
            session_counter.clone(),
            active_users.clone(),
            max_sessions,
            test_start,
            max_duration,
        ));
    }

    let mut max_concurrency_reached = initial_count;
    let is_ramp = config.load.mode == "ramp";

    // Collector task
    let rolling_cancel = cancel.clone();
    let rolling_active = active_users.clone();
    let rolling_sessions = session_counter.clone();
    let event_tx = opts.event_tx.clone();
    let db_clone = opts.db.clone();
    let run_id_clone = run_id.clone();
    let quiet = opts.quiet;

    let collector_handle = tokio::spawn(async move {
        let mut rolling = RollingMetrics::new();
        let mut last_ramp = Instant::now();
        let ramp_interval = Duration::from_secs(config.load.ramp_interval_secs);
        let mut local_concurrency = initial_count;
        let mut local_max = initial_count;

        // Buffer for batching records to DB and SSE
        let mut pending_records: Vec<RequestRecord> = Vec::new();
        let mut last_flush = Instant::now();

        loop {
            // Drain records
            let mut drained = 0;
            loop {
                match rx.try_recv() {
                    Ok(rec) => {
                        rolling.add(rec.clone());
                        pending_records.push(rec);
                        drained += 1;
                    }
                    Err(_) => break,
                }
                if drained > 1000 {
                    break;
                }
            }

            // Flush batched records every 500ms
            if last_flush.elapsed() >= Duration::from_millis(500) && !pending_records.is_empty() {
                let batch = std::mem::take(&mut pending_records);

                // Broadcast to SSE subscribers
                if let Some(ref etx) = event_tx {
                    let _ = etx.send(LoadTestEvent::RequestBatch {
                        records: batch.clone(),
                    });
                }

                // Write to DB
                if let Some(ref db) = db_clone {
                    let _ = db.insert_records(&run_id_clone, batch).await;
                }

                last_flush = Instant::now();
            }

            let elapsed = test_start.elapsed();
            let secs = elapsed.as_secs();
            let mins = secs / 60;
            let remaining_secs = secs % 60;

            let users = rolling_active.load(Ordering::Relaxed);
            let rps = rolling.rolling_rps(10_000);
            let p50 = rolling.rolling_p50(10_000);
            let p95 = rolling.rolling_p95(10_000);
            let err_rate = rolling.rolling_error_rate(10_000);
            let sessions = rolling_sessions.load(Ordering::Relaxed);

            if !quiet {
                print!(
                    "\r[{:02}:{:02}] Users: {:>3} | Sessions: {:>5} | Req/s: {:>6.1} | p95: {:>6} | Errors: {:>5.1}%    ",
                    mins,
                    remaining_secs,
                    users,
                    sessions,
                    rps,
                    format_duration_ms(p95),
                    err_rate * 100.0,
                );
                let _ = std::io::stdout().flush();
            }

            // Broadcast rolling summary
            if let Some(ref etx) = event_tx {
                let _ = etx.send(LoadTestEvent::Summary(RollingSummary {
                    elapsed_secs: elapsed.as_secs_f64(),
                    active_users: users,
                    total_sessions: sessions,
                    total_requests: rolling.records.len(),
                    rps,
                    p50_ms: p50,
                    p95_ms: p95,
                    error_rate: err_rate,
                }));
            }

            // Check abort conditions
            if secs > 5 && rolling.records.len() > 10 {
                if p95 > config.abort.p95_latency_ms {
                    if !quiet {
                        println!(
                            "\nSaturation reached: p95 latency {}ms exceeds {}ms threshold",
                            p95, config.abort.p95_latency_ms
                        );
                    }
                    rolling_cancel.store(true, Ordering::Relaxed);
                }
                if err_rate > config.abort.error_rate {
                    if !quiet {
                        println!(
                            "\nSaturation reached: error rate {:.1}% exceeds {:.1}% threshold",
                            err_rate * 100.0,
                            config.abort.error_rate * 100.0
                        );
                    }
                    rolling_cancel.store(true, Ordering::Relaxed);
                }
            }

            let all_done = rolling_active.load(Ordering::Relaxed) == 0
                && !rolling.records.is_empty();
            if elapsed >= max_duration || rolling_cancel.load(Ordering::Relaxed) || all_done {
                rolling_cancel.store(true, Ordering::Relaxed);
                break;
            }

            tokio::time::sleep(Duration::from_secs(1)).await;

            if config.load.mode == "ramp" && last_ramp.elapsed() >= ramp_interval {
                last_ramp = Instant::now();
                local_concurrency += config.load.ramp_step;
                if local_concurrency > local_max {
                    local_max = local_concurrency;
                }
            }
        }

        // Final flush of any remaining records
        if !pending_records.is_empty() {
            if let Some(ref etx) = event_tx {
                let _ = etx.send(LoadTestEvent::RequestBatch {
                    records: pending_records.clone(),
                });
            }
            if let Some(ref db) = db_clone {
                let _ = db.insert_records(&run_id_clone, pending_records).await;
            }
        }

        if !quiet {
            println!();
        }
        (rolling.records, local_max)
    });

    // Ramp-up spawner
    if is_ramp {
        let ramp_cancel = cancel.clone();
        let ramp_interval = Duration::from_secs(config.load.ramp_interval_secs);
        let ramp_step = config.load.ramp_step;
        let tx_ramp = tx.clone();
        let client_ramp = client.clone();
        let base_url_ramp = base_url.clone();
        let seed_ramp = seed.clone();
        let session_counter_ramp = session_counter.clone();
        let active_users_ramp = active_users.clone();

        tokio::spawn(async move {
            let mut next_ramp = Instant::now() + ramp_interval;
            loop {
                tokio::time::sleep(Duration::from_millis(500)).await;
                if ramp_cancel.load(Ordering::Relaxed) {
                    break;
                }
                if Instant::now() >= next_ramp {
                    for _ in 0..ramp_step {
                        let _ = spawn_worker(
                            tx_ramp.clone(),
                            client_ramp.clone(),
                            base_url_ramp.clone(),
                            seed_ramp.clone(),
                            ramp_cancel.clone(),
                            session_counter_ramp.clone(),
                            active_users_ramp.clone(),
                            max_sessions,
                            test_start,
                            max_duration,
                        );
                    }
                    next_ramp = Instant::now() + ramp_interval;
                }
            }
        });
    }

    drop(tx);

    let (all_records, collector_max) = collector_handle.await?;

    cancel.store(true, Ordering::Relaxed);
    for h in worker_handles {
        let _ = h.await;
    }

    let wall_duration = test_start.elapsed();
    max_concurrency_reached = max_concurrency_reached.max(collector_max);

    // Collect ClickHouse metrics (already broadcast live, just persist to DB)
    let ch_metrics = if let Some(handle) = ch_handle {
        cancel.store(true, Ordering::Relaxed);
        let m = handle.await.unwrap_or_default();
        if let Some(ref db) = opts.db {
            let _ = db.insert_ch_metrics(&run_id, m.clone()).await;
        }
        m
    } else {
        Vec::new()
    };

    let session_count = session_counter.load(Ordering::Relaxed);
    let report = build_report(
        &all_records,
        session_count,
        max_concurrency_reached,
        wall_duration,
        ch_metrics,
        Vec::new(), // CR metrics added async later
        test_start_chrono,
    );

    // Complete the run in DB
    if let Some(ref db) = opts.db {
        db.complete_run(&run_id, report.clone()).await?;
    }

    // Broadcast completion
    if let Some(ref etx) = opts.event_tx {
        let _ = etx.send(LoadTestEvent::RunCompleted {
            run_id: run_id.clone(),
        });
    }

    // GCP metrics: spawn async if configured (don't block)
    if let Some(ref gcp) = config.gcp {
        let gcp = gcp.clone();
        let db = opts.db.clone();
        let event_tx = opts.event_tx.clone();
        let run_id = run_id.clone();
        let test_start_chrono = test_start_chrono;

        tokio::spawn(async move {
            if !quiet {
                println!("Waiting 60s for GCP metrics to propagate...");
            }
            tokio::time::sleep(Duration::from_secs(60)).await;
            let test_end = Utc::now();
            let cr_metrics = fetch_gcp_metrics(&gcp, test_start_chrono, test_end).await;

            if let Some(ref db) = db {
                let _ = db.insert_cr_metrics(&run_id, cr_metrics.clone()).await;
            }
            if let Some(ref etx) = event_tx {
                let _ = etx.send(LoadTestEvent::GcpMetricsReady {
                    run_id: run_id.clone(),
                });
            }
        });
    }

    if !opts.quiet {
        print_report(&report);
    }

    Ok(report)
}

/// CLI entrypoint: read config from TOML file and run with stdout output + HTML/JSON reports.
pub async fn run_loadtest_cli(config_path: PathBuf) -> Result<()> {
    let config_str = std::fs::read_to_string(&config_path)
        .with_context(|| format!("Failed to read config: {:?}", config_path))?;
    let config: LoadTestConfig =
        toml::from_str(&config_str).context("Failed to parse loadtest TOML")?;

    let output = config.output.clone();

    // Open SQLite for history even in CLI mode
    let db = LoadTestDb::open("loadtest.db").ok();

    let opts = RunnerOptions {
        db,
        event_tx: None,
        run_id: Some(uuid::Uuid::new_v4().to_string()),
        quiet: false,
    };

    let report = run_loadtest(config, opts).await?;

    // Write JSON
    let json = serde_json::to_string_pretty(&report)?;
    std::fs::write(&output.json_file, &json)?;
    println!("JSON report written to {}", output.json_file);

    // Write HTML
    write_html_report(&report, &output.html_file)?;

    Ok(())
}
