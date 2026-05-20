import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { RequestRecord } from '../types';

const COLORS = [
  '#dc2626', '#2563eb', '#059669', '#f59e0b', '#7c3aed',
  '#0891b2', '#e11d48', '#65a30d', '#c026d3', '#ea580c',
  '#4f46e5', '#0d9488', '#b91c1c',
];

// Only show the slowest endpoints to avoid chart clutter
const MAX_ENDPOINTS = 6;
const BUCKET_SECS = 10; // 10-second buckets for smoother lines

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(Math.floor(sorted.length * p), sorted.length - 1)];
}

interface Props {
  records: RequestRecord[];
}

export function EndpointLatencyChart({ records }: Props) {
  const { chartData, endpoints } = useMemo(() => {
    if (records.length === 0) return { chartData: [], endpoints: [] };

    const startMs = Math.min(...records.slice(0, 100).map(r => r.timestamp_ms));

    // Find the slowest endpoints by overall p95
    const byEp = new Map<string, number[]>();
    for (const r of records) {
      let arr = byEp.get(r.endpoint);
      if (!arr) { arr = []; byEp.set(r.endpoint, arr); }
      arr.push(r.latency_ms);
    }

    const epRanked = Array.from(byEp.entries())
      .map(([ep, lats]) => {
        const sorted = [...lats].sort((a, b) => a - b);
        return { ep, p95: pct(sorted, 0.95) };
      })
      .sort((a, b) => b.p95 - a.p95)
      .slice(0, MAX_ENDPOINTS)
      .map(e => e.ep);

    // Bucket by BUCKET_SECS-second windows, per endpoint
    const buckets = new Map<number, Map<string, number[]>>();
    for (const r of records) {
      if (!epRanked.includes(r.endpoint)) continue;
      const bucket = Math.floor((r.timestamp_ms - startMs) / (BUCKET_SECS * 1000)) * BUCKET_SECS;
      let epMap = buckets.get(bucket);
      if (!epMap) { epMap = new Map(); buckets.set(bucket, epMap); }
      let arr = epMap.get(r.endpoint);
      if (!arr) { arr = []; epMap.set(r.endpoint, arr); }
      arr.push(r.latency_ms);
    }

    const chartData = Array.from(buckets.entries())
      .sort(([a], [b]) => a - b)
      .map(([t, epMap]) => {
        const point: Record<string, number> = { t };
        for (const ep of epRanked) {
          const lats = epMap.get(ep);
          if (lats && lats.length >= 2) {
            const sorted = [...lats].sort((a, b) => a - b);
            point[ep] = pct(sorted, 0.95);
          }
        }
        return point;
      });

    return { chartData, endpoints: epRanked };
  }, [records]);

  if (chartData.length < 2) return null;

  return (
    <div style={{ background: 'white', padding: 16, borderRadius: 8, marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 8px' }}>Latency by Endpoint (p95, {BUCKET_SECS}s buckets)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="t" tickFormatter={v => `${v}s`} />
          <YAxis unit="ms" />
          <Tooltip labelFormatter={v => `${v}s`} formatter={(v: number) => [`${Math.round(v)}ms`]} />
          <Legend />
          {endpoints.map((ep, i) => (
            <Line
              key={ep}
              type="monotone"
              dataKey={ep}
              name={ep}
              stroke={COLORS[i % COLORS.length]}
              dot={false}
              strokeWidth={2}
              isAnimationActive={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
