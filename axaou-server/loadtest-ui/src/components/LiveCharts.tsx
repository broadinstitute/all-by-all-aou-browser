import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

import type { ChartPoint, ChMetricPoint } from '../hooks/useLoadTestStream';

interface Props {
  data: ChartPoint[];
}

export function LatencyChart({ data }: Props) {
  return (
    <div style={{ background: 'white', padding: 16, borderRadius: 8, marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 8px' }}>Latency Over Time</h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="t" tickFormatter={v => `${v}s`} />
          <YAxis unit="ms" />
          <Tooltip labelFormatter={v => `${v}s`} />
          <Legend />
          <Line type="monotone" dataKey="p50" name="p50 (ms)" stroke="#2563eb" dot={false} strokeWidth={2} isAnimationActive={false} />
          <Line type="monotone" dataKey="p95" name="p95 (ms)" stroke="#dc2626" dot={false} strokeWidth={2} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ThroughputChart({ data }: Props) {
  return (
    <div style={{ background: 'white', padding: 16, borderRadius: 8, marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 8px' }}>Throughput (req/s)</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="t" tickFormatter={v => `${v}s`} />
          <YAxis />
          <Tooltip labelFormatter={v => `${v}s`} />
          <Bar dataKey="rps" name="Requests" fill="#059669" isAnimationActive={false} />
          <Bar dataKey="errors" name="Errors" fill="#dc2626" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ClickHouseCharts({ data }: { data: ChMetricPoint[] }) {
  if (data.length === 0) return null;

  const latest = data[data.length - 1];
  const memUsed = latest.memory_used_gb ?? 0;
  const memTotal = latest.memory_total_gb ?? 0;
  const memPct = memTotal > 0 ? ((memUsed / memTotal) * 100).toFixed(1) : '?';

  return (
    <div style={{ background: 'white', padding: 16, borderRadius: 8, marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 12px' }}>ClickHouse Resource Usage</h3>

      {/* Summary stats */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 12, fontSize: 13, flexWrap: 'wrap' }}>
        <span>Memory: <b>{memUsed.toFixed(1)}</b> / {memTotal.toFixed(1)} GB ({memPct}%)</span>
        <span>Query mem: <b>{(latest.query_memory_gb ?? 0).toFixed(2)}</b> GB</span>
        <span>Queries: <b>{latest.active_queries ?? 0}</b></span>
        <span>Threads: <b>{(latest.thread_saturation ?? 0).toFixed(0)}%</b> saturated</span>
        <span>Merges: <b>{latest.merges_running ?? 0}</b></span>
      </div>

      {/* Queries + Merges */}
      <ResponsiveContainer width="100%" height={150}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="t" tickFormatter={v => `${v}s`} />
          <YAxis allowDecimals={false} />
          <Tooltip labelFormatter={v => `${v}s`} />
          <Legend />
          <Line type="stepAfter" dataKey="active_queries" name="Active Queries" stroke="#f59e0b" dot={false} strokeWidth={2} isAnimationActive={false} />
          <Line type="stepAfter" dataKey="merges_running" name="Merges" stroke="#8b5cf6" dot={false} strokeWidth={1} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>

      {/* Memory */}
      <ResponsiveContainer width="100%" height={150}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="t" tickFormatter={v => `${v}s`} />
          <YAxis unit=" GB" />
          <Tooltip labelFormatter={v => `${v}s`} />
          <Legend />
          <Line type="monotone" dataKey="memory_used_gb" name="Memory Used (GB)" stroke="#dc2626" dot={false} strokeWidth={2} isAnimationActive={false} />
          <Line type="monotone" dataKey="memory_total_gb" name="Memory Total (GB)" stroke="#9ca3af" dot={false} strokeWidth={1} strokeDasharray="5 5" isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>

      {/* CPU + Disk IO */}
      <ResponsiveContainer width="100%" height={150}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="t" tickFormatter={v => `${v}s`} />
          <YAxis yAxisId="cpu" unit="%" />
          <YAxis yAxisId="io" orientation="right" unit=" MB/s" />
          <Tooltip labelFormatter={v => `${v}s`} />
          <Legend />
          <Line yAxisId="cpu" type="monotone" dataKey="cpu_usage_pct" name="CPU %" stroke="#2563eb" dot={false} strokeWidth={2} isAnimationActive={false} />
          <Line yAxisId="io" type="monotone" dataKey="read_mb_sec" name="Disk Read (MB/s)" stroke="#059669" dot={false} strokeWidth={2} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>

      {/* Saturation: thread usage, CPU wait, IO wait, cache misses */}
      <ResponsiveContainer width="100%" height={150}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="t" tickFormatter={v => `${v}s`} />
          <YAxis yAxisId="pct" unit="%" domain={[0, 100]} />
          <YAxis yAxisId="rate" orientation="right" />
          <Tooltip labelFormatter={v => `${v}s`} />
          <Legend />
          <Line yAxisId="pct" type="monotone" dataKey="thread_saturation" name="Thread Saturation %" stroke="#dc2626" dot={false} strokeWidth={2} isAnimationActive={false} />
          <Line yAxisId="rate" type="monotone" dataKey="cpu_wait_ms_sec" name="CPU Wait (ms/s)" stroke="#f59e0b" dot={false} strokeWidth={2} isAnimationActive={false} />
          <Line yAxisId="rate" type="monotone" dataKey="io_wait_ms_sec" name="Disk Read Wait (ms/s)" stroke="#7c3aed" dot={false} strokeWidth={2} isAnimationActive={false} />
          <Line yAxisId="rate" type="monotone" dataKey="page_cache_miss_sec" name="Cache Miss/s" stroke="#0891b2" dot={false} strokeWidth={1} strokeDasharray="5 5" isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
