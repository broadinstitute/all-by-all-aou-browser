import { useCallback, useState } from 'react';
import { ConfigForm } from '../components/ConfigForm';
import { SummaryBar } from '../components/SummaryBar';
import { LatencyChart, ThroughputChart, ClickHouseCharts } from '../components/LiveCharts';
import { EndpointTable } from '../components/EndpointTable';
import { ErrorLog } from '../components/ErrorLog';
import { GcpMetricsPanel } from '../components/GcpMetricsPanel';
import { useLoadTestStream } from '../hooks/useLoadTestStream';
import type { LoadTestConfig } from '../types';

export function Dashboard() {
  const [runId, setRunId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [gcpConfigured, setGcpConfigured] = useState(false);
  const stream = useLoadTestStream(runId);

  const handleStart = useCallback(async (config: LoadTestConfig) => {
    setStarting(true);
    try {
      const resp = await fetch('/api/loadtest/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!resp.ok) {
        const text = await resp.text();
        alert(`Failed to start: ${text}`);
        return;
      }
      const data = await resp.json();
      setGcpConfigured(!!(config.gcp?.project_id && config.gcp?.service_name));
      setRunId(data.run_id);
    } catch (err) {
      alert(`Network error: ${err}`);
    } finally {
      setStarting(false);
    }
  }, []);

  const handleStop = useCallback(async () => {
    if (!runId) return;
    await fetch(`/api/loadtest/stop/${runId}`, { method: 'POST' });
  }, [runId]);

  const handleReset = useCallback(() => {
    setRunId(null);
  }, []);

  const isRunning = runId !== null && !stream.completed;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>Load Test Dashboard</h1>
        {runId && (
          <div style={{ display: 'flex', gap: 8 }}>
            {isRunning && (
              <button
                onClick={handleStop}
                style={{
                  padding: '8px 16px',
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                Stop Test
              </button>
            )}
            {stream.completed && (
              <button
                onClick={handleReset}
                style={{
                  padding: '8px 16px',
                  background: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                New Test
              </button>
            )}
          </div>
        )}
      </div>

      {!runId && <ConfigForm onStart={handleStart} disabled={starting} />}

      {runId && (
        <>
          <SummaryBar summary={stream.summary} completed={stream.completed} />
          <LatencyChart data={stream.chartPoints} />
          <ThroughputChart data={stream.chartPoints} />
          <ClickHouseCharts data={stream.chMetrics} />
          <EndpointTable stats={stream.endpointStats} />
          <ErrorLog records={stream.allRecords} />
          <GcpMetricsPanel runId={runId!} completed={stream.completed} gcpConfigured={gcpConfigured} />
        </>
      )}
    </div>
  );
}
