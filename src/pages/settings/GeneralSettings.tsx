import { useEffect, useState } from 'react'
import { personalSettingsService } from '../../services/api'
import { usePersonalSettings } from '../../store/hooks'
import { useUi } from '../../store/uiStore'
import { LANGUAGES, TIME_ZONES, detectedTimeZone, formatInTimeZone } from '../../lib/personalSettings'
import type { PersonalSettings } from '../../types'

export default function GeneralSettings() {
  const saved = usePersonalSettings()
  const showToast = useUi((s) => s.showToast)
  const [form, setForm] = useState<PersonalSettings>(saved)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setForm(saved), [saved])

  const patch = (p: Partial<PersonalSettings>) => setForm((f) => ({ ...f, ...p }))

  const onSave = async () => {
    setBusy(true)
    setError(null)
    try {
      if (!form.autoTimeZone && !TIME_ZONES.includes(form.timeZone) && !form.timeZone) {
        throw new Error('Choose a time zone.')
      }
      await personalSettingsService.update({
        language: form.language,
        timeZone: form.autoTimeZone ? detectedTimeZone() : form.timeZone,
        autoTimeZone: form.autoTimeZone,
        dateTimeFormat: form.dateTimeFormat,
        watchOwnIssues: form.watchOwnIssues,
        notifyOwnChanges: form.notifyOwnChanges,
        keyboardShortcuts: form.keyboardShortcuts,
      })
      document.documentElement.lang = form.language
      showToast('General settings saved')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save settings')
    } finally {
      setBusy(false)
    }
  }

  const preview = formatInTimeZone(new Date().toISOString(), form, form.dateTimeFormat)

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">General settings</h2>
        <p className="mt-1 text-sm text-slate-600">Manage language, time zone, and other personal preferences.</p>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div>
        <label className="label" htmlFor="language">Language</label>
        <select id="language" className="input" value={form.language} onChange={(e) => patch({ language: e.target.value })}>
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">Used for dates and this settings screen. Full product translation needs locale files from the backend.</p>
      </div>

      <div>
        <label className="label">Time zone</label>
        <label className="mb-2 flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={form.autoTimeZone} onChange={(e) => patch({ autoTimeZone: e.target.checked, timeZone: e.target.checked ? detectedTimeZone() : form.timeZone })} />
          Automatically detect time zone
        </label>
        <select
          className="input"
          disabled={form.autoTimeZone}
          value={form.timeZone}
          onChange={(e) => patch({ timeZone: e.target.value })}
        >
          {!TIME_ZONES.includes(form.timeZone) && <option value={form.timeZone}>{form.timeZone}</option>}
          {TIME_ZONES.map((z) => (
            <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="dtf">Date and time format</label>
        <select id="dtf" className="input" value={form.dateTimeFormat} onChange={(e) => patch({ dateTimeFormat: e.target.value as PersonalSettings['dateTimeFormat'] })}>
          <option value="relative">Relative (e.g. 2 hours ago)</option>
          <option value="absolute">Absolute (date and time in your time zone)</option>
        </select>
        <p className="mt-1 text-xs text-slate-500">Preview: {preview}</p>
      </div>

      <div className="space-y-3 rounded-lg border border-slate-200 p-4">
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input className="mt-0.5" type="checkbox" checked={form.watchOwnIssues} onChange={(e) => patch({ watchOwnIssues: e.target.checked })} />
          <span>
            <span className="font-medium">Watch your work items</span>
            <span className="block text-xs text-slate-500">Automatically watch items you create or that are assigned to you.</span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input className="mt-0.5" type="checkbox" checked={form.notifyOwnChanges} onChange={(e) => patch({ notifyOwnChanges: e.target.checked })} />
          <span>
            <span className="font-medium">Notify me of my own changes</span>
            <span className="block text-xs text-slate-500">In-app notifications for actions you perform yourself.</span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input className="mt-0.5" type="checkbox" checked={form.keyboardShortcuts} onChange={(e) => patch({ keyboardShortcuts: e.target.checked })} />
          <span>
            <span className="font-medium">Enable keyboard shortcuts</span>
            <span className="block text-xs text-slate-500">Press <kbd className="rounded bg-slate-100 px-1">?</kbd> for the shortcut list when this is on.</span>
          </span>
        </label>
      </div>

      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy} onClick={onSave}>{busy ? 'Saving…' : 'Save changes'}</button>
        <button className="btn-default" disabled={busy} onClick={() => { setForm(saved); setError(null) }}>Cancel</button>
      </div>
    </div>
  )
}
