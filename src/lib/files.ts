// ไลบรารีใหญ่โหลดเมื่อใช้งานจริงเท่านั้น เพื่อให้หน้าเว็บเปิดเร็ว

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

// ตัดอักขระที่ใช้เป็นชื่อไฟล์ไม่ได้ใน Windows/macOS
export function safeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|\u0000-\u001F]/g, '').replace(/\s+/g, ' ').trim().slice(0, 150) || 'file'
}

export function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>()
  return names.map((n) => {
    const key = n.toLowerCase()
    const c = seen.get(key) ?? 0
    seen.set(key, c + 1)
    return c === 0 ? n : `${n} (${c + 1})`
  })
}

export interface SplitJob {
  pageIndex: number
  filename: string // ไม่รวม .pdf
}

export async function splitToZip(
  source: ArrayBuffer,
  jobs: SplitJob[],
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  const [{ PDFDocument }, { default: JSZip }] = await Promise.all([import('pdf-lib'), import('jszip')])
  const src = await PDFDocument.load(source, { ignoreEncryption: true })
  const zip = new JSZip()
  for (let i = 0; i < jobs.length; i++) {
    const out = await PDFDocument.create()
    const [page] = await out.copyPages(src, [jobs[i].pageIndex])
    out.addPage(page)
    zip.file(`${jobs[i].filename}.pdf`, await out.save())
    onProgress?.(i + 1, jobs.length)
  }
  // PDF บีบอัดอยู่แล้ว ใช้ STORE เพื่อให้เร็ว
  return zip.generateAsync({ type: 'blob', compression: 'STORE' })
}

export async function extractPages(source: ArrayBuffer, pageIndexes: number[]): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib')
  const src = await PDFDocument.load(source, { ignoreEncryption: true })
  const out = await PDFDocument.create()
  const pages = await out.copyPages(src, pageIndexes)
  pages.forEach((p) => out.addPage(p))
  const bytes = await out.save()
  return new Blob([bytes as BlobPart], { type: 'application/pdf' })
}

export type Grid = string[][] // แถวแรกเป็นหัวตาราง

export function gridToTsv(grid: Grid): string {
  return grid.map((r) => r.map((c) => c.replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\n')
}

export function downloadCsv(grid: Grid, filename: string) {
  const esc = (c: string) => (/[",\r\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)
  const csv = grid.map((r) => r.map(esc).join(',')).join('\r\n')
  // ใส่ BOM เพื่อให้ Excel เปิดภาษาไทยได้ถูกต้อง
  downloadBlob(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }), `${filename}.csv`)
}

export async function downloadXlsx(grid: Grid, filename: string) {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.aoa_to_sheet(grid)
  ws['!cols'] = grid[0].map((_, ci) => ({
    wch: Math.min(60, Math.max(6, ...grid.map((r) => (r[ci] ?? '').length + 2))),
  }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Certificates')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}
