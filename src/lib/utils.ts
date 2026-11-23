import { format, formatDistanceToNow, parseISO } from 'date-fns'
import type { IssueType, Status, User, WorkItem } from '../types'
import { DONE_STATUSES } from '../types'

export const uid = (prefix = 'id') =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

export const nowIso = () => new Date().toISOString()

/** Current time helpers (kept outside components so render functions stay lint-pure). */
export const now = () => new Date()
export const nowMs = () => Date.now()

export const todayStr = () => format(new Date(), 'yyyy-MM-dd')

export const isDone = (s: Status) => DONE_STATUSES.includes(s)

export function fmtDate(d: string | null | undefined, pattern = 'dd MMM yyyy') {
  if (!d) return '—'
  try {
    return format(parseISO(d), pattern)
  } catch {
    return d
  }
}

export function timeAgo(d: string | null | undefined) {
  if (!d) return '—'
  try {
    return formatDistanceToNow(parseISO(d), { addSuffix: true })
  } catch {
    return d
  }
}

/** Parse Jira-like duration: "1w 2d 3h 30m" (1d = 8h, 1w = 5d). Returns minutes or null when invalid. */
export function parseDuration(input: string): number | null {
  const s = input.trim().toLowerCase()
  if (!s) return null
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(parseFloat(s) * 60)
  const re = /(\d+(?:\.\d+)?)\s*([wdhm])/g
  let total = 0
  let matched = ''
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    const n = parseFloat(m[1])
    const mult = m[2] === 'w' ? 2400 : m[2] === 'd' ? 480 : m[2] === 'h' ? 60 : 1
    total += n * mult
    matched += m[0]
  }
  if (matched.replace(/\s/g, '') !== s.replace(/\s/g, '')) return null
  return total > 0 ? Math.round(total) : null
}

export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return '0m'
  let rest = Math.round(minutes)
  const w = Math.floor(rest / 2400)
  rest -= w * 2400
  const d = Math.floor(rest / 480)
  rest -= d * 480
  const h = Math.floor(rest / 60)
  const m = rest - h * 60
  return [w && `${w}w`, d && `${d}d`, h && `${h}h`, m && `${m}m`].filter(Boolean).join(' ') || '0m'
}

export const initials = (name: string) =>
  name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

export const userName = (users: User[], id: string | null | undefined) =>
  id ? (users.find((u) => u.id === id)?.name ?? 'Unknown') : 'Unassigned'

/** Walk parentId until an Epic is found (Jira breadcrumb: Spaces / space / epic / work item). */
export function findEpicAncestor(items: WorkItem[], item: WorkItem | undefined): WorkItem | undefined {
  if (!item) return undefined
  let cur = items.find((i) => i.id === item.parentId)
  const seen = new Set<string>()
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    if (cur.type === 'Epic') return cur
    const nextId = cur.parentId
    cur = nextId ? items.find((i) => i.id === nextId) : undefined
  }
  return undefined
}

/** Allowed parent types (Jira): Epic → Task/Story/Bug; Task/Story/Bug → Subtask. */
export const ALLOWED_PARENTS: Record<IssueType, IssueType[]> = {
  Epic: [],
  Story: ['Epic'],
  Task: ['Epic'],
  Bug: ['Epic'],
  Subtask: ['Story', 'Task', 'Bug'],
}

export const STATUS_STYLE: Record<Status, string> = {
  'To Do': 'bg-slate-200 text-slate-700',
  'In Progress': 'bg-blue-100 text-blue-800',
  'Developers Done': 'bg-indigo-100 text-indigo-800',
  'QA-Done': 'bg-teal-100 text-teal-800',
  Done: 'bg-green-100 text-green-800',
  Reject: 'bg-red-100 text-red-700',
  'On Hold': 'bg-amber-100 text-amber-800',
  Drop: 'bg-zinc-200 text-zinc-600',
}

export const STATUS_COLOR: Record<Status, string> = {
  'To Do': '#94a3b8',
  'In Progress': '#1d7afc',
  'Developers Done': '#6366f1',
  'QA-Done': '#14b8a6',
  Done: '#22a06b',
  Reject: '#e2483d',
  'On Hold': '#f5a623',
  Drop: '#71717a',
}
