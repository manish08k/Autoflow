import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { credentialsApi, providersApi } from '../../api/client'
import { BASE_URL } from '../../api/client'
import toast from 'react-hot-toast'
import type { Credential, Provider } from '../../types'

export default function CredentialsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')

  const { data: cData, isLoading } = useQuery({ queryKey: ['credentials'], queryFn: credentialsApi.list })
  const { data: pData } = useQuery({ queryKey: ['providers'], queryFn: providersApi.list })

  const credentials: Credential[] = cData?.credentials ?? []
  const providers: Provider[] = pData?.providers ?? []

  const deleteMut = useMutation({
    mutationFn: (id: string) => credentialsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['credentials'] }); toast.success('Disconnected') },
    onError: () => toast.error('Failed to disconnect'),
  })

  const testMut = useMutation({
    mutationFn: credentialsApi.test,
    onSuccess: (data: any) => toast(data.valid ? 'Credential valid ✓' : 'Credential invalid ✗'),
  })

  const filtered = credentials.filter(c =>
    !search || c.label.toLowerCase().includes(search.toLowerCase()) || c.provider.toLowerCase().includes(search.toLowerCase())
  )
  const connectedProviders = new Set(credentials.map(c => c.provider))

  const handleConnect = (provider: string, displayName: string) => {
    const token = localStorage.getItem('token')
    window.location.href = `${BASE_URL}/oauth/connect/${provider}?label=${encodeURIComponent(displayName)}&token=${token}`
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 32 }}>
      <div style={{ maxWidth: 800 }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Credentials</h1>
          <p style={{ color: 'var(--text3)', marginTop: 4, fontSize: 13 }}>Connect your accounts to use in workflows</p>
        </div>

        {/* Providers grid */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>Connect Account</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
            {providers.map((p: Provider) => {
              const connected = connectedProviders.has(p.name)
              return (
                <button key={p.name} onClick={() => handleConnect(p.name, p.display_name)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: connected ? 'rgba(34,197,94,0.08)' : 'var(--bg3)', border: `1px solid ${connected ? 'var(--green)' : 'var(--border)'}`, borderRadius: 8, color: 'var(--text)', fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? 'var(--green)' : 'var(--border2)', flexShrink: 0 }} />
                  <span>{p.display_name}</span>
                  {connected && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="3" style={{ marginLeft: 'auto' }}><polyline points="20 6 9 17 4 12"/></svg>}
                </button>
              )
            })}
          </div>
        </div>

        {/* Connected list */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Connected ({credentials.length})
            </div>
            {credentials.length > 0 && (
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" style={{ width: 180, fontSize: 12, padding: '5px 10px' }} />
            )}
          </div>

          {isLoading && <div style={{ color: 'var(--text3)', fontSize: 13, padding: '16px 0' }}>Loading…</div>}
          {!isLoading && filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text3)', fontSize: 13 }}>
              {credentials.length === 0 ? 'No accounts connected. Click a provider above to connect.' : 'No results'}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((c: Credential) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase' }}>{c.provider.slice(0, 2)}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{c.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
                    {c.provider} · {c.external_account_name || '—'} ·{' '}
                    {c.is_valid
                      ? <span style={{ color: 'var(--green)' }}>Valid</span>
                      : <span style={{ color: 'var(--red)' }}>Invalid — reconnect</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => testMut.mutate(c.id)} style={{ padding: '5px 12px', background: 'var(--bg3)', color: 'var(--text2)', borderRadius: 6, fontSize: 11, fontWeight: 500, border: '1px solid var(--border)', cursor: 'pointer' }}>
                    Test
                  </button>
                  <button onClick={() => { if (confirm(`Disconnect ${c.label}?`)) deleteMut.mutate(c.id) }}
                    style={{ padding: '5px 10px', background: 'rgba(239,68,68,0.1)', color: 'var(--red)', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
