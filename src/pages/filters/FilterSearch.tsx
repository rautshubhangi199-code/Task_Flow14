import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Check,
  ChevronDown,
  Columns3,
  Copy,
  Ellipsis,
  MessageSquare,
  Search,
  Sparkles,
  Star,
  User,
  X,
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useAccessibleItems, useAccessibleProjects, useCurrentUser } from '../../store/hooks'
import { canAccessSettings } from '../../lib/permissions'
import { useUi } from '../../store/uiStore'
import { filterService, workItemService } from '../../services/api'
import { DEFAULT_FILTERS, JqlError, quoteValue, runJql, sortItems, type SortSpec } from '../../lib/jql'
import { useJqlContext } from '../../lib/useJqlContext'
import { fmtDate, isDone, STATUS_STYLE, timeAgo, userName } from '../../lib/utils'
import { ISSUE_TYPES, PRIORITIES, STATUSES, type Priority, type Status } from '../../types'
import { Avatar, Dropdown, MenuItem, Modal, PriorityIcon, TypeIcon } from '../../components/ui'
import { StatusDropdown } from '../../components/StatusDropdown'

const MORE_FIELDS = [
  { id: 'timeSpent', label: 'Time spent' },
  { id: 'subtask', label: 'Subtask' },
  { id: 'storyPoints', label: 'Story point estimate' },
  { id: 'startDate', label: 'Start date' },
  { id: 'endDate', label: 'End date' },
  { id: 'sprint', label: 'Sprint' },
  { id: 'reporter', label: 'Reporter' },
  { id: 'priority', label: 'Priority' },
  { id: 'parent', label: 'Parent' },
  { id: 'creator', label: 'Creator' },
  { id: 'created', label: 'Created' },
] as const

type MoreField = (typeof MORE_FIELDS)[number]['id']

function Chip({
  label,
  value,
  open,
  children,
}: {
  label: string
  value?: string
  open?: boolean
  children: (close: () => void) => ReactNode
}) {
  const on = Boolean(value) || open
  return (
    <Dropdown
      trigger={(isOpen) => (
        <button
          type="button"
          className={clsx(
            'inline-flex h-8 shrink-0 items-center gap-1 rounded-md border px-2.5 text-[13px]',
            on || isOpen ? 'border-[#0c66e4] bg-[#e9f2ff] text-[#0c66e4]' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
          )}
        >
          {value ? `${label}: ${value}` : label}
          <ChevronDown size={14} />
        </button>
      )}
    >
      {children}
    </Dropdown>
  )
}

export default function FilterSearch() {
  const [params] = useSearchParams()
  const loc = useLocation()
  return <FilterSearchInner key={loc.pathname + loc.search} params={params} isAll={loc.pathname === '/filters/all'} />
}

