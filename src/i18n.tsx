import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export type Lang = 'th' | 'en'

const th = {
  'lang.label': 'ภาษา',
  'nav.tools': 'เครื่องมือ',
  'tool.certificate.desc': 'แยกไฟล์ใบประกาศ · ดึงรายชื่อเป็นตาราง',
  'tool.more.name': 'เครื่องมืออื่น',
  'tool.more.desc': 'กำลังตามมาเร็ว ๆ นี้',
  soon: 'เร็ว ๆ นี้',
  'footer.privacy': 'ไฟล์ของคุณถูกประมวลผลในเบราว์เซอร์นี้เท่านั้น ไม่มีการอัปโหลดไปที่เซิร์ฟเวอร์ใด ๆ',

  'cert.intro': 'อัปโหลดไฟล์ใบประกาศ (PDF หลายหน้า) แล้วเลือกว่าจะแยกเป็นไฟล์ละหน้า หรือดึงรายชื่อออกมาเป็นตาราง',
  'loading.reading': 'กำลังอ่านไฟล์… {done}/{total} หน้า',
  'file.meta': '{pages} หน้า · {mb} MB',
  'file.change': 'เปลี่ยนไฟล์',
  'warn.noText': 'ไฟล์นี้ไม่มีข้อความที่อ่านได้ (อาจเป็นภาพสแกน) — ยังแยกไฟล์ได้ แต่ดึงรายชื่อเป็นตารางไม่ได้',
  'error.password': 'ไฟล์นี้ติดรหัสผ่าน กรุณาปลดรหัสก่อนใช้งาน',
  'error.open': 'เปิดไฟล์ไม่ได้ — ตรวจสอบว่าเป็นไฟล์ PDF ที่ไม่เสียหาย',
  'map.title': 'ช่องข้อมูลที่จับได้',
  'map.none': 'ยังไม่ได้ผูกช่องใดเลย',
  'map.edited': 'แก้ไขในตารางแล้ว {n} ช่อง',
  'map.editBtn': 'แก้ไขโดยละเอียด',
  'mode.split': 'แยกไฟล์',
  'mode.splitSub': '1 หน้า = 1 ไฟล์ ตั้งชื่อตามผู้รับ',
  'mode.table': 'ดึงข้อมูลเป็นตาราง',
  'mode.tableSub': 'ส่งออก Excel / CSV / คัดลอก',

  'drop.title': 'ลากไฟล์ PDF มาวางที่นี่',
  'drop.or': 'หรือ',
  'drop.click': 'คลิกเพื่อเลือกไฟล์',
  'drop.bad': 'รองรับเฉพาะไฟล์ .pdf',

  'split.nameLabel': 'ตั้งชื่อไฟล์',
  'split.insert': 'แทรก:',
  'split.presets': 'แบบสำเร็จ:',
  'tok.order': 'ลำดับ 01, 02, …',
  'tok.page': 'เลขหน้าในไฟล์เดิม',
  'tok.file': 'ชื่อไฟล์ต้นฉบับ',
  'split.selected': 'เลือกแล้ว {n}',
  'split.ofPages': '/ {total} หน้า',
  'split.selectAll': 'เลือกทั้งหมด',
  'split.selectNone': 'ไม่เลือกเลย',
  'split.merge': 'รวมหน้าที่เลือกเป็นไฟล์เดียว',
  'split.mergeTitle': 'รวมหน้าที่เลือกเป็น PDF ไฟล์เดียว',
  'split.creating': 'กำลังสร้าง…',
  'split.zip': 'ดาวน์โหลด ZIP ({n} ไฟล์)',
  'split.splitting': 'กำลังแยก… {p}',
  'split.pageAria': 'เลือกหน้า {n}',
  'split.pageAlt': 'หน้า {n}',
  'split.downloadOne': 'ดาวน์โหลดหน้านี้',
  'split.error': 'เกิดข้อผิดพลาดระหว่างสร้างไฟล์',
  'file.zipSuffix': '_แยกไฟล์',
  'file.mergeSuffix': '_เลือก{n}หน้า',
  'file.pageSuffix': '_หน้า{n}',

  'col.no': 'ลำดับ',
  'col.page': 'หน้า',
  'table.noFields1': 'ยังไม่มีช่องข้อมูล —',
  'table.openEditor': 'เปิดตัวแก้ไขโดยละเอียด',
  'table.noFields2': 'เพื่อผูกข้อความบนใบกับช่องข้อมูล',
  'table.constants': 'ข้อมูลที่เหมือนกันทุกใบ',
  'table.columns': 'คอลัมน์',
  'table.colHint': 'ลากเพื่อสลับตำแหน่ง · กดรูปตาเพื่อซ่อน/แสดง',
  'table.show': 'แสดงคอลัมน์',
  'table.hide': 'ซ่อนคอลัมน์',
  'table.hint': 'คลิกช่องในตารางเพื่อแก้ข้อความ · คลิกหัวคอลัมน์เพื่อเปลี่ยนชื่อหัว · ข้อมูลผิดช่องหรือสลับกัน?',
  'table.fixLink': 'แก้ไขการจับข้อมูลโดยละเอียด',
  'table.rows': 'แถว',
  'table.cols': 'คอลัมน์',
  'table.resetEdits': 'ล้างที่แก้เอง ({n})',
  'table.resetTitle': 'ยกเลิกการแก้ไขในตารางทั้งหมด',
  'table.copy': 'คัดลอก (วางใน Excel/Sheets)',
  'table.copied': 'คัดลอกแล้ว',
  'table.moveLeft': 'ย้ายไปทางซ้าย',
  'table.moveRight': 'ย้ายไปทางขวา',
  'table.headerAria': 'ชื่อหัวคอลัมน์',

  'ed.title': 'แก้ไขการจับข้อมูลโดยละเอียด',
  'ed.sub': 'คลิกข้อความบนใบ แล้วเลือกว่าจะผูกกับช่องไหน',
  'ed.prev': 'หน้าก่อน (←)',
  'ed.next': 'หน้าถัดไป (→)',
  'ed.page': 'หน้า',
  'ed.zoomOut': 'ย่อ',
  'ed.zoomIn': 'ขยาย',
  'ed.resetConfirm': 'ล้างการผูกทั้งหมด แล้วให้ระบบตรวจหาใหม่อัตโนมัติ?',
  'ed.reset': 'ตรวจหาใหม่อัตโนมัติ',
  'ed.done': 'เสร็จสิ้น',
  'ed.closeEsc': 'ปิด (Esc)',
  close: 'ปิด',
  'ed.loadingImg': 'กำลังโหลดรูป…',
  'ed.selected': 'ข้อความที่เลือก',
  'ed.bindTo': 'ผูกกับช่อง',
  'ed.fieldN': 'ช่องที่ {n}',
  'ed.newPlaceholder': 'หรือพิมพ์ชื่อช่องใหม่ เช่น ตำแหน่ง',
  'ed.createBind': 'สร้างและผูก',
  'ed.unbind': 'เลิกผูก',
  'ed.unbindTitle': 'เลิกผูกบรรทัดนี้',
  'ed.movePlaceholder': 'ย้ายไปช่องใหม่ที่สร้างเอง…',
  'ed.stripStart': 'ตัดข้อความด้านหน้า',
  'ed.stripStartPh': 'เช่น วันที่',
  'ed.stripEnd': 'ตัดข้อความด้านหลัง',
  'ed.result': 'ค่าที่ได้',
  'ed.empty': '(ว่าง)',
  'ed.addAnother': 'บรรทัดนี้มีหลายข้อมูล? ผูกเพิ่มอีกช่อง',
  'ed.help':
    'กรอบสีคือข้อความที่ผูกกับช่องแล้ว กรอบเส้นประคือข้อความที่ยังไม่ได้ใช้ — คลิกเพื่อแก้ไข ระบบจะใช้ตำแหน่งเดียวกันนี้กับทุกหน้า ลองกดเปลี่ยนหน้าเพื่อตรวจว่าทุกใบดึงถูกช่อง',
  'ed.missing': 'หน้านี้ไม่พบข้อความสำหรับ: {list}',
  'ed.fieldsTitle': 'ช่องข้อมูล · ค่าในหน้านี้',
  'ed.goTo': 'ไปที่ข้อความนี้',
  'ed.fieldName': 'ชื่อช่อง',
  'ed.notFound': 'ไม่พบ',
  'ed.derived': 'แยกจากชื่อ-นามสกุล',
  'ed.unbound': 'ยังไม่ได้ผูก',
  'ed.delete': 'ลบช่องนี้',
  'ed.createPh': 'สร้างช่องเอง เช่น ตำแหน่ง, แผนก',
  'ed.create': 'สร้างช่อง',
}

