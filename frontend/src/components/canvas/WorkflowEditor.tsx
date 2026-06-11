import React, { useCallback, useEffect, useRef, useState } from 'react'
import ReactFlow, {
  Background, Controls, MiniMap, BackgroundVariant,
  addEdge, applyNodeChanges, applyEdgeChanges,
  type Node, type Edge, type Connection, type NodeChange, type EdgeChange,
  MarkerType, useReactFlow, ReactFlowProvider,
} from 'reactflow'
import 'reactflow/dist/style.css'
import dagre from 'dagre'
import { useQueryClient } from '@tanstack/react-query'
import { workflowsApi, executionsApi } from '../../api/client'
import { useStore } from '../../store'
import { getNodeDef, PROVIDER_COLORS } from '../../types/nodes'
import AutoflowNode from '../nodes/AutoflowNode'
import NodePicker from '../panels/NodePicker'
import NodePanel from '../panels/NodePanel'
import ExecutionsPanel from '../panels/ExecutionsPanel'
import TriggersPanel from '../panels/TriggersPanel'
import type { WFNode, WFEdge } from '../../types'
import toast from 'react-hot-toast'

const NODE_TYPES = { autoflow: AutoflowNode }

function wfNodeToRF(n: WFNode, idx: number): Node {
  return {
    id: n.id,
    type: 'autoflow',
    position: n.position ?? { x: 100 + idx * 240, y: 200 },
    data: { ...n, label: n.label, type: n.type },
    draggable: true,
  }
}

function rfNodeToWF(n: Node): WFNode {
  return {
    id: n.id,
    type: n.data.type,
    label: n.data.label,
    config: n.data.config ?? {},
    credential_id: n.data.credential_id,
    retry: n.data.retry,
    position: n.position,
  }
}

function autoLayout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 120 })
  nodes.forEach(n => g.setNode(n.id, { width: 200, height: 64 }))
  edges.forEach(e => g.setEdge(e.source, e.target))
  dagre.layout(g)
  return nodes.map(n => {
    const pos = g.node(n.id)
    return { ...n, position: { x: pos.x - 100, y: pos.y - 32 } }
  })
}

