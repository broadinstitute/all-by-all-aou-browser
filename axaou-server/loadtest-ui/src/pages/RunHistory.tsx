import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { RunSummary } from '../types';

export function RunHistory() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/loadtest/runs')
      .then(r => r.json())
      .then(setRuns)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Run History</h1>
      {runs.length === 0 ? (
        <p style={{ color: '#666' }}>No runs yet. Start a load test from the dashboard.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: 8 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Run ID</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Status</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Started</th>
              <th style={{ textAlign: 'right', padding: '8px 12px' }}>Duration</th>
              <th style={{ textAlign: 'right', padding: '8px 12px' }}>Requests</th>
              <th style={{ textAlign: 'right', padding: '8px 12px' }}>Req/s</th>
              <th style={{ textAlign: 'right', padding: '8px 12px' }}>Errors</th>
            </tr>
          </thead>
          <tbody>
            {runs.map(run => (
              <tr key={run.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '6px 12px' }}>
                  <Link to={`/runs/${run.id}`} style={{ color: '#2563eb', fontFamily: 'monospace', fontSize: 13 }}>
                    {run.id.slice(0, 8)}...
                  </Link>
                </td>
                <td style={{ padding: '6px 12px' }}>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 'bold',
                    background: run.status === 'completed' ? '#d1fae5' : run.status === 'running' ? '#fef3c7' : '#fee2e2',
                    color: run.status === 'completed' ? '#065f46' : run.status === 'running' ? '#92400e' : '#991b1b',
                  }}>
                    {run.status}
                  </span>
                </td>
                <td style={{ padding: '6px 12px', fontSize: 13 }}>
                  {new Date(run.start_time).toLocaleString()}
                </td>
                <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                  {run.duration_secs ? `${run.duration_secs.toFixed(1)}s` : '-'}
                </td>
                <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                  {run.total_requests.toLocaleString()}
                </td>
                <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                  {run.throughput_rps.toFixed(1)}
                </td>
                <td style={{ padding: '6px 12px', textAlign: 'right', color: run.total_errors > 0 ? '#dc2626' : undefined }}>
                  {run.total_errors} ({(run.error_rate * 100).toFixed(1)}%)
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
