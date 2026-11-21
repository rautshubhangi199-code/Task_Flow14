import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  addMonths,
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  parseISO,
  startOfMonth,
} from 'date-fns'
import { AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock, FileSpreadsheet, Filter, RotateCcw, Settings, Share2, Table2, X } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useCurrentUser } from '../../store/hooks'
import { useProject } from './projectContext'
import { canSeeAllWorklogs } from '../../lib/permissions'
import { formatDuration, parseDuration, todayStr } from '../../lib/utils'
import { Avatar, Modal, ProjectIcon, TypeIcon } from '../../components/ui'
import { worklogService } from '../../services/api'
import type { Project, Sprint, User, WorkItem, WorkLog } from '../../types'
import clsx from 'clsx'

type Dim = 'none' | 'project' | 'user' | 'issue' | 'sprint'
type Period = 'day' | 'week' | 'month'

type Filters = {
  userId: string
  projectId: string
  sprintId: string
  from: string
  to: string
  period: Period
  categorize: Dim
  groupBy: Dim
  secondary: Dim
}

type SavedReport = { id: string; name: string; filters: Filters }

const DIM_OPTS: { value: Dim; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'project', label: 'Project' },
  { value: 'user', label: 'User' },
  { value: 'issue', label: 'Work item' },
  { value: 'sprint', label: 'Sprint' },
]

function ymd(d: Date) {
  return format(d, 'yyyy-MM-dd')
}

function parseDay(s: string) {
  return parseISO(s.length > 10 ? s : `${s}T00:00:00`)
}

function fmtCell(minutes: number) {
  return minutes ? formatDuration(minutes) : ''
}

function dimMeta(
  dim: Dim,
  w: WorkLog,
  byId: Map<string, WorkItem>,
  projects: Project[],
  users: User[],
  sprints: Sprint[],
): { key: string; node: ReactNode } {
  const item = byId.get(w.itemId)
  const proj = item ? projects.find((p) => p.id === item.projectId) : undefined
  const user = users.find((u) => u.id === w.userId)
  const sprint = item?.sprintId ? sprints.find((s) => s.id === item.sprintId) : undefined
  if (dim === 'none') return { key: 'all', node: <span className="text-slate-500">All</span> }
  if (dim === 'project') {
    return {
      key: proj?.id ?? 'unknown',
      node: (
        <span className="inline-flex items-center gap-1.5">
          <ProjectIcon icon={proj?.icon ?? '📁'} size={18} />
          <span className="truncate">{proj?.name ?? 'Unknown'}</span>
        </span>
      ),
    }
  }
  if (dim === 'user') {
    return {
      key: w.userId,
      node: (
        <span className="inline-flex items-center gap-1.5">
          <Avatar user={user} size={18} />
          <span className="truncate">{user?.name ?? 'Unknown'}</span>
        </span>
      ),
    }
  }
  if (dim === 'issue') {
    return {
      key: w.itemId,
      node: item ? (
        <Link to={`/browse/${item.id}`} className="inline-flex max-w-[220px] items-center gap-1.5 hover:underline">
          <TypeIcon type={item.type} size={14} />
          <span className="text-[#0c66e4]">{item.id}</span>
          <span className="truncate text-slate-700">{item.summary}</span>
        </Link>
      ) : (
        <span>{w.itemId}</span>
      ),
    }
  }
  return { key: sprint?.id ?? 'backlog', node: <span className="truncate">{sprint?.name ?? 'Backlog'}</span> }
}

