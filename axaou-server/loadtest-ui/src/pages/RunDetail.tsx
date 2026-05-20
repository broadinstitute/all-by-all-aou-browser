import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { LatencyChart, ThroughputChart, ClickHouseCharts } from '../components/LiveCharts';
import { EndpointLatencyChart } from '../components/EndpointLatencyChart';
import { EndpointTable } from '../components/EndpointTable';
import { ErrorLog } from '../components/ErrorLog';
import { GcpMetricsPanel } from '../components/GcpMetricsPanel';
import type { RunDetail as RunDetailType } from '../types';
import type { ChMetricPoint } from '../hooks/useLoadTestStream';

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(Math.floor(sorted.length * p), sorted.length - 1)];
}

export function RunDetail() {
  const { runId } = useParams<{ runId: string }>();
  const [detail, setDetail] = useState<RunDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) return;
    fetch(`/api/loadtest/runs/${runId}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setDetail)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [runId]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: '#dc2626' }}>Error: {error}</p>;
  if (!detail) return <p>Run not found.</p>;

  const { summary } = detail;

  // Build chart data from time_series
  const startMs = detail.time_series.length > 0
    ? Math.min(...detail.time_series.map(r => r.timestamp_ms))
    : 0;

  const buckets = new Map<number, typeof detail.time_series>();
  for (const r of detail.time_series) {
    const sec = Math.floor((r.timestamp_ms - startMs) / 1000);
    let arr = buckets.get(sec);
    if (!arr) { arr = []; buckets.set(sec, arr); }
    arr.push(r);
  }

  const chartPoints = Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([t, recs]) => {
      const lats = recs.map(r => r.latency_ms).sort((a, b) => a - b);
      return {
        t,
        p50: pct(lats, 0.5),
        p95: pct(lats, 0.95),
        rps: recs.length,
        errors: recs.filter(r => r.error).length,
      };
    });

  // Build CH metrics chart data
  const chData: ChMetricPoint[] = detail.clickhouse_metrics.length > 0
    ? (() => {
        const chStart = Math.min(...detail.clickhouse_metrics.map(m => m.timestamp_ms));
        return detail.clickhouse_metrics.map(m => ({
          t: Math.round((m.timestamp_ms - chStart) / 1000),
          active_queries: m.active_queries ?? 0,
          memory_used_gb: m.memory_used_gb ?? 0,
          memory_total_gb: m.memory_total_gb ?? 0,
          cpu_usage_pct: m.cpu_usage_pct ?? 0,
          read_mb_sec: (m.read_bytes_sec ?? 0) / (1024 * 1024),
          merges_running: m.merges_running ?? 0,
          query_memory_gb: m.query_memory_gb ?? 0,
          thread_saturation: (m.thread_saturation ?? 0) * 100,
          cpu_wait_ms_sec: (m.cpu_wait_us_sec ?? 0) / 1000,
          io_wait_ms_sec: (m.io_wait_us_sec ?? 0) / 1000,
          page_cache_miss_sec: m.page_cache_miss_sec ?? 0,
        }));
      })()
    : [];

  // Check if GCP was configured (from the stored config)
  const gcpConfigured = !!(summary.config?.gcp?.project_id);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <Link to="/runs" style={{ color: '#2563eb' }}>History</Link>
        <h1 style={{ margin: 0, fontSize: 24 }}>Run {summary.id.slice(0, 8)}...</h1>
        <span style={{
          padding: '2px 8px',
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 'bold',
          background: summary.status === 'completed' ? '#d1fae5' : '#fee2e2',
          color: summary.status === 'completed' ? '#065f46' : '#991b1b',
        }}>
          {summary.status}
        </span>
      </div>

      <div style={{
        background: 'white',
        padding: 16,
        borderRadius: 8,
        marginBottom: 16,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: 16,
      }}>
        <Stat label="Duration" value={summary.duration_secs ? `${summary.duration_secs.toFixed(1)}s` : '-'} />
        <Stat label="Sessions" value={summary.total_sessions.toLocaleString()} />
        <Stat label="Requests" value={summary.total_requests.toLocaleString()} />
        <Stat label="Throughput" value={`${summary.throughput_rps.toFixed(1)} req/s`} />
        <Stat label="Max Concurrency" value={String(summary.max_concurrency)} />
        <Stat
          label="Error Rate"
          value={`${(summary.error_rate * 100).toFixed(1)}%`}
          color={summary.error_rate > 0.01 ? '#dc2626' : undefined}
        />
      </div>

      <LatencyChart data={chartPoints} />
      <EndpointLatencyChart records={detail.time_series} />
      <ThroughputChart data={chartPoints} />
      <ClickHouseCharts data={chData} />
      <EndpointTable stats={detail.endpoints} />
      <ErrorLog records={detail.time_series} />
      {gcpConfigured && runId && (
        <GcpMetricsPanel runId={runId} completed={true} gcpConfigured={true} />
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 'bold', color: color ?? '#2563eb' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}
