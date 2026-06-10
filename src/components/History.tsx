import React, { useState, useEffect, useCallback } from 'react'
import { getHistory, getBatchLinks } from '../api'

const API = 'https://content-api.startmyonlinecourses.com'

interface WebTask {
  id: number
  task_id?: string
  bot_id: string
  task_json: string
  task_json_parsed?: Record<string, unknown>
  status: string
  created_at: string
  created_by?: string
  result?: string
}

const USER_COLORS: Record<string, string> = {
  romant4: '#ec4899',
  artem4: '#3b82f6',
  sofiya: '#22c55e',
  unit: '#8b5cf6',
  vlad: '#06b6d4',
  admin: '#f59e0b',
}

interface Props {
  onRepeat: ((task: Record<string, unknown>) => void) | undefined
  onRepeatMulti?: (values: Record<string, unknown>) => void
  onLogout?: () => void
}

export default function History({ onRepeat, onRepeatMulti, onLogout }: Props) {
  const [tasks, setTasks] = useState<WebTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const load = useCallback(() => {
    getHistory().then(d => {
      const list = (Array.isArray(d) ? d : d.tasks || d.history || []).slice(0, 100).map((t: WebTask) => {
        let parsed: Record<string, unknown> = {}
        try { parsed = JSON.parse(t.task_json || '{}') } catch {}
        return { ...t, task_json_parsed: parsed }
      })
      setTasks(list)
      setError('')
    }).catch(e => {
      const msg = String(e)
      if (msg.includes('Unauthorized') && onLogout) onLogout()
      else setError(msg)
    }).finally(() => setLoading(false))
  }, [onLogout])

  useEffect(() => {
    load()
    const t = setInterval(load, 10000)
    return () => clearInterval(t)
  }, [load])

  function getLinks(task: WebTask): string[] {
    if (task.status !== 'done' || !task.result) return []
    try { return JSON.parse(task.result).links || [] } catch { return [] }
  }

  async function handleCopy(task: WebTask, e: React.MouseEvent) {
    e.stopPropagation()
    const key = String(task.task_id || task.id)
    const links = getLinks(task)
    if (links.length > 0) {
      await navigator.clipboard.writeText(links.join('\n'))
    } else {
      const f = task.task_json_parsed || {}
      const lines = [
        `Количество текстов: ${f.count || ''}`,
        `Тип генерации: ${String(f.generation_method || 'V4').toUpperCase()}`,
        `Тип: ${f.article_type || 'text_review'}`,
        `ГЕО + Язык: ${f.geo || ''}, ${f.language || ''}`,
        '',
        'Конкуренты:',
        ...((f.competitors as string[]) || []),
        '',
        'Ключи:',
        ...((f.keywords as string[]) || []),
        '',
        'Бренды:',
        ...((f.casinos as string[]) || []),
        '',
        `Папка - ${f.dropbox_folder || ''}`,
      ]
      await navigator.clipboard.writeText(lines.join('\n'))
    }
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  async function handleDelete(task: WebTask, e: React.MouseEvent) {
    e.stopPropagation()
    if (!window.confirm('Удалить из истории?')) return
    try {
      const token = localStorage.getItem('token') || ''
      await fetch(`${API}/tasks/${task.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      setTasks(prev => prev.filter(t => t.id !== task.id))
    } catch (err) {
      console.error(err)
    }
  }

  function formatDate(dt: string) {
    if (!dt) return ''
    const s = dt.endsWith('Z') || dt.includes('+') ? dt : dt + 'Z'
    const d = new Date(s)
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + ', ' +
      d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  }

  function taskLabel(task: WebTask) {
    const f = task.task_json_parsed || {}
    const kws = (f.keywords as string[]) || []
    const geo = f.geo || ''
    const count = f.count || ''
    return [kws[0] || f.article_type || 'Task', geo, count ? `${count} texts` : ''].filter(Boolean).join(' · ')
  }

  function shortId(task: WebTask) {
    const id = String(task.task_id || task.id || '')
    return id.split('_').pop() || id
  }

  function renderTaskRow(task: WebTask, idx: number, indented = false) {
    const key = String(task.task_id || task.id || idx)
    const isCopied = copied === key
    const links = getLinks(task)
    const hasLinks = links.length > 0
    const copyLabel = hasLinks ? '📎 Ссылки' : '📋 ТЗ'
    const statusColor = task.status === 'done' ? '#22c55e' : task.status === 'error' ? '#f85149' : '#faad14'
    const userColor = USER_COLORS[task.created_by || ''] || '#64748b'
    return (
      <div key={key} style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: '8px', padding: '8px 10px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px', marginLeft: indented ? '12px' : 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '12px', color: '#e6edf3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span style={{ color: '#7d8590' }}>#{shortId(task)}</span>
            {' · '}{taskLabel(task)}{' · '}
            <span style={{ color: statusColor }}>{task.status || 'done'}</span>
          </div>
          <div style={{ fontSize: '10px', color: '#7d8590', marginTop: '2px' }}>
            {formatDate(task.created_at || '')}
            {task.created_by && (
              <span style={{ display: 'inline-block', padding: '1px 7px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, background: userColor + '22', color: userColor, border: `1px solid ${userColor}44`, marginLeft: '6px' }}>{task.created_by}</span>
            )}
          </div>
        </div>
        <button onClick={e => handleCopy(task, e)} title={copyLabel} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', padding: '2px 4px', color: isCopied ? '#22c55e' : '#7d8590', flexShrink: 0, whiteSpace: 'nowrap' }}>
          {isCopied ? '✅ OK' : copyLabel}
        </button>
        {onRepeat && (
          <button onClick={() => onRepeat(task.task_json_parsed || {})} title="Повторить" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '4px', color: '#22c55e', flexShrink: 0, minWidth: '32px', minHeight: '32px' }}>🔁</button>
        )}
        <button onClick={e => handleDelete(task, e)} title="Удалить" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '16px', padding: '4px', minWidth: '32px', minHeight: '32px' }}>🗑️</button>
      </div>
    )
  }

  function renderHistory() {
    // Группируем задачи по batch_group_id
    const groups: { groupId: string | null; items: WebTask[] }[] = []
    const seenGroups = new Map<string, WebTask[]>()
    const singles: WebTask[] = []

    for (const task of tasks) {
      const gid = (task as any).batch_group_id
      if (gid) {
        if (!seenGroups.has(gid)) seenGroups.set(gid, [])
        seenGroups.get(gid)!.push(task)
      } else {
        singles.push(task)
      }
    }

    // Собираем в порядке появления (по первой задаче группы)
    const allItems: ({ type: 'group'; groupId: string; items: WebTask[] } | { type: 'single'; task: WebTask })[] = []
    const addedGroups = new Set<string>()
    for (const task of tasks) {
      const gid = (task as any).batch_group_id
      if (gid && !addedGroups.has(gid)) {
        addedGroups.add(gid)
        allItems.push({ type: 'group', groupId: gid, items: seenGroups.get(gid)! })
      } else if (!gid) {
        allItems.push({ type: 'single', task })
      }
    }

    return allItems.map((item, idx) => {
      if (item.type === 'single') {
        return renderTaskRow(item.task, idx)
      }

      // Группа
      const { groupId, items } = item
      const isExpanded = expandedGroups.has(groupId)
      const done = items.filter(t => t.status === 'done').length
      const total = items.length
      const allDone = done === total
      // Сайты (batch_index)
      const siteMap = new Map<number, WebTask[]>()
      for (const t of items) {
        const bi = (t as any).batch_index ?? 0
        if (!siteMap.has(bi)) siteMap.set(bi, [])
        siteMap.get(bi)!.push(t)
      }
      const sitesCount = siteMap.size
      const firstTask = items[0]
      const f = firstTask?.task_json_parsed || {}
      const geo = String(f.geo || '')
      const method = String(f.generation_method || '')
      const groupCopiedKey = `group_${groupId}`
      const siteCopiedKeyPrefix = `site_${groupId}_`

      return (
        <div key={groupId} style={{ marginBottom: '8px' }}>
          {/* Заголовок группы */}
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <button onClick={() => setExpandedGroups(prev => {
              const next = new Set(prev)
              isExpanded ? next.delete(groupId) : next.add(groupId)
              return next
            })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#818cf8', fontSize: '13px', padding: 0 }}>
              {isExpanded ? '▼' : '▶'}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: '12px', color: '#818cf8', fontWeight: 600 }}>🗂️ Батч {groupId}</span>
              <span style={{ fontSize: '11px', color: '#7d8590', marginLeft: '8px' }}>{sitesCount} сайтов · {geo} · {method} · {done}/{total}</span>
              {allDone && <span style={{ marginLeft: '6px', color: '#22c55e', fontSize: '11px' }}>✅</span>}
            </div>
            {/* Кнопка Копировать все ссылки батча */}
            <button
              onClick={async () => {
                const data = await getBatchLinks(groupId)
                if (data.links?.length) {
                  await navigator.clipboard.writeText(data.links.join('\n'))
                  setCopied(groupCopiedKey)
                  setTimeout(() => setCopied(null), 2000)
                }
              }}
              title="Копировать все ссылки батча"
              style={{ background: 'none', border: '1px solid #30363d', borderRadius: '6px', cursor: allDone ? 'pointer' : 'not-allowed', fontSize: '11px', padding: '3px 8px', color: copied === groupCopiedKey ? '#22c55e' : allDone ? '#818cf8' : '#4b5563', flexShrink: 0, whiteSpace: 'nowrap' }}
              disabled={!allDone}>
              {copied === groupCopiedKey ? '✅ OK' : '📦📦 Все ссылки'}
            </button>
            {/* Кнопка повторить батч */}
            {onRepeatMulti && (
              <button
                onClick={() => {
                  // Собираем страницы из уникальных задач первого сайта (batch_index=0)
                  const site0 = siteMap.get(0) || items
                  const pages = site0.map(t => ({
                    keywords: (t.task_json_parsed?.keywords as string[]) || [],
                    article_type: t.task_json_parsed?.article_type || 'text_review',
                  }))
                  const ft = site0[0]?.task_json_parsed || {}
                  onRepeatMulti({
                    pages,
                    geo: ft.geo, language: ft.language,
                    generation_method: ft.generation_method,
                    model: ft.model,
                    competitors: ft.competitors,
                    casinos: ft.casinos,
                    dropbox_folder: ft.dropbox_folder,
                    output_format: ft.output_format,
                    word_count: ft.word_count,
                    sites_count: sitesCount,
                  })
                }}
                title="Повторить батч"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '2px 4px', color: '#22c55e', flexShrink: 0 }}>
                🔁
              </button>
            )}
          </div>

          {/* Сайты внутри группы */}
          {isExpanded && Array.from(siteMap.entries()).sort((a,b)=>a[0]-b[0]).map(([bi, siteTasks]) => {
            const siteDone = siteTasks.filter(t => t.status === 'done').length
            const siteTotal = siteTasks.length
            const siteAllDone = siteDone === siteTotal
            const siteCopiedKey = `${siteCopiedKeyPrefix}${bi}`
            const siteExpKey = `site_exp_${groupId}_${bi}`
            const isSiteExp = expandedGroups.has(siteExpKey)
            return (
              <div key={bi} style={{ marginLeft: '12px', marginBottom: '4px' }}>
                <div style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: '6px', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                  <button onClick={() => setExpandedGroups(prev => {
                    const next = new Set(prev)
                    isSiteExp ? next.delete(siteExpKey) : next.add(siteExpKey)
                    return next
                  })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '11px', padding: 0 }}>
                    {isSiteExp ? '▼' : '▶'}
                  </button>
                  <span style={{ fontSize: '11px', color: '#94a3b8', flex: 1 }}>🌐 Сайт {bi + 1} · {siteDone}/{siteTotal} {siteAllDone ? '✅' : ''}</span>
                  <button
                    onClick={async () => {
                      const data = await getBatchLinks(groupId, bi)
                      if (data.links?.length) {
                        await navigator.clipboard.writeText(data.links.join('\n'))
                        setCopied(siteCopiedKey)
                        setTimeout(() => setCopied(null), 2000)
                      }
                    }}
                    title="Копировать ссылки сайта"
                    style={{ background: 'none', border: '1px solid #21262d', borderRadius: '6px', cursor: siteAllDone ? 'pointer' : 'not-allowed', fontSize: '11px', padding: '2px 7px', color: copied === siteCopiedKey ? '#22c55e' : siteAllDone ? '#818cf8' : '#4b5563', flexShrink: 0, whiteSpace: 'nowrap' }}
                    disabled={!siteAllDone}>
                    {copied === siteCopiedKey ? '✅ OK' : '📦 Пачка'}
                  </button>
                </div>
                {isSiteExp && siteTasks.map((t, i) => renderTaskRow(t, i, true))}
              </div>
            )
          })}
        </div>
      )
    })
  }

  return (
    <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '12px', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #21262d', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#e6edf3' }}>История</h2>
        <button onClick={load} style={{ background: 'none', border: 'none', color: '#7d8590', cursor: 'pointer', fontSize: '14px' }} title="Обновить">↻</button>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        {loading && tasks.length === 0 && (
          <div style={{ textAlign: 'center', color: '#7d8590', padding: '40px 0', fontSize: '13px' }}>Загрузка...</div>
        )}
        {error && (
          <div style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', borderRadius: '8px', padding: '10px 12px', color: '#f85149', fontSize: '12px', marginBottom: '8px' }}>{error}</div>
        )}
        {!loading && tasks.length === 0 && !error && (
          <div style={{ textAlign: 'center', color: '#7d8590', padding: '40px 0', fontSize: '13px' }}>Нет истории</div>
        )}

        {renderHistory()}
      </div>
    </div>
  )
}
