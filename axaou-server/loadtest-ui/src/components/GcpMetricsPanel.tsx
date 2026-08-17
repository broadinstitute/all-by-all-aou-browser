import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { RunDetail } from '../types';

interface Props {
  runId: string;
  completed: boolean;
  gcpConfigured: boolean;
}

function formatBytes(b: number): string {
  if (b > 1024 * 1024) return (b / (1024 * 1024)).toFixed(1) + ' MB';
  if (b > 1024) return (b / 1024).toFixed(1) + ' KB';
  return Math.round(b) + ' B';
}

export function GcpMetricsPanel({ runId, completed, gcpConfigured }: Props) {
  // If completed is already true on first render, this is a historical view
  const [wasCompletedOnMount] = useState(completed);
  const [countdown, setCountdown] = useState<number | null>(wasCompletedOnMount ? 0 : null);
  const [completedAt, setCompletedAt] = useState<number | null>(wasCompletedOnMount ? Date.now() : null);
  const [metrics, setMetrics] = useState<RunDetail['cloud_run_metrics'] | null>(null);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    if (completed && completedAt === null) {
      setCompletedAt(Date.now());
    }
  }, [completed, completedAt]);

  useEffect(() => {
    if (wasCompletedOnMount || !completedAt || !gcpConfigured || metrics) return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - completedAt) / 1000);
      const remaining = 65 - elapsed;
      if (remaining <= 0) {
        setCountdown(0);
        clearInterval(interval);
      } else {
        setCountdown(remaining);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [wasCompletedOnMount, completedAt, gcpConfigured, metrics]);

  useEffect(() => {
    if (countdown !== 0 || !gcpConfigured || metrics || polling) return;
    setPolling(true);

    const poll = async () => {
      for (let i = 0; i < 6; i++) {
        try {
          const resp = await fetch(`/api/loadtest/runs/${runId}`);
          if (resp.ok) {
            const detail: RunDetail = await resp.json();
            if (detail.cloud_run_metrics && detail.cloud_run_metrics.length > 0) {
              setMetrics(detail.cloud_run_metrics);
              return;
            }
          }
        } catch { /* retry */ }
        await new Promise(r => setTimeout(r, 10000));
      }
      setMetrics([]);
    };
    poll();
  }, [countdown, gcpConfigured, metrics, polling, runId]);

  if (!gcpConfigured) return null;
  if (!completed) return null;

  if (metrics === null) {
    return (
      <div style={{
        background: '#fef3c7', padding: 12, borderRadius: 8, marginBottom: 16,
        color: '#92400e', display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%', background: '#f59e0b',
          animation: 'pulse 1s infinite',
        }} />
        Cloud Run metrics arriving in ~{countdown ?? '?'}s
        <span style={{ fontSize: 12, color: '#b45309' }}>(GCP Monitoring API has a ~60s propagation delay)</span>
      </div>
    );
  }

  if (metrics.length === 0) {
    return (
      <div style={{ background: '#f3f4f6', padding: 12, borderRadius: 8, marginBottom: 16, color: '#666' }}>
        No Cloud Run metrics found. The service may not have been under enough load, or gcloud auth may have failed.
      </div>
    );
  }

  // Group by metric type, build chart data
  const byType = new Map<string, { timestamp_ms: number; value: number }[]>();
  for (const m of metrics) {
    let arr = byType.get(m.metric_type);
    if (!arr) { arr = []; byType.set(m.metric_type, arr); }
    arr.push({ timestamp_ms: m.timestamp_ms, value: m.value });
  }

  // Find global time range
  const allTimes = metrics.map(m => m.timestamp_ms);
  const minTime = Math.min(...allTimes);

  // Group related metrics for combined charts
  const cpuMemData = buildChartData(byType, minTime, [
    'run.googleapis.com/container/cpu/utilizations',
    'run.googleapis.com/container/memory/utilizations',
  ]);
  const instanceData = buildChartData(byType, minTime, [
    'run.googleapis.com/container/instance_count',
  ]);
  const networkData = buildChartData(byType, minTime, [
    'run.googleapis.com/container/network/sent_bytes_count',
    'run.googleapis.com/container/network/received_bytes_count',
  ]);

  return (
    <div style={{ background: 'white', padding: 16, borderRadius: 8, marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 12px' }}>Cloud Run Metrics</h3>

      {/* CPU + Memory */}
      {cpuMemData.length > 0 && (
        <>
          <h4 style={{ margin: '0 0 4px', fontSize: 13, color: '#666' }}>CPU & Memory Utilization</h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={cpuMemData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="t" tickFormatter={v => `${v}s`} />
              <YAxis tickFormatter={v => `${(v * 100).toFixed(0)}%`} />
              <Tooltip
                labelFormatter={v => `${v}s`}
                formatter={(v, name) => [`${(Number(v ?? 0) * 100).toFixed(1)}%`, String(name)]}
              />
              <Legend />
              <Line type="monotone" dataKey="cpu_utilizations" name="CPU p95" stroke="#dc2626" dot={false} strokeWidth={2} isAnimationActive={false} />
              <Line type="monotone" dataKey="memory_utilizations" name="Memory p95" stroke="#7c3aed" dot={false} strokeWidth={2} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}

      {/* Instance Count */}
      {instanceData.length > 0 && (
        <>
          <h4 style={{ margin: '8px 0 4px', fontSize: 13, color: '#666' }}>Instance Count</h4>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={instanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="t" tickFormatter={v => `${v}s`} />
              <YAxis allowDecimals={false} />
              <Tooltip labelFormatter={v => `${v}s`} />
              <Line type="stepAfter" dataKey="container_instance_count" name="Instances" stroke="#2563eb" dot={false} strokeWidth={2} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}

      {/* Network */}
      {networkData.length > 0 && (
        <>
          <h4 style={{ margin: '8px 0 4px', fontSize: 13, color: '#666' }}>Network I/O</h4>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={networkData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="t" tickFormatter={v => `${v}s`} />
              <YAxis tickFormatter={v => formatBytes(v)} />
              <Tooltip
                labelFormatter={v => `${v}s`}
                formatter={(v, name) => [formatBytes(Number(v ?? 0)) + '/s', String(name)]}
              />
              <Legend />
              <Line type="monotone" dataKey="network_sent_bytes_count" name="Sent" stroke="#f59e0b" dot={false} strokeWidth={2} isAnimationActive={false} />
              <Line type="monotone" dataKey="network_received_bytes_count" name="Received" stroke="#0891b2" dot={false} strokeWidth={2} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}

/** Merge multiple metric series into one array of chart points keyed by second offset. */
function buildChartData(
  byType: Map<string, { timestamp_ms: number; value: number }[]>,
  minTime: number,
  metricTypes: string[],
): Record<string, number>[] {
  const bySecond = new Map<number, Record<string, number>>();

  for (const mt of metricTypes) {
    const points = byType.get(mt);
    if (!points) continue;
    // Use last 2 segments to avoid collisions (cpu/utilizations vs memory/utilizations)
    const parts = mt.split('/');
    const shortName = parts.length >= 2
      ? parts.slice(-2).join('_')
      : parts.pop()!;
    for (const p of points) {
      const sec = Math.round((p.timestamp_ms - minTime) / 1000);
      let row = bySecond.get(sec);
      if (!row) { row = { t: sec }; bySecond.set(sec, row); }
      row[shortName] = p.value;
    }
  }

  return Array.from(bySecond.values()).sort((a, b) => a.t - b.t);
}
