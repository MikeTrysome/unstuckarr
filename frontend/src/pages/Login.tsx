import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity } from 'lucide-react'
import { api } from '../lib/api'
import { setToken } from '../lib/auth'

export default function Login() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { token } = await api.auth.login(password)
      setToken(token)
      navigate('/')
    } catch {
      setError('Ongeldig wachtwoord')
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
          <span className="text-xl font-semibold text-white">Unstackarr</span>
        </div>

        <form
          onSubmit={submit}
          className="bg-[#1a1d27] rounded-2xl border border-[#2a2d3a] p-6 space-y-4"
        >
          <h1 className="text-base font-medium text-white">Inloggen</h1>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Wachtwoord</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 bg-[#0f1117] border border-[#2a2d3a] rounded-lg text-slate-200 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Bezig...' : 'Inloggen'}
          </button>
        </form>
      </div>
    </div>
  )
}