function periodBuckets(from: string, to: string, period: Period) {
  const start = parseDay(from)
  const end = parseDay(to)
  if (end < start) return [] as { key: string; label: string; head: string; sub: string; start: Date; end: Date }[]
  if (period === 'week') {
    return eachWeekOfInterval({ start, end }, { weekStartsOn: 1 }).map((w) => {
      const s = start < w ? start : w
      const eRaw = endOfWeek(w, { weekStartsOn: 1 })
      const e = end < eRaw ? end : eRaw
      return { key: ymd(w), label: `${format(s, 'd MMM')} – ${format(e, 'd MMM')}`, head: format(s, 'd MMM'), sub: format(e, 'd MMM'), start: s, end: e }
    })
  }
  if (period === 'month') {
    return eachMonthOfInterval({ start, end }).map((m) => {
      const s = start > m ? start : m
      const eRaw = endOfMonth(m)
      const e = end < eRaw ? end : eRaw
      return { key: format(m, 'yyyy-MM'), label: format(m, 'MMM yyyy'), head: format(m, 'MMM'), sub: format(m, 'yyyy'), start: s, end: e }
    })
  }
  return eachDayOfInterval({ start, end }).map((d) => ({
    key: ymd(d),
    label: format(d, 'EEE d MMM'),
    head: format(d, 'EEE'),
    sub: format(d, 'd MMM'),
    start: d,
    end: d,
  }))
}

function inBucket(date: string, b: { start: Date; end: Date }) {
  const d = parseDay(date)
  return d >= b.start && d <= b.end
}

