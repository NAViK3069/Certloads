import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { normalizeThai } from './thai'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export type PdfDoc = pdfjs.PDFDocumentProxy
type PdfPage = pdfjs.PDFPageProxy

export interface TextLine {
  text: string
  size: number // ขนาดตัวอักษรโดยประมาณ (pt)
  y: number // ระยะจากด้านบนของหน้า (pt)
  x: number
  w: number // ความกว้างของบรรทัด (pt)
  top: number // ขอบบน/ล่างของตัวอักษรจริง (pt จากด้านบนหน้า) ใช้วาดกรอบ
  bottom: number
}

export interface PageInfo {
  index: number // เริ่มที่ 0
  width: number // ขนาดหน้า (pt)
  height: number
  lines: TextLine[]
}

export interface OpenedPdf {
  doc: PdfDoc
  close: () => void
}

export async function openPdf(bytes: ArrayBuffer): Promise<OpenedPdf> {
  // pdf.js จะโอน buffer ไปให้ worker จึงต้องส่งสำเนา เพื่อเก็บต้นฉบับไว้ใช้แยกไฟล์
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)) })
  return { doc: await task.promise, close: () => void task.destroy() }
}

interface Item {
  str: string
  x: number
  y: number
  w: number
  size: number
  asc: number // สัดส่วนความสูงเหนือ/ใต้ baseline ของฟอนต์
  desc: number
}

interface RawItem {
  fontName: string
  str: string
  transform: number[]
  width: number
  height: number
}

const UNKNOWN = '\u0000'

// อ่านข้อความในหน้า แล้วรวม text item เป็นบรรทัด (เรียงบนลงล่าง ซ้ายไปขวา)
export async function readPage(doc: PdfDoc, pageIndex: number): Promise<PageInfo> {
  const page = await doc.getPage(pageIndex + 1)
  const viewport = page.getViewport({ scale: 1 })
  const { width, height } = viewport
  const tc = await page.getTextContent()
  const raw: RawItem[] = []
  for (const it of tc.items) {
    if ('str' in it && it.str !== '') raw.push({ str: it.str, fontName: it.fontName, transform: it.transform, width: it.width, height: it.height })
  }

  // มี glyph ที่ไม่รู้ว่าเป็นตัวอะไร → ลองกู้จาก glyph id
  const unknownCount = raw.reduce((n, it) => n + it.str.split(UNKNOWN).length - 1, 0)
  if (unknownCount > 0) {
    const fixes = await recoverUnmapped(page)
    if (fixes && fixes.length === unknownCount) {
      let k = 0
      for (const it of raw) it.str = it.str.replaceAll(UNKNOWN, () => fixes[k++])
    }
  }

  const items: Item[] = raw.map((it) => {
    const [a, b, , , e, f] = it.transform
    // แปลงเป็นพิกัดหน้าจอ (รองรับ crop box ที่ไม่เริ่มที่ 0 และหน้าที่หมุน)
    const [x, y] = viewport.convertToViewportPoint(e, f)
    const st = tc.styles[it.fontName]
    // บางฟอนต์ (เช่น Prompt) รายงาน ascent/descent รวมระยะบรรทัดไว้ด้วย ทำให้กรอบสูงเกินจนชนบรรทัดข้างเคียง
    // จึงจำกัดไว้ที่ขอบเขตตัวอักษรจริงของภาษาไทย (สระบน/วรรณยุกต์ ถึง สระล่าง)
    const asc = Math.min(st?.ascent || 0.9, 0.9)
    const desc = Math.min(Math.abs(st?.descent || 0.3), 0.3)
    return { str: it.str, x, y, w: it.width, size: Math.hypot(a, b) || it.height, asc, desc }
  })

  // จัดกลุ่มตาม baseline — item ที่ y ใกล้กันถือว่าอยู่บรรทัดเดียวกัน
  items.sort((p, q) => p.y - q.y || p.x - q.x)
  const groups: Item[][] = []
  for (const it of items) {
    const g = groups.find((g) => Math.abs(g[0].y - it.y) < Math.max(2, Math.min(g[0].size, it.size) * 0.35))
    if (g) g.push(it)
    else groups.push([it])
  }

  const lines: TextLine[] = []
  for (const g of groups) {
    g.sort((p, q) => p.x - q.x)
    let text = ''
    let end = g[0].x
    for (const it of g) {
      // ถ้ามีช่องห่างชัดเจนแต่ไม่มีช่องว่างในข้อความ ให้เติมช่องว่าง
      if (text && it.x - end > it.size * 0.3 && !text.endsWith(' ') && !it.str.startsWith(' ')) text += ' '
      text += it.str
      end = Math.max(end, it.x + it.w)
    }
    const clean = normalizeThai(text)
    if (!clean) continue
    lines.push({
      text: clean,
      size: Math.max(...g.map((i) => i.size)),
      y: g[0].y,
      x: g[0].x,
      w: end - g[0].x,
      top: Math.min(...g.map((i) => i.y - i.asc * i.size)),
      bottom: Math.max(...g.map((i) => i.y + i.desc * i.size)),
    })
  }
  lines.sort((p, q) => p.y - q.y)
  return { index: pageIndex, width, height, lines }
}

