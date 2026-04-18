import { useEffect, useRef, useState } from 'react'
import { HelpCircle, X } from 'lucide-react'

// ─── Tooltip ──────────────────────────────────────────────────────────────────

export function Tip({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="text-slate-600 hover:text-slate-400 transition-colors"
        tabIndex={-1}
      >
        <HelpCircle size={14} />
      </button>
      {show && (
        <div className="absolute left-5 top-0 z-50 w-56 px-3 py-2 text-xs text-slate-300 bg-[var(--bg-base)] border border-[var(--bd)] rounded-lg shadow-xl pointer-events-none">
          {text}
        </div>
      )}
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-50 w-full max-w-md bg-[var(--bg-card)] rounded-xl border border-[var(--bd)] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--bd)]">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

// ─── Modal field row ──────────────────────────────────────────────────────────

export function MField({
  label,
  tooltip,
  children,
}: {
  label: string
  tooltip?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[var(--bd)] last:border-0 gap-4">
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-sm text-slate-400">{label}</span>
        {tooltip && <Tip text={tooltip} />}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}

// ─── Input class constants ────────────────────────────────────────────────────

export const INPUT_CLS =
  'w-48 px-2 py-1 text-sm bg-[var(--bg-base)] border border-[var(--bd)] rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 font-mono placeholder:text-slate-600'

export const PORT_CLS =
  'w-24 px-2 py-1 text-sm text-center bg-[var(--bg-base)] border border-[var(--bd)] rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 font-mono'

export const NUMBER_CLS =
  'w-20 px-2 py-1 text-sm text-center bg-[var(--bg-base)] border border-[var(--bd)] rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500'

// ─── Section card ─────────────────────────────────────────────────────────────

export function SectionCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--bd)] overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--bd)]">
        <h2 className="text-sm font-medium text-white">{title}</h2>
      </div>
      <div className="px-5">{children}</div>
    </div>
  )
}

// ─── Page header ──────────────────────────────────────────────────────────────

export function PageHeader({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-semibold text-white">{title}</h1>
      <p className="text-sm text-slate-400 mt-0.5">{description}</p>
    </div>
  )
}
