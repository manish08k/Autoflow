import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { credentialsApi, providersApi } from '../../api/client'
import toast from 'react-hot-toast'
import type { Credential, Provider } from '../../types'

interface Props { onClose: () => void }

export default function CredentialsPanel({ onClose }: Props) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')

  const { data: cData } = useQuery({ queryKey: ['credentials'], queryFn: credentialsApi.list })
  const { data: pData } = useQuery({ queryKey: ['providers'], queryFn: providersApi.list })

  const credentials: Credential[] = cData?.credentials ?? []
  const providers: Provider[] = pData?.providers ?? []

  const deleteMut = useMutation({
    mutationFn: credentialsApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['credentials'] }); toast.success('Disconnected') },
    onError: () => toast.error('Failed to disconnect'),
  })

  const testMut = useMutation({
    mutationFn: credentialsApi.test,
    onSuccess: (data) => toast(data.valid ? '✓ Credential valid' : '✗ Credential invalid', { icon: data.valid ? '✅' : '❌' }),
  })

  const filtered = credentials.filter(c =>
    !search || c.label.toLowerCase().includes(search.toLowerCase()) || c.provider.toLowerCase().includes(search.toLowerCase())
  )

  const connectedProviders = new Set(credentials.map(c => c.provider))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', zIndex: 200 }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: 640, background: 'var(--bg1)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Credentials</h2>
            <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Connect your accounts to use them in workflows</p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', color: 'var(--text3)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {/* Connect new */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Connect Account</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
              {providers.map(p => {
                const isConnected = connectedProviders.has(p.name)
                return (
                  <a key={p.name} href={`/oauth/connect/${p.name}?label=${p.display_name}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: 'var(--bg2)', border: `1px solid ${isConnected ? 'var(--green)' : 'var(--border)'}`, borderRadius: 8, textDecoration: 'none', color: 'var(--text)', fontSize: 12, fontWeight: 500, transition: 'border-color 0.15s' }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: isConnected ? 'var(--green)' : 'var(--border2)', flexShrink: 0 }} />
                    {p.display_name}
                  </a>
                )
              })}
            </div>
          </div>

          {/* Connected accounts */}
          <div style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Connected ({credentials.length})
              </div>
              {credentials.length > 0 && (
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" style={{ width: 160, fontSize: 12, padding: '4px 8px' }} />
              )}
            </div>

            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text3)', fontSize: 12 }}>
                {credentials.length === 0 ? 'No accounts connected yet' : 'No results'}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase' }}>{c.provider.slice(0, 2)}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{c.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                      {c.external_account_name || c.provider} · {c.is_valid ? <span style={{ color: 'var(--green)' }}>Valid</span> : <span style={{ color: 'var(--red)' }}>Invalid</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => testMut.mutate(c.id)} title="Test" style={{ padding: '5px 10px', background: 'var(--bg3)', color: 'var(--text3)', borderRadius: 6, fontSize: 11 }}>Test</button>
                    <button onClick={() => { if (confirm(`Disconnect ${c.label}?`)) deleteMut.mutate(c.id) }} title="Disconnect" style={{ padding: '5px 8px', background: 'rgba(239,68,68,0.1)', color: 'var(--red)', borderRadius: 6 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
