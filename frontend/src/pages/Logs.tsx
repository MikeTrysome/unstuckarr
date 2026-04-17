import { useWebSocket } from '../hooks/useWebSocket'

const LEVEL_COLORS: Record<string, string> = {
  INFO: 'text-slate-300',
  WARN: 'text-amber-400',
  WARNING: 'text-amber-400',
  ERROR: 'text-red-400',
  DEBUG: 'text-slate-500',
}

export default function Logs() {
  const { messages, connected, clear } = useWebSocket('/ws/logs')

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Live Logs</h1>
          <p className="text-sm text-slate-400 mt-0.5">Real-time log stream van de cleanup service</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs text-slate-400">{connected ? 'Verbonden' : 'Verbroken'}</span>
          </div>
          <button
            onClick={clear}
            className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
          >
            Wissen
          </button>
        </div>
      </div>

      <div className="flex-1 bg-[#1a1d27] rounded-xl border border-[#2a2d3a] overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-0.5">
          {messages.length === 0 ? (
            <p className="text-slate-500 text-center mt-8">
              Wachten op log berichten...
            </p>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className="flex gap-3 hover:bg-white/3 px-1 py-0.5 rounded">
                <span className="text-slate-600 shrink-0 w-20">{msg.ts?.slice(11, 19) ?? ''}</span>
                <span className={`shrink-0 w-12 font-medium ${LEVEL_COLORS[msg.level] ?? 'text-slate-400'}`}>
                  {msg.level}
                </span>
                <span className="text-slate-300 break-all">{msg.msg}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
