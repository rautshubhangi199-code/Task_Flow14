import { useMemo, useRef, useState, useEffect } from 'react'
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
  GripVertical,
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
import { workItemService } from '../../services/api'
import type { WorkItem } from '../../types'
import { Avatar, TypeIcon } from '../../components/ui'
import { StatusDropdown } from '../../components/StatusDropdown'
import { WorkItemDrawer } from '../../components/WorkItemDrawer'

type Zoom = 'weeks' | 'months' | 'quarters'
const PX: Record<Zoom, number> = { weeks: 32, months: 10, quarters: 4 }
const ROW_H = 38

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
  const hasChildren = childrenList.length > 0

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
        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
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
    <div className="relative flex items-center w-full" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setDropdownOpen((o) => !o)}
        className="w-full flex items-center py-1 group"
        title={`Status: ${item.status} (Click to change)`}
      >
        <div
          className={clsx(
            'h-1.5 w-full rounded-full transition-all group-hover:h-2',
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
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null)

  // Inline editing states for row summaries
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [editingSummaryText, setEditingSummaryText] = useState('')

  // Quick inline add child
  const [addingChildParentId, setAddingChildParentId] = useState<string | null>(null)
  const [quickChildSummary, setQuickChildSummary] = useState('')

  // Assignee dropdown
  const [assigneeMenuRowId, setAssigneeMenuRowId] = useState<string | null>(null)

  const scroller = useRef<HTMLDivElement>(null)

  const items = useMemo(() => {
    let list = allItems.filter((i) => i.projectId === project.id)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter((i) => i.summary.toLowerCase().includes(q) || i.id.toLowerCase().includes(q))
    }
    if (assigneeFilter) {
      list = list.filter((i) => i.assigneeId === assigneeFilter)
    }
    return list
  }, [allItems, project.id, searchQuery, assigneeFilter])

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

  // Automatically select first issue on load so the drawer is open like Jira
  useEffect(() => {
    if (!selectedIssueId && items.length > 0) {
      const candidate =
        items.find((i) => i.id === 'OT-3') ||
        items.find((i) => i.type === 'Epic') ||
        items[0]
      if (candidate) {
        setSearchParams({ selectedIssue: candidate.id }, { replace: true })
      }
    }
  }, [items, selectedIssueId, setSearchParams])

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
          label: format(d, 'MMMM yyyy'),
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
    setSearchParams({ selectedIssue: item.id })
  }

  return (
    <div className="flex h-full flex-col bg-white overflow-hidden select-none">
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

        {/* User Avatars Filter */}
        <div className="flex items-center -space-x-1.5 overflow-hidden pl-1">
          {users.slice(0, 5).map((u) => (
            <button
              key={u.id}
              onClick={() => setAssigneeFilter(assigneeFilter === u.id ? null : u.id)}
              className={clsx(
                'rounded-full ring-2 transition-transform hover:z-10 hover:scale-105',
                assigneeFilter === u.id ? 'ring-blue-600 scale-105 z-10' : 'ring-white',
              )}
              title={u.name}
            >
              <Avatar user={u} size={22} />
            </button>
          ))}
          {users.length > 5 && (
            <span className="flex h-5 items-center justify-center rounded-full bg-slate-100 px-1 text-[9px] font-semibold text-slate-600 ring-2 ring-white">
              +{users.length - 5}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            setSearchQuery('')
            setAssigneeFilter(null)
          }}
          className={clsx(
            'flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium transition-colors',
            searchQuery || assigneeFilter
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-slate-300 text-slate-700 hover:bg-slate-50',
          )}
        >
          <Filter size={12} />
          <span>Filter</span>
        </button>

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
          {/* LEFT TABLE: Work (180px), Status (70px), Assignee (100px) */}
          <div className="flex w-[350px] shrink-0 flex-col border-r border-slate-200 bg-white shadow-2xs z-10">
            {/* Table Header */}
            <div
              className="grid grid-cols-[1fr_70px_100px] items-center border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-600"
              style={{ height: ROW_H }}
            >
              <div className="flex items-center gap-1 px-3">
                <ChevronRight size={13} className="text-slate-400" />
                <span>Work</span>
              </div>
              <div className="px-2">Status</div>
              <div className="px-2">Assignee</div>
            </div>

            {/* Sprints Group Heading */}
            <div className="bg-slate-50/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100">
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
                        'group grid grid-cols-[1fr_70px_100px] items-center border-b border-slate-100 text-xs cursor-pointer transition-colors',
                        isSelected ? 'bg-blue-50/70 font-medium' : 'hover:bg-slate-50',
                      )}
                      style={{ height: ROW_H }}
                    >
                      {/* Work column */}
                      <div
                        className="flex items-center gap-1.5 min-w-0 pr-1 overflow-hidden"
                        style={{ paddingLeft: Math.max(6, 6 + depth * 14) }}
                      >
                        <GripVertical
                          size={12}
                          className="text-slate-300 opacity-0 group-hover:opacity-100 shrink-0 cursor-grab"
                        />

                        {hasChildren ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setExpanded((c) => ({ ...c, [item.id]: !c[item.id] }))
                            }}
                            className="rounded p-0.5 hover:bg-slate-200 shrink-0"
                          >
                            {expanded[item.id] ? (
                              <ChevronDown size={13} />
                            ) : (
                              <ChevronRight size={13} />
                            )}
                          </button>
                        ) : (
                          <span className="w-3 shrink-0" />
                        )}

                        <TypeIcon type={item.type} size={14} />

                        <Link
                          to={`/browse/${item.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0 text-xs font-semibold text-slate-600 hover:text-blue-600 hover:underline"
                        >
                          {item.id}
                        </Link>

                        {/* Inline Editable Summary */}
                        {isEditing ? (
                          <input
                            autoFocus
                            type="text"
                            className="w-full rounded border border-blue-500 px-1 py-0.5 text-xs text-slate-900 outline-none"
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
                              'truncate text-xs text-slate-800',
                              isDone(item.status) && 'line-through text-slate-400',
                            )}
                            title={item.summary}
                          >
                            {item.summary}
                          </span>
                        )}

                        {/* Hover Action Buttons (Edit, Add, More) */}
                        {!isEditing && (
                          <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 bg-white/90 rounded px-0.5">
                            <button
                              type="button"
                              className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-800"
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
                              className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-800"
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
                              className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-800"
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
                      <div className="relative px-2 min-w-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() =>
                            setAssigneeMenuRowId(assigneeMenuRowId === item.id ? null : item.id)
                          }
                          className="flex items-center gap-1.5 truncate text-xs text-slate-600 hover:text-slate-900 w-full"
                          title={assignee ? assignee.name : 'Unassigned'}
                        >
                          {assignee ? (
                            <Avatar user={assignee} size={18} />
                          ) : (
                            <User size={13} className="text-slate-400 shrink-0" />
                          )}
                          <span className="truncate text-[11px]">
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
                            {users.map((u) => (
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

            {/* Table Footer: + Create & Count */}
            <div className="flex h-9 items-center justify-between border-t border-slate-200 px-4 text-xs text-slate-500 bg-slate-50/50 shrink-0">
              <button
                type="button"
                onClick={() => openCreate({ projectId: project.id })}
                className="flex items-center gap-1 font-semibold text-slate-700 hover:text-blue-600"
              >
                <Plus size={13} />
                <span>Create</span>
              </button>
              <span>{rows.length} of {rows.length}</span>
            </div>
          </div>

          {/* CENTER GANTT TIMELINE CHART */}
          <div ref={scroller} className="flex-1 overflow-x-auto overflow-y-auto bg-white">
            <div style={{ width }} className="relative min-h-full">
              {/* Header dates row */}
              <div
                className="relative border-b border-slate-200 bg-slate-50/80"
                style={{ height: ROW_H }}
              >
                {headers.map((h) => (
                  <div
                    key={h.d.toISOString()}
                    className="absolute top-0 h-full border-l border-slate-200 px-2.5 pt-2 text-xs font-semibold text-slate-600 select-none"
                    style={{ left: x(h.d) }}
                  >
                    {h.label}
                  </div>
                ))}
              </div>

              {/* Today line indicator */}
              <div
                className="absolute bottom-0 top-[38px] z-20 w-0.5 bg-blue-600"
                style={{ left: x(today) }}
                title="Today"
              >
                <div className="absolute -top-1 -left-[3px] h-2 w-2 rounded-full bg-blue-600" />
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
                        title={`${item.id}: ${item.summary} (${format(s, 'dd MMM')} – ${format(e, 'dd MMM')})`}
                        className="absolute top-2 flex h-5 items-center gap-1.5 overflow-hidden rounded px-2 text-[11px] font-medium text-white shadow-2xs hover:brightness-110 transition-all"
                        style={{
                          left: x(s),
                          width: Math.max(px * 3, (differenceInCalendarDays(e, s) + 1) * px),
                          background: item.type === 'Epic' ? '#8f7ee7' : '#0c66e4',
                        }}
                      >
                        <span className="truncate">{item.summary}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* 3. RIGHT JIRA WORK ITEM DETAIL DRAWER */}
        {selectedIssueId && (
          <WorkItemDrawer
            itemId={selectedIssueId}
            onClose={() => {
              searchParams.delete('selectedIssue')
              setSearchParams(searchParams)
            }}
          />
        )}
      </div>

      {/* 4. BOTTOM VIEW SWITCHER BAR (Today, Weeks, Months, Quarters) */}
      <div className="flex h-11 shrink-0 items-center justify-center border-t border-slate-200 bg-white px-6">
        <div className="flex items-center rounded-lg border border-slate-300 bg-white p-0.5 shadow-2xs">
          <button
            type="button"
            onClick={scrollToday}
            className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded"
          >
            Today
          </button>
          <div className="h-3.5 w-px bg-slate-200 mx-0.5" />
          {(['weeks', 'months', 'quarters'] as Zoom[]).map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setZoom(z)}
              className={clsx(
                'px-2.5 py-1 text-xs font-semibold capitalize rounded transition-colors',
                zoom === z
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 font-bold'
                  : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              {z}
            </button>
          ))}
          <div className="h-3.5 w-px bg-slate-200 mx-0.5" />
          <button
            type="button"
            className="p-1 text-slate-400 hover:text-slate-600"
            title="Timeline information"
          >
            <Info size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}
