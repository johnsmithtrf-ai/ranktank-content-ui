import React, { useState } from 'react'
import { stopTask } from '../api'
import SingleTaskForm from './SingleTaskForm'
import MultiTaskForm from './MultiTaskForm'

interface Task {
  task_id?: string
  id?: string
  status: string
  task?: Record<string, unknown>
  task_json?: string
}

interface Queue {
  running: Task[]
  queued: Task[]
  done: Task[]
}

const BOT_COLORS: Record<string, string> = {
  bot1: '#22c55e',
  bot2: '#3b82f6',
  bot3: '#8b5cf6',
  bot4: '#f59e0b',
}

export default function BotCard({ name, botId, queue, onRefresh }: {
  name: string
  botId: string
  queue: Queue
  onRefresh: () => void
}) {
  const [showSingle, setShowSingle] = useState(false)
  const [showMulti, setShowMulti] = useState(false)

  const running = queue.running || []
  const queued = queue.queued || []
  const done = (queue.done || []).slice(0, 5)

  const accentColor = BOT_COLORS[botId] || '#22c55e'
  const activeCount = running.length + queued.length

  function parseTask(t: Task) {
    if (t.task) return t.task
    try { return JSON.parse(t.task_json || '{}') } catch { return {} }
  }

  async function handleStop(t: Task) {
    const tid = t.task_id || t.id || ''
    if (!tid) return
    try { await stopTask(botId, String(tid)); onRefresh() } catch {}
  }

  return (
    <>
      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '12px', padding: '20px', flex: 1, minWidth: '320px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 600 }}>{name}</h2>
            <p style={{ fontSize: '12px', color: '#7d8590', marginTop: '2px' }}>
              {running.length} running · {queued.length} queued
              {activeCount > 0 && <span style={{ color: accentColor, marginLeft: '4px' }}>●</span>}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setShowSingle(true)}
              style={{ padding: '7px 14px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', color: '#22c55e', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              + Сингл
            </button>
            <button onClick={() => setShowMulti(true)}
              style={{ padding: '7px 14px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: '8px', color: '#818cf8', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              + Мульти 🗂️
            </button>
          </div>
        </div>

        {/* Running */}
        {running.length > 0 && (
          <Section title={`Running (${running.length})`} color="#22c55e">
            {running.map((t, i) => <TaskRow key={t.task_id || i} task={t} status="running" onStop={() => handleStop(t)} parseTask={parseTask} />)}
          </Section>
        )}

        {/* Queued */}
        {queued.length > 0 && (
          <Section title={`Queued (${queued.length})`} color="#d8950f">
            {queued.map((t, i) => <TaskRow key={t.task_id || i} task={t} status="queued" parseTask={parseTask} />)}
          </Section>
        )}

        {/* Done */}
        {done.length > 0 && (
          <Section title={`Recent Done (${done.length})`} color="#7d8590">
            {done.map((t, i) => <TaskRow key={t.task_id || i} task={t} status="done" parseTask={parseTask} />)}
          </Section>
        )}

        {running.length === 0 && queued.length === 0 && done.length === 0 && (
          <div style={{ textAlign: 'center', color: '#7d8590', fontSize: '13px', padding: '24px 0' }}>No tasks</div>
        )}
      </div>

      {showSingle && <SingleTaskForm onClose={() => setShowSingle(false)} onAdded={onRefresh} />}
      {showMulti && <MultiTaskForm onClose={() => setShowMulti(false)} onAdded={onRefresh} />}
    </>
  )
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ fontSize: '11px', color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>{title}</div>
      {children}
    </div>
  )
}

function TaskRow({ task, status, onStop, parseTask }: {
  task: Task
  status: string
  onStop?: () => void
  parseTask: (t: Task) => Record<string, unknown>
}) {
  const data = parseTask(task)
  const id = task.task_id || task.id || '?'
  const keywords = Array.isArray(data.keywords) ? data.keywords : []
  const label = keywords.length > 0 ? `${keywords[0]} · ${data.geo || ''} · ${data.count || 1} texts` : `Task #${id}`

  const statusColor = status === 'running' ? '#22c55e' : status === 'queued' ? '#d8950f' : '#7d8590'

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: '#0d1117', borderRadius: '6px', marginBottom: '4px' }}>
      <div style={{ fontSize: '12px', color: '#e6edf3', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: statusColor, textTransform: 'uppercase' }}>{status}</span>
        {status === 'running' && onStop && (
          <button onClick={onStop} style={{ padding: '2px 8px', background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', borderRadius: '4px', color: '#f85149', fontSize: '11px', cursor: 'pointer' }}>
            Stop
          </button>
        )}
      </div>
    </div>
  )
}