function EditorInner() {
  const qc = useQueryClient()
  const { activeWorkflow, setActiveWorkflow, credentials } = useStore()
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [rightPanel, setRightPanel] = useState<'node' | 'executions' | 'triggers' | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, string>>({})
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const reactFlowInstance = useReactFlow()

  const wf = activeWorkflow!

  // Load definition into RF state
  useEffect(() => {
    const def = wf.definition ?? { nodes: [], edges: [] }
    const rfNodes = (def.nodes ?? []).map((n, i) => wfNodeToRF(n, i))
    const rfEdges = (def.edges ?? []).map((e, i) => ({
      id: `e-${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
      style: { stroke: '#6366f1', strokeWidth: 1.8, opacity: 0.7 },
      animated: false,
    }))
    setNodes(rfNodes)
    setEdges(rfEdges)
  }, [wf.id])

  const onNodesChange = useCallback((changes: NodeChange[]) => setNodes(n => applyNodeChanges(changes, n)), [])
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges(e => applyEdgeChanges(changes, e)), [])
  const onConnect = useCallback((conn: Connection) => {
    setEdges(eds => addEdge({
      ...conn,
      id: `e-${conn.source}-${conn.target}`,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
      style: { stroke: '#6366f1', strokeWidth: 1.8, opacity: 0.7 },
    }, eds))
  }, [])

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNodeId(node.id)
    setRightPanel('node')
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null)
    if (rightPanel === 'node') setRightPanel(null)
  }, [rightPanel])

  const addNode = (type: string) => {
    const id = `node_${Date.now()}`
    const def = getNodeDef(type)
    const color = def ? PROVIDER_COLORS[def.provider] ?? '#6366f1' : '#6366f1'
    const center = reactFlowInstance.getViewport()
    const newNode: Node = {
      id,
      type: 'autoflow',
      position: { x: (window.innerWidth / 2 - 100 - center.x) / center.zoom, y: (300 - center.y) / center.zoom },
      data: { id, type, label: def?.label ?? type, config: {}, type },
      draggable: true,
    }
    setNodes(ns => [...ns, newNode])
    setSelectedNodeId(id)
    setRightPanel('node')
    setShowPicker(false)
  }

  const deleteNode = (nodeId: string) => {
    setNodes(ns => ns.filter(n => n.id !== nodeId))
    setEdges(es => es.filter(e => e.source !== nodeId && e.target !== nodeId))
    setSelectedNodeId(null)
    setRightPanel(null)
  }

  const updateNode = (updated: WFNode) => {
    setNodes(ns => ns.map(n => n.id === updated.id
      ? { ...n, data: { ...n.data, ...updated, type: updated.type } }
      : n
    ))
    toast.success('Node saved')
  }

  const buildDefinition = () => ({
    nodes: nodes.map(rfNodeToWF),
    edges: edges.map(e => ({ source: e.source, target: e.target })),
  })

  const save = async () => {
    setSaving(true)
    try {
      const definition = buildDefinition()
      await workflowsApi.update(wf.id, { definition })
      setActiveWorkflow({ ...wf, definition })
      qc.invalidateQueries({ queryKey: ['workflows'] })
      toast.success('Saved')
    } catch { toast.error('Save failed') }
    finally { setSaving(false) }
  }

  const toggleActive = async () => {
    try {
      if (wf.status === 'active') { await workflowsApi.deactivate(wf.id); setActiveWorkflow({ ...wf, status: 'inactive' }) }
      else { await workflowsApi.activate(wf.id); setActiveWorkflow({ ...wf, status: 'active' }) }
      qc.invalidateQueries({ queryKey: ['workflows'] })
    } catch { toast.error('Failed') }
  }

  const runNow = async () => {
    setRunning(true)
    try {
      const { execution_id } = await workflowsApi.execute(wf.id)
      toast.success('Execution started')
      // Poll execution for node statuses
      let attempts = 0
      pollRef.current = setInterval(async () => {
        attempts++
        try {
          const ex = await executionsApi.get(execution_id)
          const statuses: Record<string, string> = {}
          Object.entries(ex.node_results ?? {}).forEach(([nid, r]: [string, any]) => {
            statuses[nid] = r.status
          })
          setNodeStatuses(statuses)
          setNodes(ns => ns.map(n => ({ ...n, data: { ...n.data, status: statuses[n.id] } })))
          if (['success', 'failed', 'cancelled'].includes(ex.status) || attempts > 60) {
            clearInterval(pollRef.current!)
            setRunning(false)
          }
        } catch { clearInterval(pollRef.current!); setRunning(false) }
      }, 2000)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Run failed')
      setRunning(false)
    }
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  const layout = () => { setNodes(ns => autoLayout(ns, edges)) }

  const selectedNode = nodes.find(n => n.id === selectedNodeId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ height: 48, background: 'var(--bg1)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 14px', gap: 8, flexShrink: 0 }}>
        {/* Back */}
        <button onClick={() => setActiveWorkflow(null)} style={{ background: 'transparent', color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '4px 6px', borderRadius: 6 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        {/* Name */}
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginRight: 4 }}>{wf.name}</span>
        {/* Status badge */}
        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: wf.status === 'active' ? 'rgba(34,197,94,0.12)' : 'var(--bg3)', color: wf.status === 'active' ? 'var(--green)' : 'var(--text3)' }}>
          {wf.status}
        </span>
        <div style={{ flex: 1 }} />

        {/* Panel toggles */}
        <ToolbarBtn active={rightPanel === 'triggers'} onClick={() => setRightPanel(p => p === 'triggers' ? null : 'triggers')} label="Triggers">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        </ToolbarBtn>
        <ToolbarBtn active={rightPanel === 'executions'} onClick={() => setRightPanel(p => p === 'executions' ? null : 'executions')} label="Executions">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </ToolbarBtn>

        <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

        {/* Layout */}
        <ToolbarBtn onClick={layout} label="Auto-layout">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
        </ToolbarBtn>

        {/* Add node */}
        <button onClick={() => setShowPicker(p => !p)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: showPicker ? 'var(--bg3)' : 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 7, fontSize: 12, fontWeight: 500 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Node
        </button>

        {/* Run */}
        <button onClick={runNow} disabled={running} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: running ? 'var(--bg3)' : 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: 'var(--green)', borderRadius: 7, fontSize: 12, fontWeight: 600, opacity: running ? 0.7 : 1 }}>
          {running
            ? <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0" opacity={0.3}/><path d="M12 3a9 9 0 019 9"/></svg> Running</>
            : <><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Run</>
          }
        </button>

        {/* Toggle active */}
        <button onClick={toggleActive} style={{ padding: '6px 12px', background: wf.status === 'active' ? 'rgba(239,68,68,0.12)' : 'rgba(124,58,237,0.12)', border: `1px solid ${wf.status === 'active' ? 'rgba(239,68,68,0.3)' : 'rgba(124,58,237,0.3)'}`, color: wf.status === 'active' ? 'var(--red)' : 'var(--accent)', borderRadius: 7, fontSize: 12, fontWeight: 600 }}>
          {wf.status === 'active' ? 'Deactivate' : 'Activate'}
        </button>

        {/* Save */}
        <button onClick={save} disabled={saving} style={{ padding: '6px 16px', background: 'var(--accent)', color: '#fff', borderRadius: 7, fontSize: 12, fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* Canvas area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Node picker */}
        {showPicker && <NodePicker onAdd={addNode} onClose={() => setShowPicker(false)} />}

        {/* ReactFlow canvas */}
        <div style={{ flex: 1, position: 'relative' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={NODE_TYPES}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.2}
            maxZoom={2}
            deleteKeyCode="Delete"
            multiSelectionKeyCode="Shift"
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{
              type: 'smoothstep',
              markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
              style: { stroke: '#6366f1', strokeWidth: 1.8, opacity: 0.7 },
            }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#2a2a45" />
            <Controls showInteractive={false} />
            <MiniMap nodeColor={(n) => { const def = getNodeDef(n.data?.type); return def ? PROVIDER_COLORS[def.provider] ?? '#6366f1' : '#6366f1' }} maskColor="rgba(15,15,23,0.6)" />
          </ReactFlow>

          {/* Empty state overlay */}
          {nodes.length === 0 && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', gap: 12 }}>
              <div style={{ width: 64, height: 64, border: '2px dashed var(--border2)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </div>
              <p style={{ color: 'var(--text3)', fontSize: 14 }}>Click <strong style={{ color: 'var(--text2)' }}>Add Node</strong> to start building</p>
            </div>
          )}
        </div>

        {/* Right panels */}
        {rightPanel === 'node' && selectedNode && (
          <NodePanel
            node={rfNodeToWF(selectedNode)}
            credentials={credentials}
            onChange={updateNode}
            onDelete={() => deleteNode(selectedNode.id)}
            onClose={() => setRightPanel(null)}
          />
        )}
        {rightPanel === 'executions' && (
          <ExecutionsPanel workflowId={wf.id} onClose={() => setRightPanel(null)} />
        )}
        {rightPanel === 'triggers' && (
          <TriggersPanel workflowId={wf.id} onClose={() => setRightPanel(null)} />
        )}
      </div>
    </div>
  )
}

export default function WorkflowEditor() {
  return (
    <ReactFlowProvider>
      <EditorInner />
    </ReactFlowProvider>
  )
}
