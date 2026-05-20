import type { EndpointStats } from '../types';

interface Props {
  stats: EndpointStats[];
}

export function EndpointTable({ stats }: Props) {
  if (stats.length === 0) return null;

  return (
    <div style={{ background: 'white', padding: 16, borderRadius: 8, marginBottom: 16, overflowX: 'auto' }}>
      <h3 style={{ margin: '0 0 8px' }}>Endpoint Breakdown</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ textAlign: 'left', padding: '8px 12px' }}>Endpoint</th>
            <th style={{ textAlign: 'right', padding: '8px 12px' }}>Count</th>
            <th style={{ textAlign: 'right', padding: '8px 12px' }}>p50</th>
            <th style={{ textAlign: 'right', padding: '8px 12px' }}>p95</th>
            <th style={{ textAlign: 'right', padding: '8px 12px' }}>p99</th>
            <th style={{ textAlign: 'right', padding: '8px 12px' }}>Errors</th>
          </tr>
        </thead>
        <tbody>
          {stats.map(ep => (
            <tr
              key={ep.endpoint}
              style={{
                borderBottom: '1px solid #f3f4f6',
                background: ep.errors > 0 ? '#fef2f2' : undefined,
              }}
            >
              <td style={{ padding: '6px 12px', fontFamily: 'monospace' }}>{ep.endpoint}</td>
              <td style={{ padding: '6px 12px', textAlign: 'right' }}>{ep.count.toLocaleString()}</td>
              <td style={{ padding: '6px 12px', textAlign: 'right' }}>{ep.p50_ms}ms</td>
              <td style={{ padding: '6px 12px', textAlign: 'right' }}>{ep.p95_ms}ms</td>
              <td style={{ padding: '6px 12px', textAlign: 'right' }}>{ep.p99_ms}ms</td>
              <td style={{ padding: '6px 12px', textAlign: 'right', color: ep.errors > 0 ? '#dc2626' : undefined }}>
                {ep.errors}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
