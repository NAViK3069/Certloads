import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Link2, Loader2, Plus, RotateCcw, Trash2, Unlink, X, ZoomIn, ZoomOut } from 'lucide-react'
import {
  allFields,
  fieldLabel,
  fieldToken,
  matchLines,
  newId,
  pageValues,
  slotOf,
  stripText,
  type Binding,
  type FieldDef,
  type Mapping,
} from '../../lib/certificate'
import type { PageInfo, TextLine } from '../../lib/pdf'
import { useI18n } from '../../i18n'

interface Props {
  pages: PageInfo[]
  mapping: Mapping
  onChange: (m: Mapping) => void
  onReset: () => void
  renderPage: (index: number, width: number) => Promise<string>
  onClose: () => void
}

// สีประจำช่อง (ใช้ hue เดียวกันทั้งกรอบบนรูปและป้ายในแถบข้าง)
function hueOf(fields: FieldDef[], key: string) {
  const i = fields.findIndex((f) => f.key === key)
  return (i * 47 + 210) % 360
}

export default function MappingEditor({ pages, mapping, onChange, onReset, renderPage, onClose }: Props) {
  const [pageIdx, setPageIdx] = useState(() => Math.max(0, pages.findIndex((p) => p.lines.length > 0)))
  const [selected, setSelected] = useState<number | null>(null) // index ของบรรทัดในหน้าปัจจุบัน
  const { lang, t } = useI18n()
  const [zoom, setZoom] = useState(1)
  const [images, setImages] = useState<Record<number, string>>({})
  const [newName, setNewName] = useState('') // ชื่อช่องใหม่จากแถบข้อความที่เลือก
  const [newField, setNewField] = useState('') // ชื่อช่องใหม่จากรายการช่องด้านล่าง
  const urls = useRef<string[]>([])
  const pending = useRef(new Set<number>())

  const page = pages[pageIdx]
  const fields = allFields(mapping)
  const fieldOf = (key: string) => fields.find((f) => f.key === key)
  const tok = (f?: FieldDef) => '{' + (f ? fieldToken(f, lang) : '?') + '}'

  // รูปหน้าใหญ่ — วาดเมื่อเปิดดูหน้านั้น แล้วเก็บไว้
  useEffect(() => {
    if (images[pageIdx] || pending.current.has(pageIdx)) return
    const idx = pageIdx
    pending.current.add(idx)
    renderPage(idx, 1400).then((url) => {
      pending.current.delete(idx)
      if (!url) return
      urls.current.push(url)
      setImages((m) => ({ ...m, [idx]: url }))
    })
  }, [pageIdx, images, renderPage])

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), [])

  // Esc ปิด · ลูกศรซ้าย/ขวาเปลี่ยนหน้า (เมื่อไม่ได้พิมพ์อยู่)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  function go(d: number) {
    setPageIdx((i) => Math.min(pages.length - 1, Math.max(0, i + d)))
    setSelected(null)
  }

  const matched = useMemo(() => matchLines(page.lines, mapping.bindings), [page, mapping.bindings])
  const values = useMemo(() => pageValues(page, mapping), [page, mapping])

  // บรรทัด → binding ที่จับคู่กับบรรทัดนั้น
  const bindingsByLine = useMemo(() => {
    const m = new Map<TextLine, Binding[]>()
    for (const b of mapping.bindings) {
      const l = matched.get(b.id)
      if (l) m.set(l, [...(m.get(l) ?? []), b])
    }
    return m
  }, [matched, mapping.bindings])

  const missing = mapping.bindings.filter((b) => b.field && !matched.has(b.id))
  const selLine = selected !== null ? page.lines[selected] : null
  const selBindings = selLine ? (bindingsByLine.get(selLine) ?? []) : []

  // ---------- แก้ mapping ----------

  const setBindings = (bindings: Binding[]) => onChange({ ...mapping, bindings })

  function bindLine(line: TextLine, field: string, existing?: Binding) {
    if (existing) {
      setBindings(mapping.bindings.map((b) => (b.id === existing.id ? { ...b, field } : b)))
    } else {
      setBindings([...mapping.bindings, { id: newId(), field, slot: slotOf(line), stripStart: '', stripEnd: '' }])
    }
  }

  function updateBinding(id: string, patch: Partial<Binding>) {
    setBindings(mapping.bindings.map((b) => (b.id === id ? { ...b, ...patch } : b)))
  }

  function removeBinding(id: string) {
    setBindings(mapping.bindings.filter((b) => b.id !== id))
  }

  // หาช่องที่ชื่อซ้ำ (เทียบทั้งชื่อไทยและอังกฤษ)
  function findField(label: string) {
    const tk = label.replace(/\s+/g, '')
    return fields.find((f) => [f.label, f.labelEn].includes(label) || [f.token, f.tokenEn].includes(tk))
  }

  function addCustomField(name: string): string | null {
    const label = name.replace(/[{}]/g, '').trim()
    if (!label) return null
    const dup = findField(label)
    if (dup) return dup.key
    const f: FieldDef = { key: newId('c_'), token: label.replace(/\s+/g, ''), label, custom: true }
    onChange({ ...mapping, customFields: [...mapping.customFields, f] })
    return f.key
  }

  function createAndBind(line: TextLine, existing?: Binding) {
    const label = newName.replace(/[{}]/g, '').trim()
    if (!label) return
    const dup = findField(label)
    const f: FieldDef = dup ?? { key: newId('c_'), token: label.replace(/\s+/g, ''), label, custom: true }
    const customFields = dup ? mapping.customFields : [...mapping.customFields, f]
    const bindings = existing
      ? mapping.bindings.map((b) => (b.id === existing.id ? { ...b, field: f.key } : b))
      : [...mapping.bindings, { id: newId(), field: f.key, slot: slotOf(line), stripStart: '', stripEnd: '' }]
    onChange({ bindings, customFields })
    setNewName('')
  }

  function renameField(key: string, label: string) {
    onChange({
      ...mapping,
      // ผู้ใช้ตั้งชื่อเองแล้ว ใช้ชื่อนี้ทั้งสองภาษา
      customFields: mapping.customFields.map((f) =>
        f.key === key ? { ...f, label, token: label.replace(/[{}\s]/g, '') || f.token, labelEn: undefined, tokenEn: undefined } : f,
      ),
    })
  }

  function deleteField(key: string) {
    onChange({
      bindings: mapping.bindings.filter((b) => b.field !== key),
      customFields: mapping.customFields.filter((f) => f.key !== key),
    })
  }

  function selectField(key: string) {
    const b = mapping.bindings.find((x) => x.field === key && matched.has(x.id))
    if (!b) return
    setSelected(page.lines.indexOf(matched.get(b.id)!))
  }

  // ---------- แสดงผล ----------

  const pct = (v: number, of: number) => `${(v / of) * 100}%`

  const fieldPicker = (line: TextLine, b?: Binding) => (
    <div className="pick-grid">
      {fields.map((f) => {
        const on = b?.field === f.key
        return (
          <button
            key={f.key}
            className={`pick${on ? ' on' : ''}`}
            style={{ '--h': hueOf(fields, f.key) } as React.CSSProperties}
            onClick={() => bindLine(line, f.key, b)}
            title={fieldLabel(f, lang)}
          >
            {tok(f)}
          </button>
        )
      })}
    </div>
  )

  return (
    <div className="editor-backdrop" role="dialog" aria-modal="true" aria-label={t('ed.title')}>
      <div className="editor">
        <header className="editor-head">
          <div className="editor-title">
            <b>{t('ed.title')}</b>
            <span className="hint">{t('ed.sub')}</span>
          </div>
          <div className="pager">
            <button className="icon-btn" onClick={() => go(-1)} disabled={pageIdx === 0} title={t('ed.prev')}>
              <ChevronLeft size={18} />
            </button>
            <span>
              {t('ed.page')} <b>{pageIdx + 1}</b> / {pages.length}
            </span>
            <button className="icon-btn" onClick={() => go(1)} disabled={pageIdx === pages.length - 1} title={t('ed.next')}>
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="pager">
            <button className="icon-btn" onClick={() => setZoom((z) => Math.max(1, z - 0.5))} disabled={zoom <= 1} title={t('ed.zoomOut')}>
              <ZoomOut size={18} />
            </button>
            <span className="zoom-val">{Math.round(zoom * 100)}%</span>
            <button className="icon-btn" onClick={() => setZoom((z) => Math.min(3, z + 0.5))} disabled={zoom >= 3} title={t('ed.zoomIn')}>
              <ZoomIn size={18} />
            </button>
          </div>
          <div className="editor-actions">
            <button
              className="btn ghost"
              onClick={() => {
                if (confirm(t('ed.resetConfirm'))) {
                  onReset()
                  setSelected(null)
                }
              }}
            >
              <RotateCcw size={16} /> {t('ed.reset')}
            </button>
            <button className="btn primary" onClick={onClose}>
              {t('ed.done')}
            </button>
            <button className="icon-btn" onClick={onClose} title={t('ed.closeEsc')} aria-label={t('close')}>
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="editor-body">
          <div className="stage-wrap" onClick={() => setSelected(null)}>
            <div
              className="stage"
              style={{ aspectRatio: `${page.width} / ${page.height}`, width: `${zoom * 100}%`, maxWidth: 1100 * zoom }}
            >
              {images[pageIdx] ? (
                <img src={images[pageIdx]} alt={t('split.pageAlt', { n: pageIdx + 1 })} draggable={false} />
              ) : (
                <div className="stage-loading">
                  <Loader2 size={22} className="spin" /> {t('ed.loadingImg')}
                </div>
              )}
              {page.lines.map((l, i) => {
                const bs = bindingsByLine.get(l) ?? []
                const f = bs[0] ? fieldOf(bs[0].field) : undefined
                const h = f ? hueOf(fields, f.key) : 0
                return (
                  <button
                    key={i}
                    className={`line-box${f ? ' bound' : ''}${selected === i ? ' sel' : ''}`}
                    style={
                      {
                        left: pct(l.x - 2, page.width),
                        top: pct(l.top - 0.5, page.height),
                        width: pct(l.w + 4, page.width),
                        height: pct(l.bottom - l.top + 1, page.height),
                        '--h': h,
                      } as React.CSSProperties
                    }
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelected(i)
                    }}
                    title={l.text}
                  >
                    {bs.length > 0 && (
                      <span className="line-tag">
                        {bs
                          .filter((b) => b.field)
                          .map((b) => tok(fieldOf(b.field)))
                          .join(' ')}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <aside className="side">
            {selLine ? (
              <div className="side-section">
                <div className="side-head">
                  <span className="field-label">{t('ed.selected')}</span>
                  <button className="link" onClick={() => setSelected(null)}>
                    {t('close')}
                  </button>
                </div>
                <blockquote className="line-text">{selLine.text}</blockquote>

                {selBindings.length === 0 && (
                  <>
                    <div className="side-sub">
                      <Link2 size={14} /> {t('ed.bindTo')}
                    </div>
                    {fieldPicker(selLine)}
                    <div className="new-field">
                      <input
                        placeholder={t('ed.newPlaceholder')}
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && createAndBind(selLine)}
                      />
                      <button className="btn" onClick={() => createAndBind(selLine)} disabled={!newName.trim()}>
                        <Plus size={16} /> {t('ed.createBind')}
                      </button>
                    </div>
                  </>
                )}

                {selBindings.map((b, bi) => {
                  const value = stripText(selLine.text, b)
                  return (
                    <div key={b.id} className="binding-card" style={{ '--h': hueOf(fields, b.field) } as React.CSSProperties}>
                      <div className="side-sub">
                        <Link2 size={14} /> {selBindings.length > 1 ? t('ed.fieldN', { n: bi + 1 }) : t('ed.bindTo')}
                        <button className="link danger" onClick={() => removeBinding(b.id)} title={t('ed.unbindTitle')}>
                          <Unlink size={13} /> {t('ed.unbind')}
                        </button>
                      </div>
                      {fieldPicker(selLine, b)}
                      <div className="new-field">
                        <input
                          placeholder={t('ed.movePlaceholder')}
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && createAndBind(selLine, b)}
                        />
                        <button className="btn" onClick={() => createAndBind(selLine, b)} disabled={!newName.trim()}>
                          <Plus size={16} />
                        </button>
                      </div>

                      <div className="strip-grid">
                        <label>
                          <span>{t('ed.stripStart')}</span>
                          <input
                            value={b.stripStart}
                            placeholder={t('ed.stripStartPh')}
                            onChange={(e) => updateBinding(b.id, { stripStart: e.target.value })}
                          />
                        </label>
                        <label>
                          <span>{t('ed.stripEnd')}</span>
                          <input value={b.stripEnd} placeholder="—" onChange={(e) => updateBinding(b.id, { stripEnd: e.target.value })} />
                        </label>
                      </div>
                      <div className="result">
                        <span>{t('ed.result')}</span>
                        <b>{value || <i className="hint">{t('ed.empty')}</i>}</b>
                      </div>
                    </div>
                  )
                })}

                {selBindings.length > 0 && (
                  <button
                    className="link"
                    onClick={() =>
                      setBindings([...mapping.bindings, { id: newId(), field: '', slot: selBindings[0].slot, stripStart: '', stripEnd: '' }])
                    }
                  >
                    <Plus size={13} /> {t('ed.addAnother')}
                  </button>
                )}
              </div>
            ) : (
              <div className="side-section">
                <p className="hint">
                  {t('ed.help')}
                </p>
              </div>
            )}

            {missing.length > 0 && (
              <div className="alert warn small">
                {t('ed.missing', { list: missing.map((b) => tok(fieldOf(b.field))).join(', ') })}
              </div>
            )}

            <div className="side-section">
              <div className="side-head">
                <span className="field-label">{t('ed.fieldsTitle')}</span>
              </div>
              <ul className="field-list">
                {fields.map((f) => {
                  const bound = mapping.bindings.some((b) => b.field === f.key)
                  const derived = !bound && ['prefix', 'first', 'last'].includes(f.key) && mapping.bindings.some((b) => b.field === 'name')
                  const v = values[f.key]
                  return (
                    <li key={f.key} className={bound || derived ? '' : 'unbound'} style={{ '--h': hueOf(fields, f.key) } as React.CSSProperties}>
                      <button className="field-token" onClick={() => selectField(f.key)} disabled={!bound} title={bound ? t('ed.goTo') : ''}>
                        {tok(f)}
                      </button>
                      {f.custom ? (
                        <input
                          className="field-name"
                          value={fieldLabel(f, lang)}
                          onChange={(e) => renameField(f.key, e.target.value)}
                          aria-label={t('ed.fieldName')}
                        />
                      ) : (
                        <span className="field-name">{fieldLabel(f, lang)}</span>
                      )}
                      <span className="field-val" title={v}>
                        {bound ? v || <i>{t('ed.notFound')}</i> : derived ? v || <i>{t('ed.derived')}</i> : <i>{t('ed.unbound')}</i>}
                      </span>
                      {f.custom && (
                        <button className="mini danger" onClick={() => deleteField(f.key)} title={t('ed.delete')}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
              <form
                className="new-field"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (addCustomField(newField)) setNewField('')
                }}
              >
                <input placeholder={t('ed.createPh')} value={newField} onChange={(e) => setNewField(e.target.value)} />
                <button className="btn" disabled={!newField.trim()}>
                  <Plus size={16} /> {t('ed.create')}
                </button>
              </form>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
