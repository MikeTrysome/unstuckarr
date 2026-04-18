import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity } from 'lucide-react'
import { api } from '../lib/api'
import { setToken } from '../lib/auth'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  // Redirect to setup if credentials have not been configured yet
  useEffect(() => {
    api.auth.status().then(({ configured }) => {
      if (!configured) navigate('/setup', { replace: true })
    }).catch(() => { /* ignore — backend may be starting */ })
  }, [navigate])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { token } = await api.auth.login(username.trim(), password)
      setToken(token)
      navigate('/')
    } catch {
      setError('Invalid username or password')
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
          <h1 className="text-base font-medium text-white">Sign in</h1>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              className="w-full px-3 py-2 bg-[#0f1117] border border-[#2a2d3a] rounded-lg text-slate-200 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="username"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full px-3 py-2 bg-[#0f1117] border border-[#2a2d3a] rounded-lg text-slate-200 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
