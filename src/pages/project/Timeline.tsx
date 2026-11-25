import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import {
  addDays,
  differenceInCalendarDays,
  eachMonthOfInterval,
  eachWeekOfInterval,
  format,
  max as maxDate,
  min as minDate,
  parseISO,
  startOfMonth,
  startOfQuarter,
} from 'date-fns'
import {
  ChevronDown,
  ChevronRight,
  Edit3,
  Filter,
  Info,
  MoreHorizontal,
  Plus,
  Search,
  SlidersHorizontal,
  User,
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useProject } from './projectContext'
import { useCurrentUser } from '../../store/hooks'
import { useUi } from '../../store/uiStore'
import { now, isDone } from '../../lib/utils'
import { userAdminService, workItemService } from '../../services/api'
import { ISSUE_TYPES, PRIORITIES, STATUSES, type WorkItem } from '../../types'
import { Avatar, TypeIcon } from '../../components/ui'
import { StatusDropdown } from '../../components/StatusDropdown'
import { WorkItemDrawer } from '../../components/WorkItemDrawer'

type Zoom = 'weeks' | 'months' | 'quarters'
const PX: Record<Zoom, number> = { weeks: 32, months: 10, quarters: 4 }
const ROW_H = 40
const GROUP_H = 28

// Jira Segmented Status Bar for Timeline Table
function TimelineStatusBar({
  item,
  childrenList,
  projectKey,
}: {
  item: WorkItem
  childrenList: WorkItem[]
  projectKey: string
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const hasChildren = childrenList.length > 0

  useEffect(() => {
    if (!dropdownOpen) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setDropdownOpen(false)
    }
    document.addEventListener('mousedown', onDoc, true)
    return () => document.removeEventListener('mousedown', onDoc, true)
  }, [dropdownOpen])

  if (hasChildren) {
    const total = childrenList.length
    const doneCount = childrenList.filter((c) => isDone(c.status)).length
    const inProgCount = childrenList.filter(
      (c) =>
        !isDone(c.status) &&
        c.status !== 'To Do' &&
        c.status !== 'Reject' &&
        c.status !== 'Drop',
    ).length
    const todoCount = total - doneCount - inProgCount

    const donePct = (doneCount / total) * 100
    const inProgPct = (inProgCount / total) * 100
    const todoPct = (todoCount / total) * 100

    const tooltip = `${doneCount} Done, ${inProgCount} In Progress, ${todoCount} To Do (${Math.round(donePct)}% Done)`

    return (
      <div className="relative group w-full" title={tooltip}>
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-200">
          {donePct > 0 && (
            <div
              style={{ width: `${donePct}%` }}
              className="bg-[#22a06b] transition-all"
            />
          )}
          {inProgPct > 0 && (
            <div
              style={{ width: `${inProgPct}%` }}
              className="bg-[#0c66e4] transition-all"
            />
          )}
          {todoPct > 0 && (
            <div
              style={{ width: `${todoPct}%` }}
              className="bg-slate-300 transition-all"
            />
          )}
        </div>
      </div>
    )
  }

  // Standalone item: sleek colored indicator pill
  const isComplete = isDone(item.status)
  const isInProgress =
    !isComplete &&
    item.status !== 'To Do' &&
    item.status !== 'Reject' &&
    item.status !== 'Drop'

  return (
    <div ref={wrapRef} className="relative flex w-full items-center" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setDropdownOpen((o) => !o)}
        className="w-full flex items-center py-1 group"
        title={`Status: ${item.status} (Click to change)`}
      >
        <div
          className={clsx(
            'h-2 w-full rounded-full transition-all group-hover:h-2.5',
            isComplete
              ? 'bg-[#22a06b]'
              : isInProgress
              ? 'bg-[#0c66e4]'
              : 'bg-slate-300',
          )}
        />
      </button>

      {dropdownOpen && (
        <div className="absolute left-0 top-6 z-40">
          <StatusDropdown
            value={item.status}
            onChange={(s) => {
              workItemService.update(item.id, { status: s })
              setDropdownOpen(false)
            }}
            projectKey={projectKey}
            variant="compact"
          />
        </div>
      )}
    </div>
  )
}

