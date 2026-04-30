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

interface StepperProps {
  value: number
  min?: number
  max?: number
  step: number
  onChange: (v: number) => void
  suffix?: string
}

function Stepper({ value, min = 0, max, step, onChange, suffix }: StepperProps) {
  const dec = () => onChange(Math.max(min, value - step))
  const inc = () => onChange(max !== undefined ? Math.min(max, value + step) : value + step)
  return (
    <div className="flex items-center">
      <div className="flex items-center border border-[var(--bd)] rounded-lg overflow-hidden bg-[var(--bg-base)]">
        <button type="button" onClick={dec}
          className="px-3 py-2 text-slate-400 hover:text-white hover:bg-white/5 transition-colors select-none">–</button>
        <input
          type="number" value={value} min={min} max={max}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-16 bg-transparent text-center text-sm text-slate-200 outline-none py-2"
        />
        <button type="button" onClick={inc}
          className="px-3 py-2 text-slate-400 hover:text-white hover:bg-white/5 transition-colors select-none">+</button>
      </div>
      {suffix && <span className="ml-2 text-xs text-slate-500">{suffix}</span>}
    </div>
  )
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
    {
      color: 'bg-orange-400',
      label: 'Stalled (0 seeders)',
      desc: `after ${val('detection_stalled_min_age_minutes')} min grace period — removed after ${val('strikes_stalled_threshold')} strike(s)`,
    },
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
          {/* Min Speed with stepper + unit toggle */}
          <div className="flex items-center justify-between py-2.5 border-b border-[var(--bd)] gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-slate-400">Min Speed</span>
              <Tip text="Downloads below this speed are considered slow and will accumulate strikes." />
            </div>
            <div className="flex items-center gap-2">
              <Stepper
                value={toDisplaySpeed(val('detection_slow_speed_threshold_kb') as number, speedUnit)}
                min={0}
                step={speedUnit === 'MB/s' ? 0.1 : 100}
                onChange={(v) => setVal('detection_slow_speed_threshold_kb', toKb(v, speedUnit) as never)}
              />
              <div className="flex rounded-lg overflow-hidden border border-[var(--bd)] text-xs">
                {(['KB/s', 'MB/s'] as SpeedUnit[]).map((u) => (
                  <button
                    key={u} type="button"
                    onClick={() => setSpeedUnit(u)}
                    className={`px-2.5 py-1.5 transition-colors ${speedUnit === u ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                  >{u}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Max Strikes */}
          <div className="flex items-center justify-between py-2.5 border-b border-[var(--bd)] gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-slate-400">Max Strikes</span>
              <Tip text="Number of consecutive slow detections before a download is removed and re-queued. Default 3 = must be slow across 3 separate runs before removal." />
            </div>
            <Stepper
              value={val('strikes_slow_threshold') as number}
              min={1} step={1}
              onChange={(v) => setVal('strikes_slow_threshold', v as never)}
            />
          </div>

          {/* Grace period */}
          <div className="flex items-center justify-between py-2.5 border-b border-[var(--bd)] gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-slate-400">Grace period (min)</span>
              <Tip text="New downloads are not flagged as slow until they have been running for at least this many minutes. Prevents false positives during the initial connection phase." />
            </div>
            <Stepper
              value={val('detection_slow_speed_min_age_minutes') as number}
              min={1} step={5}
              onChange={(v) => setVal('detection_slow_speed_min_age_minutes', v as never)}
              suffix="min"
            />
          </div>

          {/* Min / Max Completion % */}
          <div className="flex items-center justify-between py-2.5 border-b border-[var(--bd)] gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-slate-400">Min Completion %</span>
              <Tip text="Only flag downloads as slow once they have reached at least this completion percentage. 0 = from the start." />
            </div>
            <Stepper
              value={val('detection_slow_min_completion_pct') as number}
              min={0} max={100} step={5}
              onChange={(v) => setVal('detection_slow_min_completion_pct', v as never)}
              suffix="%"
            />
          </div>
          <div className="flex items-center justify-between py-2.5 border-b border-[var(--bd)] last:border-0 gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-slate-400">Max Completion %</span>
              <Tip text="Do not flag downloads that are already past this completion percentage — they are almost done. Default 95 = leave downloads that are 95%+ complete alone." />
            </div>
            <Stepper
              value={val('detection_slow_max_completion_pct') as number}
              min={0} max={100} step={5}
              onChange={(v) => setVal('detection_slow_max_completion_pct', v as never)}
              suffix="%"
            />
          </div>
        </div>

        <p className="text-xs text-slate-500 pt-2 pb-1">
          Strikes are automatically cleared when a download's speed recovers above the threshold — no manual action needed.
        </p>
      </SectionCard>

      <SectionCard title="Stalled download detection">
        <p className="text-xs text-slate-500 pb-3 pt-1">
          Detects torrents that RD cannot download because there are 0 seeders and no cached copy. Always active — configure the grace period and strike threshold below.
        </p>

        <div className="flex items-center justify-between py-2.5 border-b border-[var(--bd)] gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-slate-400">Grace period (min)</span>
            <Tip text="A torrent must have 0 seeders for at least this many minutes before the first strike is issued. Prevents acting on brief seeder gaps." />
          </div>
          <Stepper
            value={val('detection_stalled_min_age_minutes') as number}
            min={1} step={5}
            onChange={(v) => setVal('detection_stalled_min_age_minutes', v as never)}
            suffix="min"
          />
        </div>

        <div className="flex items-center justify-between py-2.5 border-b border-[var(--bd)] last:border-0 gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-slate-400">Max Strikes</span>
            <Tip text="Number of consecutive stalled detections before the download is removed and re-queued. With a 5-minute interval and 3 strikes, removal happens after ~15 minutes of being stalled." />
          </div>
          <Stepper
            value={val('strikes_stalled_threshold') as number}
            min={1} step={1}
            onChange={(v) => setVal('strikes_stalled_threshold', v as never)}
          />
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
