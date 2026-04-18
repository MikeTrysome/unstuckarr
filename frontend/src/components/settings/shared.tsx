import { useEffect, useRef, useState } from 'react'
import { HelpCircle, RefreshCw, WifiOff, X } from 'lucide-react'

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

// ─── Toggle switch ────────────────────────────────────────────────────────────

export function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        checked ? 'bg-indigo-600' : 'bg-slate-600'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
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

// ─── Server error ─────────────────────────────────────────────────────────────

export function ServerError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
      <WifiOff size={28} className="text-slate-500" />
      <div>
        <p className="text-base font-semibold text-white">Could not connect to server</p>
        <p className="text-sm text-slate-400 mt-1">
          Check that the backend is running and try again.
        </p>
      </div>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
      >
        <RefreshCw size={14} />
        Retry
      </button>
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
