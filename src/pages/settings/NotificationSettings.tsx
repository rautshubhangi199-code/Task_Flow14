import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Folder, Info } from 'lucide-react'
import { personalSettingsService } from '../../services/api'
import { useAccessibleProjects, usePersonalSettings } from '../../store/hooks'
import { defaultSpaceNotification, GROUP_INTERVALS } from '../../lib/personalSettings'
import type { NotificationType, NotifyChannel, PersonalSettings, SpaceNotificationSettings } from '../../types'
import { Check, Switch } from './notificationUi'

type Patch = Partial<PersonalSettings>

export default function NotificationSettings() {
  const saved = usePersonalSettings()
  const projects = useAccessibleProjects()
  const [addOpen, setAddOpen] = useState(false)
  const [openChanges, setOpenChanges] = useState(false)
  const [openComments, setOpenComments] = useState(false)
  const [spaceOpen, setSpaceOpen] = useState<Record<string, { changes: boolean; comments: boolean }>>({})

  const persist = (patch: Patch) => personalSettingsService.update(patch)

  const emailOn = saved.emailEnabled
  const inAppOn = saved.inAppEnabled

  const setInApp = (type: NotificationType, on: boolean) => persist({ inApp: { ...saved.inApp, [type]: on } })
  const setEmail = (type: NotificationType, on: boolean) => persist({ email: { ...saved.email, [type]: on } })

  const allInProduct = saved.inApp.assigned && saved.mentioned.inProduct
  const allEmail = saved.email.assigned && saved.mentioned.email
  const relevantInProduct = saved.inApp.status && saved.inApp.comment && saved.inApp.due && saved.inApp.overdue
  const relevantEmail = saved.email.status && saved.email.comment && saved.email.due && saved.email.overdue && saved.worklog.email

  const setAllGroup = (channel: 'inProduct' | 'email', on: boolean) => {
    if (channel === 'inProduct') {
      persist({ inApp: { ...saved.inApp, assigned: on }, mentioned: { ...saved.mentioned, inProduct: on } })
    } else {
      persist({ email: { ...saved.email, assigned: on }, mentioned: { ...saved.mentioned, email: on } })
    }
  }

  const setRelevantGroup = (channel: 'inProduct' | 'email', on: boolean) => {
    if (channel === 'inProduct') {
      persist({
        inApp: { ...saved.inApp, status: on, comment: on, due: on, overdue: on },
        worklog: { ...saved.worklog, inProduct: on },
      })
    } else {
      persist({
        email: { ...saved.email, status: on, comment: on, due: on, overdue: on },
        worklog: { ...saved.worklog, email: on },
      })
    }
  }

  const unusedSpaces = useMemo(
    () => projects.filter((p) => !saved.spaceNotifications.some((s) => s.projectId === p.id)),
    [projects, saved.spaceNotifications],
  )

  const addSpace = (projectId: string) => {
    persist({ spaceNotifications: [...saved.spaceNotifications, defaultSpaceNotification(projectId)] })
    setAddOpen(false)
  }

  const updateSpace = (projectId: string, next: SpaceNotificationSettings) => {
    persist({ spaceNotifications: saved.spaceNotifications.map((s) => (s.projectId === projectId ? next : s)) })
  }

  const removeSpace = (projectId: string) => {
    persist({ spaceNotifications: saved.spaceNotifications.filter((s) => s.projectId !== projectId) })
  }

  return (
    <div className="mx-auto max-w-3xl pb-16">
      <div className="mb-1 text-sm text-slate-500">Personal settings / Emails and notifications /</div>
      <h1 className="text-2xl font-medium text-slate-800">Emails and notifications</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">
        Control when you receive email or in-app notifications from Jira. You can change these settings at any time.{' '}
        <a className="text-brand-700 hover:underline" href="https://support.atlassian.com/jira-software-cloud/docs/manage-your-jira-notifications/" target="_blank" rel="noreferrer">
          More about managing notifications
        </a>
      </p>

      <h2 className="mt-8 text-sm font-semibold text-slate-800">Email preferences</h2>
      <p className="mt-1 text-sm text-slate-600">
        Tell us what kind of email updates you want to receive, and how often we should send you notifications via email.
      </p>

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
        <div className="flex items-center justify-between bg-slate-50 px-4 py-3">
          <div className="text-sm font-medium text-slate-800">Send me emails for work item activity</div>
          <Switch checked={saved.emailEnabled} onChange={(v) => persist({ emailEnabled: v })} label="Send me emails for work item activity" />
        </div>
        <div className="px-4 py-3">
          <div className="mb-2 text-sm text-slate-700">Receive emails when:</div>
          <label className="mb-1.5 flex items-center gap-2 text-sm text-slate-700">
            <Check checked={saved.emailWhenAssignee} disabled={!emailOn} onChange={(v) => persist({ emailWhenAssignee: v })} label="You're the assignee" />
            You're the assignee
          </label>
          <label className="mb-1.5 flex items-center gap-2 text-sm text-slate-700">
            <Check checked={saved.emailWhenReporter} disabled={!emailOn} onChange={(v) => persist({ emailWhenReporter: v })} label="You're the reporter" />
            You're the reporter
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <Check checked={saved.notifyOwnChanges} disabled={!emailOn} onChange={(v) => persist({ notifyOwnChanges: v })} label="You make changes to work items" />
            You make changes to work items
          </label>
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
        <div className="flex items-center justify-between bg-slate-50 px-4 py-3">
          <div className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
            Group notification emails together
            <span title="We’ll wait a short time and send one email per work item instead of one email per event.">
              <Info size={14} className="text-slate-400" />
            </span>
          </div>
          <Switch checked={saved.groupEmails} onChange={(v) => persist({ groupEmails: v })} label="Group notification emails together" />
        </div>
        <div className="px-4 py-3">
          <p className="mb-2 text-sm text-slate-600">
            We'll group together notifications for the same work items into one email. How often do you want to receive these?
          </p>
          <select
            className="input max-w-xs"
            disabled={!saved.groupEmails || !emailOn}
            value={saved.groupEmailInterval}
            onChange={(e) => persist({ groupEmailInterval: e.target.value as PersonalSettings['groupEmailInterval'] })}
          >
            {GROUP_INTERVALS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
        <div className="bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800">Email format</div>
        <div className="px-4 py-3">
          <div className="mb-2 text-sm text-slate-700">How do you like your emails?</div>
          <label className="mb-1.5 flex items-center gap-2 text-sm text-slate-700">
            <input type="radio" name="emailFormat" checked={saved.emailFormat === 'html'} disabled={!emailOn} onChange={() => persist({ emailFormat: 'html' })} />
            HTML
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="radio" name="emailFormat" checked={saved.emailFormat === 'text'} disabled={!emailOn} onChange={() => persist({ emailFormat: 'text' })} />
            Text
          </label>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">Email is queued from these preferences. Sending mail requires POST /users/me/notifications/email.</p>

      <div className="mt-10 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Customize space notifications</h2>
          <p className="mt-1 text-sm text-slate-600">Make your notifications specific to your space needs. Choose a space to set customized notifications.</p>
        </div>
        <div className="relative shrink-0">
          <button className="btn-default" onClick={() => setAddOpen((o) => !o)}>Add space notifications</button>
          {addOpen && (
            <div className="absolute right-0 z-20 mt-1 w-64 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
              {unusedSpaces.length === 0 && <div className="px-3 py-2 text-sm text-slate-500">All spaces already have custom settings</div>}
              {unusedSpaces.map((p) => (
                <button key={p.id} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-50" onClick={() => addSpace(p.id)}>
                  <span>{p.icon}</span> {p.name} <span className="text-xs text-slate-400">{p.key}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {saved.spaceNotifications.length === 0 ? (
        <div className="mt-4 flex items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 px-6 py-8">
          <Folder size={48} className="shrink-0 text-sky-400" strokeWidth={1.25} />
          <div>
            <div className="text-sm font-medium text-slate-800">Choose a space to get started</div>
            <div className="text-sm text-slate-500">Don't want to apply default notifications to all your spaces? Customize their notification settings.</div>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {saved.spaceNotifications.map((sp) => {
            const project = projects.find((p) => p.id === sp.projectId)
            const open = spaceOpen[sp.projectId] ?? { changes: false, comments: false }
            return (
              <div key={sp.projectId} className="rounded-lg border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2">
                  <div className="text-sm font-medium">{project ? `${project.icon} ${project.name}` : sp.projectId}</div>
                  <button className="text-sm text-brand-700 hover:underline" onClick={() => removeSpace(sp.projectId)}>Remove</button>
                </div>
                <SpaceTable
                  value={sp}
                  emailDisabled={!emailOn}
                  inAppDisabled={!inAppOn}
                  openChanges={open.changes}
                  openComments={open.comments}
                  onToggleChanges={() => setSpaceOpen((s) => ({ ...s, [sp.projectId]: { ...open, changes: !open.changes } }))}
                  onToggleComments={() => setSpaceOpen((s) => ({ ...s, [sp.projectId]: { ...open, comments: !open.comments } }))}
                  onChange={(next) => updateSpace(sp.projectId, next)}
                />
              </div>
            )
          })}
        </div>
      )}

      <h2 className="mt-10 text-sm font-semibold text-slate-800">Default notifications</h2>
      <p className="mt-1 text-sm text-slate-600">
        Default notification settings apply across your spaces. These can be overridden by your email preferences, or by custom space notifications settings. If you have turned off emails for work items in the Emails section, you won't be able to turn on email notifications here.
      </p>

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
        <GroupHeader
          title="Notifications for all work items"
          inProduct={allInProduct}
          email={allEmail}
          emailDisabled={!emailOn}
          inAppDisabled={!inAppOn}
          onInProduct={(v) => setAllGroup('inProduct', v)}
          onEmail={(v) => setAllGroup('email', v)}
        />
        <Row label="You're assigned to a work item" inProduct={saved.inApp.assigned} email={saved.email.assigned} emailDisabled={!emailOn} inAppDisabled={!inAppOn} onInProduct={(v) => setInApp('assigned', v)} onEmail={(v) => setEmail('assigned', v)} />
        <Row label="You're mentioned on a work item" inProduct={saved.mentioned.inProduct} email={saved.mentioned.email} emailDisabled={!emailOn} inAppDisabled={!inAppOn} onInProduct={(v) => persist({ mentioned: { ...saved.mentioned, inProduct: v } })} onEmail={(v) => persist({ mentioned: { ...saved.mentioned, email: v } })} />

        <GroupHeader
          title="Notifications for relevant work items"
          info="Relevant items are ones you watch, are assigned, reported, or voted on."
          inProduct={relevantInProduct}
          email={relevantEmail}
          emailDisabled={!emailOn}
          inAppDisabled={!inAppOn}
          onInProduct={(v) => setRelevantGroup('inProduct', v)}
          onEmail={(v) => setRelevantGroup('email', v)}
        />
        <ExpandRow open={openChanges} onToggle={() => setOpenChanges((o) => !o)} label="Changes to work items" inProduct={saved.inApp.status && saved.inApp.due && saved.inApp.overdue} email={saved.email.status && saved.email.due && saved.email.overdue} emailDisabled={!emailOn} inAppDisabled={!inAppOn} onInProduct={(v) => persist({ inApp: { ...saved.inApp, status: v, due: v, overdue: v } })} onEmail={(v) => persist({ email: { ...saved.email, status: v, due: v, overdue: v } })} />
        {openChanges && (
          <>
            <Row nested label="Status changes" inProduct={saved.inApp.status} email={saved.email.status} emailDisabled={!emailOn} inAppDisabled={!inAppOn} onInProduct={(v) => setInApp('status', v)} onEmail={(v) => setEmail('status', v)} />
            <Row nested label="Due soon" inProduct={saved.inApp.due} email={saved.email.due} emailDisabled={!emailOn} inAppDisabled={!inAppOn} onInProduct={(v) => setInApp('due', v)} onEmail={(v) => setEmail('due', v)} />
            <Row nested label="Overdue" inProduct={saved.inApp.overdue} email={saved.email.overdue} emailDisabled={!emailOn} inAppDisabled={!inAppOn} onInProduct={(v) => setInApp('overdue', v)} onEmail={(v) => setEmail('overdue', v)} />
          </>
        )}
        <ExpandRow open={openComments} onToggle={() => setOpenComments((o) => !o)} label="Changes to comments on work items" inProduct={saved.inApp.comment} email={saved.email.comment} emailDisabled={!emailOn} inAppDisabled={!inAppOn} onInProduct={(v) => setInApp('comment', v)} onEmail={(v) => setEmail('comment', v)} />
        {openComments && (
          <Row nested label="A comment is added or edited" inProduct={saved.inApp.comment} email={saved.email.comment} emailDisabled={!emailOn} inAppDisabled={!inAppOn} onInProduct={(v) => setInApp('comment', v)} onEmail={(v) => setEmail('comment', v)} />
        )}
        <Row label="A work log is created, edited, or deleted" inProduct={saved.worklog.inProduct} email={saved.worklog.email} emailDisabled={!emailOn} inAppDisabled={!inAppOn} onInProduct={(v) => persist({ worklog: { ...saved.worklog, inProduct: v } })} onEmail={(v) => persist({ worklog: { ...saved.worklog, email: v } })} />
      </div>
    </div>
  )
}

function GroupHeader({ title, info, inProduct, email, emailDisabled, inAppDisabled, onInProduct, onEmail }: {
  title: string
  info?: string
  inProduct: boolean
  email: boolean
  emailDisabled: boolean
  inAppDisabled: boolean
  onInProduct: (v: boolean) => void
  onEmail: (v: boolean) => void
}) {
  return (
    <div className="grid grid-cols-[1fr_88px_72px] items-center border-b border-slate-200 bg-slate-50 px-4 py-2 text-sm">
      <div className="flex items-center gap-1 font-medium text-slate-800">
        {title}
        {info && <span title={info}><Info size={14} className="text-slate-400" /></span>}
      </div>
      <label className="flex items-center justify-end gap-1.5 text-xs text-slate-600">
        <Check checked={inProduct} disabled={inAppDisabled} onChange={onInProduct} label={`${title} in product`} /> In product
      </label>
      <label className="flex items-center justify-end gap-1.5 text-xs text-slate-600">
        <Check checked={email} disabled={emailDisabled} onChange={onEmail} label={`${title} email`} /> Email
      </label>
    </div>
  )
}

function Row({ label, nested, inProduct, email, emailDisabled, inAppDisabled, onInProduct, onEmail }: {
  label: string
  nested?: boolean
  inProduct: boolean
  email: boolean
  emailDisabled: boolean
  inAppDisabled: boolean
  onInProduct: (v: boolean) => void
  onEmail: (v: boolean) => void
}) {
  return (
    <div className="grid grid-cols-[1fr_88px_72px] items-center border-b border-slate-100 px-4 py-2.5 text-sm last:border-b-0">
      <div className={nested ? 'pl-7 text-slate-700' : 'text-slate-700'}>{label}</div>
      <div className="flex justify-end pr-6">
        <Check checked={inProduct} disabled={inAppDisabled} onChange={onInProduct} label={`${label} in product`} />
      </div>
      <div className="flex justify-end pr-5">
        <Check checked={email} disabled={emailDisabled} onChange={onEmail} label={`${label} email`} />
      </div>
    </div>
  )
}

function ExpandRow({ open, onToggle, label, inProduct, email, emailDisabled, inAppDisabled, onInProduct, onEmail }: {
  open: boolean
  onToggle: () => void
  label: string
  inProduct: boolean
  email: boolean
  emailDisabled: boolean
  inAppDisabled: boolean
  onInProduct: (v: boolean) => void
  onEmail: (v: boolean) => void
}) {
  return (
    <div className="grid grid-cols-[1fr_88px_72px] items-center border-b border-slate-100 px-4 py-2.5 text-sm">
      <button type="button" className="flex items-center gap-1 text-left text-slate-700" onClick={onToggle}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        {label}
      </button>
      <div className="flex justify-end pr-6">
        <Check checked={inProduct} disabled={inAppDisabled} onChange={onInProduct} label={`${label} in product`} />
      </div>
      <div className="flex justify-end pr-5">
        <Check checked={email} disabled={emailDisabled} onChange={onEmail} label={`${label} email`} />
      </div>
    </div>
  )
}

function SpaceTable({ value, emailDisabled, inAppDisabled, openChanges, openComments, onToggleChanges, onToggleComments, onChange }: {
  value: SpaceNotificationSettings
  emailDisabled: boolean
  inAppDisabled: boolean
  openChanges: boolean
  openComments: boolean
  onToggleChanges: () => void
  onToggleComments: () => void
  onChange: (next: SpaceNotificationSettings) => void
}) {
  const set = (key: keyof Omit<SpaceNotificationSettings, 'projectId'>, ch: NotifyChannel) => onChange({ ...value, [key]: ch })
  const allIn = value.assigned.inProduct && value.mentioned.inProduct
  const allEm = value.assigned.email && value.mentioned.email
  const relIn = value.workItemChanges.inProduct && value.commentChanges.inProduct
  const relEm = value.workItemChanges.email && value.commentChanges.email && value.worklog.email
  return (
    <div>
      <GroupHeader title="Notifications for all work items" inProduct={allIn} email={allEm} emailDisabled={emailDisabled} inAppDisabled={inAppDisabled} onInProduct={(v) => onChange({ ...value, assigned: { ...value.assigned, inProduct: v }, mentioned: { ...value.mentioned, inProduct: v } })} onEmail={(v) => onChange({ ...value, assigned: { ...value.assigned, email: v }, mentioned: { ...value.mentioned, email: v } })} />
      <Row label="You're assigned to a work item" inProduct={value.assigned.inProduct} email={value.assigned.email} emailDisabled={emailDisabled} inAppDisabled={inAppDisabled} onInProduct={(v) => set('assigned', { ...value.assigned, inProduct: v })} onEmail={(v) => set('assigned', { ...value.assigned, email: v })} />
      <Row label="You're mentioned on a work item" inProduct={value.mentioned.inProduct} email={value.mentioned.email} emailDisabled={emailDisabled} inAppDisabled={inAppDisabled} onInProduct={(v) => set('mentioned', { ...value.mentioned, inProduct: v })} onEmail={(v) => set('mentioned', { ...value.mentioned, email: v })} />
      <GroupHeader title="Notifications for relevant work items" info="Relevant items are ones you watch, are assigned, reported, or voted on." inProduct={relIn} email={relEm} emailDisabled={emailDisabled} inAppDisabled={inAppDisabled} onInProduct={(v) => onChange({ ...value, workItemChanges: { ...value.workItemChanges, inProduct: v }, commentChanges: { ...value.commentChanges, inProduct: v }, worklog: { ...value.worklog, inProduct: v } })} onEmail={(v) => onChange({ ...value, workItemChanges: { ...value.workItemChanges, email: v }, commentChanges: { ...value.commentChanges, email: v }, worklog: { ...value.worklog, email: v } })} />
      <ExpandRow open={openChanges} onToggle={onToggleChanges} label="Changes to work items" inProduct={value.workItemChanges.inProduct} email={value.workItemChanges.email} emailDisabled={emailDisabled} inAppDisabled={inAppDisabled} onInProduct={(v) => set('workItemChanges', { ...value.workItemChanges, inProduct: v })} onEmail={(v) => set('workItemChanges', { ...value.workItemChanges, email: v })} />
      {openChanges && <Row nested label="Field and status updates" inProduct={value.workItemChanges.inProduct} email={value.workItemChanges.email} emailDisabled={emailDisabled} inAppDisabled={inAppDisabled} onInProduct={(v) => set('workItemChanges', { ...value.workItemChanges, inProduct: v })} onEmail={(v) => set('workItemChanges', { ...value.workItemChanges, email: v })} />}
      <ExpandRow open={openComments} onToggle={onToggleComments} label="Changes to comments on work items" inProduct={value.commentChanges.inProduct} email={value.commentChanges.email} emailDisabled={emailDisabled} inAppDisabled={inAppDisabled} onInProduct={(v) => set('commentChanges', { ...value.commentChanges, inProduct: v })} onEmail={(v) => set('commentChanges', { ...value.commentChanges, email: v })} />
      {openComments && <Row nested label="A comment is added or edited" inProduct={value.commentChanges.inProduct} email={value.commentChanges.email} emailDisabled={emailDisabled} inAppDisabled={inAppDisabled} onInProduct={(v) => set('commentChanges', { ...value.commentChanges, inProduct: v })} onEmail={(v) => set('commentChanges', { ...value.commentChanges, email: v })} />}
      <Row label="A work log is created, edited, or deleted" inProduct={value.worklog.inProduct} email={value.worklog.email} emailDisabled={emailDisabled} inAppDisabled={inAppDisabled} onInProduct={(v) => set('worklog', { ...value.worklog, inProduct: v })} onEmail={(v) => set('worklog', { ...value.worklog, email: v })} />
    </div>
  )
}
