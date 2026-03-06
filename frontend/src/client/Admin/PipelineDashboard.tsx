import React, { useState, useEffect } from 'react'
import styled from 'styled-components'
import { axaouDevUrl } from '../Query'

const DashboardContainer = styled.div`
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
  height: calc(100vh - 200px);
  overflow-y: auto;
`

const DashboardHeading = styled.h1`
  font-size: 24px;
  margin-bottom: 20px;
  color: var(--theme-text);
`

const SummaryCards = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
`

const Card = styled.div`
  background: var(--theme-surface);
  border: 1px solid var(--theme-border);
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);

  h3 {
    margin: 0 0 10px 0;
    font-size: 14px;
    color: var(--theme-text-muted);
    font-weight: normal;
  }

  .value {
    font-size: 24px;
    font-weight: bold;
    color: var(--theme-primary);
  }

  .subtext {
    font-size: 12px;
    color: var(--theme-text-muted);
    margin-top: 5px;
  }
`

const Controls = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
`

const ControlGroup = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
`

const SearchInput = styled.input`
  padding: 8px 12px;
  border: 1px solid var(--theme-border);
  border-radius: 4px;
  background: var(--theme-surface);
  color: var(--theme-text);
  width: 200px;

  &:focus {
    outline: none;
    border-color: var(--theme-primary);
  }
`

const Select = styled.select`
  padding: 8px 12px;
  border: 1px solid var(--theme-border);
  border-radius: 4px;
  background: var(--theme-surface);
  color: var(--theme-text);
`

const NumberInput = styled.input`
  padding: 8px;
  border: 1px solid var(--theme-border);
  border-radius: 4px;
  background: var(--theme-surface);
  color: var(--theme-text);
  width: 70px;
`

const CmdBox = styled.div`
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 15px;
  border-radius: 6px;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 12px;
  margin-bottom: 20px;
  position: relative;
  overflow-x: auto;
  white-space: nowrap;

  button {
    position: absolute;
    right: 10px;
    top: 10px;
    background: #333;
    border: none;
    color: white;
    padding: 5px 10px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;

    &:hover {
      background: #444;
    }
  }
`

const TableContainer = styled.div`
  max-height: 500px;
  overflow-y: auto;
  border: 1px solid var(--theme-border);
  border-radius: 6px;
`

const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;

  th,
  td {
    padding: 10px 12px;
    text-align: left;
    border-bottom: 1px solid var(--theme-border);
  }

  th {
    background: var(--theme-surface-alt);
    position: sticky;
    top: 0;
    font-weight: 600;
    z-index: 1;
  }

  tr:hover td {
    background: var(--theme-surface-alt);
  }
`

const Badge = styled.span<{ level: 'success' | 'error' | 'warning' }>`
  display: inline-block;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;

  ${(props) => {
    switch (props.level) {
      case 'success':
        return 'background: #e6f4ea; color: #137333;'
      case 'error':
        return 'background: #fce8e6; color: #c5221f;'
      case 'warning':
        return 'background: #fef7e0; color: #b06000;'
    }
  }}
`

const LoadingMessage = styled.div`
  text-align: center;
  padding: 40px;
  color: var(--theme-text-muted);
`

