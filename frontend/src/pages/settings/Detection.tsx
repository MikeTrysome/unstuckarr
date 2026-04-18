import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { DbConfig } from '../../types'
import { NUMBER_CLS, PageHeader, SectionCard, ServerError, Tip, Toggle } from '../../components/settings/shared'

export default function Detection() {
  const [db, setDb]         = useState<DbConfig | null>(null)
  const [draft, setDraft]   = useState<Partial<DbConfig>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [loadError, setLoadError] = useState(false)

  const load = () => {
    setLoadError(false)
    api.config.get().then((c) => {
      setDb(c.db)
      setDraft({ ...c.db })
    }).catch(() => setLoadError(true))
  }

  useEffect(load, [])

  if (loadError) return <ServerError onRetry={load} />

  const save = async () => {
    if (!db) return
    setSaving(true)
    const result = await api.config.update({ db: draft }).catch(() => null)
    if (result) {
      setDb(result.db)
      setDraft({ ...result.db })
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!db) return <p className="text-slate-500 text-sm">Loading…</p>

  const val = <K extends keyof DbConfig>(k: K) =>
    (draft[k] ?? db[k]) as DbConfig[K]

  const setVal = <K extends keyof DbConfig>(k: K, v: DbConfig[K]) =>
    setDraft((d) => ({ ...d, [k]: v }))

  return (
    <div className="space-y-5 max-w-2xl">
      <PageHeader
        title="Detection"
        description="Configure when and how stuck downloads are detected and removed."
      />

      {/* Scheduler */}
      <SectionCard title="Scheduler">
        <div className="flex items-center justify-between py-2.5 border-b border-[var(--bd)]">
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-slate-400">Scheduler enabled</span>
            <Tip text="Run cleanup automatically on the configured interval." />
          </div>
          <Toggle checked={val('scheduler_enabled') as boolean}
            onChange={(v) => setVal('scheduler_enabled', v as never)} />
        </div>
        <div className="flex items-center justify-between py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-slate-400">Dry run mode</span>
            <Tip text="Log stuck items but do not actually remove them from ARR." />
          </div>
          <Toggle checked={val('scheduler_dry_run') as boolean}
            onChange={(v) => setVal('scheduler_dry_run', v as never)} />
        </div>
      </SectionCard>

      {/* Thresholds */}
      <SectionCard title="Detection thresholds">
        {[
          {
            key: 'detection_infringing_min_age_minutes' as keyof DbConfig,
            label: 'Infringing file — min. age (min)',
            tooltip: 'A download must be at least this old before it is treated as permanently stuck due to an infringing file error.',
          },
          {
            key: 'detection_canceled_min_age_minutes' as keyof DbConfig,
            label: 'Task canceled — min. age (min)',
            tooltip: 'A download must be at least this old before a task-canceled error is treated as stuck (transient errors resolve faster).',
          },
          {
            key: 'detection_min_retry_count' as keyof DbConfig,
            label: 'Min. retry count (RDT)',
            tooltip: 'RDT-client must have retried the download at least this many times before Unstuckarr intervenes.',
          },
        ].map(({ key, label, tooltip }) => (
          <div key={key} className="flex items-center justify-between py-2.5 border-b border-[var(--bd)] last:border-0 gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-slate-400">{label}</span>
              <Tip text={tooltip} />
            </div>
            <input type="number" min={0} value={val(key) as number}
              onChange={(e) => setVal(key, Number(e.target.value) as never)}
              className={NUMBER_CLS} />
          </div>
        ))}
      </SectionCard>

      {/* Strikes */}
      <SectionCard title="Strikes">
        <div className="flex items-center justify-between py-2.5 border-b border-[var(--bd)]">
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-slate-400">Strikes enabled</span>
            <Tip text="When enabled, stuck downloads accumulate strikes across runs. Removal only happens once the threshold is reached. Prevents removing downloads that are only temporarily stuck." />
          </div>
          <Toggle checked={val('strikes_enabled') as boolean}
            onChange={(v) => setVal('strikes_enabled', v as never)} />
        </div>
        {[
          {
            key: 'strikes_infringing_threshold' as keyof DbConfig,
            label: 'Infringing file — strike threshold',
            tooltip: 'Number of strikes before an "infringing file" download is removed. Default 1 = remove on first detection (these errors are always permanent).',
          },
          {
            key: 'strikes_canceled_threshold' as keyof DbConfig,
            label: 'Task canceled — strike threshold',
            tooltip: 'Number of strikes before a "task canceled" download is removed. Default 3 = needs to be seen stuck across 3 separate runs before removal.',
          },
        ].map(({ key, label, tooltip }) => (
          <div key={key} className="flex items-center justify-between py-2.5 border-b border-[var(--bd)] last:border-0 gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-slate-400">{label}</span>
              <Tip text={tooltip} />
            </div>
            <input type="number" min={1} value={val(key) as number}
              onChange={(e) => setVal(key, Number(e.target.value) as never)}
              className={NUMBER_CLS} />
          </div>
        ))}
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
