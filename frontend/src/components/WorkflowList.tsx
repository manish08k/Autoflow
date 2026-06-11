import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { workflowsApi } from '../api/client'
import { useStore } from '../store'
import toast from 'react-hot-toast'
import type { Workflow } from '../types'

export default function WorkflowList() {
  const qc = useQueryClient()
  const { setActiveWorkflow } = useStore()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  const { data, isLoading } = useQuery({ queryKey: ['workflows'], queryFn: workflowsApi.list })
  const workflows: Workflow[] = data?.workflows ?? []

  const createMut = useMutation({
    mutationFn: (n: string) => workflowsApi.create({ name: n, definition: { nodes: [], edges: [] } }),
    onSuccess: wf => { qc.invalidateQueries({ queryKey: ['workflows'] }); setActiveWorkflow(wf); setCreating(false); setName('') },
    onError: () => toast.error('Failed to create workflow'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => workflowsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['workflows'] }); toast.success('Deleted') },
  })

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active ? workflowsApi.deactivate(id) : workflowsApi.activate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  })

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Workflows</h1>
          <p style={{ color: 'var(--text3)', marginTop: 2 }}>{workflows.length} workflow{workflows.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setCreating(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--accent)', color: '#fff', borderRadius: 8, fontWeight: 600, fontSize: 13 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Workflow
        </button>
      </div>

      {/* Create modal */}
      {creating && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 28, width: 380 }}>
            <h3 style={{ marginBottom: 16, fontWeight: 600 }}>New Workflow</h3>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Workflow name" onKeyDown={e => { if (e.key === 'Enter' && name.trim()) createMut.mutate(name.trim()) }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setCreating(false)} style={{ padding: '7px 16px', background: 'var(--bg3)', color: 'var(--text2)', borderRadius: 8 }}>Cancel</button>
              <button onClick={() => name.trim() && createMut.mutate(name.trim())} disabled={!name.trim() || createMut.isPending} style={{ padding: '7px 16px', background: 'var(--accent)', color: '#fff', borderRadius: 8, fontWeight: 600, opacity: !name.trim() ? 0.5 : 1 }}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && workflows.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 320, color: 'var(--text3)', gap: 12 }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity={0.4}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          <p style={{ fontSize: 15 }}>No workflows yet</p>
          <button onClick={() => setCreating(true)} style={{ padding: '8px 20px', background: 'var(--accent)', color: '#fff', borderRadius: 8, fontWeight: 600 }}>Create your first workflow</button>
        </div>
      )}

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {workflows.map(wf => (
          <WorkflowCard key={wf.id} wf={wf}
            onOpen={() => setActiveWorkflow(wf)}
            onToggle={() => toggleMut.mutate({ id: wf.id, active: wf.status === 'active' })}
            onDelete={() => { if (confirm('Delete this workflow?')) deleteMut.mutate(wf.id) }}
          />
        ))}
      </div>
    </div>
  )
}

function WorkflowCard({ wf, onOpen, onToggle, onDelete }: { wf: Workflow; onOpen: () => void; onToggle: () => void; onDelete: () => void }) {
  const nodeCount = wf.definition?.nodes?.length ?? 0

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 18, cursor: 'pointer', transition: 'border-color 0.15s' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div onClick={onOpen} style={{ flex: 1 }}>
          <h3 style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>{wf.name}</h3>
          <p style={{ color: 'var(--text3)', fontSize: 12 }}>{nodeCount} node{nodeCount !== 1 ? 's' : ''} · {new Date(wf.updated_at).toLocaleDateString()}</p>
        </div>
        <StatusBadge status={wf.status} />
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={onOpen} style={{ flex: 1, padding: '6px 0', background: 'var(--bg3)', color: 'var(--text2)', borderRadius: 6, fontSize: 12, fontWeight: 500 }}>Edit</button>
        <button onClick={e => { e.stopPropagation(); onToggle() }} style={{ flex: 1, padding: '6px 0', background: wf.status === 'active' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)', color: wf.status === 'active' ? 'var(--red)' : 'var(--green)', borderRadius: 6, fontSize: 12, fontWeight: 500 }}>
          {wf.status === 'active' ? 'Deactivate' : 'Activate'}
        </button>
        <button onClick={e => { e.stopPropagation(); onDelete() }} style={{ width: 30, height: 30, background: 'transparent', color: 'var(--text3)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string; label: string }> = {
    active: { color: 'var(--green)', bg: 'rgba(34,197,94,0.12)', label: 'Active' },
    inactive: { color: 'var(--text3)', bg: 'var(--bg3)', label: 'Inactive' },
    error: { color: 'var(--red)', bg: 'rgba(239,68,68,0.12)', label: 'Error' },
  }
  const s = map[status] ?? map.inactive
  return (
    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, color: s.color, background: s.bg }}>{s.label}</span>
  )
}
