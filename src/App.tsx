import { useState } from 'react'
import { Award, LockKeyhole, Wrench, type LucideIcon } from 'lucide-react'
import CertificateTool from './tools/certificate/CertificateTool'

interface Tool {
  id: string
  name: string
  desc: string
  icon: LucideIcon
  ready: boolean
}

const TOOLS: Tool[] = [
  { id: 'certificate', name: 'Certificate', desc: 'แยกไฟล์ใบประกาศ · ดึงรายชื่อเป็นตาราง', icon: Award, ready: true },
  { id: 'more', name: 'เครื่องมืออื่น', desc: 'กำลังตามมาเร็ว ๆ นี้', icon: Wrench, ready: false },
]

export default function App() {
  const [active, setActive] = useState('certificate')

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="/favicon.svg" alt="" width={28} height={28} />
          <span>Certloads</span>
        </div>
        <nav className="tools-nav" aria-label="เครื่องมือ">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={`tool-tab${active === t.id ? ' active' : ''}`}
              disabled={!t.ready}
              title={t.desc}
              onClick={() => setActive(t.id)}
            >
              <t.icon size={16} aria-hidden /> {t.name}
              {!t.ready && <small className="soon">เร็ว ๆ นี้</small>}
            </button>
          ))}
        </nav>
      </header>

      <main className="content">{active === 'certificate' && <CertificateTool />}</main>

      <footer className="footer">
        <LockKeyhole size={14} aria-hidden /> ไฟล์ของคุณถูกประมวลผลในเบราว์เซอร์นี้เท่านั้น ไม่มีการอัปโหลดไปที่เซิร์ฟเวอร์ใด ๆ
      </footer>
    </div>
  )
}
