import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { DbConfig } from '../../types'
import { PageHeader, SectionCard, ServerError } from '../../components/settings/shared'
import { useSaveState } from '../../hooks/useSaveState'

export default function Notifications() {
  const [db, setDb]         = useState<DbConfig | null>(null)
  const [urls, setUrls]     = useState<string[]>([])
  const [loadError, setLoadError] = useState(false)
  const { saving, saved, wrap } = useSaveState()

  const load = () => {
    setLoadError(false)
    api.config.get().then((c) => {
      setDb(c.db)
      setUrls(c.db.notifications_apprise_urls)
    }).catch(() => setLoadError(true))
  }

  useEffect(load, [])

  if (loadError) return <ServerError onRetry={load} />

  const save = () => wrap(async () => {
    if (!db) return
    const result = await api.config.update({
      db: { notifications_apprise_urls: urls },
    }).catch(() => null)
    if (result) {
      setDb(result.db)
      setUrls(result.db.notifications_apprise_urls)
    }
  })

  if (!db) return <p className="text-slate-500 text-sm">Loading…</p>

  return (
    <div className="space-y-5 max-w-2xl">
      <PageHeader
        title="Notifications"
        description="Get notified when stuck downloads are removed or strikes are accumulated."
      />

      <SectionCard title="Apprise URLs">
        <div className="py-4 space-y-3">
          <p className="text-xs text-slate-400">
            Unstuckarr uses <span className="text-slate-300 font-medium">Apprise</span> for
            notifications — one URL per line. Supports 80+ services including Discord, Telegram,
            Slack, Ntfy, Pushover and more.
          </p>
          <textarea
            value={urls.join('\n')}
            onChange={(e) => setUrls(e.target.value.split('\n').filter(Boolean))}
            placeholder={'discord://webhook_id/token\nntfy://topic\ntelegram://token/chat_id'}
            rows={6}
            className="w-full px-3 py-2 text-sm font-mono bg-[var(--bg-base)] border border-[var(--bd)] rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 resize-none placeholder:text-slate-600"
          />
          <p className="text-xs text-slate-500">
            Full list of supported services:{' '}
            <a
              href="https://github.com/caronc/apprise/wiki"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300 underline"
            >
              apprise wiki
            </a>
          </p>
        </div>
      </SectionCard>

      <div>
        <button
          onClick={save}
          disabled={saving}
          className="px-5 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors font-medium disabled:opacity-50"
        >
          {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
