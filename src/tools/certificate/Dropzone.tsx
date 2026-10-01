import { useRef, useState } from 'react'
import { FileUp } from 'lucide-react'

export default function Dropzone({ onFile }: { onFile: (f: File) => void }) {
  const [over, setOver] = useState(false)
  const [bad, setBad] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  function pick(files: FileList | null) {
    const f = files?.[0]
    if (!f) return
    const ok = f.type === 'application/pdf' || /\.pdf$/i.test(f.name)
    setBad(!ok)
    if (ok) onFile(f)
  }

  return (
    <div
      className={`dropzone${over ? ' over' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        pick(e.dataTransfer.files)
      }}
    >
      <input ref={input} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => pick(e.target.files)} />
      <div className="drop-icon" aria-hidden>
        <FileUp size={40} strokeWidth={1.6} />
      </div>
      <div className="drop-title">ลากไฟล์ PDF มาวางที่นี่</div>
      <div className="drop-sub">หรือ <u>คลิกเพื่อเลือกไฟล์</u></div>
      {bad && <div className="drop-bad">รองรับเฉพาะไฟล์ .pdf</div>}
    </div>
  )
}
