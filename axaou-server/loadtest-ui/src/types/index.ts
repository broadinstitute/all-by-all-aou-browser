export interface LoadTestConfig {
  target: {
    url: string;
    clickhouse_url?: string;
  };
  load: {
    mode: string;
    concurrency: number;
    ramp_start: number;
    ramp_step: number;
    ramp_interval_secs: number;
    max_duration_secs: number;
    sessions: number;
  };
  abort: {
    p95_latency_ms: number;
    error_rate: number;
  };
  gcp?: {
    project_id: string;
    service_name: string;
  };
  output: {
    json_file: string;
    html_file: string;
  };
}

export interface RequestRecord {
  timestamp_ms: number;
  endpoint: string;
  status: number;
  latency_ms: number;
  error: boolean;
}

export interface RollingSummary {
  elapsed_secs: number;
  active_users: number;
  total_sessions: number;
  total_requests: number;
  rps: number;
  p50_ms: number;
  p95_ms: number;
  error_rate: number;
}

export interface EndpointStats {
  endpoint: string;
  count: number;
  errors: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
}

export interface RunSummary {
  id: string;
  status: string;
  start_time: string;
  end_time?: string;
  duration_secs?: number;
  total_sessions: number;
  total_requests: number;
  total_errors: number;
  error_rate: number;
  throughput_rps: number;
  max_concurrency: number;
  config: LoadTestConfig;
}

export interface RunDetail {
  summary: RunSummary;
  endpoints: EndpointStats[];
  time_series: RequestRecord[];
  clickhouse_metrics: {
    timestamp_ms: number;
    active_queries: number;
    memory_used_gb?: number;
    memory_total_gb?: number;
    cpu_usage_pct?: number;
    read_bytes_sec?: number;
    merges_running?: number;
  }[];
  cloud_run_metrics: { timestamp_ms: number; metric_type: string; value: number }[];
}

export type LoadTestEvent =
  | { type: 'request_batch'; records: RequestRecord[] }
  | { type: 'ch_metric'; timestamp_ms: number; active_queries: number; memory_used_gb?: number; memory_total_gb?: number; cpu_usage_pct?: number; read_bytes_sec?: number; merges_running?: number; query_memory_gb?: number; thread_saturation?: number; cpu_wait_us_sec?: number; io_wait_us_sec?: number; page_cache_miss_sec?: number }
  | { type: 'summary'; } & RollingSummary
  | { type: 'run_completed'; run_id: string }
  | { type: 'gcp_metrics_ready'; run_id: string };
