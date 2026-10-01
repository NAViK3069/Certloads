import type { PageInfo, TextLine } from './pdf'
import { splitName } from './thai'

// ---------- ช่องข้อมูล ----------

export interface FieldDef {
  key: string
  token: string // ใช้ในชื่อไฟล์ เช่น {ชื่อ}
  label: string // หัวคอลัมน์
  tokenEn?: string // ชื่อภาษาอังกฤษ (ช่องที่ผู้ใช้สร้างเองไม่มี จะใช้ชื่อเดิม)
  labelEn?: string
  custom?: boolean
}

export const BASE_FIELDS: FieldDef[] = [
  { key: 'name', token: 'ชื่อ', label: 'ชื่อ-นามสกุล', tokenEn: 'name', labelEn: 'Full name' },
  { key: 'prefix', token: 'คำนำหน้า', label: 'คำนำหน้า', tokenEn: 'title', labelEn: 'Title' },
  { key: 'first', token: 'ชื่อจริง', label: 'ชื่อ', tokenEn: 'first', labelEn: 'First name' },
  { key: 'last', token: 'นามสกุล', label: 'นามสกุล', tokenEn: 'last', labelEn: 'Last name' },
  { key: 'certNo', token: 'เลขที่', label: 'เลขที่', tokenEn: 'no', labelEn: 'Certificate No.' },
  { key: 'code', token: 'รหัส', label: 'รหัส', tokenEn: 'id', labelEn: 'ID' },
  { key: 'course', token: 'หลักสูตร', label: 'หลักสูตร', tokenEn: 'course', labelEn: 'Course' },
  { key: 'date', token: 'วันที่', label: 'วันที่', tokenEn: 'date', labelEn: 'Date' },
  { key: 'org', token: 'หน่วยงาน', label: 'หน่วยงาน', tokenEn: 'org', labelEn: 'Organization' },
]

export const fieldLabel = (f: FieldDef, lang: 'th' | 'en') => (lang === 'en' && f.labelEn) || f.label
export const fieldToken = (f: FieldDef, lang: 'th' | 'en') => (lang === 'en' && f.tokenEn) || f.token

// ช่องที่แยกจากชื่อเต็มได้อัตโนมัติ ถ้าไม่ได้ผูกไว้เอง
export const NAME_PARTS = ['prefix', 'first', 'last'] as const

// ---------- การผูกบรรทัด → ช่อง ----------

// ตำแหน่งอ้างอิงของบรรทัด (pt) — ใช้หาบรรทัดเดียวกันในหน้าอื่น
export interface Slot {
  x: number
  y: number
  w: number
  size: number
}

export interface Binding {
  id: string
  field: string
  slot: Slot
  stripStart: string // ตัดข้อความนี้ออกจากต้นบรรทัด เช่น "วันที่"
  stripEnd: string
}

export interface Mapping {
  bindings: Binding[]
  customFields: FieldDef[]
}

export function allFields(m: Mapping): FieldDef[] {
  return [...BASE_FIELDS, ...m.customFields]
}

export const slotOf = (l: TextLine): Slot => ({ x: l.x, y: l.y, w: l.w, size: l.size })

