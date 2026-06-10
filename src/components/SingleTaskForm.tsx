import React, { useState, useEffect } from 'react'
import { addTask, getDropboxFolders } from '../api'

const METHODS: Record<string, { label: string; desc: string; color: string }> = {
  V1: { label: 'V1 — Базовый', desc: 'Быстрая генерация. Подходит для простых review с небольшим объёмом.', color: '#64748b' },
  V2: { label: 'V2 — Улучшенный', desc: 'Расширенная структура H2/H3, больше деталей о брендах.', color: '#3b82f6' },
  V3: { label: 'V3 — Максимальный', desc: 'SERP-анализ конкурентов + уникализация. Лучшее качество, дольше генерируется.', color: '#8b5cf6' },
  V4: { label: 'V4 — Pro + Проверка', desc: 'V3 + Originality.ai: если < 80% оригинальности — авторегенерация.', color: '#22c55e' },
  V5: { label: 'V5 — PAA + E-E-A-T', desc: 'V4 + реальные PAA-вопросы из Google, диверсификация анкоров. Максимальное SEO качество.', color: '#f59e0b' },
}

const inp: React.CSSProperties = {
  width: '100%', padding: '8px 12px', background: '#161b22',
  border: '1px solid #30363d', borderRadius: '6px', color: '#e6edf3', fontSize: '13px',
}
const lbl: React.CSSProperties = {
  fontSize: '12px', color: '#8b949e', marginBottom: '4px', display: 'block',
}
const row: React.CSSProperties = { marginBottom: '12px' }

interface Props {
  onClose: () => void
  onAdded: () => void
  initialValues?: Record<string, unknown>
}

