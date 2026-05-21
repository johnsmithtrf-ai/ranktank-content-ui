import { useState, useEffect, useCallback } from 'react'
import { getQueues, getHistory, stopTask } from './api'
import TaskForm from './TaskForm'


interface Task {
  id?: string
  status?: string
  task_id?: string
  article_type?: string
  geo?: string
  language?: string
  created_at?: string
  result?: string
  [key: string]: unknown
}

interface BotQueue {
  running?: Task[]
  queued?: Task[]
  done?: Task[]
  recently_done?: Task[]
  done_count?: number
  [key: string]: unknown
}

interface QueuesData {
  bot1?: BotQueue
  bot2?: BotQueue
  [key: string]: unknown
}

interface HistoryItem {
  task_id?: string
  id?: string
  status?: string
  created_at?: string
  created_by?: string
  task_json?: string
  task_json_parsed?: Record<string, unknown>
  [key: string]: unknown
}

const USER_COLORS: Record<string, string> = {
  admin:   '#f59e0b',
  sofia:   '#ec4899',
  romant4: '#3b82f6',
  unit:    '#8b5cf6',
  vlad:    '#06b6d4',
}

interface Props {
  onLogout: () => void
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    running: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e' },
    queued: { bg: 'rgba(250,173,20,0.15)', color: '#faad14' },
    done: { bg: 'rgba(125,133,144,0.15)', color: '#7d8590' },
    error: { bg: 'rgba(248,81,73,0.15)', color: '#f85149' },
  }
  const c = colors[status] || { bg: 'rgba(125,133,144,0.15)', color: '#7d8590' }
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '12px',
      fontSize: '11px',
      fontWeight: 600,
      background: c.bg,
      color: c.color,
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    }}>
      {status}
    </span>
  )
}

function getTaskTitle(task: Task): string {
  const inner = task.task as Record<string, unknown> | undefined
  const keywords = (inner?.keywords as string[]) || []
  const geo = (inner?.geo as string) || task.geo || ''
  const count = (inner?.count as string | number) || ''
  const firstKey = keywords[0] || (inner?.article_type as string) || task.article_type || 'Task'
  return [firstKey, geo, count ? `${count} texts` : ''].filter(Boolean).join(' · ')
}

function getTaskSubtitle(task: Task): string {
  const id = task.task_id || task.id || '—'
  const inner = task.task as Record<string, unknown> | undefined
  const shortId = String(id).split('_').pop() || String(id)
  const folder = (inner?.dropbox_folder as string) || ''
  return `ID: #${shortId}${folder ? ` · by: ${folder}` : ''}`
}

