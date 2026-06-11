import React, { useEffect, useState } from 'react'
import { authApi } from './api/client'
import { useStore } from './store'
import LoginPage from './components/LoginPage'
import Dashboard from './components/Dashboard'

export default function App() {
  const { user, setUser } = useStore()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { setChecking(false); return }
    authApi.me().then(u => { setUser(u); setChecking(false) }).catch(() => { localStorage.removeItem('token'); setChecking(false) })
  }, [])

  if (checking) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)', color: 'var(--text2)', fontSize: 13 }}>
      Loading…
    </div>
  )

  return user ? <Dashboard /> : <LoginPage />
}
