import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Scissors, SlidersHorizontal, Table2 } from 'lucide-react'
import { openPdf, readPage, renderThumb, type OpenedPdf, type PageInfo } from '../../lib/pdf'
import { NAME_PARTS, allFields, autoMapping, buildTable, type Mapping, type Overrides } from '../../lib/certificate'
import Dropzone from './Dropzone'
import MappingEditor from './MappingEditor'
import SplitPanel from './SplitPanel'
import TablePanel, { COL_NO, COL_PAGE, type TableView } from './TablePanel'

export interface LoadedFile {
  name: string // ไม่รวม .pdf
  size: number
  bytes: ArrayBuffer
  pages: PageInfo[]
}

type Mode = 'split' | 'table'

export default function CertificateTool() {
  const [file, setFile] = useState<LoadedFile | null>(null)
  const [mapping, setMapping] = useState<Mapping>({ bindings: [], customFields: [] })
  const [overrides, setOverrides] = useState<Overrides>({})
  const [view, setView] = useState<TableView>({ order: [], hidden: new Set(), labels: {} })
  const [thumbs, setThumbs] = useState<string[]>([])
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<Mode>('split')
  const [editing, setEditing] = useState(false)
  const docRef = useRef<OpenedPdf | null>(null)
  const loadId = useRef(0)
  const priority = useRef(0) // จำนวนงานวาดรูปที่ต้องทำก่อนรูปย่อ (เช่น รูปใหญ่ในตัวแก้ไข)

  const thumbUrls = useRef<string[]>([])

  function clearThumbs() {
    thumbUrls.current.forEach((u) => u && URL.revokeObjectURL(u))
    thumbUrls.current = []
    setThumbs([])
  }

  useEffect(() => () => thumbUrls.current.forEach((u) => u && URL.revokeObjectURL(u)), [])

  const table = useMemo(() => (file ? buildTable(file.pages, mapping, overrides) : null), [file, mapping, overrides])
  const fields = allFields(mapping)

  async function load(f: File) {
    const id = ++loadId.current
    setError('')
    setFile(null)
    setEditing(false)
    clearThumbs()
    docRef.current?.close()
    docRef.current = null
    try {
      const bytes = await f.arrayBuffer()
      const opened = await openPdf(bytes)
      if (id !== loadId.current) return opened.close()
      docRef.current = opened
      const doc = opened.doc
      const total = doc.numPages
      setProgress({ done: 0, total })
      const pages: PageInfo[] = []
      for (let i = 0; i < total; i++) {
        if (id !== loadId.current) return
        pages.push(await readPage(doc, i))
        setProgress({ done: i + 1, total })
      }
      if (id !== loadId.current) return

      const m = autoMapping(pages)
      const t = buildTable(pages, m)
      setMapping(m)
      setOverrides({})
      // ค่าเริ่มต้นของตาราง: ซ่อนเลขหน้า ชื่อที่แยกส่วน และช่องที่เหมือนกันทุกแถว
      setView({
        order: [COL_NO, COL_PAGE, ...allFields(m).map((f) => f.key)],
        hidden: new Set([COL_PAGE, ...NAME_PARTS, ...t.constantKeys]),
        labels: {},
      })
      setFile({ name: f.name.replace(/\.pdf$/i, ''), size: f.size, bytes, pages })
      setProgress(null)

      // วาดรูปย่อทีละหน้าหลังแสดงผลแล้ว
      const urls = thumbUrls.current
      for (let i = 0; i < total; i++) {
        while (priority.current > 0) await new Promise((r) => setTimeout(r, 100))
        if (id !== loadId.current) return
        const url = await renderThumb(doc, i, 240)
        if (id !== loadId.current) {
          URL.revokeObjectURL(url)
          return
        }
        urls[i] = url
        setThumbs([...urls])
      }
    } catch (e) {
      if (id !== loadId.current) return
      console.error(e)
      setProgress(null)
      const msg = e instanceof Error ? e.message : String(e)
      setError(/password/i.test(msg) ? 'ไฟล์นี้ติดรหัสผ่าน กรุณาปลดรหัสก่อนใช้งาน' : 'เปิดไฟล์ไม่ได้ — ตรวจสอบว่าเป็นไฟล์ PDF ที่ไม่เสียหาย')
    }
  }

  function reset() {
    loadId.current++
    docRef.current?.close()
    docRef.current = null
    setFile(null)
    setEditing(false)
    clearThumbs()
    setProgress(null)
    setError('')
  }

  function editCell(page: number, key: string, value: string) {
    setOverrides((o) => ({ ...o, [page]: { ...o[page], [key]: value } }))
  }

  const renderPage = useCallback(async (i: number, width: number) => {
    if (!docRef.current) return ''
    priority.current++
    try {
      return await renderThumb(docRef.current.doc, i, width)
    } finally {
      priority.current--
    }
  }, [])

  const noText = file && file.pages.every((p) => p.lines.length === 0)
  const boundFields = fields.filter((f) => mapping.bindings.some((b) => b.field === f.key))
  const editedCount = Object.values(overrides).reduce((n, o) => n + Object.keys(o).length, 0)

  return (
    <section className="tool">
      <div className="tool-head">
        <h1>Certificate</h1>
        <p>อัปโหลดไฟล์ใบประกาศ (PDF หลายหน้า) แล้วเลือกว่าจะแยกเป็นไฟล์ละหน้า หรือดึงรายชื่อออกมาเป็นตาราง</p>
      </div>

      {!file && !progress && <Dropzone onFile={load} />}
      {error && <div className="alert error">{error}</div>}

      {progress && (
        <div className="card loading">
          <div>
            กำลังอ่านไฟล์… {progress.done}/{progress.total} หน้า
          </div>
          <div className="bar">
            <div style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
          </div>
        </div>
      )}

      {file && table && (
        <>
          <div className="card file-bar">
            <div className="file-icon" aria-hidden>
              PDF
            </div>
            <div className="file-meta">
              <strong title={file.name}>{file.name}.pdf</strong>
              <span>
                {file.pages.length} หน้า · {(file.size / 1024 / 1024).toFixed(1)} MB
              </span>
            </div>
            <button className="btn ghost" onClick={reset}>
              เปลี่ยนไฟล์
            </button>
          </div>

          {noText ? (
            <div className="alert warn">
              ไฟล์นี้ไม่มีข้อความที่อ่านได้ (อาจเป็นภาพสแกน) — ยังแยกไฟล์ได้ แต่ดึงรายชื่อเป็นตารางไม่ได้
            </div>
          ) : (
            <div className="card mapping-bar">
              <div className="mapping-info">
                <span className="mapping-title">ช่องข้อมูลที่จับได้</span>
                <div className="chips">
                  {boundFields.length === 0 && <span className="hint">ยังไม่ได้ผูกช่องใดเลย</span>}
                  {boundFields.map((f) => (
                    <span key={f.key} className="token" title={f.label}>
                      {`{${f.token}}`}
                    </span>
                  ))}
                </div>
                {editedCount > 0 && <span className="hint">แก้ไขในตารางแล้ว {editedCount} ช่อง</span>}
              </div>
              <button className="btn" onClick={() => setEditing(true)}>
                <SlidersHorizontal size={16} /> แก้ไขโดยละเอียด
              </button>
            </div>
          )}

          <div className="mode-tabs" role="tablist">
            <button role="tab" aria-selected={mode === 'split'} className={mode === 'split' ? 'active' : ''} onClick={() => setMode('split')}>
              <span className="mode-icon" aria-hidden>
                <Scissors size={22} />
              </span>
              <span>
                <b>แยกไฟล์</b>
                <small>1 หน้า = 1 ไฟล์ ตั้งชื่อตามผู้รับ</small>
              </span>
            </button>
            <button role="tab" aria-selected={mode === 'table'} className={mode === 'table' ? 'active' : ''} onClick={() => setMode('table')}>
              <span className="mode-icon" aria-hidden>
                <Table2 size={22} />
              </span>
              <span>
                <b>ดึงข้อมูลเป็นตาราง</b>
                <small>ส่งออก Excel / CSV / คัดลอก</small>
              </span>
            </button>
          </div>

          {mode === 'split' ? (
            <SplitPanel file={file} table={table} fields={fields} thumbs={thumbs} />
          ) : (
            <TablePanel
              file={file}
              table={table}
              fields={fields}
              view={view}
              onView={setView}
              onEdit={editCell}
              onResetEdits={() => setOverrides({})}
              editedCount={editedCount}
              onOpenEditor={() => setEditing(true)}
            />
          )}

          {editing && (
            <MappingEditor
              pages={file.pages}
              mapping={mapping}
              onChange={setMapping}
              onReset={() => setMapping(autoMapping(file.pages))}
              renderPage={renderPage}
              onClose={() => setEditing(false)}
            />
          )}
        </>
      )}
    </section>
  )
}