function TaskResult({ result }: { result: string }) {
  try {
    const r = JSON.parse(result)
    const links: string[] = r.links || []
    if (links.length > 0) {
      return (
        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #21262d' }}>
          <div style={{ color: '#64748b', fontSize: '11px', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Результаты:</div>
          {links.map((link, i) => (
            <a
              key={i}
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{
                display: 'block',
                color: '#22c55e',
                fontSize: '12px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginBottom: '3px',
                textDecoration: 'none'
              }}
            >
              📎 {link.split('/').pop()?.split('?')[0] || `Файл ${i + 1}`}
            </a>
          ))}
        </div>
      )
    }
    if (r.text) {
      return (
        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #21262d', color: '#64748b', fontSize: '11px' }}>
          {r.text.slice(0, 100)}...
        </div>
      )
    }
    return null
  } catch {
    return null
  }
}

function TaskCard({ task, botId, onRefresh }: { task: Task; botId?: string; onRefresh?: () => void }) {
  const status = (task.status as string) || 'queued'
  const isDone = status === 'done'
  const hasResult = isDone && !!task.result
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      onClick={isDone ? () => setExpanded(e => !e) : undefined}
      style={{
        background: '#0d1117',
        border: '1px solid #21262d',
        borderRadius: '8px',
        padding: '12px 14px',
        marginBottom: '8px',
        cursor: isDone ? 'pointer' : 'default',
        transition: 'border-color 0.15s'
      }}
      onMouseEnter={e => { if (isDone) (e.currentTarget as HTMLDivElement).style.borderColor = '#30363d' }}
      onMouseLeave={e => { if (isDone) (e.currentTarget as HTMLDivElement).style.borderColor = '#21262d' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', color: '#e6edf3', fontWeight: 500, marginBottom: '4px', wordBreak: 'break-word' }}>
            {getTaskTitle(task)}
          </div>
          <div style={{ fontSize: '11px', color: '#7d8590' }}>
            {getTaskSubtitle(task)}
            {task.created_at && ` · ${(() => { const s = (task.created_at as string).replace('T',' '); const p = s.split(/[- :]/); const d = new Date(+p[0], +p[1]-1, +p[2], +p[3]||0, +p[4]||0); return d.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'}); })()}`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <StatusBadge status={status} />
          {status === 'running' && botId && (
            <button
              onClick={async (e) => {
                e.stopPropagation();
                if (confirm('Остановить задачу?')) {
                  await stopTask(botId, task.task_id || task.id || '');
                  if (onRefresh) onRefresh();
                }
              }}
              style={{
                background: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '12px',
                cursor: 'pointer',
                marginLeft: '8px'
              }}
            >
              ⛔ Стоп
            </button>
          )}
          {isDone && hasResult && (
            <span style={{ color: '#64748b', fontSize: '12px' }}>{expanded ? '▲' : '▼'}</span>
          )}
        </div>
      </div>
      {expanded && hasResult && <TaskResult result={task.result!} />}
    </div>
  )
}

function BotColumn({
  name,
  queue,
  onRefresh
}: {
  name: string
  queue: BotQueue | undefined
  onRefresh: () => void
}) {
  const [showForm, setShowForm] = useState(false)

  const running = queue?.running || []
  const queued = queue?.queued || []
  const done = (queue?.recently_done || queue?.done || []).slice(-5).reverse()
  const doneCount = queue?.done_count || 0
  const total = running.length + queued.length

  return (
    <div style={{
      background: '#161b22',
      border: '1px solid #30363d',
      borderRadius: '12px',
      padding: '20px',
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 600 }}>{name}</h2>
          <p style={{ fontSize: '12px', color: '#7d8590', marginTop: '2px' }}>
            {running.length} running · {queued.length} queued · {doneCount} done
            {total > 0 && <span style={{ color: '#22c55e', marginLeft: '4px' }}>●</span>}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{
            padding: '7px 14px',
            background: 'rgba(34,197,94,0.15)',
            border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: '8px',
            color: '#22c55e',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          + Добавить
        </button>
      </div>

      {/* Running */}
      {running.length > 0 && (
        <div>
          <div style={{ fontSize: '11px', color: '#7d8590', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>
            Running ({running.length})
          </div>
          {running.map((t, i) => <TaskCard key={t.task_id || t.id || i} task={t} botId={name === 'Бот 1' ? 'bot1' : 'bot2'} onRefresh={onRefresh} />)}
        </div>
      )}

      {/* Queued */}
      {queued.length > 0 && (
        <div>
          <div style={{ fontSize: '11px', color: '#7d8590', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>
            Queued ({queued.length})
          </div>
          {queued.map((t, i) => <TaskCard key={t.task_id || t.id || i} task={t} />)}
        </div>
      )}

      {/* Recently Done */}
      {done.length > 0 && (
        <div>
          <div style={{ fontSize: '11px', color: '#7d8590', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
            <span>✔ Недавно выполнено</span>
            <span style={{ color: '#22c55e' }}>{doneCount} всего</span>
          </div>
          {done.map((t, i) => <TaskCard key={t.task_id || t.id || i} task={{ ...t, status: 'done' }} />)}
        </div>
      )}

      {running.length === 0 && queued.length === 0 && done.length === 0 && (
        <div style={{ textAlign: 'center', color: '#7d8590', fontSize: '13px', padding: '24px 0' }}>
          No tasks
        </div>
      )}

      {showForm && (
        <TaskForm
          onClose={() => setShowForm(false)}
          onAdded={onRefresh}
        />
      )}
    </div>
  )
}

function HistoryPanel({ onRepeat, onLogout }: { onRepeat: (task: Record<string, unknown>) => void; onLogout: () => void }) {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copyMsg, setCopyMsg] = useState<string | null>(null)

  const fetchHistory = useCallback(() => {
    setLoading(true)
    getHistory()
      .then(data => {
        const items: HistoryItem[] = Array.isArray(data) ? data : (data.tasks || data.history || [])
        const parsed = items.slice(0, 100).map(item => {
          let taskData: Record<string, unknown> = {}
          try { taskData = JSON.parse(item.task_json as string || '{}') } catch {}
          return { ...item, task_json_parsed: taskData }
        })
        setHistory(parsed)
        setError('')
      })
      .catch(err => {
        const msg = err instanceof Error ? err.message : 'Failed'
        if (msg === 'Unauthorized') { onLogout(); return; }
        setError(msg)
      })
      .finally(() => setLoading(false))
  }, [onLogout])

  useEffect(() => {
    fetchHistory()
    const iv = setInterval(fetchHistory, 5000)
    return () => clearInterval(iv)
  }, [fetchHistory])

  const handleRepeat = (item: HistoryItem) => {
    onRepeat(item.task_json_parsed || {})
  }

  const getItemLinks = (item: HistoryItem): string[] => {
    if (item.status !== 'done' || !item.result) return []
    try {
      const r = JSON.parse(item.result as string)
      return (r.links as string[]) || []
    } catch { return [] }
  }

  const handleCopy = async (item: HistoryItem, e: React.MouseEvent) => {
    e.stopPropagation()

    // For done tasks with results — copy Dropbox links
    if (item.status === 'done' && item.result) {
      try {
        const r = JSON.parse(item.result as string)
        const links: string[] = r.links || []
        if (links.length > 0) {
          await navigator.clipboard.writeText(links.join('\n'))
          const key = item.task_id || item.id || 'ok'
          setCopyMsg(key)
          setTimeout(() => setCopyMsg(null), 2000)
          return
        }
      } catch {}
    }

    // Otherwise copy task spec
    const t = item.task_json_parsed || {}
    const lines = [
      `Количество текстов: ${(t.count as number) || ''}`,
      `Тип генерации: ${(t.generation_method as string)?.toUpperCase() || 'V4'}`,
      `Тип: ${(t.article_type as string) || 'text_review'}`,
      `ГЕО + Язык: ${(t.geo as string) || ''}, ${(t.language as string) || ''}`,
      ``,
      `Конкуренты:`,
      ...((t.competitors as string[]) || []),
      ``,
      `Ключи:`,
      ...((t.keywords as string[]) || []),
      ``,
      `Бренды:`,
      ...((t.casinos as string[]) || []),
      ``,
      `Папка - ${(t.dropbox_folder as string) || ''}`,
    ]
    await navigator.clipboard.writeText(lines.join('\n'))
    const key = item.task_id || item.id || 'ok'
    setCopyMsg(key)
    setTimeout(() => setCopyMsg(null), 2000)
  }

  const getHistoryId = (item: HistoryItem) => {
    const raw = item.task_id || item.id || ''
    return String(raw).split('_').pop() || String(raw)
  }

  const getHistoryTitle = (item: HistoryItem) => {
    const d = item.task_json_parsed || {}
    const kw = (d.keywords as string[]) || []
    const geo = (d.geo as string) || ''
    const count = (d.count as number) || ''
    const first = kw[0] || (d.article_type as string) || 'Task'
    return [first, geo, count ? `${count} texts` : ''].filter(Boolean).join(' · ')
  }

  const formatDate = (s: string) => {
    if (!s) return '';
    // Treat as UTC (API now stores UTC)
    const utc = s.endsWith('Z') || s.includes('+') ? s : s + 'Z';
    const d = new Date(utc);
    return d.toLocaleDateString('ru-RU',{day:'numeric',month:'short'}) + ', ' +
           d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
  };

  return (
    <div style={{
      background: '#161b22',
      border: '1px solid #30363d',
      borderRadius: '12px',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: 0
    }}>
      {/* Panel header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #21262d', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#e6edf3' }}>История</h2>
      </div>

      {/* Scrollable list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        {loading && history.length === 0 && (
          <div style={{ textAlign: 'center', color: '#7d8590', padding: '40px 0', fontSize: '13px' }}>Загрузка...</div>
        )}
        {error && (
          <div style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', borderRadius: '8px', padding: '10px 12px', color: '#f85149', fontSize: '12px', marginBottom: '8px' }}>{error}</div>
        )}
        {!loading && history.length === 0 && !error && (
          <div style={{ textAlign: 'center', color: '#7d8590', padding: '40px 0', fontSize: '13px' }}>Нет истории</div>
        )}
        {history.map((item, i) => {
          const itemKey = item.task_id || item.id || String(i)
          const isCopied = copyMsg === itemKey
          return (
            <div key={itemKey} style={{
              background: '#0d1117',
              border: '1px solid #21262d',
              borderRadius: '8px',
              padding: '8px 10px',
              marginBottom: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', color: '#e6edf3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ color: '#7d8590' }}>#{getHistoryId(item)}</span>
                  {' · '}{getHistoryTitle(item)}
                  {' · '}
                  <span style={{
                    color: item.status === 'done' ? '#22c55e' : item.status === 'error' ? '#f85149' : '#faad14'
                  }}>{item.status || 'done'}</span>
                </div>
                <div style={{ fontSize: '10px', color: '#7d8590', marginTop: '2px' }}>
                  {formatDate(item.created_at as string || '')}
                  {item.created_by && (
                    <span style={{
                      display: 'inline-block',
                      padding: '1px 7px',
                      borderRadius: '10px',
                      fontSize: '11px',
                      fontWeight: 600,
                      background: (USER_COLORS[item.created_by] || '#64748b') + '22',
                      color: USER_COLORS[item.created_by] || '#64748b',
                      border: `1px solid ${(USER_COLORS[item.created_by] || '#64748b')}44`,
                      marginLeft: '6px',
                    }}>
                      {item.created_by}
                    </span>
                  )}
                </div>
              </div>
              {/* Actions */}
              {(() => {
                const links = getItemLinks(item)
                const hasLinks = links.length > 0
                const label = hasLinks ? '📎 Ссылки' : '📋 ТЗ'
                const title = hasLinks ? 'Копировать ссылки Dropbox' : 'Копировать ТЗ'
                return (
                  <button
                    onClick={(e) => handleCopy(item, e)}
                    title={title}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', padding: '2px 4px', color: isCopied ? '#22c55e' : '#7d8590', flexShrink: 0, whiteSpace: 'nowrap' }}
                  >{isCopied ? '✅ OK' : label}</button>
                )
              })()}
              <button
                onClick={() => handleRepeat(item)}
                title="Повторить задание"
                className="cq-icon-btn"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '4px', color: '#22c55e', flexShrink: 0, minWidth: '36px', minHeight: '36px' }}
              >🔁</button>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  if (window.confirm('Удалить?')) {
                    try {
                      const token = localStorage.getItem('token') || '';
                      await fetch(`https://content-api.startmyonlinecourses.com/tasks/${item.id}`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${token}` }
                      });
                      setHistory(prev => prev.filter(t => t.id !== item.id));
                    } catch(e) { console.error(e); }
                  }
                }}
                title="Удалить"
                className="cq-icon-btn"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '16px', padding: '4px', minWidth: '36px', minHeight: '36px' }}
              >🗑️</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Dashboard({ onLogout }: Props) {
  const [queues, setQueues] = useState<QueuesData>({})
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState('')
  const [showRepeatForm, setShowRepeatForm] = useState(false)
  const [repeatTask, setRepeatTask] = useState<Record<string, unknown> | null>(null)

  const handleRepeat = (task: Record<string, unknown>) => {
    // Явно вырезаем id/task_id — передаём только поля формы, чтобы
    // TaskForm создал НОВУЮ задачу, а не обновил существующую
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, task_id: _tid, status: _status, created_at: _created, result: _result, ...taskFields } = task
    setRepeatTask(taskFields)
    setShowRepeatForm(true)
  }

  const fetchQueues = useCallback(async () => {
    try {
      const data = await getQueues()
      setQueues(data)
      setLastUpdated(new Date())
      setError('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch queues'
      if (msg === 'Unauthorized') { onLogout(); return; }
      setError(msg)
    }
  }, [onLogout])

  useEffect(() => {
    fetchQueues()
    const interval = setInterval(fetchQueues, 2000)
    return () => clearInterval(interval)
  }, [fetchQueues])

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117' }}>
      {/* Navbar */}
      <nav className="cq-navbar" style={{
        background: '#161b22',
        borderBottom: '1px solid #21262d',
        padding: '0 24px',
        height: '56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>⚡</span>
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#e6edf3' }}>RankTank - ContentQueue</span>
        </div>
        <div className="cq-navbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {lastUpdated && (
            <span className="cq-navbar-updated" style={{ fontSize: '12px', color: '#7d8590' }}>
              Updated {lastUpdated.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit', second:'2-digit'})}
            </span>
          )}
          <button
            onClick={fetchQueues}
            style={{
              background: 'none',
              border: '1px solid #30363d',
              borderRadius: '6px',
              color: '#7d8590',
              padding: '5px 12px',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            ↻ Refresh
          </button>
          <button
            onClick={onLogout}
            style={{
              background: 'none',
              border: 'none',
              color: '#7d8590',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            Logout
          </button>
        </div>
      </nav>

      {/* 3-column grid */}
      <style>{`
        * { box-sizing: border-box; }
        body, #root { overflow-x: hidden; max-width: 100vw; }
        @media (max-width: 768px) {
          /* Main layout */
          .cq-grid { grid-template-columns: 1fr !important; }
          .cq-history-col { min-height: 300px; height: auto !important; }

          /* Version cards: horizontal scroll strip */
          .cq-version-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .cq-version-card { width: 100% !important; }

          /* Navbar */
          .cq-navbar {
            height: auto !important;
            min-height: 56px;
            flex-wrap: wrap;
            padding: 8px 12px !important;
            gap: 6px;
          }
          .cq-navbar-actions { flex-wrap: wrap; gap: 8px !important; }
          .cq-navbar-updated { display: none !important; }

          /* Touch targets for icon buttons */
          .cq-icon-btn {
            min-width: 44px !important;
            min-height: 44px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }

          /* Sticky FAB */
          .cq-fab {
            display: flex !important;
          }
        }
        @media (min-width: 769px) {
          .cq-fab { display: none !important; }
        }
      `}</style>

      <div style={{ padding: '16px' }}>
        {error && (
          <div style={{
            background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)',
            borderRadius: '8px', padding: '10px 16px', color: '#f85149',
            fontSize: '13px', marginBottom: '16px'
          }}>{error}</div>
        )}

        {/* Version Guide */}
        <div className="cq-version-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '10px',
          marginBottom: '16px',
          overflow: 'hidden',
        }}>
          {[
            {
              version: 'V1',
              color: '#64748b',
              title: 'Базовый',
              speed: '⚡ Быстро',
              desc: 'Стандартная генерация text_review. Подходит для большого объёма простых обзоров с несколькими брендами.',
            },
            {
              version: 'V2',
              color: '#3b82f6',
              title: 'Улучшенный',
              speed: '⚡⚡ Средне',
              desc: 'Расширенная H2/H3 структура, детализированные описания брендов. Хороший баланс скорость / качество.',
            },
            {
              version: 'V3',
              color: '#8b5cf6',
              title: 'Максимальный',
              speed: '⚡⚡⚡ Дольше',
              desc: 'SERP-анализ конкурентов + уникализация структуры. Наилучшее качество, релевантность запросу.',
            },
            {
              version: 'V4',
              color: '#22c55e',
              title: 'Pro + Проверка',
              speed: '⚡⚡⚡⚡ Медленно',
              desc: 'V3 + автоматическая проверка Originality.ai. Если < 80% оригинальности — авторегенерация (до 2х).',
            },
          ].map(v => (
            <div key={v.version} className="cq-version-card" style={{
              background: '#161b22',
              border: `1px solid ${v.color}33`,
              borderTop: `3px solid ${v.color}`,
              borderRadius: '8px',
              padding: '10px 12px',
            }}>
              <div style={{display:'flex', alignItems:'center', gap:'8px', marginBottom:'6px'}}>
                <span style={{
                  background: v.color + '22',
                  color: v.color,
                  fontWeight: 700,
                  fontSize: '13px',
                  padding: '2px 8px',
                  borderRadius: '6px',
                }}>{v.version}</span>
                <span style={{color:'#e6edf3', fontWeight: 600, fontSize:'13px'}}>{v.title}</span>
                <span style={{color:'#64748b', fontSize:'11px', marginLeft:'auto'}}>{v.speed}</span>
              </div>
              <p style={{color:'#94a3b8', fontSize:'11px', lineHeight:'1.5', margin: 0}}>
                {v.desc}
              </p>
            </div>
          ))}
        </div>

        <div
          className="cq-grid"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 520px', gap: '16px', alignItems: 'start' }}
        >
          <BotColumn name="Бот 1" queue={queues.bot1 as BotQueue} onRefresh={fetchQueues} />
          <BotColumn name="Бот 2" queue={queues.bot2 as BotQueue} onRefresh={fetchQueues} />
          <div className="cq-history-col" style={{ height: 'calc(100vh - 80px)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <HistoryPanel onRepeat={handleRepeat} onLogout={onLogout} />
          </div>
        </div>
      </div>

      {/* Mobile sticky FAB - Add Task */}
      <div
        className="cq-fab"
        style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
          display: 'none',
        }}
      >
        <button
          onClick={() => {
            // Open bot1 form by dispatching a custom event; BotColumn listens
            setShowRepeatForm(true)
            setRepeatTask({})
          }}
          style={{
            padding: '14px 28px',
            background: '#22c55e',
            color: '#0d1117',
            border: 'none',
            borderRadius: '28px',
            fontSize: '15px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(34,197,94,0.4)',
            whiteSpace: 'nowrap',
          }}
        >
          + Добавить задание
        </button>
      </div>

      {/* Repeat modal */}
      {showRepeatForm && repeatTask && (
        <TaskForm
          onClose={() => { setShowRepeatForm(false); setRepeatTask(null) }}
          onAdded={fetchQueues}
          initialValues={{
            geo: repeatTask.geo as string,
            language: repeatTask.language as string,
            count: repeatTask.count as number,
            generation_method: repeatTask.generation_method as string,
            article_type: repeatTask.article_type as string,
            competitors: repeatTask.competitors as string[],
            keywords: repeatTask.keywords as string[],
            casinos: repeatTask.casinos as string[],
            dropbox_folder: repeatTask.dropbox_folder as string,
            output_format: repeatTask.output_format as string,
            bot: repeatTask.bot as string,
          }}
        />
      )}
    </div>
  )
}
