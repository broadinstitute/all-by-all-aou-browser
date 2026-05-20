import type { RollingSummary } from '../types';

interface Props {
  summary: RollingSummary | null;
  completed: boolean;
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'inline-block', marginRight: 24 }}>
      <div style={{ fontSize: 22, fontWeight: 'bold', color: color ?? '#2563eb' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}

export function SummaryBar({ summary, completed }: Props) {
  if (!summary) return null;

  const elapsed = summary.elapsed_secs;
  const mins = Math.floor(elapsed / 60);
  const secs = Math.floor(elapsed % 60);
  const errPct = (summary.error_rate * 100).toFixed(1);

  return (
    <div style={{
      background: 'white',
      padding: 16,
      borderRadius: 8,
      marginBottom: 16,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    }}>
      <div style={{
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: completed ? '#059669' : '#f59e0b',
        animation: completed ? undefined : 'pulse 1s infinite',
        marginRight: 8,
      }} />
      <Stat label="Elapsed" value={`${mins}:${secs.toString().padStart(2, '0')}`} />
      <Stat label="Users" value={String(summary.active_users)} />
      <Stat label="Sessions" value={summary.total_sessions.toLocaleString()} />
      <Stat label="Requests" value={summary.total_requests.toLocaleString()} />
      <Stat label="Req/s" value={summary.rps.toFixed(1)} />
      <Stat label="p50" value={`${summary.p50_ms}ms`} />
      <Stat label="p95" value={`${summary.p95_ms}ms`} />
      <Stat
        label="Error Rate"
        value={`${errPct}%`}
        color={summary.error_rate > 0.01 ? '#dc2626' : undefined}
      />
    </div>
  );
}