// วรรณยุกต์/สระบนของไทย — ฟอนต์หลายตัว (เช่น Prompt ใน Canva) มี glyph "ยกสูง" ที่ไม่มี Unicode
// วางไว้ถัดจาก glyph ปกติหนึ่งตำแหน่ง จึงเดาได้จาก id ก่อนหน้า
const THAI_UPPER_MARKS = new Set(['ั', 'ิ', 'ี', 'ึ', 'ื', '็', '่', '้', '๊', '๋', '์', 'ํ'])

interface PdfGlyph {
  unicode: string
  originalCharCode: number
}

// คืนตัวอักษรแทน glyph ที่ไม่รู้จัก ตามลำดับที่ปรากฏในหน้า ('' ถ้าเดาไม่ได้)
async function recoverUnmapped(page: PdfPage): Promise<string[] | null> {
  try {
    const ol = await page.getOperatorList()
    const byFont = new Map<string, Map<number, string>>()
    const unknown: { font: string; code: number }[] = []
    let font = ''
    for (let i = 0; i < ol.fnArray.length; i++) {
      const fn = ol.fnArray[i]
      const args = ol.argsArray[i]
      if (fn === pdfjs.OPS.setFont) {
        const obj = page.commonObjs.has(args[0]) ? (page.commonObjs.get(args[0]) as { name?: string }) : null
        font = (obj?.name ?? String(args[0])).replace(/^[A-Z]{6}\+/, '')
      } else if (fn === pdfjs.OPS.showText) {
        let map = byFont.get(font)
        if (!map) byFont.set(font, (map = new Map()))
        for (const g of args[0] as (PdfGlyph | number | null)[]) {
          if (!g || typeof g === 'number') continue
          if (!g.unicode || g.unicode === UNKNOWN) unknown.push({ font, code: g.originalCharCode })
          else map.set(g.originalCharCode, g.unicode)
        }
      }
    }
    // ฟอนต์ตระกูลเดียวกันคนละน้ำหนักมักใช้ลำดับ glyph เดียวกัน จึงหาข้ามฟอนต์ได้
    const family = (f: string) => f.split('-')[0]
    return unknown.map(({ font, code }) => {
      const prev = byFont.get(font)?.get(code - 1)
      if (prev && THAI_UPPER_MARKS.has(prev)) return prev
      for (const [f, m] of byFont) {
        const p = m.get(code - 1)
        if (family(f) === family(font) && p && THAI_UPPER_MARKS.has(p)) return p
      }
      return ''
    })
  } catch {
    return null
  }
}

export async function renderThumb(doc: PdfDoc, pageIndex: number, width: number): Promise<string> {
  const page = await doc.getPage(pageIndex + 1)
  const base = page.getViewport({ scale: 1 })
  const viewport = page.getViewport({ scale: (width * (window.devicePixelRatio || 1)) / base.width })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(viewport.width)
  canvas.height = Math.round(viewport.height)
  await page.render({ canvas, viewport }).promise
  const url = await new Promise<string>((resolve) =>
    canvas.toBlob((b) => resolve(b ? URL.createObjectURL(b) : ''), 'image/jpeg', 0.85),
  )
  page.cleanup()
  return url
}
