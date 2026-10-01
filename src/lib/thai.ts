// แก้ข้อความไทยที่ได้จาก PDF (โดยเฉพาะไฟล์จาก Canva / Word) ให้อ่านได้ถูกต้อง

const FIXES: [RegExp, string][] = [
  // สระอำ ที่ถูกเก็บเป็น นิคหิต + สระอา
  [/ํา/g, 'ำ'],
  // ไม้เอกที่ font ไม่มี ToUnicode (ได้ \u0000) — เดาจากคำที่เจอบ่อย
  [/ที\u0000/g, 'ที่'],
  [/ได\u0000/g, 'ได้'],
  [/[\u0000�]/g, ''],
  // ช่องว่างหลายตัว
  [/[ \t ]+/g, ' '],
]

export function normalizeThai(s: string): string {
  let out = s.normalize('NFC')
  for (const [re, rep] of FIXES) out = out.replace(re, rep)
  return out.trim()
}

// คำนำหน้าชื่อ เรียงจากยาวไปสั้นเพื่อให้จับคำยาวก่อน
const PREFIXES = [
  'ว่าที่ร้อยตรีหญิง', 'ว่าที่ร้อยตรี', 'ว่าที่ ร.ต.หญิง', 'ว่าที่ ร.ต.',
  'ศาสตราจารย์', 'รองศาสตราจารย์', 'ผู้ช่วยศาสตราจารย์',
  'เด็กชาย', 'เด็กหญิง', 'นางสาว', 'นาย', 'นาง',
  'ด.ช.', 'ด.ญ.', 'น.ส.', 'ผศ.ดร.', 'รศ.ดร.', 'ศ.ดร.', 'ผศ.', 'รศ.', 'ศ.', 'ดร.', 'นพ.', 'พญ.', 'ทพ.', 'ทญ.',
  'Mrs.', 'Mr.', 'Ms.', 'Miss', 'Dr.', 'Mrs', 'Mr', 'Ms', 'Dr',
].sort((a, b) => b.length - a.length)

export interface NameParts {
  prefix: string
  first: string
  last: string
}

export function splitName(full: string): NameParts {
  let rest = full.trim()
  let prefix = ''
  for (const p of PREFIXES) {
    if (rest.startsWith(p)) {
      prefix = p
      rest = rest.slice(p.length).trim()
      break
    }
  }
  const sp = rest.indexOf(' ')
  if (sp < 0) return { prefix, first: rest, last: '' }
  return { prefix, first: rest.slice(0, sp), last: rest.slice(sp + 1).trim() }
}
