import { useState } from 'react'
import { api } from '../../lib/api'
import { PageHeader, SectionCard } from '../../components/settings/shared'

const INPUT_CLS =
  'w-full px-3 py-2 text-sm bg-[var(--bg-base)] border border-[var(--bd)] rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-slate-400 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

// ─── Change Password ──────────────────────────────────────────────────────────

function ChangePasswordCard() {
  const [current, setCurrent]   = useState('')
  const [next, setNext]         = useState('')
  const [confirm, setConfirm]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [success, setSuccess]   = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (next !== confirm) { setError('New passwords do not match'); return }
    if (next.length < 8)  { setError('Password must be at least 8 characters'); return }
    setSaving(true); setError(null)
    try {
      await api.auth.changePassword(current, next)
      setSuccess(true)
      setCurrent(''); setNext(''); setConfirm('')
      setTimeout(() => setSuccess(false), 3000)
    } catch {
      setError('Current password is incorrect')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionCard title="Change Password">
      <form onSubmit={submit} className="py-4 space-y-3">
        <Field label="Current password">
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)}
            placeholder="Enter current password" autoComplete="current-password"
            className={INPUT_CLS} />
        </Field>
        <Field label="New password">
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)}
            placeholder="Min. 8 characters" autoComplete="new-password"
            className={INPUT_CLS} />
        </Field>
        <Field label="Confirm new password">
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat new password" autoComplete="new-password"
            className={INPUT_CLS} />
        </Field>
        {error   && <p className="text-sm text-red-400">{error}</p>}
        {success && <p className="text-sm text-green-400">Password changed successfully.</p>}
        <div className="flex justify-end pt-1">
          <button type="submit" disabled={saving || !current || !next || !confirm}
            className="px-4 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors font-medium disabled:opacity-50">
            {saving ? 'Saving…' : 'Change Password'}
          </button>
        </div>
      </form>
    </SectionCard>
  )
}

// ─── Change Username ──────────────────────────────────────────────────────────

function ChangeUsernameCard() {
  const [current, setCurrent]   = useState('')
  const [username, setUsername] = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [success, setSuccess]   = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim()) { setError('Username cannot be empty'); return }
    setSaving(true); setError(null)
    try {
      await api.auth.changeUsername(current, username.trim())
      setSuccess(true)
      setCurrent(''); setUsername('')
      setTimeout(() => setSuccess(false), 3000)
    } catch {
      setError('Current password is incorrect')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionCard title="Change Username">
      <form onSubmit={submit} className="py-4 space-y-3">
        <Field label="Current password">
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)}
            placeholder="Enter current password to confirm" autoComplete="current-password"
            className={INPUT_CLS} />
        </Field>
        <Field label="New username">
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
            placeholder="New username" autoComplete="username"
            className={INPUT_CLS} />
        </Field>
        {error   && <p className="text-sm text-red-400">{error}</p>}
        {success && <p className="text-sm text-green-400">Username changed successfully.</p>}
        <div className="flex justify-end pt-1">
          <button type="submit" disabled={saving || !current || !username}
            className="px-4 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors font-medium disabled:opacity-50">
            {saving ? 'Saving…' : 'Change Username'}
          </button>
        </div>
      </form>
    </SectionCard>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Account() {
  return (
    <div className="space-y-5 max-w-2xl">
      <PageHeader
        title="Account"
        description="Manage your login credentials."
      />
      <ChangePasswordCard />
      <ChangeUsernameCard />
    </div>
  )
}