export default function SingleTaskForm({ onClose, onAdded, initialValues }: Props) {
  const [bot, setBot] = useState('auto')
  const [count, setCount] = useState(1)
  const [method, setMethod] = useState('V4')
  const [articleType, setArticleType] = useState('text_review')
  const [model, setModel] = useState('anthropic/claude-opus-4-6')
  const [geo, setGeo] = useState('')
  const [lang, setLang] = useState('')
  const [folder, setFolder] = useState('/test/')
  const [competitors, setCompetitors] = useState('')
  const [keywords, setKeywords] = useState('keyword 1\nkeyword 2')
  const [casinos, setCasinos] = useState('')
  const [wordCount, setWordCount] = useState('')
  const [htmlFormat, setHtmlFormat] = useState(false)
  const [folders, setFolders] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (initialValues) {
      if (initialValues.count) setCount(Number(initialValues.count))
      if (initialValues.generation_method) setMethod(String(initialValues.generation_method))
      if (initialValues.article_type) setArticleType(String(initialValues.article_type))
      if (initialValues.model) setModel(String(initialValues.model))
      if (initialValues.geo) setGeo(String(initialValues.geo))
      if (initialValues.language) setLang(String(initialValues.language))
      if (initialValues.dropbox_folder) setFolder(String(initialValues.dropbox_folder))
      if (initialValues.word_count) setWordCount(String(initialValues.word_count))
      if (initialValues.output_format === 'html') setHtmlFormat(true)
      if (Array.isArray(initialValues.keywords)) setKeywords((initialValues.keywords as string[]).join('\n'))
      if (Array.isArray(initialValues.casinos)) setCasinos((initialValues.casinos as string[]).join('\n'))
      if (Array.isArray(initialValues.competitors)) setCompetitors((initialValues.competitors as string[]).join('\n'))
    }
    getDropboxFolders().then(d => {
      if (Array.isArray(d)) setFolders(d)
    }).catch(() => {})
  }, [])

  async function submit() {
    setLoading(true); setError('')
    try {
      await addTask({
        bot_id: bot,
        count,
        generation_method: method,
        article_type: articleType,
        model,
        geo: geo || 'US',
        language: lang || 'EN',
        dropbox_folder: folder,
        competitors: competitors.split('\n').map(s => s.trim()).filter(Boolean),
        keywords: keywords.split('\n').map(s => s.trim()).filter(Boolean),
        casinos: casinos.split('\n').map(s => s.trim()).filter(Boolean),
        ...(wordCount && Number(wordCount) > 0 ? { word_count: Number(wordCount) } : {}),
        ...(htmlFormat ? { output_format: 'html' } : {}),
      })
      onAdded(); onClose()
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const methodInfo = METHODS[method]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '12px', padding: '28px', width: '660px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700 }}>Add Task</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8b949e', fontSize: '20px', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
          <div style={row}>
            <label style={lbl}>Bot</label>
            <select value={bot} onChange={e => setBot(e.target.value)} style={inp}>
              <option value="auto">Авто</option>
              <option value="bot1">Бот 1</option>
              <option value="bot2">Бот 2</option>
            </select>
          </div>
          <div style={row}>
            <label style={lbl}>Count</label>
            <input type="number" value={count} onChange={e => setCount(Number(e.target.value))} style={inp} min={1} max={50} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
          <div>
            <label style={lbl}>Generation Method</label>
            <select value={method} onChange={e => setMethod(e.target.value)} style={inp}>
              {Object.keys(METHODS).map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            {methodInfo && (
              <div style={{ marginTop: '8px', padding: '10px 12px', background: '#0d1117', border: `1px solid ${methodInfo.color}30`, borderLeft: `3px solid ${methodInfo.color}`, borderRadius: '6px', fontSize: '12px' }}>
                <div style={{ color: methodInfo.color, fontWeight: 600, marginBottom: '3px' }}>{methodInfo.label}</div>
                <div style={{ color: '#94a3b8', lineHeight: 1.5 }}>{methodInfo.desc}</div>
              </div>
            )}
          </div>
          <div>
            <label style={lbl}>Article Type</label>
            <select value={articleType} onChange={e => setArticleType(e.target.value)} style={inp}>
              <option value="text_review">text_review</option>
              <option value="text_mono">text_mono</option>
            </select>
            <label style={{ ...lbl, marginTop: '10px' }}>Модель генерации</label>
            <select value={model} onChange={e => setModel(e.target.value)} style={inp}>
              <option value="anthropic/claude-opus-4-6">Claude Opus 4.6 ⭐</option>
              <option value="anthropic/claude-opus-4-5">Claude Opus 4.5</option>
              <option value="anthropic/claude-sonnet-4-6">Claude Sonnet 4.6</option>
              <option value="google/gemini-2.5-flash">Gemini 2.5 Flash</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
          <div>
            <label style={lbl}>GEO</label>
            <input value={geo} onChange={e => setGeo(e.target.value)} placeholder="e.g. DE" style={inp} />
          </div>
          <div>
            <label style={lbl}>Language</label>
            <input value={lang} onChange={e => setLang(e.target.value)} placeholder="e.g. German" style={inp} />
          </div>
        </div>

        <div style={row}>
          <label style={lbl}>Dropbox Folder</label>
          {folders.length > 0 ? (
            <select value={folder} onChange={e => setFolder(e.target.value)} style={inp}>
              {folders.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          ) : (
            <input value={folder} onChange={e => setFolder(e.target.value)} placeholder="/test/" style={inp} />
          )}
        </div>

        <div style={row}>
          <label style={lbl}>Competitors (one URL per line)</label>
          <textarea value={competitors} onChange={e => setCompetitors(e.target.value)} rows={3} placeholder="https://example.com" style={{ ...inp, resize: 'vertical' }} />
        </div>

        <div style={row}>
          <label style={lbl}>Keywords (one per line)</label>
          <textarea value={keywords} onChange={e => setKeywords(e.target.value)} rows={4} style={{ ...inp, resize: 'vertical' }} />
        </div>

        <div style={row}>
          <label style={lbl}>Casinos (one per line)</label>
          <textarea value={casinos} onChange={e => setCasinos(e.target.value)} rows={3} placeholder="Casino Name" style={{ ...inp, resize: 'vertical' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
          <div>
            <label style={lbl}>Объём текста (слов) <span style={{ color: '#4b5563', fontStyle: 'italic' }}>— авто если пусто</span></label>
            <input
              type="number"
              value={wordCount}
              onChange={e => setWordCount(e.target.value)}
              placeholder="Авто"
              style={inp}
              min={100}
              step={100}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" id="htmlfmt" checked={htmlFormat} onChange={e => setHtmlFormat(e.target.checked)} />
              <label htmlFor="htmlfmt" style={{ fontSize: '13px', color: '#e6edf3', cursor: 'pointer' }}>HTML формат (для сайта)</label>
            </div>
          </div>
        </div>

        {error && <div style={{ color: '#f85149', fontSize: '13px', marginBottom: '10px' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 20px', background: 'rgba(255,255,255,0.05)', border: '1px solid #30363d', borderRadius: '8px', color: '#8b949e', cursor: 'pointer' }}>Cancel</button>
          <button onClick={submit} disabled={loading} style={{ padding: '8px 24px', background: loading ? '#333' : '#238636', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Adding...' : 'Add Task'}
          </button>
        </div>
      </div>
    </div>
  )
}
