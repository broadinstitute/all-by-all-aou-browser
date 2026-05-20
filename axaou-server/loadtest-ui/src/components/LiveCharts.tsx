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

  const latestMem = data[data.length - 1];
  const memPct = latestMem.memory_total_gb > 0
    ? ((latestMem.memory_used_gb / latestMem.memory_total_gb) * 100).toFixed(1)
    : '?';

  return (
    <div style={{ background: 'white', padding: 16, borderRadius: 8, marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 12px' }}>ClickHouse Resource Usage</h3>

      {/* Summary stats */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 12, fontSize: 13 }}>
        <span>Memory: <b>{latestMem.memory_used_gb.toFixed(1)}</b> / {latestMem.memory_total_gb.toFixed(1)} GB ({memPct}%)</span>
        <span>Queries: <b>{latestMem.active_queries}</b></span>
        <span>Merges: <b>{latestMem.merges_running}</b></span>
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
    </div>
  );
}
