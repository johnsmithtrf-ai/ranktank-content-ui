import { useState, useEffect } from 'react'
import { addTask } from './api'

interface InitialValues {
  geo?: string
  language?: string
  count?: number
  generation_method?: string
  article_type?: string
  competitors?: string[]
  keywords?: string[]
  casinos?: string[]
  dropbox_folder?: string
  output_format?: string
  bot?: string
}

interface Props {
  onClose: () => void
  onAdded?: () => void
  initialValues?: InitialValues
}

export default function TaskForm({ onClose, onAdded, initialValues }: Props) {
  const [bot, setBot] = useState('auto')
  const [count, setCount] = useState(1)
  const [generationMethod, setGenerationMethod] = useState('V1')
  const [articleType, setArticleType] = useState('text_review')
  const [geo, setGeo] = useState('')
  const [language, setLanguage] = useState('')
  const [competitors, setCompetitors] = useState('')
  const [keywords, setKeywords] = useState('')
  const [casinos, setCasinos] = useState('')
  const [dropboxFolder, setDropboxFolder] = useState('')
  const [folderCustom, setFolderCustom] = useState(false)
  const [htmlFormat, setHtmlFormat] = useState(false)

  const DROPBOX_FOLDERS = ['/sofiya/', '/roman/', '/jeka/', '/test/']
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (initialValues) {
      setGeo(initialValues.geo || '')
      setLanguage(initialValues.language || '')
      setCount(initialValues.count || 1)
      setGenerationMethod(initialValues.generation_method || 'V1')
      setArticleType(initialValues.article_type || 'text_review')
      setCompetitors((initialValues.competitors || []).join('\n'))
      setKeywords((initialValues.keywords || []).join('\n'))
      setCasinos((initialValues.casinos || []).join('\n'))
      const folder = initialValues.dropbox_folder || ''
      if (folder && !['/sofiya/', '/roman/', '/jeka/', '/test/'].includes(folder)) {
        setFolderCustom(true)
        setDropboxFolder(folder)
      } else {
        setDropboxFolder(folder)
      }
      setHtmlFormat(initialValues.output_format === 'html')
      if (initialValues.bot) setBot(initialValues.bot)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const data: Record<string, unknown> = {
        count,
        generation_method: generationMethod,
        article_type: articleType,
        geo,
        language,
        competitors: competitors.split('\n').map(s => s.trim()).filter(Boolean),
        keywords: keywords.split('\n').map(s => s.trim()).filter(Boolean),
        casinos: casinos.split('\n').map(s => s.trim()).filter(Boolean),
        dropbox_folder: dropboxFolder,
        output_format: htmlFormat ? 'html' : 'text',
      }
      if (bot !== 'auto') {
        data.bot = bot
      }
      await addTask(data)
      onAdded?.()
      onClose()
    } catch {
      setError('Failed to add task')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
    padding: '8px 12px',
    background: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: '6px',
    color: '#e6edf3',
    fontSize: '13px',
    outline: 'none',
    fontFamily: 'Inter, sans-serif'
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    color: '#7d8590',
    marginBottom: '4px',
    fontWeight: 500
  }

  const fieldStyle: React.CSSProperties = {
    marginBottom: '14px'
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      zIndex: 1000,
      overflowY: 'auto',
      padding: '16px',
      WebkitOverflowScrolling: 'touch' as unknown as undefined,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#161b22',
        border: '1px solid #30363d',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '480px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        margin: 'auto',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid #21262d',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600 }}>{initialValues ? '🔁 Повторить задачу' : 'Add Task'}</h2>
          <button onClick={onClose} style={{
            background: 'none',
            border: 'none',
            color: '#7d8590',
            cursor: 'pointer',
            fontSize: '18px',
            lineHeight: 1
          }}>✕</button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 24px', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div>
              <label style={labelStyle}>Bot</label>
              <select value={bot} onChange={e => setBot(e.target.value)} style={inputStyle}>
                <option value="auto">Авто</option>
                <option value="bot1">Бот 1</option>
                <option value="bot2">Бот 2</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Count</label>
              <input
                type="number"
                min={1}
                value={count}
                onChange={e => setCount(parseInt(e.target.value) || 1)}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div>
              <label style={labelStyle}>Generation Method</label>
              <select value={generationMethod} onChange={e => setGenerationMethod(e.target.value)} style={inputStyle}>
                <option value="V1">V1</option>
                <option value="V2">V2</option>
                <option value="V3">V3</option>
                <option value="V4">V4</option>
              </select>
              {(() => {
                const VERSION_HINTS: Record<string, {label: string, desc: string, color: string}> = {
                  V1: { label: 'V1 — Базовый', desc: 'Быстрая генерация. Подходит для простых review с небольшим объёмом.', color: '#64748b' },
                  V2: { label: 'V2 — Улучшенный', desc: 'Расширенная структура H2/H3, больше деталей о брендах. Хороший баланс скорость/качество.', color: '#3b82f6' },
                  V3: { label: 'V3 — Максимальный', desc: 'SERP-анализ конкурентов + уникализация. Лучшее качество, дольше генерируется.', color: '#8b5cf6' },
                  V4: { label: 'V4 — Pro + Проверка', desc: 'V3 + Originality.ai: если < 80% оригинальности — авторегенерация. Для важных материалов.', color: '#22c55e' },
                };
                const hint = VERSION_HINTS[generationMethod];
                if (!hint) return null;
                return (
                  <div style={{
                    marginTop: '8px',
                    padding: '10px 12px',
                    background: '#0d1117',
                    border: `1px solid ${hint.color}30`,
                    borderLeft: `3px solid ${hint.color}`,
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}>
                    <div style={{color: hint.color, fontWeight: 600, marginBottom: '3px'}}>
                      {hint.label}
                    </div>
                    <div style={{color: '#94a3b8', lineHeight: '1.5'}}>
                      {hint.desc}
                    </div>
                  </div>
                );
              })()}
            </div>
            <div>
              <label style={labelStyle}>Article Type</label>
              <select value={articleType} onChange={e => setArticleType(e.target.value)} style={inputStyle}>
                <option value="text_review">text_review</option>
                <option value="text_mono">text_mono</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div>
              <label style={labelStyle}>GEO</label>
              <input type="text" value={geo} onChange={e => setGeo(e.target.value)} style={inputStyle} placeholder="e.g. DE" />
            </div>
            <div>
              <label style={labelStyle}>Language</label>
              <input type="text" value={language} onChange={e => setLanguage(e.target.value)} style={inputStyle} placeholder="e.g. German" />
            </div>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Dropbox Folder</label>
            <select
              value={folderCustom ? 'custom' : dropboxFolder}
              onChange={e => {
                if (e.target.value === 'custom') { setFolderCustom(true); setDropboxFolder(''); }
                else { setFolderCustom(false); setDropboxFolder(e.target.value); }
              }}
              style={{width:'100%',maxWidth:'100%',boxSizing:'border-box',padding:'10px 12px',background:'#0d1117',border:'1px solid #30363d',borderRadius:'8px',color:'#e6edf3',fontSize:'14px',marginBottom:'8px'}}
            >
              {DROPBOX_FOLDERS.map(f => <option key={f} value={f}>{f}</option>)}
              <option value="custom">Другая папка...</option>
            </select>
            {folderCustom && (
              <input
                value={dropboxFolder}
                onChange={e => setDropboxFolder(e.target.value)}
                placeholder="/custom-folder/"
                style={{width:'100%',maxWidth:'100%',boxSizing:'border-box',padding:'10px 12px',background:'#0d1117',border:'1px solid #30363d',borderRadius:'8px',color:'#e6edf3',fontSize:'14px'}}
              />
            )}
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Competitors (one URL per line)</label>
            <textarea
              value={competitors}
              onChange={e => setCompetitors(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
              placeholder="https://example.com"
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Keywords (one per line)</label>
            <textarea
              value={keywords}
              onChange={e => setKeywords(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
              placeholder="keyword 1&#10;keyword 2"
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Casinos (one per line)</label>
            <textarea
              value={casinos}
              onChange={e => setCasinos(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
              placeholder="Casino Name"
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#e6edf3' }}>
              <input
                type="checkbox"
                checked={htmlFormat}
                onChange={e => setHtmlFormat(e.target.checked)}
                style={{ accentColor: '#22c55e', width: '14px', height: '14px' }}
              />
              HTML формат (для сайта)
            </label>
          </div>

          {error && (
            <div style={{
              background: 'rgba(248,81,73,0.1)',
              border: '1px solid rgba(248,81,73,0.3)',
              borderRadius: '6px',
              padding: '8px 12px',
              color: '#f85149',
              fontSize: '13px',
              marginBottom: '16px'
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '10px',
                background: 'transparent',
                border: '1px solid #30363d',
                borderRadius: '8px',
                color: '#7d8590',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1,
                padding: '10px',
                background: loading ? '#1a4731' : '#22c55e',
                color: loading ? '#7d8590' : '#0d1117',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Adding...' : 'Add Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