export default function Worklog() {
  const project = useProject()
  const me = useCurrentUser()
  const items = useStore((s) => s.items)
  const users = useStore((s) => s.users)
  const projects = useStore((s) => s.projects)
  const sprints = useStore((s) => s.sprints)
  const worklogs = useStore((s) => s.worklogs)
  const allowAll = canSeeAllWorklogs(me)
  const today = todayStr()
  const monthStart = ymd(startOfMonth(new Date()))
  const monthEnd = ymd(endOfMonth(new Date()))

  const defaults = (): Filters => ({
    userId: me?.id ?? '',
    projectId: project.id,
    sprintId: '',
    from: monthStart,
    to: monthEnd,
    period: 'day',
    categorize: 'project',
    groupBy: 'project',
    secondary: 'none',
  })

  const [draft, setDraft] = useState<Filters>(defaults)
  const [applied, setApplied] = useState<Filters>(defaults)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [saved, setSaved] = useState<SavedReport[]>([])
  const [chosen, setChosen] = useState('')
  const [logOpen, setLogOpen] = useState(false)
  const [logItem, setLogItem] = useState('')
  const [logDate, setLogDate] = useState(today)
  const [logTime, setLogTime] = useState('')
  const [logDesc, setLogDesc] = useState('')
  const [logErr, setLogErr] = useState('')
  const [shareMsg, setShareMsg] = useState('')
  const [saveName, setSaveName] = useState('')
  const [saving, setSaving] = useState(false)

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const projectItems = useMemo(
    () => items.filter((i) => (applied.projectId ? i.projectId === applied.projectId : i.projectId === project.id)),
    [items, applied.projectId, project.id],
  )
  const memberUsers = useMemo(() => {
    const ids = new Set(project.memberIds.concat(project.leadId))
    return users.filter((u) => ids.has(u.id))
  }, [users, project])
  const projectSprints = useMemo(() => sprints.filter((s) => s.projectId === (applied.projectId || project.id)), [sprints, applied.projectId, project.id])

  const buckets = useMemo(() => periodBuckets(applied.from, applied.to, applied.period), [applied.from, applied.to, applied.period])

  const filteredLogs = useMemo(() => {
    const ids = new Set(items.filter((i) => i.projectId === (applied.projectId || project.id)).map((i) => i.id))
    return worklogs.filter((w) => {
      if (!ids.has(w.itemId)) return false
      if (!allowAll && w.userId !== me?.id) return false
      if (applied.userId && w.userId !== applied.userId) return false
      if (w.date < applied.from || w.date > applied.to) return false
      if (applied.sprintId) {
        const it = byId.get(w.itemId)
        if (it?.sprintId !== applied.sprintId) return false
      }
      return true
    })
  }, [worklogs, items, applied, allowAll, me?.id, project.id, byId])

  const rows = useMemo(() => {
    const map = new Map<
      string,
      { catKey: string; grpKey: string; secKey: string; cat: ReactNode; grp: ReactNode; sec: ReactNode; days: Record<string, number>; total: number }
    >()
    for (const w of filteredLogs) {
      const cat = dimMeta(applied.categorize, w, byId, projects, users, sprints)
      const grp = dimMeta(applied.groupBy, w, byId, projects, users, sprints)
      const sec = dimMeta(applied.secondary, w, byId, projects, users, sprints)
      const id = `${cat.key}|${grp.key}|${sec.key}`
      let row = map.get(id)
      if (!row) {
        row = { catKey: cat.key, grpKey: grp.key, secKey: sec.key, cat: cat.node, grp: grp.node, sec: sec.node, days: {}, total: 0 }
        map.set(id, row)
      }
      row.total += w.minutes
      for (const b of buckets) {
        if (inBucket(w.date, b)) row.days[b.key] = (row.days[b.key] ?? 0) + w.minutes
      }
    }
    return [...map.values()].sort((a, b) => b.total - a.total)
  }, [filteredLogs, applied.categorize, applied.groupBy, applied.secondary, byId, projects, users, sprints, buckets])

  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize)
  const showSecondary = applied.secondary !== 'none'
  const todayBucket = buckets.find((b) => isSameDay(b.start, parseDay(today)) || (applied.period !== 'day' && parseDay(today) >= b.start && parseDay(today) <= b.end))

  const patchDraft = (p: Partial<Filters>) => setDraft((d) => ({ ...d, ...p }))

  const viewReport = () => {
    setApplied({ ...draft })
    setPage(1)
  }

  const shiftRange = (dir: -1 | 1) => {
    const from = addMonths(parseDay(draft.from), dir)
    const to = addMonths(parseDay(draft.to), dir)
    patchDraft({ from: ymd(from), to: ymd(to) })
  }

  const exportCsv = () => {
    const headers = [
      DIM_OPTS.find((d) => d.value === applied.categorize)?.label ?? 'Categorize',
      DIM_OPTS.find((d) => d.value === applied.groupBy)?.label ?? 'Group',
      ...(showSecondary ? [DIM_OPTS.find((d) => d.value === applied.secondary)?.label ?? 'Secondary'] : []),
      'Total',
      ...buckets.map((b) => b.label),
    ]
    const lines = [
      headers.join(','),
      ...rows.map((r) =>
        [
          `"${applied.categorize}"`,
          `"${applied.groupBy}"`,
          ...(showSecondary ? [`"${applied.secondary}"`] : []),
          formatDuration(r.total),
          ...buckets.map((b) => fmtCell(r.days[b.key] ?? 0)),
        ].join(','),
      ),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `worklogs-${project.key}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setShareMsg('Link copied')
      setTimeout(() => setShareMsg(''), 1600)
    } catch {
      setShareMsg('Could not copy')
    }
  }

  const saveReport = () => {
    const name = saveName.trim()
    if (!name) return
    const rec = { id: `r-${Date.now()}`, name, filters: { ...applied } }
    setSaved((s) => [...s, rec])
    setChosen(rec.id)
    setSaving(false)
    setSaveName('')
  }

  const loadReport = (id: string) => {
    setChosen(id)
    const rec = saved.find((s) => s.id === id)
    if (!rec) return
    setDraft(rec.filters)
    setApplied(rec.filters)
    setPage(1)
  }

  const openLog = (date?: string) => {
    setLogDate(date ?? today)
    setLogItem(projectItems.find((i) => i.type !== 'Epic')?.id ?? '')
    setLogTime('')
    setLogDesc('')
    setLogErr('')
    setLogOpen(true)
  }

  const submitLog = () => {
    const mins = parseDuration(logTime)
    if (!logItem) {
      setLogErr('Select a work item')
      return
    }
    if (!mins) {
      setLogErr('Enter time like 2h 15m')
      return
    }
    worklogService.add(logItem, logDate, mins, logDesc)
    setLogOpen(false)
  }

  const selectedUser = users.find((u) => u.id === draft.userId) ?? (draft.userId ? undefined : me)
  const selectedProject = projects.find((p) => p.id === draft.projectId) ?? project
  const jiraSelect = 'h-[32px] appearance-none rounded-[3px] border border-[#dfe1e6] bg-white bg-[length:12px] px-2 pr-7 text-[14px] text-[#172b4d] outline-none focus:border-[#4c9aff]'
  const jiraLabel = 'mb-0.5 text-[12px] text-[#6b778c]'
  const sortIcon = (
    <span className="ml-1 inline-flex flex-col leading-none text-[#6b778c]">
      <ChevronUp size={8} className="-mb-0.5" />
      <ChevronDown size={8} className="-mt-0.5" />
    </span>
  )

  return (
    <div className="bg-white px-5 py-3 text-[#172b4d]">
      <div className="mb-3 flex flex-nowrap items-center gap-x-3 overflow-x-auto">
        <h2 className="inline-flex items-center gap-2 text-[20px] font-medium">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#dfe1e6] text-[#2684ff]">
            <Clock size={16} />
          </span>
          Worklogs
        </h2>
        <button type="button" className="text-[14px] text-[#0052cc] hover:underline" onClick={() => setSaving(true)}>
          Save as a new report
        </button>
        <select className={clsx(jiraSelect, 'min-w-[200px]')} value={chosen} onChange={(e) => loadReport(e.target.value)}>
          <option value="">Choose your report...</option>
          {saved.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" className="inline-flex h-8 items-center gap-1 rounded-[3px] border border-[#dfe1e6] bg-white px-2 text-[13px] text-[#42526e]">
            <Table2 size={14} /> Table <ChevronDown size={12} />
          </button>
          <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-[3px] text-[#42526e] hover:bg-[#f4f5f7]" title="Settings">
            <Settings size={16} />
          </button>
          <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-[3px] text-[#36b37e] hover:bg-[#f4f5f7]" title="Export Excel" onClick={exportCsv}>
            <FileSpreadsheet size={16} />
          </button>
          <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-[3px] text-[#42526e] hover:bg-[#f4f5f7]" title="Share" onClick={() => void share()}>
            <Share2 size={16} />
          </button>
          <button
            type="button"
            className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-full bg-[#0c66e4] px-3.5 text-[13px] font-medium text-white hover:bg-[#0055cc]"
            onClick={() => openLog()}
          >
            <Clock size={14} /> Log time
          </button>
        </div>
      </div>
      {shareMsg && <div className="mb-2 text-xs text-emerald-700">{shareMsg}</div>}

      <div className="mb-4 flex items-start gap-3 rounded-[3px] border border-[#ffe2a8] bg-[#fffae6] px-4 py-3 text-[13px] text-[#172b4d]">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[#ff8b00]" fill="#ff8b00" stroke="#fff" />
        <p className="flex-1">
          <b>Your version of the Worklogs is out of date (6.8.0 or earlier).</b> To keep it working correctly and continue receiving fixes and
          performance improvements ask your Jira administrator to update the app
        </p>
        <a href="https://marketplace.atlassian.com/apps/1212652" target="_blank" rel="noreferrer" className="shrink-0 text-[#0052cc] hover:underline">
          Learn more
        </a>
      </div>

      <div className="mb-2 flex flex-nowrap items-end gap-x-6 overflow-x-auto">
        <div className="min-w-[180px]">
          <div className={jiraLabel}>User</div>
          <div className="relative flex h-8 items-center">
            <span className="inline-flex items-center gap-1.5 pr-2 text-[14px]">
              <Avatar user={selectedUser} size={24} />
              <span>{selectedUser?.name ?? 'All users'}</span>
            </span>
            {allowAll && (
              <select
                aria-label="User"
                className="absolute inset-0 cursor-pointer opacity-0"
                value={draft.userId}
                onChange={(e) => patchDraft({ userId: e.target.value })}
              >
                <option value="">All users</option>
                {memberUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        <div className="min-w-[200px]">
          <div className={jiraLabel}>Project or Filter</div>
          <div className="relative flex h-8 min-w-[200px] items-center gap-1 rounded-[3px] border border-[#dfe1e6] bg-white px-1.5">
            <span className="inline-flex items-center gap-1 rounded-[3px] bg-[#dfe1e6] px-1.5 py-0.5 text-[13px]">
              {selectedProject.name}
              <button type="button" className="text-[#6b778c] hover:text-[#172b4d]" onClick={() => patchDraft({ projectId: project.id })} aria-label="Clear project">
                <X size={12} />
              </button>
            </span>
            <Filter size={14} className="ml-auto shrink-0 text-[#6b778c]" />
            <select
              aria-label="Project or Filter"
              className="absolute inset-0 cursor-pointer opacity-0"
              value={draft.projectId}
              onChange={(e) => patchDraft({ projectId: e.target.value, sprintId: '' })}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="min-w-[140px]">
          <div className={jiraLabel}>Sprint</div>
          <select className={clsx(jiraSelect, 'w-full')} value={draft.sprintId} onChange={(e) => patchDraft({ sprintId: e.target.value })}>
            <option value="">None</option>
            {projectSprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className={jiraLabel}>Date range</div>
          <div className="flex h-8 items-center rounded-[3px] border border-[#dfe1e6] bg-white text-[13px]">
            <button type="button" className="px-1.5 text-[#42526e] hover:bg-[#f4f5f7]" onClick={() => shiftRange(-1)} aria-label="Previous range">
              <ChevronLeft size={16} />
            </button>
            <input type="date" className="w-[118px] border-0 bg-transparent text-[13px] outline-none" value={draft.from} onChange={(e) => patchDraft({ from: e.target.value })} />
            <span className="px-1 text-[#6b778c]">→</span>
            <input type="date" className="w-[118px] border-0 bg-transparent text-[13px] outline-none" value={draft.to} onChange={(e) => patchDraft({ to: e.target.value })} />
            <button type="button" className="px-1.5 text-[#42526e] hover:bg-[#f4f5f7]" onClick={() => shiftRange(1)} aria-label="Next range">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-nowrap items-end gap-x-5 overflow-x-auto">
        <div>
          <div className={jiraLabel}>Period grouping</div>
          <select className={clsx(jiraSelect, 'w-[88px]')} value={draft.period} onChange={(e) => patchDraft({ period: e.target.value as Period })}>
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </div>
        <div>
          <div className={jiraLabel}>Categorize by</div>
          <select className={clsx(jiraSelect, 'w-[120px]')} value={draft.categorize} onChange={(e) => patchDraft({ categorize: e.target.value as Dim })}>
            {DIM_OPTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className={jiraLabel}>Group by</div>
          <select className={clsx(jiraSelect, 'w-[120px]')} value={draft.groupBy} onChange={(e) => patchDraft({ groupBy: e.target.value as Dim })}>
            {DIM_OPTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className={jiraLabel}>Secondary Grouping</div>
          <select className={clsx(jiraSelect, 'w-[120px]')} value={draft.secondary} onChange={(e) => patchDraft({ secondary: e.target.value as Dim })}>
            {DIM_OPTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 pb-px">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#6b778c] hover:bg-[#f4f5f7]"
            title="Reset"
            onClick={() => {
              const d = defaults()
              setDraft(d)
              setApplied(d)
              setPage(1)
            }}
          >
            <RotateCcw size={16} />
          </button>
          <button
            type="button"
            className="h-8 rounded-[3px] border border-[#dfe1e6] bg-white px-3 text-[14px] text-[#42526e] hover:bg-[#f4f5f7]"
            onClick={viewReport}
          >
            View Report
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#f4f5f7] text-[12px] font-semibold text-[#6b778c]">
              <th className="sticky left-0 z-20 min-w-[160px] border-b border-[#dfe1e6] bg-[#f4f5f7] px-3 py-2 text-left">
                <span className="inline-flex items-center">{DIM_OPTS.find((d) => d.value === applied.categorize)?.label}{sortIcon}</span>
              </th>
              <th className="sticky left-[160px] z-20 min-w-[160px] border-b border-[#dfe1e6] bg-[#f4f5f7] px-3 py-2 text-left">
                <span className="inline-flex items-center">{DIM_OPTS.find((d) => d.value === applied.groupBy)?.label}{sortIcon}</span>
              </th>
              {showSecondary && (
                <th className="min-w-[140px] border-b border-[#dfe1e6] px-3 py-2 text-left">
                  <span className="inline-flex items-center">{DIM_OPTS.find((d) => d.value === applied.secondary)?.label}{sortIcon}</span>
                </th>
              )}
              <th className="sticky left-[320px] z-20 min-w-[96px] border-b border-[#dfe1e6] bg-[#e9d5ff] px-3 py-2 text-center text-[#172b4d]">
                <span className="inline-flex items-center justify-center">Total{sortIcon}</span>
              </th>
              {buckets.map((b) => (
                <th
                  key={b.key}
                  className={clsx(
                    'min-w-[78px] border-b border-[#dfe1e6] px-1 py-1.5 text-center font-semibold',
                    todayBucket?.key === b.key && 'bg-[#deebff] text-[#0052cc] shadow-[inset_0_0_0_2px_#4c9aff]',
                  )}
                >
                  <div className="leading-tight">
                    <div>{b.head}</div>
                    <div className="inline-flex items-center justify-center font-normal">
                      {b.sub}
                      {sortIcon}
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r, idx) => (
              <tr key={`${r.catKey}-${r.grpKey}-${r.secKey}-${idx}`} className="[&>td]:border-b-[3px] [&>td]:border-[#d8b4fe]">
                <td className="sticky left-0 z-10 bg-white px-3 py-2.5">{r.cat}</td>
                <td className="sticky left-[160px] z-10 bg-white px-3 py-2.5">{r.grp}</td>
                {showSecondary && <td className="bg-white px-3 py-2.5">{r.sec}</td>}
                <td className="sticky left-[320px] z-10 bg-[#f3e8ff] px-3 py-2.5 text-center font-medium">{fmtCell(r.total)}</td>
                {buckets.map((b) => (
                  <td
                    key={b.key}
                    className={clsx(
                      'cursor-pointer bg-white px-1 py-2.5 text-center',
                      todayBucket?.key === b.key && 'bg-[#deebff] shadow-[inset_0_0_0_2px_#4c9aff]',
                    )}
                    onClick={() => openLog(applied.period === 'day' ? b.key : ymd(b.start))}
                  >
                    {fmtCell(r.days[b.key] ?? 0)}
                  </td>
                ))}
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={3 + (showSecondary ? 1 : 0) + buckets.length} className="px-3 py-10 text-center text-[#6b778c]">
                  No worklogs for this report. Adjust filters and click View Report, or log time.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="relative mt-4 flex items-center justify-center text-[13px] text-[#6b778c]">
        <div className="flex items-center gap-1">
          <button type="button" className="px-1 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            ‹
          </button>
          <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-[3px] border border-[#4c9aff] text-[#0052cc]">{page}</span>
          <button type="button" className="px-1 disabled:opacity-40" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>
            ›
          </button>
        </div>
        <label className="absolute right-0 flex items-center gap-2">
          Show
          <select
            className={clsx(jiraSelect, 'w-[56px]')}
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setPage(1)
            }}
          >
            {[10, 25, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          entries
        </label>
      </div>

      <Modal
        open={saving}
        onClose={() => setSaving(false)}
        title="Save as a new report"
        footer={
          <>
            <button type="button" className="btn-default" onClick={() => setSaving(false)}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={saveReport}>
              Save
            </button>
          </>
        }
      >
        <label className="label">Report name</label>
        <input className="input" value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="My worklog report" />
      </Modal>

      <Modal
        open={logOpen}
        onClose={() => setLogOpen(false)}
        title="Log time"
        footer={
          <>
            <button type="button" className="btn-default" onClick={() => setLogOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={submitLog}>
              Log time
            </button>
          </>
        }
      >
        <div className="grid gap-3">
          <div>
            <label className="label">Work item</label>
            <select className="input" value={logItem} onChange={(e) => setLogItem(e.target.value)}>
              {projectItems.filter((i) => i.type !== 'Epic').map((i) => (
                <option key={i.id} value={i.id}>
                  {i.id} {i.summary}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date started</label>
              <input type="date" className="input" value={logDate} onChange={(e) => setLogDate(e.target.value)} />
            </div>
            <div>
              <label className="label">Time spent</label>
              <input className="input" placeholder="2h 15m" value={logTime} onChange={(e) => setLogTime(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Work description</label>
            <input className="input" value={logDesc} onChange={(e) => setLogDesc(e.target.value)} />
          </div>
          {logErr && <div className="text-sm text-red-600">{logErr}</div>}
        </div>
      </Modal>
    </div>
  )
}
