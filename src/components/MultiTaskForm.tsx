import React, { useState, useEffect } from 'react'
import { addBulkTasks, addBatchTasks, getDropboxFolders } from '../api'

interface Page {
  keywords: string
  article_type: string
}

const inp: React.CSSProperties = {
  width: '100%', padding: '8px 12px', background: '#161b22',
  border: '1px solid #30363d', borderRadius: '6px', color: '#e6edf3', fontSize: '13px',
}
const lbl: React.CSSProperties = {
  fontSize: '12px', color: '#8b949e', marginBottom: '4px', display: 'block',
}

interface Props {
  onClose: () => void
  onAdded: () => void
  initialValues?: Record<string, unknown>
}

export default function MultiTaskForm({ onClose, onAdded, initialValues }: Props) {
  const [pages, setPages] = useState<Page[]>([{ keywords: '', article_type: 'text_review' }])
  const [method, setMethod] = useState('V4')
  const [model, setModel] = useState('anthropic/claude-opus-4-6')
  const [geo, setGeo] = useState('')
  const [lang, setLang] = useState('')
  const [folder, setFolder] = useState('/test/')
  const [competitors, setCompetitors] = useState('')
  const [casinos, setCasinos] = useState('')
  const [sitesCount, setSitesCount] = useState(1)
  const [wordCount, setWordCount] = useState('')
  const [htmlFormat, setHtmlFormat] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (initialValues) {
      if (initialValues.generation_method) setMethod(String(initialValues.generation_method))
      if (initialValues.model) setModel(String(initialValues.model))
      if (initialValues.geo) setGeo(String(initialValues.geo))
      if (initialValues.language) setLang(String(initialValues.language))
      if (initialValues.dropbox_folder) setFolder(String(initialValues.dropbox_folder))
      if (initialValues.word_count) setWordCount(String(initialValues.word_count))
      if (initialValues.output_format === 'html') setHtmlFormat(true)
      if (initialValues.sites_count) setSitesCount(Number(initialValues.sites_count))
      if (Array.isArray(initialValues.competitors)) setCompetitors((initialValues.competitors as string[]).join('\n'))
      if (Array.isArray(initialValues.casinos)) setCasinos((initialValues.casinos as string[]).join('\n'))
      // Страницы из pages массива
      if (Array.isArray(initialValues.pages)) {
        const restored = (initialValues.pages as Record<string, unknown>[]).map(p => ({
          keywords: Array.isArray(p.keywords) ? (p.keywords as string[]).join('\n') : String(p.keywords || ''),
          article_type: String(p.article_type || 'text_review'),
        }))
        if (restored.length > 0) setPages(restored)
      }
    }
  }, [])

  function updatePage(idx: number, field: keyof Page, val: string) {
    setPages(prev => prev.map((p, i) => i === idx ? { ...p, [field]: val } : p))
  }

  function addPage() {
    setPages(prev => [...prev, { keywords: '', article_type: 'text_review' }])
  }

  function removePage(idx: number) {
    setPages(prev => prev.filter((_, i) => i !== idx))
  }

  const totalTasks = pages.filter(p => p.keywords.trim()).length

  async function submit() {
    const validPages = pages
      .map(p => ({
        keywords: p.keywords.split('\n').map(k => k.trim()).filter(Boolean),
        article_type: p.article_type,
      }))
      .filter(p => p.keywords.length > 0)

    if (!validPages.length) { setError('Добавь хотя бы один keyword'); return }

    setLoading(true); setError('')
    try {
      const payload = {
        geo: geo || 'US',
        language: lang || 'EN',
        generation_method: method,
        model,
        competitors: competitors.split('\n').map(s => s.trim()).filter(Boolean),
        casinos: casinos.split('\n').map(s => s.trim()).filter(Boolean),
        dropbox_folder: folder,
        article_type: 'text_review',
        ...(wordCount && Number(wordCount) > 0 ? { word_count: Number(wordCount) } : {}),
        ...(htmlFormat ? { output_format: 'html' } : {}),
        pages: validPages,
      }
      if (sitesCount > 1) {
        await addBatchTasks({ ...payload, sites_count: sitesCount })
      } else {
        await addBulkTasks(payload)
      }
      onAdded(); onClose()
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '12px', padding: '28px', width: '620px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700 }}>🗂️ Мульти-задача — многостраничный сайт</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8b949e', fontSize: '20px', cursor: 'pointer' }}>×</button>
        </div>

        {/* Блоки страниц */}
        {pages.map((page, idx) => (
          <div key={idx} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '14px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#818cf8' }}>📄 Страница {idx + 1}</span>
              {idx > 0 && (
                <button onClick={() => removePage(idx)} style={{ background: 'none', border: 'none', color: '#f85149', cursor: 'pointer', fontSize: '12px' }}>✕ удалить</button>
              )}
            </div>
            <label style={lbl}>Ключи страницы (все пойдут в 1 задачу)</label>
            <textarea
              value={page.keywords}
              onChange={e => updatePage(idx, 'keywords', e.target.value)}
              rows={3}
              placeholder={`best bitcoin casino canada\nno deposit casino ${idx === 0 ? 'bonus' : 'review'}\ncrypto casino ${idx === 0 ? 'review' : 'bonus'}`}
              style={{ ...inp, fontFamily: 'monospace', resize: 'vertical', marginBottom: '8px' }}
            />
            <label style={lbl}>Тип страницы</label>
            <select value={page.article_type} onChange={e => updatePage(idx, 'article_type', e.target.value)} style={inp}>
              <option value="text_review">text_review</option>
              <option value="text_mono">text_mono</option>
            </select>
          </div>
        ))}

        <button onClick={addPage} style={{ width: '100%', padding: '8px', background: 'rgba(99,102,241,0.1)', border: '1px dashed rgba(99,102,241,0.4)', borderRadius: '8px', color: '#818cf8', cursor: 'pointer', fontSize: '13px', marginBottom: '16px' }}>
          + Добавить страницу
        </button>

        {/* Общие настройки */}
        <div style={{ borderTop: '1px solid #30363d', paddingTop: '14px', marginBottom: '12px' }}>
          <span style={{ fontSize: '12px', color: '#8b949e', fontWeight: 600 }}>Общие настройки для всех страниц</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div>
            <label style={lbl}>GEO</label>
            <input value={geo} onChange={e => setGeo(e.target.value)} placeholder="CA" style={inp} />
          </div>
          <div>
            <label style={lbl}>Язык</label>
            <input value={lang} onChange={e => setLang(e.target.value)} placeholder="English" style={inp} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div>
            <label style={lbl}>Кол-во сайтов <span style={{ color: '#4b5563', fontStyle: 'italic' }}>— пачки идут последовательно</span></label>
            <input type="number" value={sitesCount} onChange={e => setSitesCount(Math.max(1, Number(e.target.value)))} style={inp} min={1} max={50} />
          </div>
          <div>
            <label style={lbl}>Метод генерации</label>
            <select value={method} onChange={e => setMethod(e.target.value)} style={inp}>
              <option value="V1">V1</option>
              <option value="V2">V2</option>
              <option value="V3">V3</option>
              <option value="V4">V4 ⭐</option>
              <option value="V5">V5</option>
            </select>
          </div>
          <div>
            <label style={lbl}>Модель</label>
            <select value={model} onChange={e => setModel(e.target.value)} style={inp}>
              <option value="anthropic/claude-opus-4-6">Claude Opus 4.6 ⭐</option>
              <option value="anthropic/claude-opus-4-5">Claude Opus 4.5</option>
              <option value="anthropic/claude-sonnet-4-6">Claude Sonnet 4.6</option>
              <option value="google/gemini-2.5-flash">Gemini 2.5 Flash</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
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
          <div>
            <label style={lbl}>Dropbox папка</label>
            <input value={folder} onChange={e => setFolder(e.target.value)} placeholder="/mysite-ca/" style={inp} />
          </div>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={lbl}>Казино (общие для всех страниц)</label>
          <textarea value={casinos} onChange={e => setCasinos(e.target.value)} rows={3} placeholder="Casino Name" style={{ ...inp, resize: 'vertical' }} />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={lbl}>Конкуренты (общие для всех страниц)</label>
          <textarea value={competitors} onChange={e => setCompetitors(e.target.value)} rows={2} placeholder="https://example.com" style={{ ...inp, resize: 'vertical' }} />
        </div>

        <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input type="checkbox" id="htmlfmt_multi" checked={htmlFormat} onChange={e => setHtmlFormat(e.target.checked)} />
          <label htmlFor="htmlfmt_multi" style={{ fontSize: '13px', color: '#e6edf3', cursor: 'pointer' }}>HTML формат (для сайта)</label>
        </div>

        {error && <div style={{ color: '#f85149', fontSize: '13px', marginBottom: '10px' }}>{error}</div>}

        {totalTasks > 0 && (
          <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '8px', padding: '10px', marginBottom: '12px', fontSize: '12px', color: '#818cf8' }}>
            📋 {sitesCount > 1
              ? `${sitesCount} сайтов × ${totalTasks} страниц = ${sitesCount * totalTasks} задач — пачками по ${totalTasks}`
              : `Будет создано ${totalTasks} задач (по одной на каждую страницу)`}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 20px', background: 'rgba(255,255,255,0.05)', border: '1px solid #30363d', borderRadius: '8px', color: '#8b949e', cursor: 'pointer' }}>Отмена</button>
          <button onClick={submit} disabled={loading} style={{ padding: '8px 24px', background: loading ? '#333' : 'rgba(99,102,241,0.8)', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Создаём...' : '🚀 Создать задачи'}
          </button>
        </div>
      </div>
    </div>
  )
}