const ErrorText = styled.span`
  color: #c5221f;
  font-size: 11px;
  max-width: 200px;
  display: inline-block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

interface PipelineStatusRow {
  phenotype: string
  ancestry: string
  status: string
  loci_count: number
  significant_variants: number
  original_gcs_bytes: number
  derived_gcs_bytes: number
  error_message: string | null
  updated_at: string
}

interface PipelineSummary {
  total_processed: number
  total_ingested: number
  total_failed: number
  current_gcs_tb: number
  current_ch_tb: number
  projected_gcs_tb: number
  projected_ch_tb: number
  universe_size: number
}

interface PipelineStats {
  rows: PipelineStatusRow[]
  summary: PipelineSummary
}

export default function PipelineDashboard() {
  const [data, setData] = useState<PipelineStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [batchSize, setBatchSize] = useState(50)

  useEffect(() => {
    setLoading(true)
    fetch(`${axaouDevUrl}/admin/pipeline/stats`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        setData(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <DashboardContainer>
        <LoadingMessage>Loading pipeline analytics...</LoadingMessage>
      </DashboardContainer>
    )
  }

  if (error) {
    return (
      <DashboardContainer>
        <LoadingMessage>Error loading pipeline data: {error}</LoadingMessage>
      </DashboardContainer>
    )
  }

  if (!data) {
    return (
      <DashboardContainer>
        <LoadingMessage>No pipeline data available</LoadingMessage>
      </DashboardContainer>
    )
  }

  const { rows, summary } = data

  const filteredRows = rows.filter((r) => {
    const matchSearch = r.phenotype.toLowerCase().includes(filter.toLowerCase())
    const matchStatus = statusFilter === 'ALL' || r.status.includes(statusFilter)
    return matchSearch && matchStatus
  })

  const getBadgeLevel = (status: string): 'success' | 'error' | 'warning' => {
    if (status === 'INGESTED') return 'success'
    if (status.includes('FAILED')) return 'error'
    return 'warning'
  }

  // Generate command for filtered phenotypes
  const targetIds = filteredRows.map((r) => r.phenotype).slice(0, batchSize)
  const cmd = `genohype pool submit heavy --force --batch-size 40 -- manhattan-batch --config axaou-server/phenotype-data.toml --analysis-ids ${targetIds.join(',')}`

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0'
    const gb = bytes / 1e9
    return gb.toFixed(2)
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(cmd)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <DashboardContainer>
      <DashboardHeading>Pipeline Control Center</DashboardHeading>

      <SummaryCards>
        <Card>
          <h3>Phenotypes Processed</h3>
          <div className="value">
            {summary.total_ingested} / {summary.universe_size}
          </div>
          <div className="subtext">{summary.total_failed} Failed</div>
        </Card>
        <Card>
          <h3>GCS Storage Footprint</h3>
          <div className="value">{summary.current_gcs_tb.toFixed(2)} TB</div>
          <div className="subtext">Projected: {summary.projected_gcs_tb.toFixed(2)} TB</div>
        </Card>
        <Card>
          <h3>ClickHouse Footprint</h3>
          <div className="value">{summary.current_ch_tb.toFixed(4)} TB</div>
          <div className="subtext">Projected: {summary.projected_ch_tb.toFixed(4)} TB</div>
        </Card>
        <Card>
          <h3>Completion Rate</h3>
          <div className="value">
            {summary.universe_size > 0
              ? ((summary.total_ingested / summary.universe_size) * 100).toFixed(1)
              : 0}
            %
          </div>
          <div className="subtext">{summary.total_processed} total processed</div>
        </Card>
      </SummaryCards>

      <Controls>
        <ControlGroup>
          <SearchInput
            type="text"
            placeholder="Search phenotype..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">All Statuses</option>
            <option value="INGESTED">Ingested</option>
            <option value="FAILED">Failed</option>
            <option value="INGESTING">In Progress</option>
          </Select>
        </ControlGroup>
        <ControlGroup>
          <span>Batch Size:</span>
          <NumberInput
            type="number"
            value={batchSize}
            onChange={(e) => setBatchSize(Number(e.target.value))}
            min={1}
            max={500}
          />
        </ControlGroup>
      </Controls>

      {targetIds.length > 0 && (
        <CmdBox>
          <div>{cmd}</div>
          <button onClick={copyToClipboard}>Copy</button>
        </CmdBox>
      )}

      <TableContainer>
        <StyledTable>
          <thead>
            <tr>
              <th>Phenotype</th>
              <th>Status</th>
              <th>Loci</th>
              <th>Sig. Variants</th>
              <th>GCS Size (GB)</th>
              <th>Updated At</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r, i) => (
              <tr key={i}>
                <td>
                  <strong>{r.phenotype}</strong>
                </td>
                <td>
                  <Badge level={getBadgeLevel(r.status)}>{r.status}</Badge>
                </td>
                <td>{r.loci_count.toLocaleString()}</td>
                <td>{r.significant_variants.toLocaleString()}</td>
                <td>{formatBytes(r.original_gcs_bytes + r.derived_gcs_bytes)}</td>
                <td>{new Date(r.updated_at).toLocaleString()}</td>
                <td>
                  {r.error_message ? <ErrorText title={r.error_message}>{r.error_message}</ErrorText> : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </StyledTable>
      </TableContainer>
    </DashboardContainer>
  )
}
