import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, ShieldCheck } from 'lucide-react'
import { api } from '../lib/api'

export default function Setup() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const validate = (): string | null => {
    if (username.trim().length < 3) return 'Username must be at least 3 characters'
    if (password.length < 12) return 'Password must be at least 12 characters'
    if (password !== confirm) return 'Passwords do not match'
    return null
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    setLoading(true)
    setError(null)
    try {
      await api.auth.setup(username.trim(), password)
      navigate('/login', { replace: true })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('409')) {
        setError('Already configured. Go to Settings to change credentials.')
      } else {
        setError('Setup failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
            <Activity size={18} className="text-white" />
          </div>
          <span className="text-xl font-semibold text-white">Unstuckarr</span>
        </div>

        <form
          onSubmit={submit}
          className="bg-[#1a1d27] rounded-2xl border border-[#2a2d3a] p-6 space-y-4"
        >
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={16} className="text-indigo-400" />
            <h1 className="text-base font-medium text-white">First-time setup</h1>
          </div>
          <p className="text-sm text-slate-400">
            Choose a username and password to secure the Unstuckarr web interface. You can change them later in Settings.
          </p>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              className="w-full px-3 py-2 bg-[#0f1117] border border-[#2a2d3a] rounded-lg text-slate-200 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="Min. 3 characters"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full px-3 py-2 bg-[#0f1117] border border-[#2a2d3a] rounded-lg text-slate-200 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="Min. 12 characters"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              className="w-full px-3 py-2 bg-[#0f1117] border border-[#2a2d3a] rounded-lg text-slate-200 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading || !username || !password || !confirm}
            className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Setting up...' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  )
}
