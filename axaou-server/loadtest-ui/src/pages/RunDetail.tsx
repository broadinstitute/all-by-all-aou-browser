import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { LatencyChart, ThroughputChart, ClickHouseCharts } from '../components/LiveCharts';
import { EndpointTable } from '../components/EndpointTable';
import type { RunDetail as RunDetailType } from '../types';

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
      const pct = (p: number) => lats[Math.floor(lats.length * p)] ?? 0;
      return {
        t,
        p50: pct(0.5),
        p95: pct(0.95),
        rps: recs.length,
        errors: recs.filter(r => r.error).length,
      };
    });

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
      <ThroughputChart data={chartPoints} />

      {detail.clickhouse_metrics.length > 0 && (() => {
        const chStart = Math.min(...detail.clickhouse_metrics.map(m => m.timestamp_ms));
        const chData = detail.clickhouse_metrics.map(m => ({
          t: Math.round((m.timestamp_ms - chStart) / 1000),
          active_queries: m.active_queries,
          memory_used_gb: m.memory_used_gb ?? 0,
          memory_total_gb: m.memory_total_gb ?? 0,
          cpu_usage_pct: m.cpu_usage_pct ?? 0,
          read_mb_sec: (m.read_bytes_sec ?? 0) / (1024 * 1024),
          merges_running: m.merges_running ?? 0,
        }));
        return <ClickHouseCharts data={chData} />;
      })()}

      {detail.cloud_run_metrics.length > 0 && (
        <div style={{ background: 'white', padding: 16, borderRadius: 8, marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 8px' }}>Cloud Run Metrics</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '6px 12px' }}>Metric</th>
                <th style={{ textAlign: 'right', padding: '6px 12px' }}>Time</th>
                <th style={{ textAlign: 'right', padding: '6px 12px' }}>Value</th>
              </tr>
            </thead>
            <tbody>
              {detail.cloud_run_metrics.map((m, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '4px 12px', fontFamily: 'monospace', fontSize: 12 }}>
                    {m.metric_type.split('/').pop()}
                  </td>
                  <td style={{ padding: '4px 12px', textAlign: 'right', fontSize: 12 }}>
                    {new Date(m.timestamp_ms).toLocaleTimeString()}
                  </td>
                  <td style={{ padding: '4px 12px', textAlign: 'right' }}>
                    {m.value.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <EndpointTable stats={detail.endpoints} />
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
