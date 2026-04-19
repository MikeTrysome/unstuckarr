import { useState } from 'react'

export function useSaveState() {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  const wrap = async (fn: () => Promise<unknown>) => {
    setSaving(true)
    await fn()
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return { saving, saved, wrap }
}