export default function Timeline() {
  const project = useProject()
  const allItems = useStore((s) => s.items)
  const users = useStore((s) => s.users)
  const me = useCurrentUser()
  const showToast = useUi((s) => s.showToast)
  const openCreate = useUi((s) => s.openCreateItem)

  const [searchParams, setSearchParams] = useSearchParams()
  const selectedIssueId = searchParams.get('selectedIssue')

  const [zoom, setZoom] = useState<Zoom>('months')
  // By default, children are collapsed so only top-level items appear in table
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>([])
  const [typeFilter, setTypeFilter] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [parentFilter, setParentFilter] = useState<string[]>([])
  const [labelFilter, setLabelFilter] = useState<string[]>([])
  const [priorityFilter, setPriorityFilter] = useState<string[]>([])
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterField, setFilterField] = useState<string | null>(null)
  const [extraFields, setExtraFields] = useState<string[]>([])
  const [addFieldOpen, setAddFieldOpen] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)

  // Inline editing states for row summaries
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [editingSummaryText, setEditingSummaryText] = useState('')

  // Quick inline add child
  const [addingChildParentId, setAddingChildParentId] = useState<string | null>(null)
  const [quickChildSummary, setQuickChildSummary] = useState('')

  // Assignee dropdown
  const [assigneeMenuRowId, setAssigneeMenuRowId] = useState<string | null>(null)

  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!assigneeMenuRowId) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('[data-assignee-menu]')) return
      setAssigneeMenuRowId(null)
    }
    document.addEventListener('mousedown', onDoc, true)
    return () => document.removeEventListener('mousedown', onDoc, true)
  }, [assigneeMenuRowId])

  const members = users

  useEffect(() => {
    let cancelled = false
    void userAdminService.list()
      .then((rows) => {
        if (cancelled || !rows.length) return
        const existing = useStore.getState().users
        const extra = rows.filter((u) => !existing.some((e) => e.id === u.id || e.email.toLowerCase() === u.email.toLowerCase()))
        if (extra.length) useStore.setState({ users: [...existing, ...extra] })
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!filterOpen) return
    const onDoc = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false)
        setAddFieldOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [filterOpen])

  const projectItems = useMemo(() => allItems.filter((i) => i.projectId === project.id), [allItems, project.id])
  const parentOptions = useMemo(
    () => projectItems.filter((i) => i.type === 'Epic' || i.type === 'Story'),
    [projectItems],
  )
  const labelOptions = useMemo(() => [...new Set(projectItems.flatMap((i) => i.labels))].sort(), [projectItems])
  const filterCount = assigneeFilter.length + typeFilter.length + statusFilter.length + parentFilter.length + labelFilter.length + priorityFilter.length
  const clearFilters = () => {
    setAssigneeFilter([])
    setTypeFilter([])
    setStatusFilter([])
    setParentFilter([])
    setLabelFilter([])
    setPriorityFilter([])
    setFilterField(null)
  }
  const toggleVal = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value])

  const items = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return allItems.filter((i) => {
      if (i.projectId !== project.id) return false
      if (q && !i.summary.toLowerCase().includes(q) && !i.id.toLowerCase().includes(q)) return false
      if (assigneeFilter.length && !assigneeFilter.includes(i.assigneeId ?? 'none')) return false
      if (typeFilter.length && !typeFilter.includes(i.type)) return false
      if (statusFilter.length && !statusFilter.includes(i.status)) return false
      if (parentFilter.length && !parentFilter.includes(i.parentId ?? 'none')) return false
      if (labelFilter.length && !labelFilter.some((l) => i.labels.includes(l))) return false
      if (priorityFilter.length && !priorityFilter.includes(i.priority)) return false
      return true
    })
  }, [allItems, project.id, searchQuery, assigneeFilter, typeFilter, statusFilter, parentFilter, labelFilter, priorityFilter])

  const children = useMemo(() => {
    const m = new Map<string | null, WorkItem[]>()
    const ids = new Set(items.map((i) => i.id))
    for (const i of items) {
      const p = i.parentId && ids.has(i.parentId) ? i.parentId : null
      m.set(p, [...(m.get(p) ?? []), i])
    }
    const order = { Epic: 0, Story: 1, Task: 2, Bug: 3, Subtask: 4 }
    m.forEach((arr) =>
      arr.sort(
        (a, b) =>
          order[a.type] - order[b.type] || a.id.localeCompare(b.id, undefined, { numeric: true }),
      ),
    )
    return m
  }, [items])

  const rows = useMemo(() => {
    const out: { item: WorkItem; depth: number; hasChildren: boolean; childrenList: WorkItem[] }[] =
      []
    const walk = (parent: string | null, depth: number) => {
      for (const it of children.get(parent) ?? []) {
        const itemChildren = children.get(it.id) ?? []
        const hasChildren = itemChildren.length > 0
        out.push({ item: it, depth, hasChildren, childrenList: itemChildren })
        // Only recurse if user explicitly expanded this item
        if (hasChildren && expanded[it.id]) walk(it.id, depth + 1)
      }
    }
    walk(null, 0)
    return out
  }, [children, expanded])

  // Drawer opens only when the user clicks a Task, Story, or Bug — never on load / Epic.

  const today = now()
  const dates = items.flatMap((i) =>
    [i.startDate, i.dueDate].filter((d): d is string => !!d).map((d) => parseISO(d)),
  )
  const earliest = minDate([today, ...dates])
  const latest = maxDate([today, ...dates])
  const rangeStart = startOfMonth(addDays(earliest, -20))
  const rangeEnd = addDays(latest, 60)
  const totalDays = differenceInCalendarDays(rangeEnd, rangeStart) + 1
  const px = PX[zoom]
  const width = Math.max(1400, totalDays * px)
  const x = (d: Date) => differenceInCalendarDays(d, rangeStart) * px

  const headers =
    zoom === 'weeks'
      ? eachWeekOfInterval({ start: rangeStart, end: rangeEnd }, { weekStartsOn: 1 }).map((d) => ({
          d,
          label: format(d, 'dd MMM'),
        }))
      : zoom === 'months'
      ? eachMonthOfInterval({ start: rangeStart, end: rangeEnd }).map((d) => ({
          d,
          label: format(d, 'MMMM'),
        }))
      : eachMonthOfInterval({ start: rangeStart, end: rangeEnd })
          .filter((d) => d.getMonth() % 3 === 0)
          .map((d) => ({
            d: startOfQuarter(d),
            label: `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`,
          }))

  const scrollToday = () =>
    scroller.current?.scrollTo({ left: Math.max(0, x(today) - 260), behavior: 'smooth' })

  const handleStartEditSummary = (rowItem: WorkItem) => {
    setEditingRowId(rowItem.id)
    setEditingSummaryText(rowItem.summary)
  }

  const handleSaveSummary = (id: string) => {
    const trimmed = editingSummaryText.trim()
    if (trimmed) {
      workItemService.update(id, { summary: trimmed })
      showToast('Summary updated')
    }
    setEditingRowId(null)
  }

  const handleQuickAddChild = async (parentId: string) => {
    const trimmed = quickChildSummary.trim()
    if (!trimmed) return
    const parentItem = items.find((i) => i.id === parentId)
    const childType = parentItem?.type === 'Epic' ? 'Task' : 'Subtask'
    await workItemService.create({
      projectId: project.id,
      type: childType,
      summary: trimmed,
      description: '',
      status: 'To Do',
      priority: 'Medium',
      originalEstimate: null,
      assigneeId: null,
      reporterId: me?.id || 'u2',
      labels: [],
      parentId,
      dueDate: null,
      startDate: null,
      team: parentItem?.team || null,
      sprintId: parentItem?.sprintId || null,
      storyPoints: null,
    })
    setQuickChildSummary('')
    setAddingChildParentId(null)
    showToast(`Added ${childType.toLowerCase()} under ${parentId}`)
  }

  const handleRowClick = (item: WorkItem) => {
    if (item.type !== 'Task' && item.type !== 'Story' && item.type !== 'Bug') return
    setSearchParams({ selectedIssue: item.id })
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-white select-none">
      {/* 1. TIMELINE TOOLBAR (Search, Avatars, Filters) */}
      <div className="flex h-11 shrink-0 items-center gap-3 border-b border-slate-200 px-5">
        <div className="relative w-60">
          <input
            type="text"
            className="input py-1 pl-7 text-xs placeholder:text-slate-400"
            placeholder="Search timeline"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        <div className="flex items-center -space-x-1.5 overflow-hidden pl-1">
          {members.slice(0, 4).map((u) => (
            <button
              key={u.id}
              onClick={() => setAssigneeFilter((f) => (f.includes(u.id) ? f.filter((x) => x !== u.id) : [...f, u.id]))}
              className={clsx(
                'rounded-full ring-2 transition-transform hover:z-10 hover:scale-105',
                assigneeFilter.includes(u.id) ? 'ring-blue-600 scale-105 z-10' : 'ring-white',
              )}
              title={u.name}
            >
              <Avatar user={u} size={24} />
            </button>
          ))}
          {members.length > 4 && (
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-100 px-1.5 text-[10px] font-semibold text-slate-600 ring-2 ring-white">
              +{members.length - 4}
            </span>
          )}
        </div>

        <div className="relative" ref={filterRef}>
          <button
            type="button"
            className={clsx('btn-default', (filterOpen || filterCount > 0) && 'border-brand-600 bg-brand-50 text-brand-700')}
            onClick={() => setFilterOpen((o) => !o)}
          >
            <Filter size={14} /> Filter{filterCount > 0 ? ` · ${filterCount}` : ''}
          </button>
          {filterOpen && (
            <div className="absolute z-30 mt-1 flex w-[520px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
              <div className="flex min-h-[280px]">
                <div className="w-44 shrink-0 border-r border-slate-200 py-2">
                  {([
                    ['parent', 'Parent'],
                    ['assignee', 'Assignee'],
                    ['status', 'Status'],
                    ['type', 'Work type'],
                    ['labels', 'Labels'],
                    ...extraFields.map((f) => [f, f === 'priority' ? 'Priority' : f] as const),
                  ] as [string, string][]).map(([id, label]) => (
                    <button
                      key={id}
                      className={clsx('flex w-full px-4 py-2 text-left text-sm', filterField === id ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-700 hover:bg-slate-50')}
                      onClick={() => { setFilterField(id); setAddFieldOpen(false) }}
                    >
                      {label}
                    </button>
                  ))}
                  <div className="relative px-3 pt-2">
                    <button className="btn-default w-full justify-center" onClick={() => setAddFieldOpen((o) => !o)}>
                      <Plus size={14} /> Add field
                    </button>
                    {addFieldOpen && (
                      <div className="absolute left-3 right-3 z-10 mt-1 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                        {['priority'].filter((f) => !extraFields.includes(f)).map((f) => (
                          <button
                            key={f}
                            className="block w-full px-3 py-1.5 text-left text-sm capitalize hover:bg-slate-50"
                            onClick={() => { setExtraFields((x) => [...x, f]); setFilterField(f); setAddFieldOpen(false) }}
                          >
                            {f}
                          </button>
                        ))}
                        {extraFields.includes('priority') && <div className="px-3 py-1.5 text-xs text-slate-400">All fields added</div>}
                      </div>
                    )}
                  </div>
                </div>
                <div className="min-w-0 flex-1 p-4">
                  {!filterField && <p className="text-sm text-slate-500">Select a field to start creating a filter.</p>}
                  {filterField === 'parent' && (
                    <CheckList
                      options={[{ value: 'none', label: 'No parent' }, ...parentOptions.map((p) => ({ value: p.id, label: `${p.id} ${p.summary}` }))]}
                      selected={parentFilter}
                      onToggle={(v) => toggleVal(parentFilter, setParentFilter, v)}
                    />
                  )}
                  {filterField === 'assignee' && (
                    <CheckList
                      options={[{ value: 'none', label: 'Unassigned' }, ...members.map((u) => ({ value: u.id, label: u.name }))]}
                      selected={assigneeFilter}
                      onToggle={(v) => toggleVal(assigneeFilter, setAssigneeFilter, v)}
                    />
                  )}
                  {filterField === 'status' && (
                    <CheckList options={STATUSES.map((s) => ({ value: s, label: s }))} selected={statusFilter} onToggle={(v) => toggleVal(statusFilter, setStatusFilter, v)} />
                  )}
                  {filterField === 'type' && (
                    <CheckList options={ISSUE_TYPES.filter((t) => t !== 'Epic' && t !== 'Subtask').map((t) => ({ value: t, label: t }))} selected={typeFilter} onToggle={(v) => toggleVal(typeFilter, setTypeFilter, v)} />
                  )}
                  {filterField === 'labels' && (
                    labelOptions.length === 0
                      ? <p className="text-sm text-slate-500">No labels in this space yet.</p>
                      : <CheckList options={labelOptions.map((l) => ({ value: l, label: l }))} selected={labelFilter} onToggle={(v) => toggleVal(labelFilter, setLabelFilter, v)} />
                  )}
                  {filterField === 'priority' && (
                    <CheckList options={PRIORITIES.map((p) => ({ value: p, label: p }))} selected={priorityFilter} onToggle={(v) => toggleVal(priorityFilter, setPriorityFilter, v)} />
                  )}
                </div>
              </div>
              <div className="border-t border-slate-200 px-4 py-2">
                <button
                  className={clsx('text-sm', filterCount ? 'text-slate-700 hover:underline' : 'cursor-default text-slate-300')}
                  disabled={filterCount === 0}
                  onClick={clearFilters}
                >
                  Clear all
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
            title="View settings"
          >
            <SlidersHorizontal size={14} />
          </button>
          <button
            type="button"
            className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
            title="More options"
          >
            <MoreHorizontal size={14} />
          </button>
        </div>
      </div>

      {/* 2. MAIN SPLIT VIEW: TABLE + GANTT + DRAWER */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left Table + Center Gantt Timeline */}
        <div className="flex min-w-0 flex-1 overflow-hidden">
          <div className="flex w-[520px] shrink-0 flex-col border-r border-slate-200 bg-white z-10">
            <div
              className="grid grid-cols-[minmax(0,1fr)_88px_118px] items-center border-b border-slate-200 bg-[#f7f8f9] text-[12px] font-semibold text-slate-600"
              style={{ height: ROW_H }}
            >
              <div className="flex items-center gap-1 px-3">
                <ChevronRight size={14} className="text-slate-400" />
                <span>Work</span>
              </div>
              <div className="px-2">Status</div>
              <div className="px-2">Assignee</div>
            </div>

            <div
              className="flex items-center border-b border-slate-100 bg-white px-3 text-[12px] font-medium text-slate-500"
              style={{ height: GROUP_H }}
            >
              Sprints
            </div>

            {/* Table Rows */}
            <div className="flex-1 overflow-y-auto">
              {rows.map(({ item, depth, hasChildren, childrenList }) => {
                const isSelected = selectedIssueId === item.id
                const assignee = users.find((u) => u.id === item.assigneeId)
                const isEditing = editingRowId === item.id

                return (
                  <div key={item.id}>
                    <div
                      onClick={() => handleRowClick(item)}
                      className={clsx(
                        'group relative grid grid-cols-[minmax(0,1fr)_88px_118px] items-center border-b border-slate-100 text-[13px] cursor-pointer transition-colors',
                        isSelected ? 'bg-[#e9f2ff]' : 'hover:bg-[#f7f8f9]',
                      )}
                      style={{ height: ROW_H }}
                    >
                      <div
                        className="flex min-w-0 items-center gap-1.5 overflow-hidden pr-2"
                        style={{ paddingLeft: 8 + depth * 16 }}
                      >
                        {hasChildren ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setExpanded((c) => ({ ...c, [item.id]: !c[item.id] }))
                            }}
                            className="shrink-0 rounded p-0.5 text-slate-500 hover:bg-slate-200"
                          >
                            {expanded[item.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        ) : (
                          <span className="inline-flex w-[18px] shrink-0 justify-center text-slate-300">
                            <ChevronRight size={14} />
                          </span>
                        )}

                        <TypeIcon type={item.type} size={16} />

                        <Link
                          to={`/browse/${item.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0 text-[13px] font-medium text-[#0c66e4] hover:underline"
                        >
                          {item.id}
                        </Link>

                        {isEditing ? (
                          <input
                            autoFocus
                            type="text"
                            className="min-w-0 flex-1 rounded border border-blue-500 px-1 py-0.5 text-[13px] text-slate-900 outline-none"
                            value={editingSummaryText}
                            onChange={(e) => setEditingSummaryText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveSummary(item.id)
                              if (e.key === 'Escape') setEditingRowId(null)
                            }}
                            onBlur={() => handleSaveSummary(item.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span
                            className={clsx(
                              'min-w-0 flex-1 truncate text-[13px] text-slate-800',
                              isDone(item.status) && 'text-slate-400 line-through',
                            )}
                            title={item.summary}
                          >
                            {item.summary}
                          </span>
                        )}

                        {!isEditing && (
                          <div className="absolute right-[214px] top-1/2 z-10 hidden -translate-y-1/2 items-center gap-0.5 rounded bg-white/95 px-0.5 shadow-sm group-hover:flex">
                            <button
                              type="button"
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-800"
                              title="Edit summary"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleStartEditSummary(item)
                              }}
                            >
                              <Edit3 size={12} />
                            </button>
                            <button
                              type="button"
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-800"
                              title="Add child work item"
                              onClick={(e) => {
                                e.stopPropagation()
                                setAddingChildParentId(item.id)
                              }}
                            >
                              <Plus size={13} />
                            </button>
                            <button
                              type="button"
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-800"
                              title="More options"
                              onClick={(e) => {
                                e.stopPropagation()
                                showToast(`Actions for ${item.id}`)
                              }}
                            >
                              <MoreHorizontal size={12} />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Status column (Segmented progress bar) */}
                      <div className="px-2">
                        <TimelineStatusBar
                          item={item}
                          childrenList={childrenList}
                          projectKey={project.key}
                        />
                      </div>

                      {/* Assignee column */}
                      <div className="relative min-w-0 px-2" data-assignee-menu onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() =>
                            setAssigneeMenuRowId(assigneeMenuRowId === item.id ? null : item.id)
                          }
                          className="flex items-center gap-1.5 truncate text-xs text-slate-600 hover:text-slate-900 w-full"
                          title={assignee ? assignee.name : 'Unassigned'}
                        >
                          {assignee ? (
                            <Avatar user={assignee} size={20} />
                          ) : (
                            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500">
                              <User size={12} />
                            </span>
                          )}
                          <span className="truncate text-[12px] text-slate-600">
                            {assignee ? assignee.name : 'Unassigned'}
                          </span>
                        </button>

                        {assigneeMenuRowId === item.id && (
                          <div className="absolute left-0 top-7 z-30 w-44 rounded-md border border-slate-200 bg-white py-1 shadow-lg max-h-48 overflow-y-auto">
                            <button
                              type="button"
                              className="w-full px-3 py-1.5 text-left text-xs text-slate-500 hover:bg-slate-100"
                              onClick={() => {
                                workItemService.update(item.id, { assigneeId: null })
                                setAssigneeMenuRowId(null)
                              }}
                            >
                              Unassigned
                            </button>
                            {members.map((u) => (
                              <button
                                key={u.id}
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-slate-100"
                                onClick={() => {
                                  workItemService.update(item.id, { assigneeId: u.id })
                                  setAssigneeMenuRowId(null)
                                }}
                              >
                                <Avatar user={u} size={18} />
                                <span className="truncate">{u.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick Inline Add Child Input */}
                    {addingChildParentId === item.id && (
                      <div className="flex items-center gap-2 border-b border-blue-200 bg-blue-50/60 px-6 py-1.5">
                        <TypeIcon type={item.type === 'Epic' ? 'Task' : 'Subtask'} size={13} />
                        <input
                          autoFocus
                          type="text"
                          className="input flex-1 py-1 text-xs"
                          placeholder={`Add child under ${item.id}...`}
                          value={quickChildSummary}
                          onChange={(e) => setQuickChildSummary(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleQuickAddChild(item.id)
                            if (e.key === 'Escape') setAddingChildParentId(null)
                          }}
                        />
                        <button
                          type="button"
                          className="btn-primary py-0.5 px-2 text-xs"
                          onClick={() => handleQuickAddChild(item.id)}
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          className="btn-subtle py-0.5 px-1.5 text-xs"
                          onClick={() => setAddingChildParentId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="flex h-10 shrink-0 items-center justify-between border-t border-slate-200 bg-white px-3 text-[13px] text-slate-500">
              <button
                type="button"
                onClick={() => openCreate({ projectId: project.id })}
                className="flex items-center gap-1 font-medium text-slate-700 hover:text-[#0c66e4]"
              >
                <Plus size={14} />
                <span>Create</span>
              </button>
              <span>{rows.length} of {rows.length}</span>
            </div>
          </div>

          {/* CENTER GANTT TIMELINE CHART */}
          <div ref={scroller} className="flex-1 overflow-x-auto overflow-y-auto bg-white">
            <div style={{ width }} className="relative min-h-full">
              <div
                className="relative border-b border-slate-200 bg-[#f7f8f9]"
                style={{ height: ROW_H }}
              >
                {headers.map((h) => (
                  <div
                    key={h.d.toISOString()}
                    className="absolute top-0 h-full border-l border-slate-200 px-3 pt-2.5 text-[13px] font-semibold text-slate-700 select-none"
                    style={{ left: x(h.d) }}
                  >
                    {h.label}
                  </div>
                ))}
              </div>

              <div
                className="relative border-b border-slate-100 bg-white"
                style={{ height: GROUP_H }}
              >
                {headers.map((h) => (
                  <div
                    key={h.d.toISOString()}
                    className="absolute top-0 h-full border-l border-slate-100"
                    style={{ left: x(h.d) }}
                  />
                ))}
              </div>

              <div
                className="absolute bottom-0 z-20 w-px bg-[#0c66e4]"
                style={{ left: x(today), top: ROW_H }}
                title="Today"
              >
                <div className="absolute -top-[5px] left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 bg-[#0c66e4]" />
              </div>

              {/* Rows Bars */}
              {rows.map(({ item }) => {
                const s = item.startDate
                  ? parseISO(item.startDate)
                  : item.dueDate
                  ? addDays(parseISO(item.dueDate), -5)
                  : null
                const e = item.dueDate ? parseISO(item.dueDate) : s ? addDays(s, 6) : null
                const isSelected = selectedIssueId === item.id

                return (
                  <div
                    key={item.id}
                    onClick={() => handleRowClick(item)}
                    className={clsx(
                      'relative border-b border-slate-100 cursor-pointer transition-colors',
                      isSelected ? 'bg-blue-50/40' : 'hover:bg-slate-50/50',
                    )}
                    style={{ height: ROW_H }}
                  >
                    {headers.map((h) => (
                      <div
                        key={h.d.toISOString()}
                        className="absolute top-0 h-full border-l border-slate-100"
                        style={{ left: x(h.d) }}
                      />
                    ))}

                    {s && e && (
                      <div
                        title={`${item.id} ${item.summary} (${format(s, 'dd MMM')} – ${format(e, 'dd MMM')})`}
                        className="absolute top-2 flex h-5 items-center gap-1.5 overflow-hidden rounded px-2 text-[11px] font-medium text-white shadow-2xs hover:brightness-110 transition-all"
                        style={{
                          left: x(s),
                          width: Math.max(px * 4, (differenceInCalendarDays(e, s) + 1) * px),
                          background: item.type === 'Epic' ? '#8f7ee7' : '#0c66e4',
                        }}
                      >
                        <span className="truncate">{item.id} {item.summary}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* 3. RIGHT JIRA WORK ITEM DETAIL DRAWER */}
        {selectedIssueId && (() => {
          const opened = allItems.find((i) => i.id === selectedIssueId)
          if (!opened || (opened.type !== 'Task' && opened.type !== 'Story' && opened.type !== 'Bug')) return null
          return (
            <WorkItemDrawer
              itemId={selectedIssueId}
              onClose={() => {
                searchParams.delete('selectedIssue')
                setSearchParams(searchParams)
              }}
            />
          )
        })()}
      </div>

      {/* 4. BOTTOM VIEW SWITCHER BAR (Today, Weeks, Months, Quarters) */}
      <div className="pointer-events-none absolute bottom-3 left-[520px] right-0 z-30 flex justify-center">
        <div className="pointer-events-auto flex items-center rounded-lg border border-slate-300 bg-white p-0.5 shadow-md">
          <button
            type="button"
            onClick={scrollToday}
            className="rounded px-2.5 py-1 text-[13px] font-medium text-slate-700 hover:bg-slate-100"
          >
            Today
          </button>
          <div className="mx-0.5 h-4 w-px bg-slate-200" />
          {(['weeks', 'months', 'quarters'] as Zoom[]).map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setZoom(z)}
              className={clsx(
                'rounded px-2.5 py-1 text-[13px] font-medium capitalize',
                zoom === z ? 'bg-[#e9f2ff] text-[#0c66e4]' : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              {z}
            </button>
          ))}
          <div className="mx-0.5 h-4 w-px bg-slate-200" />
          <button type="button" className="p-1 text-slate-400 hover:text-slate-600" title="Timeline information">
            <Info size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

function CheckList({ options, selected, onToggle }: { options: { value: string; label: string }[]; selected: string[]; onToggle: (value: string) => void }) {
  const [q, setQ] = useState('')
  const list = options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()))
  return (
    <div>
      {options.length > 8 && <input className="input mb-2" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />}
      <div className="max-h-52 overflow-auto">
        {list.length === 0 && <div className="text-sm text-slate-500">No matches</div>}
        {list.map((o) => (
          <label key={o.value} className="flex items-center gap-2 rounded px-1 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
            <input type="checkbox" checked={selected.includes(o.value)} onChange={() => onToggle(o.value)} />
            <span className="truncate">{o.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
