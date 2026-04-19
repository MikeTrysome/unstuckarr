import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { DbConfig } from '../../types'
import { NUMBER_CLS, PageHeader, SectionCard, ServerError, Tip, Toggle } from '../../components/settings/shared'
import { useSaveState } from '../../hooks/useSaveState'

type SpeedUnit = 'KB/s' | 'MB/s'

function toDisplaySpeed(kb: number, unit: SpeedUnit): number {
  return unit === 'MB/s' ? Math.round(kb / 1024 * 10) / 10 : kb
}

function toKb(value: number, unit: SpeedUnit): number {
  return unit === 'MB/s' ? Math.round(value * 1024) : value
}

export default function Detection() {
  const [db, setDb]         = useState<DbConfig | null>(null)
  const [draft, setDraft]   = useState<Partial<DbConfig>>({})
  const [loadError, setLoadError] = useState(false)
  const [speedUnit, setSpeedUnit] = useState<SpeedUnit>('KB/s')
  const { saving, saved, wrap } = useSaveState()

  const load = () => {
    setLoadError(false)
    api.config.get().then((c) => {
      setDb(c.db)
      setDraft({ ...c.db })
    }).catch(() => setLoadError(true))
  }

  useEffect(load, [])

  if (loadError) return <ServerError onRetry={load} />

  const save = () => wrap(async () => {
    if (!db) return
    const result = await api.config.update({ db: draft }).catch(() => null)
    if (result) {
      setDb(result.db)
      setDraft({ ...result.db })
    }
  })

  if (!db) return <p className="text-slate-500 text-sm">Loading…</p>

  const val = <K extends keyof DbConfig>(k: K) =>
    (draft[k] ?? db[k]) as DbConfig[K]

  const setVal = <K extends keyof DbConfig>(k: K, v: DbConfig[K]) =>
    setDraft((d) => ({ ...d, [k]: v }))

  const slowEnabled = val('detection_slow_speed_enabled') as boolean

  const monitoringModes = [
    {
      color: 'bg-red-500',
      label: 'Infringing file',
      desc: `removed after ${val('strikes_infringing_threshold')} strike(s) — permanent error, always blocklisted`,
    },
    {
      color: 'bg-amber-500',
      label: 'Task canceled',
      desc: `removed after ${val('strikes_canceled_threshold')} strike(s) — soft retry triggered on each strike`,
    },
    ...(slowEnabled ? [{
      color: 'bg-yellow-400',
      label: 'Slow download',
      desc: `below ${val('detection_slow_speed_threshold_kb')} KB/s — removed after ${val('strikes_slow_threshold')} strike(s), strikes auto-clear on recovery`,
    }] : []),
  ]

  return (
    <div className="space-y-5 max-w-2xl">
      <PageHeader
        title="Detection"
        description="Configure when and how stuck or slow downloads are detected and removed."
      />

      <SectionCard title="Monitoring overview">
        <p className="text-xs text-slate-500 pb-3 pt-1">
          What Unstuckarr actively monitors every {val('scheduler_interval_minutes')} minute(s).
        </p>
        <div className="space-y-2.5">
          {monitoringModes.map(({ color, label, desc }) => (
            <div key={label} className="flex items-start gap-3">
              <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${color}`} />
              <p className="text-sm">
                <span className="text-slate-300 font-medium">{label}</span>
                <span className="text-slate-500"> — {desc}</span>
              </p>
            </div>
          ))}
          {!slowEnabled && (
            <p className="text-xs text-slate-600 pt-1">
              Slow download detection is disabled — enable it below to monitor download speed.
            </p>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Scheduler">
        <div className="flex items-center justify-between py-2.5 border-b border-[var(--bd)]">
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-slate-400">Scheduler enabled</span>
            <Tip text="Run cleanup automatically on the configured interval." />
          </div>
          <Toggle checked={val('scheduler_enabled') as boolean}
            onChange={(v) => setVal('scheduler_enabled', v as never)} />
        </div>
        <div className="flex items-center justify-between py-2.5 border-b border-[var(--bd)] gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-slate-400">Interval (minutes)</span>
            <Tip text="How often Unstuckarr scans for stuck or slow downloads. Lower = faster response, higher = less overhead. Changes take effect immediately without restart." />
          </div>
          <input
            type="number" min={1} max={1440}
            value={val('scheduler_interval_minutes') as number}
            onChange={(e) => setVal('scheduler_interval_minutes', Number(e.target.value) as never)}
            className={NUMBER_CLS}
          />
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

      <SectionCard title="Error detection thresholds">
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

      <SectionCard title="Slow download detection">
        <div className="flex items-center justify-between py-2.5 border-b border-[var(--bd)]">
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-slate-400">Enable slow download detection</span>
            <Tip text="Detect downloads that are active but downloading below the configured speed threshold. These accumulate strikes just like error-based detections." />
          </div>
          <Toggle
            checked={slowEnabled}
            onChange={(v) => setVal('detection_slow_speed_enabled', v as never)}
          />
        </div>

        <div className={slowEnabled ? '' : 'opacity-40 pointer-events-none'}>
          {/* Speed threshold with unit toggle */}
          <div className="flex items-center justify-between py-2.5 border-b border-[var(--bd)] gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-slate-400">Speed threshold</span>
              <Tip text="Downloads below this speed are considered slow and will accumulate strikes. Switch between KB/s and MB/s using the unit button." />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0.1}
                step={speedUnit === 'MB/s' ? 0.1 : 100}
                value={toDisplaySpeed(val('detection_slow_speed_threshold_kb') as number, speedUnit)}
                onChange={(e) => setVal('detection_slow_speed_threshold_kb', toKb(Number(e.target.value), speedUnit) as never)}
                className={NUMBER_CLS}
              />
              <button
                type="button"
                onClick={() => setSpeedUnit((u) => u === 'KB/s' ? 'MB/s' : 'KB/s')}
                className="px-2 py-1 text-xs rounded border border-[var(--bd)] text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors w-14 text-center"
              >
                {speedUnit}
              </button>
            </div>
          </div>

          {[
            {
              key: 'detection_slow_speed_min_age_minutes' as keyof DbConfig,
              label: 'Grace period (min)',
              min: 1,
              tooltip: 'New downloads are not flagged as slow until they have been running for at least this many minutes. Prevents false positives during the initial connection phase.',
            },
            {
              key: 'strikes_slow_threshold' as keyof DbConfig,
              label: 'Slow download — strike threshold',
              min: 1,
              tooltip: 'Number of consecutive slow detections before a download is removed and re-queued. Default 3 = must be slow across 3 separate runs before removal.',
            },
          ].map(({ key, label, min, tooltip }) => (
            <div key={key} className="flex items-center justify-between py-2.5 border-b border-[var(--bd)] last:border-0 gap-4">
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-slate-400">{label}</span>
                <Tip text={tooltip} />
              </div>
              <input type="number" min={min} value={val(key) as number}
                onChange={(e) => setVal(key, Number(e.target.value) as never)}
                className={NUMBER_CLS} />
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-500 pt-2 pb-1">
          Strikes are automatically cleared when a download's speed recovers above the threshold — no manual action needed.
        </p>
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
