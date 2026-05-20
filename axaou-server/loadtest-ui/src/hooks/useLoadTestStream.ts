import { useCallback, useEffect, useRef, useState } from 'react';
import type { EndpointStats, LoadTestEvent, RequestRecord, RollingSummary } from '../types';

export interface ChartPoint {
  t: number;
  p50: number;
  p95: number;
  rps: number;
  errors: number;
}

export interface ChMetricPoint {
  t: number;
  active_queries: number;
  memory_used_gb: number;
  memory_total_gb: number;
  cpu_usage_pct: number;
  read_mb_sec: number;
  merges_running: number;
}

interface StreamState {
  connected: boolean;
  completed: boolean;
  summary: RollingSummary | null;
  endpointStats: EndpointStats[];
  chartPoints: ChartPoint[];
  allRecords: RequestRecord[];
  chMetrics: ChMetricPoint[];
  gcpReady: boolean;
}

const WINDOW = 120;

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(Math.floor(sorted.length * p), sorted.length - 1)];
}

function computeEndpointStats(records: RequestRecord[]): EndpointStats[] {
  const byEp = new Map<string, number[]>();
  const errByEp = new Map<string, number>();
  for (const r of records) {
    let arr = byEp.get(r.endpoint);
    if (!arr) { arr = []; byEp.set(r.endpoint, arr); }
    arr.push(r.latency_ms);
    if (r.error) errByEp.set(r.endpoint, (errByEp.get(r.endpoint) ?? 0) + 1);
  }
  const stats: EndpointStats[] = [];
  for (const [ep, lats] of byEp) {
    lats.sort((a, b) => a - b);
    stats.push({
      endpoint: ep,
      count: lats.length,
      errors: errByEp.get(ep) ?? 0,
      p50_ms: pct(lats, 0.5),
      p95_ms: pct(lats, 0.95),
      p99_ms: pct(lats, 0.99),
    });
  }
  return stats.sort((a, b) => b.p95_ms - a.p95_ms);
}

/** Compute a frozen chart point from a completed bucket. */
function bucketToPoint(t: number, recs: RequestRecord[]): ChartPoint {
  const lats = recs.map(r => r.latency_ms).sort((a, b) => a - b);
  return {
    t,
    p50: pct(lats, 0.5),
    p95: pct(lats, 0.95),
    rps: recs.length,
    errors: recs.filter(r => r.error).length,
  };
}

export function useLoadTestStream(runId: string | null) {
  const [state, setState] = useState<StreamState>({
    connected: false,
    completed: false,
    summary: null,
    endpointStats: [],
    chartPoints: [],
    allRecords: [],
    chMetrics: [],
    gcpReady: false,
  });

  const allRecords = useRef<RequestRecord[]>([]);
  const startMs = useRef<number | null>(null);
  const chStartMs = useRef<number | null>(null);
  // Raw records per second bucket (mutable, not in React state)
  const buckets = useRef<Map<number, RequestRecord[]>>(new Map());
  // Chart points that have been frozen (bucket is old enough)
  const frozenPoints = useRef<Map<number, ChartPoint>>(new Map());

  const reset = useCallback(() => {
    allRecords.current = [];
    startMs.current = null;
    chStartMs.current = null;
    buckets.current = new Map();
    frozenPoints.current = new Map();
    setState({
      connected: false,
      completed: false,
      summary: null,
      endpointStats: [],
      chartPoints: [],
      allRecords: [],
      chMetrics: [],
      gcpReady: false,
    });
  }, []);

  useEffect(() => {
    if (!runId) return;
    reset();

    const es = new EventSource(`/api/loadtest/stream/${runId}`);

    es.onopen = () => {
      setState(s => ({ ...s, connected: true }));
    };

    es.onmessage = (msg) => {
      try {
        const event: LoadTestEvent = JSON.parse(msg.data);

        if (event.type === 'request_batch') {
          const records = event.records;
          allRecords.current.push(...records);

          if (startMs.current === null && records.length > 0) {
            startMs.current = records[0].timestamp_ms;
          }

          // Add to raw buckets
          for (const r of records) {
            const sec = Math.floor((r.timestamp_ms - (startMs.current ?? r.timestamp_ms)) / 1000);
            let arr = buckets.current.get(sec);
            if (!arr) { arr = []; buckets.current.set(sec, arr); }
            arr.push(r);
          }

          // Find the latest bucket second
          const keys = Array.from(buckets.current.keys());
          const maxSec = keys.length > 0 ? Math.max(...keys) : 0;

          // Freeze any bucket that's >= 2 seconds behind the latest
          for (const sec of keys) {
            if (sec <= maxSec - 2 && !frozenPoints.current.has(sec)) {
              frozenPoints.current.set(sec, bucketToPoint(sec, buckets.current.get(sec)!));
            }
          }

          // Build chart: frozen points + live point for the most recent complete-ish bucket
          const allPoints = new Map(frozenPoints.current);
          // Add the "almost done" bucket (maxSec - 1) as a live preview
          const previewSec = maxSec - 1;
          if (previewSec >= 0 && !allPoints.has(previewSec) && buckets.current.has(previewSec)) {
            allPoints.set(previewSec, bucketToPoint(previewSec, buckets.current.get(previewSec)!));
          }

          const sorted = Array.from(allPoints.entries())
            .sort(([a], [b]) => a - b);
          const trimStart = sorted.length > WINDOW ? sorted[sorted.length - WINDOW][0] : -Infinity;
          const chartPoints = sorted
            .filter(([k]) => k >= trimStart)
            .map(([, pt]) => pt);

          setState(prev => ({
            ...prev,
            chartPoints,
            endpointStats: computeEndpointStats(allRecords.current),
            allRecords: [...allRecords.current],
          }));
        } else if (event.type === 'ch_metric') {
          if (chStartMs.current === null) {
            chStartMs.current = event.timestamp_ms;
          }
          const t = Math.round((event.timestamp_ms - chStartMs.current) / 1000);
          setState(prev => ({
            ...prev,
            chMetrics: [...prev.chMetrics, {
              t,
              active_queries: event.active_queries,
              memory_used_gb: event.memory_used_gb ?? 0,
              memory_total_gb: event.memory_total_gb ?? 0,
              cpu_usage_pct: event.cpu_usage_pct ?? 0,
              read_mb_sec: (event.read_bytes_sec ?? 0) / (1024 * 1024),
              merges_running: event.merges_running ?? 0,
            }],
          }));
        } else if (event.type === 'summary') {
          const { type: _, ...summary } = event;
          setState(prev => ({ ...prev, summary: summary as RollingSummary }));
        } else if (event.type === 'gcp_metrics_ready') {
          setState(prev => ({ ...prev, gcpReady: true }));
        } else if (event.type === 'run_completed') {
          // Freeze all remaining buckets on completion
          for (const [sec, recs] of buckets.current) {
            if (!frozenPoints.current.has(sec)) {
              frozenPoints.current.set(sec, bucketToPoint(sec, recs));
            }
          }
          const sorted = Array.from(frozenPoints.current.values())
            .sort((a, b) => a.t - b.t);
          setState(prev => ({
            ...prev,
            completed: true,
            chartPoints: sorted,
          }));
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      setState(s => ({ ...s, connected: false }));
    };

    return () => {
      es.close();
    };
  }, [runId, reset]);

  return state;
}
