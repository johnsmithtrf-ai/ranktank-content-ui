import React, { useState, useEffect, useCallback } from 'react'
import { isLoggedIn, login, saveToken, logout, getQueues } from './api'
import BotCard from './components/BotCard'
import History from './components/History'
import SingleTaskForm from './components/SingleTaskForm'
import MultiTaskForm from './components/MultiTaskForm'

const SingleTaskFormLazy = SingleTaskForm

interface Task {
  task_id?: string
  id?: string
  status: string
  task?: Record<string, unknown>
}

interface Queue {
  running: Task[]
  queued: Task[]
  done: Task[]
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(isLoggedIn)
  const [queues, setQueues] = useState<Record<string, Queue>>({})
  const [loadError, setLoadError] = useState('')
  const [repeatValues, setRepeatValues] = useState<Record<string, unknown> | null>(null)
  const [repeatMultiValues, setRepeatMultiValues] = useState<Record<string, unknown> | null>(null)

  const refresh = useCallback(async () => {
    try {
      const data = await getQueues()
      setQueues(data)
      setLoadError('')
    } catch (e) {
      if (String(e).includes('Unauthorized')) setLoggedIn(false)
      else setLoadError(String(e))
    }
  }, [])

  useEffect(() => {
    if (loggedIn) {
      refresh()
      const t = setInterval(refresh, 8000)
      return () => clearInterval(t)
    }
  }, [loggedIn, refresh])

  if (!loggedIn) return <LoginScreen onLogin={() => setLoggedIn(true)} />

  const bots = Object.keys(queues).length > 0 ? Object.keys(queues) : ['bot1', 'bot2']

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#e6edf3' }}>RankTank — ContentQueue</h1>
          <p style={{ fontSize: '12px', color: '#7d8590', marginTop: '2px' }}>Content generation dashboard</p>
        </div>
        <button onClick={() => { logout(); setLoggedIn(false) }} style={{ padding: '6px 14px', background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', borderRadius: '6px', color: '#f85149', fontSize: '12px', cursor: 'pointer' }}>
          Выйти
        </button>
      </div>

      {/* Method legend */}
      <MethodLegend />

      {/* Repeat form */}
      {repeatValues !== null && (
        <SingleTaskFormLazy
          initialValues={repeatValues}
          onClose={() => setRepeatValues(null)}
          onAdded={() => { setRepeatValues(null); refresh() }}
        />
      )}
      {repeatMultiValues !== null && (
        <MultiTaskForm
          initialValues={repeatMultiValues}
          onClose={() => setRepeatMultiValues(null)}
          onAdded={() => { setRepeatMultiValues(null); refresh() }}
        />
      )}

      {loadError && (
        <div style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#f85149' }}>
          {loadError}
        </div>
      )}

      {/* Bot cards + History sidebar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 560px', gap: '16px', alignItems: 'start' }}>
        {bots.slice(0, 2).map(botId => (
          <BotCard
            key={botId}
            name={`Бот ${botId.replace('bot', '')}`}
            botId={botId}
            queue={queues[botId] || { running: [], queued: [], done: [] }}
            onRefresh={refresh}
          />
        ))}
        {/* History sidebar */}
        <div style={{ height: 'calc(100vh - 120px)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <History onRepeat={t => setRepeatValues(t)} onRepeatMulti={t => setRepeatMultiValues(t)} onLogout={() => setLoggedIn(false)} />
        </div>
      </div>
    </div>
  )
}

// ── Login ────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function doLogin() {
    setLoading(true); setError('')
    try {
      const data = await login(username, password)
      if (data.access_token) {
        saveToken(data.access_token)
        onLogin()
      } else {
        setError(data.detail || 'Неверный логин/пароль')
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1117' }}>
      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '12px', padding: '40px', width: '360px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '24px', textAlign: 'center' }}>ContentQueue</h2>
        <div style={{ marginBottom: '12px' }}>
          <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" onKeyDown={e => e.key === 'Enter' && doLogin()}
            style={{ width: '100%', padding: '10px 14px', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', color: '#e6edf3', fontSize: '14px' }} />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" onKeyDown={e => e.key === 'Enter' && doLogin()}
            style={{ width: '100%', padding: '10px 14px', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', color: '#e6edf3', fontSize: '14px' }} />
        </div>
        {error && <div style={{ color: '#f85149', fontSize: '13px', marginBottom: '12px' }}>{error}</div>}
        <button onClick={doLogin} disabled={loading}
          style={{ width: '100%', padding: '10px', background: loading ? '#333' : '#238636', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
          {loading ? 'Входим...' : 'Войти'}
        </button>
      </div>
    </div>
  )
}

// ── Method Legend ─────────────────────────────────────────────────────────────
const METHODS = [
  { id: 'V1', label: 'V1 Базовый', color: '#64748b', speed: 1, quality: 1, speedLabel: '⚡ Быстро', desc: 'Стандартная генерация text_review. Подходит для большого объёма простых обзоров с несколькими брендами.' },
  { id: 'V2', label: 'V2 Улучшенный', color: '#3b82f6', speed: 2, quality: 2, speedLabel: '⚡⚡ Средне', desc: 'Расширенная H2/H3 структура, детализированные описания брендов. Хороший баланс скорость / качество.' },
  { id: 'V3', label: 'V3 Максимальный', color: '#8b5cf6', speed: 3, quality: 4, speedLabel: '⚡⚡⚡ Дольше', desc: 'SERP-анализ конкурентов + уникализация структуры. Наилучшее качество, релевантность запросу.' },
  { id: 'V4', label: 'V4 Pro+Проверка', color: '#22c55e', speed: 3, quality: 5, speedLabel: '⚡⚡⚡⚡ Медленно', desc: 'V3 + автоматическая проверка Originality.ai. Если < 80% оригинальности — авторегенерация (до 2х).' },
  { id: 'V5', label: 'V5 PAA+E-E-A-T', color: '#f59e0b', speed: 4, quality: 5, speedLabel: '⚡⚡⚡⚡⚡ Макс', desc: 'V4 + реальные PAA-вопросы Google, диверсификация анкоров, responsible gambling блок, self-check отчёт. Максимальное SEO качество.' },
]

function MethodLegend() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginBottom: '16px' }}>
      {METHODS.map(m => (
        <div key={m.id} style={{ background: '#161b22', border: `1px solid ${m.color}33`, borderTop: `3px solid ${m.color}`, borderRadius: '6px', padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
            <span style={{ background: m.color + '22', color: m.color, fontWeight: 700, fontSize: '11px', padding: '1px 5px', borderRadius: '4px', whiteSpace: 'nowrap' }}>{m.id}</span>
            <span style={{ color: '#e6edf3', fontWeight: 600, fontSize: '11px', whiteSpace: 'nowrap' }}>{m.label.replace(m.id + ' ', '')}</span>
            <span style={{ color: '#64748b', fontSize: '10px', marginLeft: 'auto', whiteSpace: 'nowrap' }}>{m.speedLabel}</span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '11px', lineHeight: '1.4', margin: 0 }}>{m.desc}</p>
        </div>
      ))}
    </div>
  )
}
