import React from 'react'
import { useStore } from '../../store'

const NAV = [
  {
    id: 'workflows', label: 'Workflows',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
  },
  {
    id: 'credentials', label: 'Credentials',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
  },
  {
    id: 'executions', label: 'Executions',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
  },
]

export default function Sidebar() {
  const { setUser, setActiveWorkflow, page, setPage } = useStore()
  const logout = () => { localStorage.removeItem('token'); setUser(null) }

  const handleNav = (id: string) => {
    setActiveWorkflow(null)
    setPage(id as any)
  }

  return (
    <nav style={{ width: 52, background: 'var(--bg1)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0', gap: 4, flexShrink: 0, zIndex: 10 }}>
      <div style={{ width: 32, height: 32, background: 'var(--accent)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
      </div>
      {NAV.map(n => (
        <button key={n.id} title={n.label} onClick={() => handleNav(n.id)} style={{ width: 36, height: 36, borderRadius: 8, background: page === n.id ? 'var(--accent)' : 'transparent', color: page === n.id ? '#fff' : 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', border: 'none', cursor: 'pointer' }}>
          {n.icon}
        </button>
      ))}
      <div style={{ flex: 1 }} />
      <button title="Logout" onClick={logout} style={{ width: 36, height: 36, borderRadius: 8, background: 'transparent', color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      </button>
    </nav>
  )
}