let seq = 0
export const newId = (p = 'b') => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`

// จับคู่ binding กับบรรทัดในหน้า: ใกล้ตำแหน่ง y + ขนาดตัวอักษรใกล้กัน (ไม่สนข้อความ)
export function matchLines(lines: TextLine[], bindings: Binding[]): Map<string, TextLine> {
  const pairs: { b: Binding; l: TextLine; score: number }[] = []
  for (const b of bindings) {
    const s = b.slot
    for (const l of lines) {
      const dy = Math.abs(l.y - s.y)
      if (dy > Math.max(s.size, l.size) + 2) continue
      const dc = Math.abs(l.x + l.w / 2 - (s.x + s.w / 2))
      const ds = Math.abs(l.size - s.size)
      pairs.push({ b, l, score: dy * 3 + ds * 2 + dc * 0.05 })
    }
  }
  pairs.sort((p, q) => p.score - q.score)
  const out = new Map<string, TextLine>()
  const used = new Map<TextLine, number>() // บรรทัด → y ของ slot ที่ใช้ไปแล้ว
  for (const { b, l } of pairs) {
    if (out.has(b.id)) continue
    const uy = used.get(l)
    // ใช้บรรทัดซ้ำได้เฉพาะเมื่อผู้ใช้ผูกบรรทัดเดียวกันหลายช่องตั้งใจ (slot เดียวกัน)
    if (uy !== undefined && Math.abs(uy - b.slot.y) > 1) continue
    out.set(b.id, l)
    used.set(l, b.slot.y)
  }
  return out
}

export function stripText(text: string, b: Pick<Binding, 'stripStart' | 'stripEnd'>): string {
  let t = text
  const st = b.stripStart.trim()
  const en = b.stripEnd.trim()
  if (st) {
    const i = t.indexOf(st)
    if (i >= 0) t = t.slice(i + st.length)
  }
  if (en) {
    const i = t.lastIndexOf(en)
    if (i >= 0) t = t.slice(0, i)
  }
  return t.trim()
}

// ---------- ตรวจหาช่องอัตโนมัติ ----------

const THAI_MONTHS =
  'มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม|ม\\.ค\\.|ก\\.พ\\.|มี\\.ค\\.|เม\\.ย\\.|พ\\.ค\\.|มิ\\.ย\\.|ก\\.ค\\.|ส\\.ค\\.|ก\\.ย\\.|ต\\.ค\\.|พ\\.ย\\.|ธ\\.ค\\.'
const EN_MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December'
const DATE_RE = new RegExp(
  `(\\d{1,2}\\s*(${THAI_MONTHS}|${EN_MONTHS})\\s*(พ\\.ศ\\.|ค\\.ศ\\.)?\\s*\\d{2,4})|(\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{2,4})`,
  'i',
)

interface Rule {
  field: string
  match: (t: string) => string | null // คืนค่าที่ต้องการ (ส่วนหนึ่งของบรรทัด)
}

const RULES: Rule[] = [
  { field: 'certNo', match: (t) => t.match(/(?:^|\s)(?:เลขที่|Certificate\s*No\.?|No\.)\s*[:.]?\s*([A-Za-z0-9][A-Za-z0-9\-/.]*)/i)?.[1] ?? null },
  { field: 'code', match: (t) => t.match(/(?:^|\s)(?:รหัส(?:ประจำตัว|พนักงาน|นักศึกษา)?|ID|Code)\s*[:.]?\s*([A-Za-z0-9][A-Za-z0-9\-/.]*)/i)?.[1] ?? null },
  {
    field: 'course',
    match: (t) => {
      const m = t.match(/(?:หลักสูตร|โครงการ|course|program(?:me)?)\s*[:"“]?\s*(.+?)["”]?$/i)
      return m ? m[1].trim() : null
    },
  },
  { field: 'date', match: (t) => t.match(DATE_RE)?.[0] ?? null },
  {
    field: 'org',
    match: (t) =>
      /^(บริษัท|ห้างหุ้นส่วน|มหาวิทยาลัย|โรงเรียน|วิทยาลัย|สถาบัน|สำนักงาน|กรม|กระทรวง|สมาคม|มูลนิธิ|ธนาคาร|การไฟฟ้า|องค์การ)/.test(t) ||
      /(Co\.,?\s*Ltd\.?|Company|University|Institute|Limited|Inc\.?)$/i.test(t)
        ? t
        : null,
  },
]

const HEADING_RE =
  /^(ประกาศนียบัตร|เกียรติบัตร|วุฒิบัตร|ใบประกาศ|หนังสือรับรอง|certificate|of\s+(completion|achievement|appreciation|participation)|มอบให้|ขอมอบ|ให้ไว้เพื่อแสดงว่า|this\s+is\s+to\s+certify)/i

// ตัดส่วนก่อน/หลังค่าที่จับได้ เป็นข้อความที่ต้องตัดทิ้ง
function stripAround(text: string, value: string) {
  const i = text.indexOf(value)
  if (i < 0) return { stripStart: '', stripEnd: '' }
  return { stripStart: text.slice(0, i).trim(), stripEnd: text.slice(i + value.length).trim() }
}

export function autoMapping(pages: PageInfo[]): Mapping {
  const page = pages.find((p) => p.lines.length > 0)
  const bindings: Binding[] = []
  const customFields: FieldDef[] = []
  if (!page) return { bindings, customFields }

  const ruled = new Map<TextLine, { field: string; value: string }>()
  for (const l of page.lines) {
    for (const r of RULES) {
      const v = r.match(l.text)
      if (v !== null && ![...ruled.values()].some((x) => x.field === r.field)) {
        ruled.set(l, { field: r.field, value: v })
        break
      }
    }
  }
  // ชื่อผู้รับ = บรรทัดตัวใหญ่ที่สุดที่ไม่ใช่หัวกระดาษ และไม่ตรงกฎอื่น
  const candidates = page.lines.filter((l) => !HEADING_RE.test(l.text) && !ruled.has(l))
  const maxSize = Math.max(0, ...candidates.map((l) => l.size))
  const nameLine = candidates.find((l) => l.size === maxSize)

  let extra = 0
  for (const l of page.lines) {
    if (l === nameLine) {
      bindings.push({ id: newId(), field: 'name', slot: slotOf(l), stripStart: '', stripEnd: '' })
    } else if (ruled.has(l)) {
      const { field, value } = ruled.get(l)!
      bindings.push({ id: newId(), field, slot: slotOf(l), ...stripAround(l.text, value) })
    } else {
      // บรรทัดที่ไม่รู้จัก เก็บไว้เป็น "ข้อความ N" ให้ผู้ใช้เลือกผูกใหม่เองได้
      extra++
      const f: FieldDef = {
        key: `c_auto${extra}`,
        token: `ข้อความ${extra}`,
        label: `ข้อความ ${extra}`,
        tokenEn: `text${extra}`,
        labelEn: `Text ${extra}`,
        custom: true,
      }
      customFields.push(f)
      bindings.push({ id: newId(), field: f.key, slot: slotOf(l), stripStart: '', stripEnd: '' })
    }
  }
  return { bindings, customFields }
}

// ---------- สร้างตาราง ----------

export interface CertRecord {
  page: number // เริ่มที่ 1
  values: Record<string, string>
}

export interface CertTable {
  fields: FieldDef[] // ช่องที่มีข้อมูล เรียงตามลำดับช่อง
  rows: CertRecord[]
  constantKeys: Set<string> // ช่องที่ทุกแถวมีค่าเดียวกัน
}

export type Overrides = Record<number, Record<string, string>> // page → key → ค่าที่ผู้ใช้แก้เอง

// ค่าที่ดึงได้ของแต่ละช่องในหน้าหนึ่ง (ยังไม่รวมการแก้ไขในตาราง)
export function extractPage(page: PageInfo, m: Mapping): Record<string, string> {
  const matched = matchLines(page.lines, m.bindings)
  const parts: Record<string, { y: number; x: number; text: string }[]> = {}
  for (const b of m.bindings) {
    const l = matched.get(b.id)
    if (!l || !b.field) continue
    const text = stripText(l.text, b)
    if (!text) continue
    ;(parts[b.field] ??= []).push({ y: l.y, x: l.x, text })
  }
  const values: Record<string, string> = {}
  // ผูกหลายบรรทัดกับช่องเดียว → ต่อกันตามลำดับบนลงล่าง
  for (const [k, list] of Object.entries(parts)) values[k] = list.sort((a, b) => a.y - b.y || a.x - b.x).map((p) => p.text).join(' ')
  return values
}

// เติม คำนำหน้า/ชื่อ/นามสกุล จากชื่อเต็ม หรือประกอบชื่อเต็มจากส่วนย่อย
function fillNameParts(values: Record<string, string>, bound: Set<string>, edited: Record<string, string> = {}) {
  if (values.name) {
    const n = splitName(values.name)
    for (const k of NAME_PARTS) if (!bound.has(k) && !(k in edited)) values[k] = n[k]
  } else if (!values.name && (values.first || values.last)) {
    values.name = [values.prefix, values.first].filter(Boolean).join('') + (values.last ? ` ${values.last}` : '')
  }
}

// ค่าของหน้าหนึ่ง รวมคำนำหน้า/ชื่อ/นามสกุลที่แยกจากชื่อเต็ม
export function pageValues(page: PageInfo, m: Mapping): Record<string, string> {
  const values = extractPage(page, m)
  fillNameParts(values, new Set(m.bindings.map((b) => b.field).filter(Boolean)))
  return values
}

export function buildTable(pages: PageInfo[], m: Mapping, overrides: Overrides = {}): CertTable {
  const bound = new Set(m.bindings.map((b) => b.field).filter(Boolean))
  const rows: CertRecord[] = pages.map((p) => {
    const edited = overrides[p.index + 1] ?? {}
    const values = { ...extractPage(p, m), ...edited }
    fillNameParts(values, bound, edited)
    return { page: p.index + 1, values }
  })

  const fields = allFields(m).filter((f) => rows.some((r) => r.values[f.key]))
  const constantKeys = new Set<string>()
  if (rows.length > 1) {
    for (const f of fields) {
      const first = rows[0].values[f.key] ?? ''
      if (first && rows.every((r) => (r.values[f.key] ?? '') === first)) constantKeys.add(f.key)
    }
  }
  return { fields, rows, constantKeys }
}
