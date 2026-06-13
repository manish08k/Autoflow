import React, { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { workflowsApi, credentialsApi } from '../api/client'
import { useStore } from '../store'
import Sidebar from './sidebar/Sidebar'
import WorkflowList from './WorkflowList'
import WorkflowEditor from './canvas/WorkflowEditor'
import CredentialsPage from './pages/CredentialsPage'
import ExecutionsPage from './pages/ExecutionsPage'

export default function Dashboard() {
  const { activeWorkflow, setWorkflows, setCredentials, page } = useStore()

  const { data: wfData } = useQuery({ queryKey: ['workflows'], queryFn: workflowsApi.list, refetchInterval: 30000 })
  const { data: credData } = useQuery({ queryKey: ['credentials'], queryFn: credentialsApi.list, refetchInterval: 60000 })

  useEffect(() => { if (wfData?.workflows) setWorkflows(wfData.workflows) }, [wfData])
  useEffect(() => { if (credData?.credentials) setCredentials(credData.credentials) }, [credData])

  const renderMain = () => {
    if (activeWorkflow) return <WorkflowEditor />
    if (page === 'credentials') return <CredentialsPage />
    if (page === 'executions') return <ExecutionsPage />
    return <WorkflowList />
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: 'var(--bg)' }}>
      <Sidebar />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {renderMain()}
      </main>
    </div>
  )
}
