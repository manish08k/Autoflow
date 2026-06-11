import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30000 } } })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={qc}>
    <App />
    <Toaster position="bottom-right" toastOptions={{ style: { background: '#1e1e2e', color: '#cdd6f4', border: '1px solid #313244', borderRadius: '8px' } }} />
  </QueryClientProvider>
)