export type Key = keyof typeof th

const en: Record<Key, string> = {
  'lang.label': 'Language',
  'nav.tools': 'Tools',
  'tool.certificate.desc': 'Split certificate PDFs · extract names to a table',
  'tool.more.name': 'More tools',
  'tool.more.desc': 'Coming soon',
  soon: 'Soon',
  'footer.privacy': 'Your files are processed in this browser only — nothing is uploaded to any server.',

  'cert.intro': 'Upload a certificate file (multi-page PDF), then split it into one file per page or extract the names into a table.',
  'loading.reading': 'Reading file… {done}/{total} pages',
  'file.meta': '{pages} pages · {mb} MB',
  'file.change': 'Change file',
  'warn.noText': 'This file has no readable text (it may be a scan) — you can still split it, but names cannot be extracted to a table.',
  'error.password': 'This file is password-protected. Please remove the password first.',
  'error.open': 'Could not open the file — make sure it is a valid PDF.',
  'map.title': 'Detected fields',
  'map.none': 'No fields bound yet',
  'map.edited': '{n} cells edited in the table',
  'map.editBtn': 'Detailed editor',
  'mode.split': 'Split files',
  'mode.splitSub': '1 page = 1 file, named after the recipient',
  'mode.table': 'Extract to table',
  'mode.tableSub': 'Export Excel / CSV / copy',

  'drop.title': 'Drag & drop a PDF here',
  'drop.or': 'or',
  'drop.click': 'click to choose a file',
  'drop.bad': 'Only .pdf files are supported',

  'split.nameLabel': 'File name',
  'split.insert': 'Insert:',
  'split.presets': 'Presets:',
  'tok.order': 'Sequence 01, 02, …',
  'tok.page': 'Page number in the original file',
  'tok.file': 'Original file name',
  'split.selected': '{n} selected',
  'split.ofPages': 'of {total} pages',
  'split.selectAll': 'Select all',
  'split.selectNone': 'Select none',
  'split.merge': 'Merge selected into one file',
  'split.mergeTitle': 'Merge the selected pages into a single PDF',
  'split.creating': 'Creating…',
  'split.zip': 'Download ZIP ({n} files)',
  'split.splitting': 'Splitting… {p}',
  'split.pageAria': 'Select page {n}',
  'split.pageAlt': 'Page {n}',
  'split.downloadOne': 'Download this page',
  'split.error': 'Something went wrong while creating the file',
  'file.zipSuffix': '_split',
  'file.mergeSuffix': '_{n}-pages',
  'file.pageSuffix': '_page{n}',

  'col.no': 'No.',
  'col.page': 'Page',
  'table.noFields1': 'No fields yet —',
  'table.openEditor': 'open the detailed editor',
  'table.noFields2': 'to bind text on the certificate to fields.',
  'table.constants': 'Same on every certificate',
  'table.columns': 'Columns',
  'table.colHint': 'Drag to reorder · click the eye to show/hide',
  'table.show': 'Show column',
  'table.hide': 'Hide column',
  'table.hint': 'Click a cell to edit · click a header to rename it · Wrong or swapped fields?',
  'table.fixLink': 'Fix them in the detailed editor',
  'table.rows': 'rows',
  'table.cols': 'columns',
  'table.resetEdits': 'Clear my edits ({n})',
  'table.resetTitle': 'Undo all edits made in the table',
  'table.copy': 'Copy (paste into Excel/Sheets)',
  'table.copied': 'Copied',
  'table.moveLeft': 'Move left',
  'table.moveRight': 'Move right',
  'table.headerAria': 'Column header',

  'ed.title': 'Detailed field editor',
  'ed.sub': 'Click text on the certificate, then choose which field it belongs to',
  'ed.prev': 'Previous page (←)',
  'ed.next': 'Next page (→)',
  'ed.page': 'Page',
  'ed.zoomOut': 'Zoom out',
  'ed.zoomIn': 'Zoom in',
  'ed.resetConfirm': 'Clear all bindings and auto-detect again?',
  'ed.reset': 'Auto-detect again',
  'ed.done': 'Done',
  'ed.closeEsc': 'Close (Esc)',
  close: 'Close',
  'ed.loadingImg': 'Loading image…',
  'ed.selected': 'Selected text',
  'ed.bindTo': 'Bind to field',
  'ed.fieldN': 'Field {n}',
  'ed.newPlaceholder': 'Or type a new field name, e.g. Position',
  'ed.createBind': 'Create & bind',
  'ed.unbind': 'Unbind',
  'ed.unbindTitle': 'Unbind this line',
  'ed.movePlaceholder': 'Move to a new custom field…',
  'ed.stripStart': 'Remove text before',
  'ed.stripStartPh': 'e.g. Date',
  'ed.stripEnd': 'Remove text after',
  'ed.result': 'Result',
  'ed.empty': '(empty)',
  'ed.addAnother': 'Several values on this line? Bind another field',
  'ed.help':
    'Colored boxes are text bound to a field; dashed boxes are unused text. Click one to edit — the same position is used on every page. Flip through the pages to check that every certificate is read correctly.',
  'ed.missing': 'Not found on this page: {list}',
  'ed.fieldsTitle': 'Fields · values on this page',
  'ed.goTo': 'Go to this text',
  'ed.fieldName': 'Field name',
  'ed.notFound': 'Not found',
  'ed.derived': 'Split from full name',
  'ed.unbound': 'Not bound',
  'ed.delete': 'Delete this field',
  'ed.createPh': 'Create a field, e.g. Position, Department',
  'ed.create': 'Create field',
}

const DICT: Record<Lang, Record<Key, string>> = { th, en }

export type T = (key: Key, vars?: Record<string, string | number>) => string

interface Ctx {
  lang: Lang
  setLang: (l: Lang) => void
  t: T
}

const I18nContext = createContext<Ctx | null>(null)

const STORAGE_KEY = 'certloads.lang'

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'th' || saved === 'en') return saved
  } catch {
    /* storage อาจถูกปิด */
  }
  return navigator.language?.toLowerCase().startsWith('th') ? 'th' : 'en'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try {
      localStorage.setItem(STORAGE_KEY, l)
    } catch {
      /* ignore */
    }
  }, [])

  const t = useCallback<T>(
    (key, vars) => {
      let s = DICT[lang][key] ?? key
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v))
      return s
    },
    [lang],
  )

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider')
  return ctx
}
