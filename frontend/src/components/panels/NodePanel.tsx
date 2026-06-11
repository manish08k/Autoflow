import React, { useState, useEffect } from 'react'
import { getNodeDef } from '../../types/nodes'
import type { WFNode } from '../../types'

interface Props {
  node: WFNode
  onChange: (updated: WFNode) => void
  onDelete: () => void
  onClose: () => void
  credentials: any[]
}

export default function NodePanel({ node, onChange, onDelete, onClose, credentials }: Props) {
  const def = getNodeDef(node.type)
  const [cfg, setCfg] = useState<Record<string, any>>(node.config ?? {})
  const [label, setLabel] = useState(node.label ?? def?.label ?? '')
  const [credId, setCredId] = useState(node.credential_id ?? '')
  const [retryEnabled, setRetryEnabled] = useState(!!node.retry)
  const [retryAttempts, setRetryAttempts] = useState(node.retry?.max_attempts ?? 3)

  useEffect(() => {
    setCfg(node.config ?? {})
    setLabel(node.label ?? def?.label ?? '')
    setCredId(node.credential_id ?? '')
  }, [node.id])

  const save = () => {
    onChange({
      ...node,
      label,
      config: cfg,
      credential_id: credId || undefined,
      retry: retryEnabled ? { max_attempts: retryAttempts, wait_min: 1, wait_max: 60 } : undefined,
    })
  }

  const needsCred = def && !['core', 'http'].includes(def.provider) && !def.type?.startsWith('trigger.')
  const providerCreds = credentials.filter(c => c.provider === def?.provider)

  return (
    <div style={{ width: 300, background: 'var(--bg1)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>{def?.category}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{def?.label ?? node.type}</div>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', color: 'var(--text3)', padding: 4 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Label */}
        <Field label="Node Label">
          <input value={label} onChange={e => setLabel(e.target.value)} placeholder={def?.label} />
        </Field>

        {/* Credential */}
        {needsCred && (
          <Field label={`${def!.label ?? def!.provider} Account`}>
            {providerCreds.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--yellow)', padding: '6px 0' }}>
                No credentials connected.{' '}
                <a href={`/oauth/connect/${def!.provider}`} target="_blank" rel="noopener" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>Connect now</a>
              </div>
            ) : (
              <select value={credId} onChange={e => setCredId(e.target.value)}>
                <option value="">— Select account —</option>
                {providerCreds.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.label} ({c.external_account_name || c.provider})</option>
                ))}
              </select>
            )}
          </Field>
        )}

        {/* Config fields */}
        {def?.configFields.map(field => (
          <Field key={field.key} label={field.label} required={field.required}>
            {field.type === 'select' ? (
              <select value={cfg[field.key] ?? ''} onChange={e => setCfg(p => ({ ...p, [field.key]: e.target.value }))}>
                <option value="">— Select —</option>
                {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : field.type === 'boolean' ? (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!cfg[field.key]} onChange={e => setCfg(p => ({ ...p, [field.key]: e.target.checked }))} style={{ width: 'auto' }} />
                <span style={{ color: 'var(--text2)', fontSize: 12 }}>Enabled</span>
              </label>
            ) : field.type === 'number' ? (
              <input type="number" value={cfg[field.key] ?? ''} placeholder={field.placeholder} onChange={e => setCfg(p => ({ ...p, [field.key]: Number(e.target.value) }))} />
            ) : field.type === 'json' ? (
              <textarea
                value={typeof cfg[field.key] === 'object' ? JSON.stringify(cfg[field.key], null, 2) : (cfg[field.key] ?? '')}
                placeholder={field.placeholder ?? '{ }'}
                onChange={e => {
                  try { setCfg(p => ({ ...p, [field.key]: JSON.parse(e.target.value) })) }
                  catch { setCfg(p => ({ ...p, [field.key]: e.target.value })) }
                }}
              />
            ) : field.type === 'textarea' ? (
              <textarea value={cfg[field.key] ?? ''} placeholder={field.placeholder} onChange={e => setCfg(p => ({ ...p, [field.key]: e.target.value }))} />
            ) : (
              <input value={cfg[field.key] ?? ''} placeholder={field.placeholder} onChange={e => setCfg(p => ({ ...p, [field.key]: e.target.value }))} />
            )}
          </Field>
        ))}

        {/* Retry */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: retryEnabled ? 10 : 0 }}>
            <input type="checkbox" checked={retryEnabled} onChange={e => setRetryEnabled(e.target.checked)} style={{ width: 'auto' }} />
            <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>Retry on failure</span>
          </label>
          {retryEnabled && (
            <Field label="Max Attempts">
              <input type="number" min={1} max={10} value={retryAttempts} onChange={e => setRetryAttempts(Number(e.target.value))} />
            </Field>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
        <button onClick={save} style={{ flex: 1, padding: '8px 0', background: 'var(--accent)', color: '#fff', borderRadius: 7, fontWeight: 600, fontSize: 13 }}>
          Save
        </button>
        <button onClick={onDelete} style={{ width: 36, height: 36, background: 'rgba(239,68,68,0.1)', color: 'var(--red)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>
      </div>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>
        {label}{required && <span style={{ color: 'var(--red)', marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  )
}
