import type { NotificationType, NotifyChannel, PersonalSettings, SpaceNotificationSettings } from '../types'

export const LANGUAGES = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'hi-IN', label: 'हिन्दी (India)' },
  { value: 'de-DE', label: 'Deutsch' },
  { value: 'es-ES', label: 'Español' },
  { value: 'fr-FR', label: 'Français' },
  { value: 'ja-JP', label: '日本語' },
  { value: 'pt-BR', label: 'Português (Brasil)' },
] as const

export const TIME_ZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
]

const EVENT_DEFAULTS: Record<NotificationType, boolean> = {
  assigned: true,
  status: true,
  comment: true,
  due: true,
  overdue: true,
}

export function detectedTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export const on: NotifyChannel = { inProduct: true, email: true }

export function defaultSpaceNotification(projectId: string): SpaceNotificationSettings {
  return {
    projectId,
    assigned: { ...on },
    mentioned: { ...on },
    workItemChanges: { ...on },
    commentChanges: { ...on },
    worklog: { inProduct: false, email: true },
  }
}

export function defaultPersonalSettings(): PersonalSettings {
  return {
    language: 'en-US',
    timeZone: detectedTimeZone(),
    autoTimeZone: true,
    dateTimeFormat: 'relative',
    watchOwnIssues: true,
    notifyOwnChanges: false,
    keyboardShortcuts: true,
    emailEnabled: true,
    inAppEnabled: true,
    inApp: { ...EVENT_DEFAULTS },
    email: { ...EVENT_DEFAULTS },
    emailWhenAssignee: true,
    emailWhenReporter: true,
    groupEmails: true,
    groupEmailInterval: '3',
    emailFormat: 'html',
    mentioned: { ...on },
    worklog: { inProduct: false, email: true },
    spaceNotifications: [],
    digestDaily: false,
    digestWeekly: false,
  }
}

export function mergePersonalSettings(partial?: Partial<PersonalSettings> | null): PersonalSettings {
  const base = defaultPersonalSettings()
  if (!partial) return base
  return {
    ...base,
    ...partial,
    inApp: { ...base.inApp, ...partial.inApp },
    email: { ...base.email, ...partial.email },
    mentioned: { ...base.mentioned, ...partial.mentioned },
    worklog: { ...base.worklog, ...partial.worklog },
    spaceNotifications: partial.spaceNotifications ?? base.spaceNotifications,
    timeZone: partial.autoTimeZone !== false && (partial.autoTimeZone ?? base.autoTimeZone)
      ? detectedTimeZone()
      : partial.timeZone || base.timeZone,
  }
}

export const GROUP_INTERVALS: { value: PersonalSettings['groupEmailInterval']; label: string }[] = [
  { value: '1', label: 'Every 1 minute' },
  { value: '3', label: 'Every 3 minutes' },
  { value: '10', label: 'Every 10 minutes' },
  { value: '15', label: 'Every 15 minutes' },
  { value: '30', label: 'Every 30 minutes' },
  { value: '60', label: 'Every hour' },
]

export function formatInTimeZone(iso: string | null | undefined, settings: PersonalSettings, pattern: 'relative' | 'absolute' = settings.dateTimeFormat) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const timeZone = settings.autoTimeZone ? detectedTimeZone() : settings.timeZone
  if (pattern === 'relative') {
    const diff = Date.now() - date.getTime()
    const mins = Math.round(diff / 60000)
    if (Math.abs(mins) < 1) return 'just now'
    if (Math.abs(mins) < 60) return mins > 0 ? `${mins} minutes ago` : `in ${-mins} minutes`
    const hours = Math.round(mins / 60)
    if (Math.abs(hours) < 24) return hours > 0 ? `${hours} hours ago` : `in ${-hours} hours`
    const days = Math.round(hours / 24)
    if (Math.abs(days) < 7) return days > 0 ? `${days} days ago` : `in ${-days} days`
  }
  try {
    return new Intl.DateTimeFormat(settings.language, {
      timeZone,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date)
  } catch {
    return date.toISOString()
  }
}

export const NOTIFICATION_EVENTS: { type: NotificationType; label: string; hint: string }[] = [
  { type: 'assigned', label: 'Assigned to me', hint: 'When a work item is assigned to you' },
  { type: 'status', label: 'Status changes', hint: 'When a watched or assigned item changes status' },
  { type: 'comment', label: 'Comments', hint: 'When someone comments on your work' },
  { type: 'due', label: 'Due soon', hint: 'When an assigned item is due within 2 days' },
  { type: 'overdue', label: 'Overdue', hint: 'When an assigned item is past its due date' },
]