function FilterSearchInner({ params, isAll }: { params: URLSearchParams; isAll: boolean }) {
  const me = useCurrentUser()!
  const isAdmin = canAccessSettings(me)
  const navigate = useNavigate()
  const items = useAccessibleItems()
  const projects = useAccessibleProjects()
  const users = useStore((s) => s.users)
  const sprints = useStore((s) => s.sprints)
  const worklogs = useStore((s) => s.worklogs)
  const savedFilters = useStore((s) => s.savedFilters)
  const showToast = useUi((s) => s.showToast)
  const ctx = useJqlContext()

  const saved = savedFilters.find((f) => f.id === params.get('filter'))
  const def = DEFAULT_FILTERS.find((f) => f.id === params.get('default'))
  const initialJql = saved?.jql ?? def?.jql ?? params.get('jql') ?? ''
  const title = isAll ? 'All work items' : saved?.name ?? def?.name ?? 'Search work items'

  const [mode, setMode] = useState<'basic' | 'jql'>(initialJql ? 'jql' : 'basic')
  const [text, setText] = useState(initialJql)
  const [applied, setApplied] = useState(initialJql)
  const [basic, setBasic] = useState({
    project: '',
    assignee: '',
    type: '',
    status: '',
    text: '',
    priority: '',
    reporter: '',
    labels: '',
    parent: '',
    timeSpent: '',
    subtask: '',
    storyPoints: '',
    startDate: '',
    endDate: '',
    sprint: '',
    creator: '',
    created: '',
  })
  const [moreFields, setMoreFields] = useState<MoreField[]>([])
  const [sort, setSort] = useState<SortSpec | null>({ field: 'created', dir: 'desc' })
  const [page, setPage] = useState(0)
  const [pageSize] = useState(50)
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [starred, setStarred] = useState(!!saved?.starred || isAll)
  const [selected, setSelected] = useState<string[]>([])
  const [askOpen, setAskOpen] = useState(false)
  const [askText, setAskText] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editSummary, setEditSummary] = useState('')
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [assignQ, setAssignQ] = useState('')
  const [assignPos, setAssignPos] = useState({ top: 0, left: 0 })
  const assignRef = useRef<HTMLDivElement>(null)
  const [reporterCardId, setReporterCardId] = useState<string | null>(null)
  const [reporterPos, setReporterPos] = useState({ top: 0, left: 0 })
  const [priorityId, setPriorityId] = useState<string | null>(null)
  const [priorityPos, setPriorityPos] = useState({ top: 0, left: 0 })
  const [visibleCols, setVisibleCols] = useState({
    assignee: true,
    reporter: true,
    priority: true,
    status: true,
    resolution: true,
    created: true,
    updated: true,
    dueDate: true,
  })

  const labels = useMemo(() => [...new Set(items.flatMap((i) => i.labels))].sort(), [items])
  const parents = useMemo(() => items.filter((i) => i.type === 'Epic' || i.type === 'Story'), [items])
  const spentByItem = useMemo(() => {
    const m = new Map<string, number>()
    for (const w of worklogs) m.set(w.itemId, (m.get(w.itemId) ?? 0) + w.minutes)
    return m
  }, [worklogs])
  const storyPointOptions = useMemo(
    () => [...new Set(items.map((i) => i.storyPoints).filter((n): n is number => n != null))].sort((a, b) => a - b),
    [items],
  )

  const basicJql = useMemo(() => {
    const c: string[] = []
    if (basic.project) c.push(`project = ${quoteValue(basic.project)}`)
    if (basic.assignee) c.push(basic.assignee === 'EMPTY' ? 'assignee IS EMPTY' : basic.assignee === 'me' ? 'assignee = currentUser()' : `assignee = ${quoteValue(basic.assignee)}`)
    if (basic.type) c.push(`type = ${quoteValue(basic.type)}`)
    if (basic.status) c.push(`status = ${quoteValue(basic.status)}`)
    if (basic.priority) c.push(`priority = ${quoteValue(basic.priority)}`)
    if (basic.reporter) c.push(basic.reporter === 'me' ? 'reporter = currentUser()' : `reporter = ${quoteValue(basic.reporter)}`)
    if (basic.labels) c.push(`labels = ${quoteValue(basic.labels)}`)
    if (basic.parent) c.push(`parent = ${quoteValue(basic.parent)}`)
    if (basic.text.trim()) c.push(`text ~ "${basic.text.trim().replace(/"/g, '')}"`)
    return c.join(' AND ')
  }, [basic])

  const query = mode === 'basic' ? basicJql : applied
  const result = useMemo(() => {
    try {
      const r = runJql(query, items, ctx)
      const extra = r.items.filter((i) => {
        if (basic.timeSpent === 'none' && (spentByItem.get(i.id) ?? 0) > 0) return false
        if (basic.timeSpent === 'any' && !(spentByItem.get(i.id) ?? 0)) return false
        if (basic.subtask === 'is' && i.type !== 'Subtask') return false
        if (basic.subtask === 'has' && !items.some((c) => c.parentId === i.id && c.type === 'Subtask')) return false
        if (basic.subtask === 'none' && items.some((c) => c.parentId === i.id && c.type === 'Subtask')) return false
        if (basic.storyPoints === 'empty' && i.storyPoints != null) return false
        if (basic.storyPoints && basic.storyPoints !== 'empty' && String(i.storyPoints) !== basic.storyPoints) return false
        if (basic.startDate === 'empty' && i.startDate) return false
        if (basic.startDate && basic.startDate !== 'empty' && i.startDate !== basic.startDate) return false
        if (basic.endDate === 'empty' && i.dueDate) return false
        if (basic.endDate && basic.endDate !== 'empty' && i.dueDate !== basic.endDate) return false
        if (basic.sprint === 'empty' && i.sprintId) return false
        if (basic.sprint && basic.sprint !== 'empty' && i.sprintId !== basic.sprint) return false
        if (basic.creator === 'me' && i.reporterId !== me.id) return false
        if (basic.creator && basic.creator !== 'me') {
          const uid = users.find((u) => u.name === basic.creator)?.id
          if (i.reporterId !== uid) return false
        }
        if (basic.created) {
          const t = new Date(i.createdAt).getTime()
          const day = 86400000
          if (basic.created === '1d' && t < Date.now() - day) return false
          if (basic.created === '7d' && t < Date.now() - 7 * day) return false
          if (basic.created === '30d' && t < Date.now() - 30 * day) return false
        }
        return true
      })
      return { items: extra, error: null as string | null }
    } catch (e) {
      return { items: [], error: e instanceof JqlError ? e.message : String(e) }
    }
  }, [query, items, ctx, basic, spentByItem, me.id, users])

  const sorted = useMemo(() => (sort ? sortItems(result.items, [sort], ctx) : result.items), [result.items, sort, ctx])
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const current = Math.min(page, pages - 1)
  const pageItems = sorted.slice(current * pageSize, current * pageSize + pageSize)
  const setB = (patch: Partial<typeof basic>) => {
    setBasic({ ...basic, ...patch })
    setPage(0)
  }

  const projectLabel = projects.find((p) => p.key === basic.project)?.name
  const assigneeLabel = basic.assignee === 'me' ? 'Current user' : basic.assignee === 'EMPTY' ? 'Unassigned' : basic.assignee
  const reporterLabel = basic.reporter === 'me' ? 'Current user' : basic.reporter
  const creatorLabel = basic.creator === 'me' ? 'Current user' : basic.creator
  const sprintLabel = basic.sprint === 'empty' ? 'None' : sprints.find((s) => s.id === basic.sprint)?.name
  const timeSpentLabel = basic.timeSpent === 'any' ? 'Logged' : basic.timeSpent === 'none' ? 'None' : ''
  const subtaskLabel = basic.subtask === 'is' ? 'Is a subtask' : basic.subtask === 'has' ? 'Has subtasks' : basic.subtask === 'none' ? 'No subtasks' : ''
  const storyPointsLabel = basic.storyPoints === 'empty' ? 'None' : basic.storyPoints
  const startDateLabel = basic.startDate === 'empty' ? 'None' : basic.startDate
  const endDateLabel = basic.endDate === 'empty' ? 'None' : basic.endDate
  const createdLabel = basic.created === '1d' ? 'Last 24 hours' : basic.created === '7d' ? 'Last 7 days' : basic.created === '30d' ? 'Last 30 days' : ''

  const copyFilter = () => {
    const url = `${window.location.origin}/filters/search?jql=${encodeURIComponent(query)}`
    void navigator.clipboard?.writeText(query ? url : window.location.href)
    showToast('Filter copied')
  }

  const allChecked = pageItems.length > 0 && pageItems.every((i) => selected.includes(i.id))
  const toggleAll = () => {
    if (allChecked) setSelected((s) => s.filter((id) => !pageItems.some((i) => i.id === id)))
    else setSelected((s) => [...new Set([...s, ...pageItems.map((i) => i.id)])])
  }

  const askAi = () => {
    const q = askText.trim()
    if (!q) return
    setMode('jql')
    const jql = `text ~ "${q.replace(/"/g, '')}"`
    setText(jql)
    setApplied(jql)
    setAskOpen(false)
    setAskText('')
    setPage(0)
    showToast('Converted to JQL')
  }

  const startEdit = (id: string, summary: string) => {
    setEditingId(id)
    setEditSummary(summary)
  }
  const cancelEdit = () => {
    setEditingId(null)
    setEditSummary('')
  }
  const saveEdit = () => {
    if (editingId && editSummary.trim()) workItemService.update(editingId, { summary: editSummary.trim() })
    cancelEdit()
  }

  useEffect(() => {
    if (!assigningId && !reporterCardId && !priorityId) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (assigningId && !t.closest('[data-assignee-picker]')) setAssigningId(null)
      if (reporterCardId && !t.closest('[data-reporter-card]')) setReporterCardId(null)
      if (priorityId && !t.closest('[data-priority-picker]')) setPriorityId(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [assigningId, reporterCardId, priorityId])

  const openAssignee = (itemId: string, currentName: string, el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    setAssignPos({ top: r.bottom + 4, left: r.left })
    setAssigningId(itemId)
    setAssignQ(currentName)
  }
  const openPriority = (itemId: string, el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    setPriorityPos({ top: r.bottom + 4, left: r.left })
    setPriorityId(itemId)
  }
  const pickPriority = (itemId: string, priority: Priority) => {
    workItemService.update(itemId, { priority })
    setPriorityId(null)
  }

  const openReporter = (userId: string, el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    const width = 360
    const left = Math.min(r.left, window.innerWidth - width - 12)
    setReporterPos({ top: r.bottom + 6, left: Math.max(12, left) })
    setReporterCardId(userId)
  }

  const pickAssignee = (itemId: string, userId: string | null) => {
    workItemService.update(itemId, { assigneeId: userId })
    setAssigningId(null)
  }
  const assignQuery = assignQ.trim().toLowerCase()
  const assignMatches = users.filter((u) => {
    if (!assignQuery) return true
    return u.name.toLowerCase().includes(assignQuery) || u.email.toLowerCase().includes(assignQuery)
  })

  const tabBtn = (id: 'basic' | 'jql', label: string) => (
    <button
      type="button"
      onClick={() => setMode(id)}
      className={clsx(
        'h-8 rounded-md px-2.5 text-[13px] font-medium',
        mode === id ? 'bg-[#e9f2ff] text-[#0c66e4]' : 'text-slate-600 hover:bg-slate-100',
      )}
    >
      {label}
    </button>
  )

  return (
    <div className="flex h-full min-h-0 flex-col bg-white px-6 py-5">
      <div className="mb-4 flex items-center gap-2">
        <h1 className="text-[24px] font-semibold tracking-tight text-slate-900">{title}</h1>
        <button
          type="button"
          title="Star"
          onClick={() => {
            if (saved) filterService.update(saved.id, { starred: !saved.starred })
            setStarred((s) => !s)
          }}
        >
          <Star size={18} className={starred ? 'fill-amber-400 text-amber-400' : 'text-slate-400'} />
        </button>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="h-8 w-52 rounded-md border border-slate-300 bg-white pl-8 pr-2 text-[13px] outline-none focus:border-[#0c66e4]" placeholder="Search all apps" />
          </div>
          <span className="text-[13px] text-slate-500">Apps</span>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => setAskOpen((o) => !o)}
            className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[13px] font-medium text-slate-700 hover:bg-slate-100"
          >
            <Sparkles size={14} className="text-purple-600" />
            Ask AI
          </button>
          {askOpen && (
            <div className="absolute left-0 z-40 mt-1 w-80 rounded-md border border-slate-200 bg-white p-3 shadow-lg">
              <div className="mb-2 text-xs font-semibold text-slate-700">Ask AI to filter work items</div>
              <input
                autoFocus
                className="input text-sm"
                placeholder="e.g. bugs assigned to me"
                value={askText}
                onChange={(e) => setAskText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && askAi()}
              />
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" className="btn-subtle py-1 text-xs" onClick={() => setAskOpen(false)}>Cancel</button>
                <button type="button" className="btn-primary py-1 text-xs" onClick={askAi}>Search</button>
              </div>
            </div>
          )}
        </div>
        {tabBtn('basic', 'Basic')}
        {tabBtn('jql', 'JQL')}

        {mode === 'basic' ? (
          <>
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="h-8 w-[200px] rounded-md border border-slate-300 bg-white pl-8 pr-2 text-[13px] outline-none focus:border-[#0c66e4]"
                placeholder="Search work items"
                value={basic.text}
                onChange={(e) => setB({ text: e.target.value })}
              />
            </div>
            <Chip label="Space" value={projectLabel}>
              {(close) => (
                <>
                  <MenuItem active={!basic.project} onClick={() => { setB({ project: '' }); close() }}>All spaces</MenuItem>
                  {projects.map((p) => (
                    <MenuItem key={p.id} active={basic.project === p.key} onClick={() => { setB({ project: p.key }); close() }}>
                      {p.icon} {p.name}
                    </MenuItem>
                  ))}
                </>
              )}
            </Chip>
            <Chip label="Assignee" value={assigneeLabel}>
              {(close) => (
                <>
                  <MenuItem active={!basic.assignee} onClick={() => { setB({ assignee: '' }); close() }}>All</MenuItem>
                  <MenuItem active={basic.assignee === 'me'} onClick={() => { setB({ assignee: 'me' }); close() }}>Current user</MenuItem>
                  <MenuItem active={basic.assignee === 'EMPTY'} onClick={() => { setB({ assignee: 'EMPTY' }); close() }}>Unassigned</MenuItem>
                  {users.map((u) => (
                    <MenuItem key={u.id} active={basic.assignee === u.name} onClick={() => { setB({ assignee: u.name }); close() }}>
                      {u.name}
                    </MenuItem>
                  ))}
                </>
              )}
            </Chip>
            <Chip label="Type" value={basic.type}>
              {(close) => (
                <>
                  <MenuItem active={!basic.type} onClick={() => { setB({ type: '' }); close() }}>All types</MenuItem>
                  {ISSUE_TYPES.map((t) => (
                    <MenuItem key={t} active={basic.type === t} onClick={() => { setB({ type: t }); close() }}>
                      <TypeIcon type={t} size={14} /> {t}
                    </MenuItem>
                  ))}
                </>
              )}
            </Chip>
            <Chip label="Status" value={basic.status}>
              {(close) => (
                <>
                  <MenuItem active={!basic.status} onClick={() => { setB({ status: '' }); close() }}>All statuses</MenuItem>
                  {STATUSES.map((s) => (
                    <MenuItem key={s} active={basic.status === s} onClick={() => { setB({ status: s }); close() }}>{s}</MenuItem>
                  ))}
                </>
              )}
            </Chip>
            {moreFields.includes('priority') && (
              <Chip label="Priority" value={basic.priority}>
                {(close) => (
                  <>
                    <MenuItem active={!basic.priority} onClick={() => { setB({ priority: '' }); close() }}>All</MenuItem>
                    {PRIORITIES.map((p) => (
                      <MenuItem key={p} active={basic.priority === p} onClick={() => { setB({ priority: p }); close() }}>
                        <PriorityIcon priority={p} /> {p}
                      </MenuItem>
                    ))}
                  </>
                )}
              </Chip>
            )}
            {moreFields.includes('reporter') && (
              <Chip label="Reporter" value={reporterLabel}>
                {(close) => (
                  <>
                    <MenuItem active={!basic.reporter} onClick={() => { setB({ reporter: '' }); close() }}>All</MenuItem>
                    <MenuItem active={basic.reporter === 'me'} onClick={() => { setB({ reporter: 'me' }); close() }}>Current user</MenuItem>
                    {users.map((u) => (
                      <MenuItem key={u.id} active={basic.reporter === u.name} onClick={() => { setB({ reporter: u.name }); close() }}>{u.name}</MenuItem>
                    ))}
                  </>
                )}
              </Chip>
            )}
            {moreFields.includes('labels') && (
              <Chip label="Labels" value={basic.labels}>
                {(close) => (
                  <>
                    <MenuItem active={!basic.labels} onClick={() => { setB({ labels: '' }); close() }}>All</MenuItem>
                    {labels.length === 0 && <div className="px-3 py-1.5 text-sm text-slate-500">No labels</div>}
                    {labels.map((l) => (
                      <MenuItem key={l} active={basic.labels === l} onClick={() => { setB({ labels: l }); close() }}>{l}</MenuItem>
                    ))}
                  </>
                )}
              </Chip>
            )}
            {moreFields.includes('parent') && (
              <Chip label="Parent" value={basic.parent}>
                {(close) => (
                  <>
                    <MenuItem active={!basic.parent} onClick={() => { setB({ parent: '' }); close() }}>All</MenuItem>
                    {parents.map((p) => (
                      <MenuItem key={p.id} active={basic.parent === p.id} onClick={() => { setB({ parent: p.id }); close() }}>
                        {p.id} {p.summary}
                      </MenuItem>
                    ))}
                  </>
                )}
              </Chip>
            )}
            {moreFields.includes('timeSpent') && (
              <Chip label="Time spent" value={timeSpentLabel}>
                {(close) => (
                  <>
                    <MenuItem active={!basic.timeSpent} onClick={() => { setB({ timeSpent: '' }); close() }}>All</MenuItem>
                    <MenuItem active={basic.timeSpent === 'any'} onClick={() => { setB({ timeSpent: 'any' }); close() }}>Time logged</MenuItem>
                    <MenuItem active={basic.timeSpent === 'none'} onClick={() => { setB({ timeSpent: 'none' }); close() }}>No time logged</MenuItem>
                  </>
                )}
              </Chip>
            )}
            {moreFields.includes('subtask') && (
              <Chip label="Subtask" value={subtaskLabel}>
                {(close) => (
                  <>
                    <MenuItem active={!basic.subtask} onClick={() => { setB({ subtask: '' }); close() }}>All</MenuItem>
                    <MenuItem active={basic.subtask === 'is'} onClick={() => { setB({ subtask: 'is' }); close() }}>Is a subtask</MenuItem>
                    <MenuItem active={basic.subtask === 'has'} onClick={() => { setB({ subtask: 'has' }); close() }}>Has subtasks</MenuItem>
                    <MenuItem active={basic.subtask === 'none'} onClick={() => { setB({ subtask: 'none' }); close() }}>No subtasks</MenuItem>
                  </>
                )}
              </Chip>
            )}
            {moreFields.includes('storyPoints') && (
              <Chip label="Story point estimate" value={storyPointsLabel}>
                {(close) => (
                  <>
                    <MenuItem active={!basic.storyPoints} onClick={() => { setB({ storyPoints: '' }); close() }}>All</MenuItem>
                    <MenuItem active={basic.storyPoints === 'empty'} onClick={() => { setB({ storyPoints: 'empty' }); close() }}>None</MenuItem>
                    {storyPointOptions.map((n) => (
                      <MenuItem key={n} active={basic.storyPoints === String(n)} onClick={() => { setB({ storyPoints: String(n) }); close() }}>{n}</MenuItem>
                    ))}
                  </>
                )}
              </Chip>
            )}
            {moreFields.includes('startDate') && (
              <Chip label="Start date" value={startDateLabel}>
                {(close) => (
                  <>
                    <MenuItem active={!basic.startDate} onClick={() => { setB({ startDate: '' }); close() }}>All</MenuItem>
                    <MenuItem active={basic.startDate === 'empty'} onClick={() => { setB({ startDate: 'empty' }); close() }}>None</MenuItem>
                    <div className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <input type="date" className="input py-1" value={basic.startDate !== 'empty' ? basic.startDate : ''} onChange={(e) => { setB({ startDate: e.target.value }); close() }} />
                    </div>
                  </>
                )}
              </Chip>
            )}
            {moreFields.includes('endDate') && (
              <Chip label="End date" value={endDateLabel}>
                {(close) => (
                  <>
                    <MenuItem active={!basic.endDate} onClick={() => { setB({ endDate: '' }); close() }}>All</MenuItem>
                    <MenuItem active={basic.endDate === 'empty'} onClick={() => { setB({ endDate: 'empty' }); close() }}>None</MenuItem>
                    <div className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <input type="date" className="input py-1" value={basic.endDate !== 'empty' ? basic.endDate : ''} onChange={(e) => { setB({ endDate: e.target.value }); close() }} />
                    </div>
                  </>
                )}
              </Chip>
            )}
            {moreFields.includes('sprint') && (
              <Chip label="Sprint" value={sprintLabel}>
                {(close) => (
                  <>
                    <MenuItem active={!basic.sprint} onClick={() => { setB({ sprint: '' }); close() }}>All</MenuItem>
                    <MenuItem active={basic.sprint === 'empty'} onClick={() => { setB({ sprint: 'empty' }); close() }}>None (backlog)</MenuItem>
                    {sprints.map((s) => (
                      <MenuItem key={s.id} active={basic.sprint === s.id} onClick={() => { setB({ sprint: s.id }); close() }}>{s.name}</MenuItem>
                    ))}
                  </>
                )}
              </Chip>
            )}
            {moreFields.includes('creator') && (
              <Chip label="Creator" value={creatorLabel}>
                {(close) => (
                  <>
                    <MenuItem active={!basic.creator} onClick={() => { setB({ creator: '' }); close() }}>All</MenuItem>
                    <MenuItem active={basic.creator === 'me'} onClick={() => { setB({ creator: 'me' }); close() }}>Current user</MenuItem>
                    {users.map((u) => (
                      <MenuItem key={u.id} active={basic.creator === u.name} onClick={() => { setB({ creator: u.name }); close() }}>{u.name}</MenuItem>
                    ))}
                  </>
                )}
              </Chip>
            )}
            {moreFields.includes('created') && (
              <Chip label="Created" value={createdLabel}>
                {(close) => (
                  <>
                    <MenuItem active={!basic.created} onClick={() => { setB({ created: '' }); close() }}>Any time</MenuItem>
                    <MenuItem active={basic.created === '1d'} onClick={() => { setB({ created: '1d' }); close() }}>Last 24 hours</MenuItem>
                    <MenuItem active={basic.created === '7d'} onClick={() => { setB({ created: '7d' }); close() }}>Last 7 days</MenuItem>
                    <MenuItem active={basic.created === '30d'} onClick={() => { setB({ created: '30d' }); close() }}>Last 30 days</MenuItem>
                  </>
                )}
              </Chip>
            )}
            <Dropdown
              menuClassName="max-h-80 overflow-y-auto min-w-[220px]"
              trigger={(open) => (
                <button
                  type="button"
                  className={clsx(
                    'inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-[13px]',
                    moreFields.length || open ? 'border-[#0c66e4] bg-[#e9f2ff] text-[#0c66e4]' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
                  )}
                >
                  More filters
                  <ChevronDown size={14} />
                </button>
              )}
            >
              {() => (
                <>
                  {MORE_FIELDS.map((f) => {
                    const on = moreFields.includes(f.id)
                    return (
                      <MenuItem
                        key={f.id}
                        active={on}
                        onClick={() => {
                          setMoreFields((cur) => (cur.includes(f.id) ? cur.filter((x) => x !== f.id) : [...cur, f.id]))
                          if (on) {
                            const clear: Partial<typeof basic> = {}
                            if (f.id === 'priority') clear.priority = ''
                            if (f.id === 'reporter') clear.reporter = ''
                            if (f.id === 'parent') clear.parent = ''
                            if (f.id === 'timeSpent') clear.timeSpent = ''
                            if (f.id === 'subtask') clear.subtask = ''
                            if (f.id === 'storyPoints') clear.storyPoints = ''
                            if (f.id === 'startDate') clear.startDate = ''
                            if (f.id === 'endDate') clear.endDate = ''
                            if (f.id === 'sprint') clear.sprint = ''
                            if (f.id === 'creator') clear.creator = ''
                            if (f.id === 'created') clear.created = ''
                            if (Object.keys(clear).length) setB(clear)
                          }
                        }}
                      >
                        {f.label}
                      </MenuItem>
                    )
                  })}
                </>
              )}
            </Dropdown>
          </>
        ) : (
          <div className="flex min-w-[280px] flex-1 items-center gap-2">
            <input
              className="h-8 flex-1 rounded-md border border-slate-300 bg-white px-2.5 font-mono text-[13px] outline-none focus:border-[#0c66e4]"
              value={text}
              placeholder='project = CP AND status = "In Progress"'
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setApplied(text)
                  setPage(0)
                }
              }}
            />
            <button type="button" className="btn-primary h-8 py-0" onClick={() => { setApplied(text); setPage(0) }}>Search</button>
          </div>
        )}

        <button type="button" className="inline-flex h-8 items-center gap-1 px-2 text-[13px] font-medium text-[#0c66e4] hover:underline" onClick={copyFilter}>
          <Copy size={13} />
          Copy filter
        </button>
      </div>

      {result.error && (
        <div className="mb-3 flex items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle size={16} /> {result.error}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[1580px] table-fixed border-collapse">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="text-[12px] font-semibold text-[#6b778c]">
              <th className="w-10 border-b border-[#dfe1e6] px-3 py-2.5 text-left">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} className="h-3.5 w-3.5 rounded-[2px] border-[#8590a2] accent-[#0c66e4]" />
              </th>
              <th className="w-[22%] border-b border-[#dfe1e6] px-2 py-2.5 text-left">Work</th>
              {visibleCols.assignee && <th className="w-[11%] border-b border-[#dfe1e6] px-2 py-2.5 text-left">Assignee</th>}
              {visibleCols.reporter && <th className="w-[11%] border-b border-[#dfe1e6] px-2 py-2.5 text-left">Reporter</th>}
              {visibleCols.priority && <th className="w-[8%] border-b border-[#dfe1e6] px-2 py-2.5 text-left">Priority</th>}
              {visibleCols.status && <th className="w-[9%] border-b border-[#dfe1e6] px-2 py-2.5 text-left">Status</th>}
              {visibleCols.resolution && <th className="w-[8%] border-b border-[#dfe1e6] px-2 py-2.5 text-left">Resolution</th>}
              {visibleCols.created && (
                <th className="w-[12%] border-b border-[#dfe1e6] px-2 py-2.5 text-left">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1"
                    onClick={() => setSort((s) => ({ field: 'created', dir: s?.field === 'created' && s.dir === 'desc' ? 'asc' : 'desc' }))}
                  >
                    Created
                    {sort?.field === 'created' && (sort.dir === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
                  </button>
                </th>
              )}
              {visibleCols.updated && (
                <th className="w-[12%] border-b border-[#dfe1e6] px-2 py-2.5 text-left">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1"
                    onClick={() => setSort((s) => ({ field: 'updated', dir: s?.field === 'updated' && s.dir === 'desc' ? 'asc' : 'desc' }))}
                  >
                    Updated
                    {sort?.field === 'updated' && (sort.dir === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
                  </button>
                </th>
              )}
              {visibleCols.dueDate && <th className="w-[8%] border-b border-[#dfe1e6] px-2 py-2.5 text-left">Due date</th>}
              <th className="w-10 border-b border-[#dfe1e6] px-1 py-2.5 text-right">
                <Dropdown
                  align="right"
                  trigger={() => (
                    <button type="button" className="rounded p-1 text-[#6b778c] hover:bg-[#f1f2f4]" title="Columns">
                      <Columns3 size={16} />
                    </button>
                  )}
                >
                  {() => (
                    <>
                      {([
                        ['assignee', 'Assignee'],
                        ['reporter', 'Reporter'],
                        ['priority', 'Priority'],
                        ['status', 'Status'],
                        ['resolution', 'Resolution'],
                        ['created', 'Created'],
                        ['updated', 'Updated'],
                        ['dueDate', 'Due date'],
                      ] as const).map(([c, label]) => (
                        <MenuItem
                          key={c}
                          active={visibleCols[c]}
                          onClick={() => setVisibleCols((v) => ({ ...v, [c]: !v[c] }))}
                        >
                          {visibleCols[c] ? '✓ ' : ''}{label}
                        </MenuItem>
                      ))}
                    </>
                  )}
                </Dropdown>
              </th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((i) => {
              const assignee = users.find((u) => u.id === i.assigneeId)
              const reporter = users.find((u) => u.id === i.reporterId)
              const project = projects.find((p) => p.id === i.projectId)
              const statusStyle = STATUS_STYLE[i.status] ?? 'bg-slate-100 text-slate-700'
              const editing = editingId === i.id
              return (
                <tr
                  key={i.id}
                  className={clsx('group', editing ? 'bg-[#deebff]' : 'cursor-pointer hover:bg-[#f1f2f4]')}
                  onClick={() => { if (!editing) navigate(`/browse/${i.id}`) }}
                >
                  <td className="border-b border-[#ebecf0] px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.includes(i.id) || editing}
                      onChange={() => setSelected((s) => (s.includes(i.id) ? s.filter((id) => id !== i.id) : [...s, i.id]))}
                      className="h-3.5 w-3.5 rounded-[2px] accent-[#0c66e4]"
                    />
                  </td>
                  <td className="relative border-b border-[#ebecf0] px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex min-w-0 items-center gap-2">
                      <TypeIcon type={i.type} size={16} />
                      <button
                        type="button"
                        className="shrink-0 text-[13px] font-medium text-[#0c66e4] hover:underline"
                        onClick={() => navigate(`/browse/${i.id}`)}
                      >
                        {i.id}
                      </button>
                      {editing ? (
                        <>
                          <input
                            autoFocus
                            className="h-8 min-w-0 flex-1 rounded-[3px] border-2 border-[#4c9aff] bg-white px-2 text-[14px] text-[#172b4d] outline-none"
                            value={editSummary}
                            onChange={(e) => setEditSummary(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit()
                              if (e.key === 'Escape') cancelEdit()
                            }}
                          />
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px] border border-[#dfe1e6] bg-white text-[#22a06b] shadow-sm hover:bg-[#f4f5f7]"
                            title="Save"
                            onClick={saveEdit}
                          >
                            <Check size={16} strokeWidth={2.5} />
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px] border border-[#dfe1e6] bg-white text-[#44546f] shadow-sm hover:bg-[#f4f5f7]"
                            title="Cancel"
                            onClick={cancelEdit}
                          >
                            <X size={16} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="min-w-0 flex-1 truncate text-left text-[14px] text-[#172b4d]"
                            onClick={() => startEdit(i.id, i.summary)}
                          >
                            {i.summary}
                          </button>
                          <ArrowUpRight size={14} className="invisible shrink-0 text-[#6b778c] group-hover:visible" />
                        </>
                      )}
                    </div>
                  </td>
                  {visibleCols.assignee && (
                    <td className="relative border-b border-[#ebecf0] px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                      {assigningId === i.id ? (
                        <div ref={assignRef} data-assignee-picker className="relative z-30">
                          <div className="flex h-9 items-center gap-1.5 rounded-[3px] border-2 border-[#4c9aff] bg-white px-1.5">
                            {assignee ? <Avatar user={assignee} size={22} /> : <User size={16} className="text-[#6b778c]" />}
                            <input
                              autoFocus
                              className="min-w-0 flex-1 bg-transparent text-[13px] text-[#172b4d] outline-none"
                              value={assignQ}
                              onChange={(e) => setAssignQ(e.target.value)}
                              onKeyDown={(e) => e.key === 'Escape' && setAssigningId(null)}
                            />
                            <button
                              type="button"
                              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[#6b778c] hover:bg-[#f1f2f4]"
                              onClick={() => pickAssignee(i.id, null)}
                              aria-label="Clear assignee"
                            >
                              <X size={12} />
                            </button>
                          </div>
                          {createPortal(
                            <div
                              data-assignee-picker
                              className="fixed z-[80] max-h-[320px] w-[280px] overflow-y-auto rounded-[3px] border border-[#dfe1e6] bg-white py-1 shadow-lg"
                              style={{ top: assignPos.top, left: assignPos.left }}
                            >
                              {(assignee ?? assignMatches[0]) && (
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 bg-[#f4f5f7] px-3 py-2 text-left hover:bg-[#ebecf0]"
                                  onClick={() => pickAssignee(i.id, (assignee ?? assignMatches[0])!.id)}
                                >
                                  <Avatar user={assignee ?? assignMatches[0]} size={24} />
                                  <span className="min-w-0 truncate text-[14px] text-[#172b4d]">
                                    {(assignee ?? assignMatches[0])!.name}
                                    {assignee ? ' (Assigned)' : ''}
                                  </span>
                                </button>
                              )}
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[#f4f5f7]"
                                onClick={() => pickAssignee(i.id, null)}
                              >
                                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#dfe1e6] text-[#44546f]">
                                  <User size={14} />
                                </span>
                                <span className="text-[14px] text-[#172b4d]">Unassigned</span>
                              </button>
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[#f4f5f7]"
                                onClick={() => pickAssignee(i.id, project?.leadId ?? null)}
                              >
                                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#dfe1e6] text-[#44546f]">
                                  <User size={14} />
                                </span>
                                <span className="text-[14px] text-[#172b4d]">Automatic</span>
                              </button>
                              {assignMatches.map((u) => (
                                <button
                                  key={u.id}
                                  type="button"
                                  className={clsx(
                                    'flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[#f4f5f7]',
                                    u.id === i.assigneeId && 'bg-[#e9f2ff]',
                                  )}
                                  onClick={() => pickAssignee(i.id, u.id)}
                                >
                                  <Avatar user={u} size={24} />
                                  <span className="min-w-0">
                                    <span className="block truncate text-[14px] text-[#172b4d]">{u.name}</span>
                                    <span className="block truncate text-[12px] text-[#6b778c]">{u.email}</span>
                                  </span>
                                </button>
                              ))}
                              {assignMatches.length === 0 && (
                                <div className="px-3 py-2 text-[13px] text-[#6b778c]">No matches</div>
                              )}
                            </div>,
                            document.body,
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="flex w-full min-w-0 items-center gap-1.5 rounded-[3px] px-1 py-0.5 text-left hover:bg-white"
                          onClick={(e) => openAssignee(i.id, assignee?.name ?? '', e.currentTarget)}
                        >
                          <Avatar user={assignee} size={24} />
                          <span className="truncate text-[14px] text-[#172b4d]">{assignee?.name ?? 'Unassigned'}</span>
                        </button>
                      )}
                    </td>
                  )}
                  {visibleCols.reporter && (
                    <td className="border-b border-[#ebecf0] px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      {isAdmin ? (
                        <button
                          type="button"
                          data-reporter-card
                          className="flex w-full min-w-0 items-center gap-1.5 rounded-[3px] px-1 py-0.5 text-left hover:bg-white"
                          onClick={(e) => reporter && openReporter(reporter.id, e.currentTarget)}
                        >
                          <Avatar user={reporter} size={24} />
                          <span className="truncate text-[14px] text-[#172b4d]">{reporter?.name ?? userName(users, i.reporterId)}</span>
                        </button>
                      ) : (
                        <span className="flex min-w-0 items-center gap-1.5">
                          <Avatar user={reporter} size={24} />
                          <span className="truncate text-[14px] text-[#172b4d]">{reporter?.name ?? userName(users, i.reporterId)}</span>
                        </span>
                      )}
                    </td>
                  )}
                  {visibleCols.priority && (
                    <td className="border-b border-[#ebecf0] px-2 py-1.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        data-priority-picker
                        className={clsx(
                          'inline-flex h-8 min-w-[132px] items-center gap-1.5 rounded-[3px] px-2 text-[14px] text-[#172b4d]',
                          priorityId === i.id ? 'border-2 border-[#4c9aff] bg-white' : 'border border-transparent hover:bg-white',
                        )}
                        onClick={(e) => openPriority(i.id, e.currentTarget)}
                      >
                        <PriorityIcon priority={i.priority} />
                        <span className="flex-1 text-left">{i.priority}</span>
                        <ChevronDown size={14} className="text-[#6b778c]" />
                      </button>
                      {priorityId === i.id && createPortal(
                        <div
                          data-priority-picker
                          className="fixed z-[80] min-w-[180px] overflow-hidden rounded-[3px] border border-[#dfe1e6] bg-white py-1 shadow-lg"
                          style={{ top: priorityPos.top, left: priorityPos.left }}
                        >
                          {PRIORITIES.map((p) => (
                            <button
                              key={p}
                              type="button"
                              className={clsx(
                                'flex w-full items-center gap-2 px-3 py-2 text-left text-[14px] text-[#172b4d] hover:bg-[#f4f5f7]',
                                p === i.priority && 'bg-[#f4f5f7]',
                              )}
                              onClick={() => pickPriority(i.id, p)}
                            >
                              <PriorityIcon priority={p} />
                              {p}
                            </button>
                          ))}
                        </div>,
                        document.body,
                      )}
                    </td>
                  )}
                  {visibleCols.status && (
                    <td className="border-b border-[#ebecf0] px-2 py-2 [&_button>span:first-child]:hidden" onClick={(e) => e.stopPropagation()}>
                      <StatusDropdown
                        value={i.status}
                        variant="chip"
                        projectKey={project?.key}
                        className={clsx('!gap-0.5 !rounded-[3px] !border-0 !px-2 !py-0.5 !text-[13px] !font-medium !shadow-none', statusStyle)}
                        onChange={(s) => workItemService.update(i.id, { status: s as Status })}
                      />
                    </td>
                  )}
                  {visibleCols.resolution && (
                    <td className="border-b border-[#ebecf0] px-2 py-2 text-[14px] text-[#44546f]">{isDone(i.status) ? 'Done' : 'Unresolved'}</td>
                  )}
                  {visibleCols.created && (
                    <td className="border-b border-[#ebecf0] px-2 py-2 whitespace-nowrap text-[14px] text-[#172b4d]">
                      {fmtDate(i.createdAt, 'MMM d, yyyy, h:mm a')}
                    </td>
                  )}
                  {visibleCols.updated && (
                    <td className="border-b border-[#ebecf0] px-2 py-2 whitespace-nowrap text-[14px] text-[#172b4d]">
                      {fmtDate(i.updatedAt, 'MMM d, yyyy, h:mm a')}
                    </td>
                  )}
                  {visibleCols.dueDate && (
                    <td className="border-b border-[#ebecf0] px-2 py-2 whitespace-nowrap text-[14px] text-[#6b778c]">
                      {i.dueDate ? fmtDate(i.dueDate, 'MMM d, yyyy') : 'None'}
                    </td>
                  )}
                  <td className="border-b border-[#ebecf0] px-1 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                    <Dropdown
                      align="right"
                      trigger={() => (
                        <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded text-[#6b778c] hover:bg-[#f1f2f4]" title="More">
                          <Ellipsis size={16} />
                        </button>
                      )}
                    >
                      {(close) => (
                        <>
                          <MenuItem onClick={() => { navigate(`/browse/${i.id}`); close() }}>Open</MenuItem>
                          <MenuItem onClick={() => { void navigator.clipboard.writeText(`${window.location.origin}/browse/${i.id}`); showToast('Link copied'); close() }}>Copy link</MenuItem>
                        </>
                      )}
                    </Dropdown>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {pageItems.length === 0 && (
          <div className="p-10 text-center text-sm text-slate-500">{result.error ? 'Fix the query to see results' : 'No work items match this search'}</div>
        )}
      </div>

      <div className="flex items-center justify-center gap-3 pt-3 text-[13px] text-slate-600">
        {pages > 1 && (
          <button type="button" className="btn-subtle py-0.5" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button>
        )}
        <span className="inline-flex items-center gap-1.5">
          {sorted.length === 0 ? '0 of 0' : `${pageItems.length} of ${sorted.length}`}
          <MessageSquare size={14} className="text-slate-400" />
        </span>
        {pages > 1 && (
          <button type="button" className="btn-subtle py-0.5" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Next</button>
        )}
        {query && (
          <button type="button" className="ml-auto text-[13px] text-[#0c66e4] hover:underline" onClick={() => { setSaveName(title); setSaveOpen(true) }}>
            Save filter
          </button>
        )}
      </div>

      {isAdmin && reporterCardId && createPortal((() => {
        const person = users.find((u) => u.id === reporterCardId)
        if (!person) return null
        const recent = items
          .filter((it) => it.reporterId === person.id)
          .slice()
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
          .slice(0, 3)
        const reporterJql = `reporter = ${quoteValue(person.name)}`
        return (
          <div
            data-reporter-card
            className="fixed z-[80] w-[360px] rounded-lg border border-[#dfe1e6] bg-white p-4 shadow-xl"
            style={{ top: reporterPos.top, left: reporterPos.left }}
          >
            <div className="mb-3 flex items-start gap-3">
              <Avatar user={person} size={72} />
              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  className="h-8 rounded-[3px] border border-[#dfe1e6] bg-white px-3 text-[13px] font-medium text-[#172b4d] hover:bg-[#f4f5f7]"
                  onClick={() => {
                    setReporterCardId(null)
                    showToast(`${person.name}'s profile`)
                  }}
                >
                  View profile
                </button>
                <Dropdown
                  align="right"
                  trigger={() => (
                    <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-[3px] border border-[#dfe1e6] text-[#44546f] hover:bg-[#f4f5f7]">
                      <Ellipsis size={16} />
                    </button>
                  )}
                >
                  {(close) => (
                    <>
                      <MenuItem onClick={() => { void navigator.clipboard.writeText(person.email); showToast('Email copied'); close() }}>Copy email</MenuItem>
                      <MenuItem onClick={() => { void navigator.clipboard.writeText(person.name); showToast('Name copied'); close() }}>Copy name</MenuItem>
                    </>
                  )}
                </Dropdown>
              </div>
            </div>
            <div className="text-[18px] font-semibold text-[#172b4d]">{person.name}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[13px] text-[#6b778c]">
              {person.email}
              <button
                type="button"
                className="rounded p-0.5 hover:bg-[#f4f5f7]"
                title="Copy email"
                onClick={() => { void navigator.clipboard.writeText(person.email); showToast('Email copied') }}
              >
                <Copy size={13} />
              </button>
            </div>
            <div className="mt-4 mb-2 flex items-center justify-between">
              <div className="text-[13px] font-semibold text-[#172b4d]">Recent work</div>
              <button
                type="button"
                className="text-[13px] text-[#0c66e4] hover:underline"
                onClick={() => {
                  setReporterCardId(null)
                  navigate(`/filters/search?jql=${encodeURIComponent(reporterJql)}`)
                }}
              >
                View all
              </button>
            </div>
            <div className="space-y-2">
              {recent.map((it) => {
                const proj = projects.find((p) => p.id === it.projectId)
                return (
                  <div key={it.id} className="flex items-center gap-2">
                    <TypeIcon type={it.type} size={20} />
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => { setReporterCardId(null); navigate(`/browse/${it.id}`) }}
                    >
                      <div className="truncate text-[13px] text-[#172b4d]">
                        {it.id}: {it.summary}
                      </div>
                      <div className="text-[12px] text-[#6b778c]">Jira · Updated {timeAgo(it.updatedAt)}</div>
                    </button>
                    <div className="shrink-0 [&_button>span:first-child]:hidden" onClick={(e) => e.stopPropagation()}>
                      <StatusDropdown
                        value={it.status}
                        variant="chip"
                        projectKey={proj?.key}
                        className={clsx('!gap-0.5 !rounded-[3px] !border-0 !px-2 !py-0.5 !text-[12px] !font-medium !shadow-none', STATUS_STYLE[it.status] ?? '')}
                        onChange={(s) => workItemService.update(it.id, { status: s as Status })}
                      />
                    </div>
                  </div>
                )
              })}
              {recent.length === 0 && <div className="text-[13px] text-[#6b778c]">No recent work</div>}
            </div>
          </div>
        )
      })(), document.body)}

      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title="Save filter"
        width={480}
        footer={(
          <>
            <button className="btn-subtle" onClick={() => setSaveOpen(false)}>Cancel</button>
            <button
              className="btn-primary"
              disabled={!saveName.trim()}
              onClick={async () => {
                const f = await filterService.create(saveName.trim(), query)
                setSaveOpen(false)
                showToast(`Filter "${f.name}" saved`)
                navigate(`/filters/search?filter=${f.id}`)
              }}
            >
              Save
            </button>
          </>
        )}
      >
        <label className="label">Name</label>
        <input className="input" autoFocus value={saveName} onChange={(e) => setSaveName(e.target.value)} />
        <div className="mt-3 text-xs text-slate-500">Query</div>
        <code className="block rounded bg-slate-100 p-2 text-xs">{query || '(all work items)'}</code>
      </Modal>
    </div>
  )
}
