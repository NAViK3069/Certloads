import { useEffect, useMemo, useState } from 'react'
import { Check, Download, Files, Loader2 } from 'lucide-react'
import { fieldLabel, fieldToken, type CertTable, type FieldDef } from '../../lib/certificate'
import { useI18n, type Lang } from '../../i18n'
import { downloadBlob, extractPages, safeFilename, splitToZip, uniqueNames } from '../../lib/files'
import type { LoadedFile } from './CertificateTool'

interface Token {
  th: string // {ชื่อ}
  en: string // {name}
  hint: string
  get: (v: Record<string, string>, page: number, order: number) => string
}

const PRESETS: Record<Lang, string[]> = {
  th: ['{ชื่อ}', '{ลำดับ}_{ชื่อ}', '{ชื่อจริง} {นามสกุล}', '{ไฟล์}_หน้า{หน้า}'],
  en: ['{name}', '{order}_{name}', '{first} {last}', '{file}_page{page}'],
}

interface Props {
  file: LoadedFile
  table: CertTable
  fields: FieldDef[]
  thumbs: string[]
}

export default function SplitPanel({ file, table, fields, thumbs }: Props) {
  const { lang, t } = useI18n()
  const total = file.pages.length
  const [selected, setSelected] = useState<boolean[]>(() => Array(total).fill(true))
  const [template, setTemplate] = useState(() => PRESETS[lang][table.fields.some((f) => f.key === 'name') ? 0 : 3])
  const [busy, setBusy] = useState<string>('')

  const chosen = selected.map((s, i) => (s ? i : -1)).filter((i) => i >= 0)
  const pad = String(total).length

  // ตัวแปรชื่อไฟล์: ทุกช่องที่มีข้อมูล (รวมช่องที่สร้างเอง) + ลำดับ/หน้า/ไฟล์ — ใช้ได้ทั้งชื่อไทยและอังกฤษ
  const tokens = useMemo<Token[]>(
    () => [
      ...fields
        .filter((f) => table.fields.some((x) => x.key === f.key))
        .map((f) => ({
          th: `{${fieldToken(f, 'th')}}`,
          en: `{${fieldToken(f, 'en')}}`,
          hint: fieldLabel(f, lang),
          get: (v: Record<string, string>) => v[f.key] ?? '',
        })),
      { th: '{ลำดับ}', en: '{order}', hint: t('tok.order'), get: (_v, _p, order) => String(order).padStart(pad, '0') },
      { th: '{หน้า}', en: '{page}', hint: t('tok.page'), get: (_v, page) => String(page) },
      { th: '{ไฟล์}', en: '{file}', hint: t('tok.file'), get: () => file.name },
    ],
    [fields, table.fields, pad, file.name, lang, t],
  )

  // เปลี่ยนภาษาแล้ว แปลงตัวแปรในชื่อไฟล์เป็นภาษาใหม่ด้วย
  useEffect(() => {
    setTemplate((tpl) => {
      let out = tpl
      for (const tk of [...tokens].sort((a, b) => b.th.length - a.th.length)) {
        const from = lang === 'en' ? tk.th : tk.en
        out = out.split(from).join(lang === 'en' ? tk.en : tk.th)
      }
      return out
    })
    // ตั้งใจให้ทำงานเฉพาะตอนเปลี่ยนภาษา
  }, [lang])

  const names = useMemo(() => {
    // แทนตัวแปรที่ยาวก่อน เพื่อไม่ให้ตัวสั้นไปกินบางส่วนของตัวยาว
    const pairs = tokens.flatMap((tk) => [
      { token: tk.th, get: tk.get },
      { token: tk.en, get: tk.get },
    ])
    pairs.sort((a, b) => b.token.length - a.token.length)
    const raw = file.pages.map((p, i) => {
      const values = table.rows[i]?.values ?? {}
      let out = template
      for (const tk of pairs) out = out.split(tk.token).join(tk.get(values, p.index + 1, i + 1))
      out = safeFilename(out)
      return out === 'file' ? file.name + t('file.pageSuffix', { n: i + 1 }) : out
    })
    return uniqueNames(raw)
  }, [file, table, template, tokens, t])

  function toggle(i: number) {
    setSelected((s) => s.map((v, j) => (j === i ? !v : v)))
  }

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label)
    try {
      await fn()
    } catch (e) {
      console.error(e)
      alert(t('split.error'))
    } finally {
      setBusy('')
    }
  }

  const downloadZip = () =>
    run('zip', async () => {
      const blob = await splitToZip(
        file.bytes,
        chosen.map((i) => ({ pageIndex: i, filename: names[i] })),
        (d, t) => setBusy(`zip ${d}/${t}`),
      )
      downloadBlob(blob, `${safeFilename(file.name)}${t('file.zipSuffix')}.zip`)
    })

  const downloadMerged = () =>
    run('merge', async () => {
      downloadBlob(await extractPages(file.bytes, chosen), `${safeFilename(file.name)}${t('file.mergeSuffix', { n: chosen.length })}.pdf`)
    })

  const downloadOne = (i: number) =>
    run(`one${i}`, async () => {
      downloadBlob(await extractPages(file.bytes, [i]), `${names[i]}.pdf`)
    })

  return (
    <div className="panel">
      <div className="card settings">
        <label className="field">
          <span className="field-label">{t('split.nameLabel')}</span>
          <div className="input-wrap">
            <input value={template} onChange={(e) => setTemplate(e.target.value)} spellCheck={false} />
            <span className="suffix">.pdf</span>
          </div>
        </label>
        <div className="chips">
          <span className="chips-label">{t('split.insert')}</span>
          {tokens.map((tk) => (
            <button key={tk.th} className="chip" title={tk.hint} onClick={() => setTemplate((s) => s + tk[lang])}>
              {tk[lang]}
            </button>
          ))}
        </div>
        <div className="chips">
          <span className="chips-label">{t('split.presets')}</span>
          {PRESETS[lang].map((p) => (
            <button key={p} className={`chip${template === p ? ' on' : ''}`} onClick={() => setTemplate(p)}>
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="toolbar">
        <div className="sel">
          <b>{t('split.selected', { n: chosen.length })}</b> {t('split.ofPages', { total })}
          <button className="link" onClick={() => setSelected(Array(total).fill(true))}>
            {t('split.selectAll')}
          </button>
          <button className="link" onClick={() => setSelected(Array(total).fill(false))}>
            {t('split.selectNone')}
          </button>
        </div>
        <div className="actions">
          <button className="btn" disabled={!chosen.length || !!busy} onClick={downloadMerged} title={t('split.mergeTitle')}>
            {busy === 'merge' ? <Loader2 size={16} className="spin" /> : <Files size={16} />}
            {busy === 'merge' ? t('split.creating') : t('split.merge')}
          </button>
          <button className="btn primary" disabled={!chosen.length || !!busy} onClick={downloadZip}>
            {busy.startsWith('zip') ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
            {busy.startsWith('zip') ? t('split.splitting', { p: busy.slice(4) }) : t('split.zip', { n: chosen.length })}
          </button>
        </div>
      </div>

      <div className="page-grid">
        {file.pages.map((p, i) => (
          <div key={p.index} className={`page-card${selected[i] ? ' on' : ''}`}>
            <button className="thumb" onClick={() => toggle(i)} aria-pressed={selected[i]} aria-label={t('split.pageAria', { n: i + 1 })}>
              {thumbs[i] ? <img src={thumbs[i]} alt={t('split.pageAlt', { n: i + 1 })} /> : <div className="thumb-ph" />}
              <span className="check" aria-hidden>
                {selected[i] && <Check size={14} strokeWidth={3} />}
              </span>
              <span className="page-no">{i + 1}</span>
            </button>
            <div className="page-info">
              <span className="page-name" title={`${names[i]}.pdf`}>
                {names[i]}.pdf
              </span>
              <button className="icon-btn" title={t('split.downloadOne')} disabled={!!busy} onClick={() => downloadOne(i)}>
                <Download size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
