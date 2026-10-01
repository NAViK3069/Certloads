import { useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Copy, Eye, EyeOff, FileSpreadsheet, FileText, GripVertical, RotateCcw, SlidersHorizontal } from 'lucide-react'
import type { CertTable, FieldDef } from '../../lib/certificate'
import { downloadCsv, downloadXlsx, gridToTsv, safeFilename, type Grid } from '../../lib/files'
import type { LoadedFile } from './CertificateTool'

export const COL_NO = '__no'
export const COL_PAGE = '__page'

export interface TableView {
  order: string[] // ลำดับคอลัมน์ (key)
  hidden: Set<string>
  labels: Record<string, string> // หัวคอลัมน์ที่ผู้ใช้เปลี่ยนเอง
}

interface Col {
  key: string
  label: string
  kind: 'no' | 'page' | 'field'
}

interface Props {
  file: LoadedFile
  table: CertTable
  fields: FieldDef[]
  view: TableView
  onView: (v: TableView) => void
  onEdit: (page: number, key: string, value: string) => void
  onResetEdits: () => void
  editedCount: number
  onOpenEditor: () => void
}

export default function TablePanel({ file, table, fields, view, onView, onEdit, onResetEdits, editedCount, onOpenEditor }: Props) {
  const [copied, setCopied] = useState(false)
  const [drag, setDrag] = useState<string | null>(null)
  const [dropAt, setDropAt] = useState<string | null>(null)

  // คอลัมน์ทั้งหมดที่มีข้อมูล เรียงตาม view.order (ช่องใหม่ที่ยังไม่อยู่ใน order ต่อท้าย)
  const available: Col[] = [
    { key: COL_NO, label: 'ลำดับ', kind: 'no' },
    { key: COL_PAGE, label: 'หน้า', kind: 'page' },
    ...table.fields.map((f) => ({ key: f.key, label: f.label, kind: 'field' as const })),
  ]
  const rank = (k: string) => {
    const i = view.order.indexOf(k)
    return i < 0 ? 1e6 + fields.findIndex((f) => f.key === k) : i
  }
  const allCols = [...available].sort((a, b) => rank(a.key) - rank(b.key))
  const cols = allCols.filter((c) => !view.hidden.has(c.key))
  const label = (c: Col) => view.labels[c.key] || c.label
  const constants = table.fields.filter((f) => table.constantKeys.has(f.key))

  function setOrder(keys: string[]) {
    // เก็บลำดับของคอลัมน์ที่ตอนนี้ไม่มีข้อมูลไว้ด้วย เผื่อกลับมามีอีก
    const rest = view.order.filter((k) => !keys.includes(k))
    onView({ ...view, order: [...keys, ...rest] })
  }

  // สลับกับคอลัมน์ที่มองเห็นตัวถัดไป (ข้ามคอลัมน์ที่ซ่อนอยู่)
  function move(key: string, dir: -1 | 1) {
    const keys = allCols.map((c) => c.key)
    const vis = cols.map((c) => c.key)
    const target = vis[vis.indexOf(key) + dir]
    if (!target) return
    const a = keys.indexOf(key)
    const b = keys.indexOf(target)
    ;[keys[a], keys[b]] = [keys[b], keys[a]]
    setOrder(keys)
  }

  function dropOn(target: string) {
    if (!drag || drag === target) return
    const keys = allCols.map((c) => c.key)
    const from = keys.indexOf(drag)
    const to = keys.indexOf(target)
    keys.splice(from, 1)
    keys.splice(to, 0, drag)
    setOrder(keys)
  }

  function toggle(key: string) {
    const hidden = new Set(view.hidden)
    if (hidden.has(key)) hidden.delete(key)
    else hidden.add(key)
    onView({ ...view, hidden })
  }

  const dragProps = (key: string) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      setDrag(key)
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', key)
    },
    onDragOver: (e: React.DragEvent) => {
      if (!drag) return
      e.preventDefault()
      setDropAt(key)
    },
    onDragLeave: () => setDropAt((d) => (d === key ? null : d)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      dropOn(key)
      setDrag(null)
      setDropAt(null)
    },
    onDragEnd: () => {
      setDrag(null)
      setDropAt(null)
    },
  })

  const dropClass = (key: string) => (dropAt === key && drag && drag !== key ? ' drop' : '')

  const cellValue = (c: Col, r: CertTable['rows'][number], i: number) =>
    c.kind === 'no' ? String(i + 1) : c.kind === 'page' ? String(r.page) : (r.values[c.key] ?? '')

  function grid(): Grid {
    return [cols.map(label), ...table.rows.map((r, i) => cols.map((c) => cellValue(c, r, i)))]
  }

  async function copy() {
    await navigator.clipboard.writeText(gridToTsv(grid()))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const base = safeFilename(file.name)

  if (!table.fields.length) {
    return (
      <div className="alert warn">
        ยังไม่มีช่องข้อมูล —{' '}
        <button className="link" onClick={onOpenEditor}>
          เปิดตัวแก้ไขโดยละเอียด
        </button>{' '}
        เพื่อผูกข้อความบนใบกับช่องข้อมูล
      </div>
    )
  }

  return (
    <div className="panel">
      {constants.length > 0 && (
        <div className="card summary">
          <div className="summary-title">ข้อมูลที่เหมือนกันทุกใบ</div>
          <dl>
            {constants.map((f) => (
              <div key={f.key}>
                <dt>{view.labels[f.key] || f.label}</dt>
                <dd>{table.rows[0].values[f.key]}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className="card settings">
        <div className="settings-head">
          <span className="field-label">คอลัมน์</span>
          <span className="hint">ลากเพื่อสลับตำแหน่ง · กดรูปตาเพื่อซ่อน/แสดง</span>
        </div>
        <div className="col-list">
          {allCols.map((c) => {
            const hidden = view.hidden.has(c.key)
            return (
              <div
                key={c.key}
                className={`col-chip${hidden ? ' off' : ''}${drag === c.key ? ' dragging' : ''}${dropClass(c.key)}`}
                {...dragProps(c.key)}
              >
                <GripVertical size={14} className="grip" aria-hidden />
                <span>{label(c)}</span>
                <button className="mini" onClick={() => toggle(c.key)} title={hidden ? 'แสดงคอลัมน์' : 'ซ่อนคอลัมน์'}>
                  {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            )
          })}
        </div>
        <p className="hint">
          คลิกช่องในตารางเพื่อแก้ข้อความ · คลิกหัวคอลัมน์เพื่อเปลี่ยนชื่อหัว · ข้อมูลผิดช่องหรือสลับกัน?{' '}
          <button className="link" onClick={onOpenEditor}>
            <SlidersHorizontal size={13} /> แก้ไขการจับข้อมูลโดยละเอียด
          </button>
        </p>
      </div>

      <div className="toolbar">
        <div className="sel">
          <b>{table.rows.length}</b> แถว · <b>{cols.length}</b> คอลัมน์
          {editedCount > 0 && (
            <button className="link" onClick={onResetEdits} title="ยกเลิกการแก้ไขในตารางทั้งหมด">
              <RotateCcw size={13} /> ล้างที่แก้เอง ({editedCount})
            </button>
          )}
        </div>
        <div className="actions">
          <button className="btn" onClick={copy}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'คัดลอกแล้ว' : 'คัดลอก (วางใน Excel/Sheets)'}
          </button>
          <button className="btn" onClick={() => downloadCsv(grid(), base)}>
            <FileText size={16} /> CSV
          </button>
          <button className="btn primary" onClick={() => downloadXlsx(grid(), base)}>
            <FileSpreadsheet size={16} /> Excel (.xlsx)
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              {cols.map((c, ci) => (
                <th key={c.key} className={`${c.kind !== 'field' ? 'num' : ''}${dropClass(c.key)}`} {...dragProps(c.key)}>
                  <div className="th-inner">
                    <button className="mini" disabled={ci === 0} onClick={() => move(c.key, -1)} title="ย้ายไปทางซ้าย">
                      <ChevronLeft size={14} />
                    </button>
                    <input
                      className="head-input"
                      value={label(c)}
                      onChange={(e) => onView({ ...view, labels: { ...view.labels, [c.key]: e.target.value } })}
                      aria-label="ชื่อหัวคอลัมน์"
                      size={Math.max(4, label(c).length)}
                    />
                    <button className="mini" disabled={ci === cols.length - 1} onClick={() => move(c.key, 1)} title="ย้ายไปทางขวา">
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r, i) => (
              <tr key={r.page}>
                {cols.map((c) =>
                  c.kind === 'field' ? (
                    <td key={c.key}>
                      <input
                        className="cell-input"
                        value={r.values[c.key] ?? ''}
                        onChange={(e) => onEdit(r.page, c.key, e.target.value)}
                        size={Math.max(4, (r.values[c.key] ?? '').length)}
                      />
                    </td>
                  ) : (
                    <td key={c.key} className="num">
                      {cellValue(c, r, i)}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
