import { useMemo, useState } from 'react'
import { Check, Download, Files, Loader2 } from 'lucide-react'
import type { CertTable, FieldDef } from '../../lib/certificate'
import { downloadBlob, extractPages, safeFilename, splitToZip, uniqueNames } from '../../lib/files'
import type { LoadedFile } from './CertificateTool'

interface Token {
  token: string
  hint: string
  get: (v: Record<string, string>, page: number, order: number) => string
}

const PRESETS = ['{ชื่อ}', '{ลำดับ}_{ชื่อ}', '{ชื่อจริง} {นามสกุล}', '{ไฟล์}_หน้า{หน้า}']

interface Props {
  file: LoadedFile
  table: CertTable
  fields: FieldDef[]
  thumbs: string[]
}

export default function SplitPanel({ file, table, fields, thumbs }: Props) {
  const total = file.pages.length
  const [selected, setSelected] = useState<boolean[]>(() => Array(total).fill(true))
  const [template, setTemplate] = useState(() => (table.fields.some((f) => f.key === 'name') ? '{ชื่อ}' : '{ไฟล์}_หน้า{หน้า}'))
  const [busy, setBusy] = useState<string>('')

  const chosen = selected.map((s, i) => (s ? i : -1)).filter((i) => i >= 0)
  const pad = String(total).length

  // ตัวแปรชื่อไฟล์: ทุกช่องที่มีข้อมูล (รวมช่องที่สร้างเอง) + ลำดับ/หน้า/ไฟล์
  const tokens = useMemo<Token[]>(
    () => [
      ...fields
        .filter((f) => table.fields.some((t) => t.key === f.key))
        .map((f) => ({ token: `{${f.token}}`, hint: f.label, get: (v: Record<string, string>) => v[f.key] ?? '' })),
      { token: '{ลำดับ}', hint: 'ลำดับ 01, 02, …', get: (_v, _p, order) => String(order).padStart(pad, '0') },
      { token: '{หน้า}', hint: 'เลขหน้าในไฟล์เดิม', get: (_v, page) => String(page) },
      { token: '{ไฟล์}', hint: 'ชื่อไฟล์ต้นฉบับ', get: () => file.name },
    ],
    [fields, table.fields, pad, file.name],
  )

  const names = useMemo(() => {
    // แทนตัวแปรที่ยาวก่อน เพื่อไม่ให้ {ชื่อ} ไปกิน {ชื่อจริง}
    const sorted = [...tokens].sort((a, b) => b.token.length - a.token.length)
    const raw = file.pages.map((p, i) => {
      const values = table.rows[i]?.values ?? {}
      let out = template
      for (const t of sorted) out = out.split(t.token).join(t.get(values, p.index + 1, i + 1))
      out = safeFilename(out)
      return out === 'file' ? `${file.name}_หน้า${i + 1}` : out
    })
    return uniqueNames(raw)
  }, [file, table, template, tokens])

  function toggle(i: number) {
    setSelected((s) => s.map((v, j) => (j === i ? !v : v)))
  }

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label)
    try {
      await fn()
    } catch (e) {
      console.error(e)
      alert('เกิดข้อผิดพลาดระหว่างสร้างไฟล์')
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
      downloadBlob(blob, `${safeFilename(file.name)}_แยกไฟล์.zip`)
    })

  const downloadMerged = () =>
    run('merge', async () => {
      downloadBlob(await extractPages(file.bytes, chosen), `${safeFilename(file.name)}_เลือก${chosen.length}หน้า.pdf`)
    })

  const downloadOne = (i: number) =>
    run(`one${i}`, async () => {
      downloadBlob(await extractPages(file.bytes, [i]), `${names[i]}.pdf`)
    })

  return (
    <div className="panel">
      <div className="card settings">
        <label className="field">
          <span className="field-label">ตั้งชื่อไฟล์</span>
          <div className="input-wrap">
            <input value={template} onChange={(e) => setTemplate(e.target.value)} spellCheck={false} />
            <span className="suffix">.pdf</span>
          </div>
        </label>
        <div className="chips">
          <span className="chips-label">แทรก:</span>
          {tokens.map((t) => (
            <button key={t.token} className="chip" title={t.hint} onClick={() => setTemplate((s) => s + t.token)}>
              {t.token}
            </button>
          ))}
        </div>
        <div className="chips">
          <span className="chips-label">แบบสำเร็จ:</span>
          {PRESETS.map((p) => (
            <button key={p} className={`chip${template === p ? ' on' : ''}`} onClick={() => setTemplate(p)}>
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="toolbar">
        <div className="sel">
          <b>เลือกแล้ว {chosen.length}</b> / {total} หน้า
          <button className="link" onClick={() => setSelected(Array(total).fill(true))}>
            เลือกทั้งหมด
          </button>
          <button className="link" onClick={() => setSelected(Array(total).fill(false))}>
            ไม่เลือกเลย
          </button>
        </div>
        <div className="actions">
          <button className="btn" disabled={!chosen.length || !!busy} onClick={downloadMerged} title="รวมหน้าที่เลือกเป็น PDF ไฟล์เดียว">
            {busy === 'merge' ? <Loader2 size={16} className="spin" /> : <Files size={16} />}
            {busy === 'merge' ? 'กำลังสร้าง…' : 'รวมหน้าที่เลือกเป็นไฟล์เดียว'}
          </button>
          <button className="btn primary" disabled={!chosen.length || !!busy} onClick={downloadZip}>
            {busy.startsWith('zip') ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
            {busy.startsWith('zip') ? `กำลังแยก… ${busy.slice(4)}` : `ดาวน์โหลด ZIP (${chosen.length} ไฟล์)`}
          </button>
        </div>
      </div>

      <div className="page-grid">
        {file.pages.map((p, i) => (
          <div key={p.index} className={`page-card${selected[i] ? ' on' : ''}`}>
            <button className="thumb" onClick={() => toggle(i)} aria-pressed={selected[i]} aria-label={`เลือกหน้า ${i + 1}`}>
              {thumbs[i] ? <img src={thumbs[i]} alt={`หน้า ${i + 1}`} /> : <div className="thumb-ph" />}
              <span className="check" aria-hidden>
                {selected[i] && <Check size={14} strokeWidth={3} />}
              </span>
              <span className="page-no">{i + 1}</span>
            </button>
            <div className="page-info">
              <span className="page-name" title={`${names[i]}.pdf`}>
                {names[i]}.pdf
              </span>
              <button className="icon-btn" title="ดาวน์โหลดหน้านี้" disabled={!!busy} onClick={() => downloadOne(i)}>
                <Download size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
