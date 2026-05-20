import { useEffect, useRef } from 'react';
import type { RequestRecord } from '../types';

interface Props {
  records: RequestRecord[];
}

// Color by latency bucket
function latencyColor(ms: number): string {
  if (ms < 200) return '#059669';   // green - fast
  if (ms < 500) return '#65a30d';   // lime
  if (ms < 1000) return '#ca8a04';  // yellow
  if (ms < 3000) return '#ea580c';  // orange
  if (ms < 10000) return '#dc2626'; // red
  return '#991b1b';                  // dark red - very slow
}

function latencyBar(ms: number, maxMs: number): number {
  return Math.min(100, (ms / maxMs) * 100);
}

// Short endpoint names for compact display
const SHORT_NAMES: Record<string, string> = {
  phenotypes_summary: 'pheno/summary',
  phenotype_overview: 'pheno/overview',
  phenotype_loci: 'pheno/loci',
  region_render: 'region/render',
  region_overlay: 'region/overlay',
  genes_interval: 'genes/interval',
  gene_model: 'gene/model',
  annotations_exome: 'annot/exome',
  annotations_genome: 'annot/genome',
  associations_exome: 'assoc/exome',
  associations_genome: 'assoc/genome',
  genes_associations: 'genes/assoc',
  gene_phewas: 'gene/phewas',
};

const MAX_VISIBLE = 80;

export function RequestFeed({ records }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const autoScroll = useRef(true);

  // Auto-scroll to bottom when new records arrive
  useEffect(() => {
    if (autoScroll.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [records.length]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    autoScroll.current = scrollHeight - scrollTop - clientHeight < 40;
  };

  if (records.length === 0) return null;

  // Show last N records
  const visible = records.slice(-MAX_VISIBLE);
  const maxLatency = Math.max(...visible.map(r => r.latency_ms), 1000);

  return (
    <div style={{ background: 'white', padding: 16, borderRadius: 8, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>Live Requests</h3>
        <span style={{ fontSize: 12, color: '#666' }}>
          {records.length.toLocaleString()} total
        </span>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 11, color: '#666' }}>
        {[
          ['<200ms', '#059669'],
          ['<500ms', '#65a30d'],
          ['<1s', '#ca8a04'],
          ['<3s', '#ea580c'],
          ['<10s', '#dc2626'],
          ['>10s', '#991b1b'],
        ].map(([label, color]) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block' }} />
            {label}
          </span>
        ))}
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          maxHeight: 350,
          overflow: 'auto',
          fontFamily: 'monospace',
          fontSize: 12,
          lineHeight: '18px',
        }}
      >
        {visible.map((r, i) => {
          const name = SHORT_NAMES[r.endpoint] ?? r.endpoint;
          const color = r.error ? '#991b1b' : latencyColor(r.latency_ms);
          const barWidth = latencyBar(r.latency_ms, maxLatency);
          const ms = r.latency_ms;
          const label = ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;

          return (
            <div
              key={`${r.timestamp_ms}-${i}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '1px 0',
                opacity: r.error ? 1 : 0.9,
              }}
            >
              {/* Status dot */}
              <span style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: r.error ? '#dc2626' : '#059669',
                flexShrink: 0,
              }} />

              {/* Endpoint name */}
              <span style={{
                width: 110,
                flexShrink: 0,
                color: r.error ? '#dc2626' : '#374151',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {name}
              </span>

              {/* Latency bar */}
              <div style={{
                flex: 1,
                height: 14,
                background: '#f3f4f6',
                borderRadius: 2,
                overflow: 'hidden',
                position: 'relative',
              }}>
                <div style={{
                  width: `${barWidth}%`,
                  height: '100%',
                  background: color,
                  borderRadius: 2,
                  transition: 'none',
                }} />
              </div>

              {/* Latency label */}
              <span style={{
                width: 55,
                textAlign: 'right',
                flexShrink: 0,
                color,
                fontWeight: ms > 3000 ? 'bold' : 'normal',
              }}>
                {label}
              </span>

              {/* HTTP status */}
              <span style={{
                width: 28,
                textAlign: 'right',
                flexShrink: 0,
                color: r.error ? '#dc2626' : '#9ca3af',
                fontSize: 10,
              }}>
                {r.status || 'ERR'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
