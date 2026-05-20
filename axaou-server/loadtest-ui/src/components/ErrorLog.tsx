import type { RequestRecord } from '../types';

interface Props {
  records: RequestRecord[];
}

export function ErrorLog({ records }: Props) {
  // Show most recent errors first, capped at 100
  const errors = records
    .filter(r => r.error)
    .slice(-100)
    .reverse();

  if (errors.length === 0) return null;

  // Group by endpoint + status for a summary view
  const grouped = new Map<string, { count: number; lastTimestamp: number; latency_ms: number[] }>();
  for (const r of records.filter(r => r.error)) {
    const key = `${r.endpoint} → ${r.status === 0 ? 'timeout/network' : `HTTP ${r.status}`}`;
    const entry = grouped.get(key) ?? { count: 0, lastTimestamp: 0, latency_ms: [] };
    entry.count++;
    entry.lastTimestamp = Math.max(entry.lastTimestamp, r.timestamp_ms);
    entry.latency_ms.push(r.latency_ms);
    grouped.set(key, entry);
  }

  const summary = Array.from(grouped.entries())
    .sort(([, a], [, b]) => b.count - a.count);

  return (
    <div style={{ background: 'white', padding: 16, borderRadius: 8, marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 12px', color: '#dc2626' }}>
        Errors ({records.filter(r => r.error).length} total)
      </h3>

      {/* Summary table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, marginBottom: 16 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #fecaca' }}>
            <th style={{ textAlign: 'left', padding: '6px 12px' }}>Endpoint / Error</th>
            <th style={{ textAlign: 'right', padding: '6px 12px' }}>Count</th>
            <th style={{ textAlign: 'right', padding: '6px 12px' }}>Avg Latency</th>
          </tr>
        </thead>
        <tbody>
          {summary.map(([key, val]) => (
            <tr key={key} style={{ borderBottom: '1px solid #fee2e2' }}>
              <td style={{ padding: '6px 12px', fontFamily: 'monospace', fontSize: 12 }}>{key}</td>
              <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 'bold', color: '#dc2626' }}>
                {val.count}
              </td>
              <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                {Math.round(val.latency_ms.reduce((a, b) => a + b, 0) / val.latency_ms.length)}ms
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Recent errors detail */}
      <details>
        <summary style={{ cursor: 'pointer', fontSize: 13, color: '#666', marginBottom: 8 }}>
          Recent errors (last {errors.length})
        </summary>
        <div style={{ maxHeight: 300, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, background: 'white' }}>
                <th style={{ textAlign: 'left', padding: '4px 8px' }}>Time</th>
                <th style={{ textAlign: 'left', padding: '4px 8px' }}>Endpoint</th>
                <th style={{ textAlign: 'right', padding: '4px 8px' }}>Status</th>
                <th style={{ textAlign: 'right', padding: '4px 8px' }}>Latency</th>
              </tr>
            </thead>
            <tbody>
              {errors.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '3px 8px', fontFamily: 'monospace', color: '#666' }}>
                    {new Date(r.timestamp_ms).toLocaleTimeString()}
                  </td>
                  <td style={{ padding: '3px 8px', fontFamily: 'monospace' }}>{r.endpoint}</td>
                  <td style={{ padding: '3px 8px', textAlign: 'right', color: '#dc2626', fontWeight: 'bold' }}>
                    {r.status === 0 ? 'TIMEOUT' : r.status}
                  </td>
                  <td style={{ padding: '3px 8px', textAlign: 'right' }}>{r.latency_ms}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
