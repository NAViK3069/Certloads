import { useState } from 'react'
import { Award, Languages, LockKeyhole, Wrench, type LucideIcon } from 'lucide-react'
import CertificateTool from './tools/certificate/CertificateTool'
import { useI18n, type Key, type Lang } from './i18n'

interface Tool {
  id: string
  name: string | Key // ชื่อเฉพาะ (ไม่แปล) หรือ key สำหรับแปล
  desc: Key
  icon: LucideIcon
  ready: boolean
}

const TOOLS: Tool[] = [
  { id: 'certificate', name: 'Certificate', desc: 'tool.certificate.desc', icon: Award, ready: true },
  { id: 'more', name: 'tool.more.name', desc: 'tool.more.desc', icon: Wrench, ready: false },
]

const LANGS: { id: Lang; label: string; full: string }[] = [
  { id: 'th', label: 'TH', full: 'ไทย' },
  { id: 'en', label: 'EN', full: 'English' },
]

export default function App() {
  const [active, setActive] = useState('certificate')
  const { lang, setLang, t } = useI18n()
  const toolName = (n: string) => (n.includes('.') ? t(n as Key) : n)

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="/favicon.svg" alt="" width={28} height={28} />
          <span>Certloads</span>
        </div>
        <nav className="tools-nav" aria-label={t('nav.tools')}>
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              className={`tool-tab${active === tool.id ? ' active' : ''}`}
              disabled={!tool.ready}
              title={t(tool.desc)}
              onClick={() => setActive(tool.id)}
            >
              <tool.icon size={16} aria-hidden /> {toolName(tool.name)}
              {!tool.ready && <small className="soon">{t('soon')}</small>}
            </button>
          ))}
        </nav>
        <div className="lang-switch" role="radiogroup" aria-label={t('lang.label')}>
          <Languages size={16} aria-hidden className="lang-icon" />
          {LANGS.map((l) => (
            <button
              key={l.id}
              role="radio"
              aria-checked={lang === l.id}
              className={lang === l.id ? 'on' : ''}
              onClick={() => setLang(l.id)}
              title={l.full}
            >
              {l.label}
            </button>
          ))}
        </div>
      </header>

      <main className="content">{active === 'certificate' && <CertificateTool />}</main>

      <footer className="footer">
        <LockKeyhole size={14} aria-hidden /> {t('footer.privacy')}
      </footer>
    </div>
  )
}
