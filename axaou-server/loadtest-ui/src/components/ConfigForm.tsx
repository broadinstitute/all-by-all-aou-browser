import { useState } from 'react';
import type { LoadTestConfig } from '../types';

const DEFAULT_CONFIG: LoadTestConfig = {
  target: { url: 'https://allbyall.researchallofus.org', clickhouse_url: 'http://localhost:8123' },
  load: {
    mode: 'static',
    concurrency: 10,
    ramp_start: 5,
    ramp_step: 5,
    ramp_interval_secs: 10,
    max_duration_secs: 60,
    sessions: 0,
  },
  abort: {
    p95_latency_ms: 30000,
    error_rate: 0.20,
  },
  gcp: {
    project_id: 'aou-neale-gwas-browser',
    service_name: 'axaou-backend-prod',
  },
  output: {
    json_file: 'loadtest-results.json',
    html_file: 'loadtest-report.html',
  },
};

interface Props {
  onStart: (config: LoadTestConfig) => void;
  disabled?: boolean;
}

export function ConfigForm({ onStart, disabled }: Props) {
  const [config, setConfig] = useState<LoadTestConfig>(DEFAULT_CONFIG);
  const isRamp = config.load.mode === 'ramp';

  const update = <K extends keyof LoadTestConfig>(
    section: K,
    field: string,
    value: string | number,
  ) => {
    setConfig(prev => ({
      ...prev,
      [section]: { ...(prev[section] as Record<string, unknown>), [field]: value },
    }));
  };

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        onStart(config);
      }}
      style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr', maxWidth: 600 }}
    >
      <label style={{ gridColumn: '1 / -1' }}>
        Target URL
        <input
          value={config.target.url}
          onChange={e => update('target', 'url', e.target.value)}
          style={{ width: '100%', padding: 6, marginTop: 4, boxSizing: 'border-box' }}
        />
      </label>

      <label>
        Mode
        <select
          value={config.load.mode}
          onChange={e => update('load', 'mode', e.target.value)}
          style={{ width: '100%', padding: 6, marginTop: 4 }}
        >
          <option value="static">Static</option>
          <option value="ramp">Ramp</option>
        </select>
      </label>

      {!isRamp && (
        <label>
          Concurrency
          <input
            type="number"
            min={1}
            value={config.load.concurrency}
            onChange={e => update('load', 'concurrency', +e.target.value)}
            style={{ width: '100%', padding: 6, marginTop: 4 }}
          />
        </label>
      )}

      {isRamp && (
        <>
          <label>
            Ramp Start
            <input
              type="number"
              min={1}
              value={config.load.ramp_start}
              onChange={e => update('load', 'ramp_start', +e.target.value)}
              style={{ width: '100%', padding: 6, marginTop: 4 }}
            />
          </label>
          <label>
            Ramp Step
            <input
              type="number"
              min={1}
              value={config.load.ramp_step}
              onChange={e => update('load', 'ramp_step', +e.target.value)}
              style={{ width: '100%', padding: 6, marginTop: 4 }}
            />
          </label>
          <label>
            Ramp Interval (s)
            <input
              type="number"
              min={1}
              value={config.load.ramp_interval_secs}
              onChange={e => update('load', 'ramp_interval_secs', +e.target.value)}
              style={{ width: '100%', padding: 6, marginTop: 4 }}
            />
          </label>
        </>
      )}

      <label>
        Max Duration (s)
        <input
          type="number"
          min={1}
          value={config.load.max_duration_secs}
          onChange={e => update('load', 'max_duration_secs', +e.target.value)}
          style={{ width: '100%', padding: 6, marginTop: 4 }}
        />
      </label>

      <label>
        Max Sessions (0=unlimited)
        <input
          type="number"
          min={0}
          value={config.load.sessions}
          onChange={e => update('load', 'sessions', +e.target.value)}
          style={{ width: '100%', padding: 6, marginTop: 4 }}
        />
      </label>

      <label>
        p95 Abort Threshold (ms)
        <input
          type="number"
          min={100}
          value={config.abort.p95_latency_ms}
          onChange={e => update('abort', 'p95_latency_ms', +e.target.value)}
          style={{ width: '100%', padding: 6, marginTop: 4 }}
        />
      </label>

      <label>
        Error Rate Abort
        <input
          type="number"
          step={0.01}
          min={0}
          max={1}
          value={config.abort.error_rate}
          onChange={e => update('abort', 'error_rate', +e.target.value)}
          style={{ width: '100%', padding: 6, marginTop: 4 }}
        />
      </label>

      <label>
        ClickHouse URL (optional)
        <input
          value={config.target.clickhouse_url ?? ''}
          onChange={e => update('target', 'clickhouse_url', e.target.value || '')}
          placeholder="http://localhost:8123"
          style={{ width: '100%', padding: 6, marginTop: 4, boxSizing: 'border-box' }}
        />
      </label>

      <label>
        GCP Project ID
        <input
          value={config.gcp?.project_id ?? ''}
          onChange={e => {
            const val = e.target.value;
            setConfig(prev => ({
              ...prev,
              gcp: val ? { project_id: val, service_name: prev.gcp?.service_name ?? '' } : undefined,
            }));
          }}
          placeholder="aou-neale-gwas-browser"
          style={{ width: '100%', padding: 6, marginTop: 4, boxSizing: 'border-box' }}
        />
      </label>

      <label>
        Cloud Run Service
        <input
          value={config.gcp?.service_name ?? ''}
          onChange={e => {
            const val = e.target.value;
            setConfig(prev => ({
              ...prev,
              gcp: val ? { project_id: prev.gcp?.project_id ?? '', service_name: val } : undefined,
            }));
          }}
          placeholder="axaou-backend-prod"
          style={{ width: '100%', padding: 6, marginTop: 4, boxSizing: 'border-box' }}
        />
      </label>

      <div style={{ gridColumn: '1 / -1', marginTop: 8 }}>
        <button
          type="submit"
          disabled={disabled}
          style={{
            padding: '10px 24px',
            fontSize: 16,
            fontWeight: 'bold',
            background: disabled ? '#999' : '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          {disabled ? 'Running...' : 'Start Load Test'}
        </button>
      </div>
    </form>
  );
}
