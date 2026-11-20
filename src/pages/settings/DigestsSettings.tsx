import { personalSettingsService } from '../../services/api'
import { usePersonalSettings } from '../../store/hooks'
import { Switch } from './notificationUi'

export default function DigestsSettings() {
  const saved = usePersonalSettings()
  const setDaily = (on: boolean) => personalSettingsService.update({ digestDaily: on })
  const setWeekly = (on: boolean) => personalSettingsService.update({ digestWeekly: on })

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-1 text-sm text-slate-500">
        Personal settings / Digests /
      </div>
      <h1 className="text-2xl font-medium text-slate-800">Digests</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">
        Get a summary of activity in Jira instead of (or in addition to) individual emails.
      </p>
      <div className="mt-6 overflow-hidden rounded-lg border border-slate-200">
        <div className="flex items-center justify-between bg-slate-50 px-4 py-3">
          <div>
            <div className="text-sm font-medium text-slate-800">Daily digest</div>
            <div className="text-xs text-slate-500">One email each morning with work assigned to you and items due soon.</div>
          </div>
          <Switch checked={saved.digestDaily} onChange={setDaily} label="Daily digest" />
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
          <div>
            <div className="text-sm font-medium text-slate-800">Weekly digest</div>
            <div className="text-xs text-slate-500">A weekly summary of your spaces. Sending requires POST /users/me/notifications/email.</div>
          </div>
          <Switch checked={saved.digestWeekly} onChange={setWeekly} label="Weekly digest" />
        </div>
      </div>
    </div>
  )
}
