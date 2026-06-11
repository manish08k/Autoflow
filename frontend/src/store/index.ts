import { create } from 'zustand'
import type { Workflow, Credential, Execution } from '../types'

interface AppState {
  user: any | null
  setUser: (u: any) => void
  workflows: Workflow[]
  setWorkflows: (w: Workflow[]) => void
  activeWorkflow: Workflow | null
  setActiveWorkflow: (w: Workflow | null) => void
  credentials: Credential[]
  setCredentials: (c: Credential[]) => void
  executions: Execution[]
  setExecutions: (e: Execution[]) => void
  sidebarOpen: boolean
  setSidebarOpen: (v: boolean) => void
  rightPanel: 'triggers' | 'executions' | 'credentials' | 'node' | null
  setRightPanel: (p: AppState['rightPanel']) => void
  selectedNodeId: string | null
  setSelectedNodeId: (id: string | null) => void
}

export const useStore = create<AppState>(set => ({
  user: null,
  setUser: user => set({ user }),
  workflows: [],
  setWorkflows: workflows => set({ workflows }),
  activeWorkflow: null,
  setActiveWorkflow: activeWorkflow => set({ activeWorkflow }),
  credentials: [],
  setCredentials: credentials => set({ credentials }),
  executions: [],
  setExecutions: executions => set({ executions }),
  sidebarOpen: true,
  setSidebarOpen: sidebarOpen => set({ sidebarOpen }),
  rightPanel: null,
  setRightPanel: rightPanel => set({ rightPanel }),
  selectedNodeId: null,
  setSelectedNodeId: selectedNodeId => set({ selectedNodeId }),
}))
