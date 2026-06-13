import React, { useState } from 'react'
import { authApi } from '../api/client'
import { useStore } from '../store'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const setUser = useStore(s => s.setUser)
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !pw) return
    setLoading(true)
    try {
      const fn = mode === 'login' ? authApi.login : authApi.register
      const data = await fn(email, pw)
      localStorage.setItem('token', data.access_token)
      const me = await authApi.me()
      setUser(me)
      toast.success(mode === 'login' ? 'Welcome back!' : 'Account created!')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
      {/* Background grid */}
      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)', backgroundSize: '28px 28px', opacity: 0.4, pointerEvents: 'none' }} />

      <div style={{ position: 'relative', width: 380, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: '36px 32px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
          <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg, var(--accent), #a855f7)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(124,58,237,0.4)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text)', letterSpacing: '-0.02em' }}>AutoFlow</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: -1 }}>Workflow Automation</div>
          </div>
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, color: 'var(--text)' }}>
          {mode === 'login' ? 'Sign in' : 'Create account'}
        </h2>
        <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 24 }}>
          {mode === 'login' ? 'Welcome back to AutoFlow' : 'Start automating your workflows'}
        </p>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Email</label>
            <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Password</label>
            <input type="password" placeholder="••••••••" value={pw} onChange={e => setPw(e.target.value)} required />
            {mode === 'register' && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>Must be less than 72 characters</div>}
          </div>
          <button type="submit" disabled={loading || !email || !pw} style={{ marginTop: 8, padding: '11px 0', background: 'linear-gradient(135deg, var(--accent), #a855f7)', color: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 14, opacity: loading ? 0.7 : 1, boxShadow: '0 4px 14px rgba(124,58,237,0.35)', transition: 'opacity 0.15s', cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in →' : 'Create account →'}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button onClick={() => setMode(m => m === 'login' ? 'register' : 'login')} style={{ background: 'none', color: 'var(--accent)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            {mode === 'login' ? 'Register' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}
