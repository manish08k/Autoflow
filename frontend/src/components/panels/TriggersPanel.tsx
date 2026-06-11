import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { triggersApi, schedulesApi, credentialsApi } from '../../api/client'
import toast from 'react-hot-toast'
import type { Trigger, Schedule } from '../../types'

interface Props { workflowId: string; onClose: () => void }

export default function TriggersPanel({ workflowId, onClose }: Props) {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'triggers' | 'schedules'>('triggers')
  const [adding, setAdding] = useState(false)

  const { data: tData } = useQuery({ queryKey: ['triggers', workflowId], queryFn: () => triggersApi.list(workflowId) })
  const { data: sData } = useQuery({ queryKey: ['schedules', workflowId], queryFn: () => schedulesApi.list(workflowId) })
  const { data: credData } = useQuery({ queryKey: ['credentials'], queryFn: credentialsApi.list })

  const triggers: Trigger[] = tData?.triggers ?? []
  const schedules: Schedule[] = sData?.schedules ?? []
  const credentials = credData?.credentials ?? []

  const deleteTrigger = useMutation({ mutationFn: triggersApi.delete, onSuccess: () => qc.invalidateQueries({ queryKey: ['triggers', workflowId] }) })
  const deleteSchedule = useMutation({ mutationFn: schedulesApi.delete, onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules', workflowId] }) })
  const toggleSchedule = useMutation({ mutationFn: schedulesApi.toggle, onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules', workflowId] }) })

  return (
    <div style={{ width: 320, background: 'var(--bg1)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>Triggers</span>
        <button onClick={onClose} style={{ background: 'transparent', color: 'var(--text3)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {(['triggers', 'schedules'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '9px 0', fontSize: 12, fontWeight: 500, background: 'transparent', color: tab === t ? 'var(--accent)' : 'var(--text3)', borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent', textTransform: 'capitalize' }}>
            {t}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {tab === 'triggers' && (
          <>
            {triggers.length === 0 && !adding && <EmptyState label="No triggers" />}
            {triggers.map(t => (
              <TriggerRow key={t.id} trigger={t} onDelete={() => deleteTrigger.mutate(t.id)} />
            ))}
            {adding && <AddTriggerForm workflowId={workflowId} credentials={credentials} onDone={() => { setAdding(false); qc.invalidateQueries({ queryKey: ['triggers', workflowId] }) }} onCancel={() => setAdding(false)} />}
            {!adding && <AddBtn onClick={() => setAdding(true)} label="Add Trigger" />}
          </>
        )}
        {tab === 'schedules' && (
          <>
            {schedules.length === 0 && !adding && <EmptyState label="No schedules" />}
            {schedules.map(s => (
              <ScheduleRow key={s.id} schedule={s} onDelete={() => deleteSchedule.mutate(s.id)} onToggle={() => toggleSchedule.mutate(s.id)} />
            ))}
            {adding && <AddScheduleForm workflowId={workflowId} onDone={() => { setAdding(false); qc.invalidateQueries({ queryKey: ['schedules', workflowId] }) }} onCancel={() => setAdding(false)} />}
            {!adding && <AddBtn onClick={() => setAdding(true)} label="Add Schedule" />}
          </>
        )}
      </div>
    </div>
  )
}

function TriggerRow({ trigger, onDelete }: { trigger: Trigger; onDelete: () => void }) {
  const [copied, setCopied] = useState(false)
  const copy = (text: string) => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{trigger.provider}</span>
          <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 6 }}>{trigger.event}</span>
        </div>
        <button onClick={onDelete} style={{ background: 'transparent', color: 'var(--red)', padding: 2 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
        </button>
      </div>
      {trigger.webhook_url && (
        <div>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 3 }}>Webhook URL</div>
          <div style={{ display: 'flex', gap: 4 }}>
            <input readOnly value={trigger.webhook_url} style={{ fontSize: 10, fontFamily: 'var(--mono)', background: 'var(--bg)', flex: 1 }} />
            <button onClick={() => copy(trigger.webhook_url!)} style={{ padding: '4px 8px', background: 'var(--bg3)', color: copied ? 'var(--green)' : 'var(--text3)', borderRadius: 5, fontSize: 10 }}>
              {copied ? '✓' : 'Copy'}
            </button>
          </div>
        </div>
      )}
      <div style={{ fontSize: 10, color: trigger.is_active ? 'var(--green)' : 'var(--text3)', marginTop: 6 }}>
        ● {trigger.is_active ? 'Active' : 'Inactive'}
      </div>
    </div>
  )
}

function ScheduleRow({ schedule, onDelete, onToggle }: { schedule: Schedule; onDelete: () => void; onToggle: () => void }) {
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--mono)' }}>
            {schedule.cron_expression ?? `every ${schedule.interval_seconds}s`}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{schedule.timezone}</div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={onToggle} style={{ padding: '3px 8px', background: schedule.is_active ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)', color: schedule.is_active ? 'var(--red)' : 'var(--green)', borderRadius: 5, fontSize: 10, fontWeight: 500 }}>
            {schedule.is_active ? 'Pause' : 'Resume'}
          </button>
          <button onClick={onDelete} style={{ background: 'transparent', color: 'var(--red)', padding: 2 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
          </button>
        </div>
      </div>
      {schedule.next_run_at && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>Next: {new Date(schedule.next_run_at).toLocaleString()}</div>}
    </div>
  )
}

function AddTriggerForm({ workflowId, credentials, onDone, onCancel }: any) {
  const [provider, setProvider] = useState('slack')
  const [event, setEvent] = useState('new_message')
  const [trigType, setTrigType] = useState<'webhook' | 'polling'>('webhook')
  const [credId, setCredId] = useState('')
  const mut = useMutation({ mutationFn: triggersApi.create, onSuccess: onDone, onError: () => toast.error('Failed') })

  const provCreds = credentials.filter((c: any) => c.provider === provider)

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>New Trigger</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <select value={trigType} onChange={e => setTrigType(e.target.value as any)}>
          <option value="webhook">Webhook</option>
          <option value="polling">Polling</option>
        </select>
        <input value={provider} onChange={e => setProvider(e.target.value)} placeholder="Provider (slack, github…)" />
        <input value={event} onChange={e => setEvent(e.target.value)} placeholder="Event (new_message, push…)" />
        {provCreds.length > 0 && (
          <select value={credId} onChange={e => setCredId(e.target.value)}>
            <option value="">— Credential (optional) —</option>
            {provCreds.map((c: any) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <button onClick={() => mut.mutate({ workflow_id: workflowId, trigger_type: trigType, provider, event, credential_id: credId || undefined })}
          disabled={mut.isPending} style={{ flex: 1, padding: '7px 0', background: 'var(--accent)', color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
          {mut.isPending ? '…' : 'Create'}
        </button>
        <button onClick={onCancel} style={{ flex: 1, padding: '7px 0', background: 'var(--bg3)', color: 'var(--text2)', borderRadius: 6, fontSize: 12 }}>Cancel</button>
      </div>
    </div>
  )
}

function AddScheduleForm({ workflowId, onDone, onCancel }: any) {
  const [cron, setCron] = useState('0 9 * * 1-5')
  const [tz, setTz] = useState('UTC')
  const mut = useMutation({ mutationFn: schedulesApi.create, onSuccess: onDone, onError: () => toast.error('Invalid cron') })

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>New Schedule</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input value={cron} onChange={e => setCron(e.target.value)} placeholder="Cron: 0 9 * * 1-5" style={{ fontFamily: 'var(--mono)', fontSize: 12 }} />
        <input value={tz} onChange={e => setTz(e.target.value)} placeholder="Timezone: UTC" />
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <button onClick={() => mut.mutate({ workflow_id: workflowId, cron_expression: cron, timezone: tz })}
          disabled={mut.isPending} style={{ flex: 1, padding: '7px 0', background: 'var(--accent)', color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
          {mut.isPending ? '…' : 'Create'}
        </button>
        <button onClick={onCancel} style={{ flex: 1, padding: '7px 0', background: 'var(--bg3)', color: 'var(--text2)', borderRadius: 6, fontSize: 12 }}>Cancel</button>
      </div>
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text3)', fontSize: 12 }}>{label}</div>
}

function AddBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} style={{ width: '100%', padding: '8px 0', background: 'var(--bg3)', color: 'var(--text2)', borderRadius: 8, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      {label}
    </button>
  )
}
