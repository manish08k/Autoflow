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
    setLoading(true)
    try {
      const fn = mode === 'login' ? authApi.login : authApi.register
      const data = await fn(email, pw)
      localStorage.setItem('token', data.access_token)
      const me = await authApi.me()
      setUser(me)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Auth failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
      <div style={{ width: 360, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{ width: 32, height: 32, background: 'var(--accent)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>AutoFlow</span>
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, color: 'var(--text)' }}>
          {mode === 'login' ? 'Sign in' : 'Create account'}
        </h2>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" value={pw} onChange={e => setPw(e.target.value)} required />
          <button type="submit" disabled={loading} style={{ marginTop: 4, padding: '9px 0', background: 'var(--accent)', color: '#fff', borderRadius: 8, fontWeight: 600, fontSize: 14, opacity: loading ? 0.7 : 1 }}>
            {loading ? '…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <p style={{ marginTop: 16, color: 'var(--text3)', textAlign: 'center' }}>
          {mode === 'login' ? "Don't have an account? " : 'Have an account? '}
          <button onClick={() => setMode(m => m === 'login' ? 'register' : 'login')} style={{ background: 'none', color: 'var(--accent)', fontWeight: 500 }}>
            {mode === 'login' ? 'Register' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}
