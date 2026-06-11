import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { executionsApi } from '../../api/client'
import type { Execution } from '../../types'

interface Props {
  workflowId: string
  onClose: () => void
}

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  success: { color: 'var(--green)', bg: 'rgba(34,197,94,0.12)' },
  failed: { color: 'var(--red)', bg: 'rgba(239,68,68,0.12)' },
  running: { color: 'var(--accent)', bg: 'rgba(124,58,237,0.12)' },
  queued: { color: 'var(--yellow)', bg: 'rgba(245,158,11,0.12)' },
  cancelled: { color: 'var(--text3)', bg: 'var(--bg3)' },
}

export default function ExecutionsPanel({ workflowId, onClose }: Props) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['executions', workflowId],
    queryFn: () => executionsApi.list(workflowId),
    refetchInterval: 5000,
  })
  const executions: Execution[] = data?.executions ?? []
  const [selected, setSelected] = React.useState<Execution | null>(null)

  return (
    <div style={{ width: 320, background: 'var(--bg1)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>Executions</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => refetch()} title="Refresh" style={{ background: 'transparent', color: 'var(--text3)', padding: 4 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
          </button>
          <button onClick={onClose} style={{ background: 'transparent', color: 'var(--text3)', padding: 4 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {isLoading && <div style={{ padding: 16, color: 'var(--text3)', fontSize: 12 }}>Loading…</div>}
        {!isLoading && executions.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>No executions yet</div>
        )}
        {executions.map(ex => {
          const s = STATUS_STYLE[ex.status] ?? STATUS_STYLE.cancelled
          const dur = ex.started_at && ex.finished_at
            ? ((new Date(ex.finished_at).getTime() - new Date(ex.started_at).getTime()) / 1000).toFixed(1) + 's'
            : null
          const isSelected = selected?.id === ex.id
          return (
            <div key={ex.id} onClick={() => setSelected(isSelected ? null : ex)} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: isSelected ? 'var(--bg3)' : 'transparent', transition: 'background 0.1s' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ padding: '2px 7px', borderRadius: 10, fontSize: 10, fontWeight: 700, color: s.color, background: s.bg, textTransform: 'uppercase' }}>{ex.status}</span>
                <span style={{ fontSize: 10, color: 'var(--text3)' }}>{new Date(ex.created_at).toLocaleString()}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                {ex.trigger_type}{dur ? ` · ${dur}` : ''}
              </div>
              {isSelected && (
                <div style={{ marginTop: 10, background: 'var(--bg)', borderRadius: 6, padding: 10, maxHeight: 200, overflow: 'auto' }}>
                  {ex.error && <div style={{ color: 'var(--red)', fontSize: 11, marginBottom: 8, wordBreak: 'break-word' }}>{ex.error}</div>}
                  {Object.entries(ex.node_results ?? {}).map(([nodeId, result]: [string, any]) => (
                    <div key={nodeId} style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: result.status === 'error' ? 'var(--red)' : 'var(--green)', marginBottom: 2 }}>{nodeId}</div>
                      <pre style={{ fontSize: 10, color: 'var(--text2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, fontFamily: 'var(--mono)' }}>
                        {JSON.stringify(result.output ?? result.error, null, 2)}
                      </pre>
                    </div>
                  ))}
                  {Object.keys(ex.node_results ?? {}).length === 0 && (
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>No node results yet</div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
