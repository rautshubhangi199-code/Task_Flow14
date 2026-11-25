import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { addDays, format } from 'date-fns'
import { DndContext, DragOverlay, PointerSensor, pointerWithin, rectIntersection, useDraggable, useDroppable, useSensor, useSensors, type CollisionDetection, type DragEndEvent } from '@dnd-kit/core'
import { ChevronDown, ChevronRight, Edit3, Filter, MoreHorizontal, Pencil, Plus, Search } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useCurrentUser } from '../../store/hooks'
import { useUi } from '../../store/uiStore'
import { useProject } from './projectContext'
import { sprintService, userAdminService, workItemService } from '../../services/api'
import { canManageSprints } from '../../lib/permissions'
import { fmtDate, isDone, todayStr } from '../../lib/utils'
import { ISSUE_TYPES, PRIORITIES, STATUSES, type Priority, type Sprint, type Status, type WorkItem } from '../../types'
import { Avatar, Dropdown, MenuItem, Modal, TypeIcon } from '../../components/ui'
import { StatusDropdown } from '../../components/StatusDropdown'
import { WorkItemDrawer } from '../../components/WorkItemDrawer'

const TODO = new Set<Status>(['To Do', 'On Hold'])
const PROG = new Set<Status>(['In Progress', 'Developers Done', 'QA-Done'])

function pts(items: WorkItem[], pred: (i: WorkItem) => boolean) {
  return items.filter(pred).reduce((a, i) => a + (i.storyPoints ?? 0), 0)
}

function EstimatePills({ items }: { items: WorkItem[] }) {
  return (
    <div className="flex items-center gap-1 text-[11px] font-medium">
      <span className="rounded bg-slate-200 px-1.5 py-0.5 text-slate-700" title="To do">{pts(items, (i) => TODO.has(i.status))}</span>
      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-800" title="In progress">{pts(items, (i) => PROG.has(i.status))}</span>
      <span className="rounded bg-green-100 px-1.5 py-0.5 text-green-800" title="Done">{pts(items, (i) => isDone(i.status))}</span>
    </div>
  )
}

function RowView({ item, overlay, selected, issueOpen, onSelect, onOpen }: { item: WorkItem; overlay?: boolean; selected?: boolean; issueOpen?: boolean; onSelect?: (id: string, on: boolean) => void; onOpen?: (id: string) => void }) {
  const project = useProject()
  const users = useStore((s) => s.users)
  const items = useStore((s) => s.items)
  const members = users
  const assignee = users.find((u) => u.id === item.assigneeId)
  const parent = items.find((i) => i.id === item.parentId)

  const [editingSummary, setEditingSummary] = useState(false)
  const [summaryText, setSummaryText] = useState(item.summary)

  const handleSaveSummary = () => {
    const trimmed = summaryText.trim()
    if (trimmed && trimmed !== item.summary) {
      workItemService.update(item.id, { summary: trimmed })
    }
    setEditingSummary(false)
  }

  return (
    <div className={clsx('group flex items-center gap-2 border-b border-slate-100 bg-white px-2 py-1.5 text-sm hover:bg-slate-50', overlay && 'w-[860px] rounded border shadow-xl', selected && 'bg-brand-50', issueOpen && 'bg-blue-50')}>
      {onSelect && (
        <input type="checkbox" checked={!!selected} onChange={(e) => onSelect(item.id, e.target.checked)} onPointerDown={(e) => e.stopPropagation()} />
      )}
      <TypeIcon type={item.type} />
      <button
        type="button"
        className="w-[72px] shrink-0 text-left text-xs font-semibold text-slate-600 hover:text-blue-600 hover:underline"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onOpen?.(item.id) }}
      >
        {item.id}
      </button>

      {/* Inline editable summary */}
      {editingSummary ? (
        <input
          autoFocus
          className="flex-1 rounded border border-blue-500 px-1.5 py-0.5 text-xs text-slate-900 outline-none"
          value={summaryText}
          onChange={(e) => setSummaryText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSaveSummary()
            if (e.key === 'Escape') {
              setSummaryText(item.summary)
              setEditingSummary(false)
            }
          }}
          onBlur={handleSaveSummary}
          onPointerDown={(e) => e.stopPropagation()}
        />
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span
            className={clsx('min-w-0 flex-1 truncate cursor-grab hover:underline', isDone(item.status) && 'text-slate-400 line-through')}
            onClick={() => onOpen ? onOpen(item.id) : setEditingSummary(true)}
            title="Drag to a sprint, or click to open"
          >
            {item.summary}
          </span>
          <button
            type="button"
            className="rounded p-0.5 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-slate-200 hover:text-slate-700"
            onClick={(e) => {
              e.stopPropagation()
              setEditingSummary(true)
            }}
            onPointerDown={(e) => e.stopPropagation()}
            title="Edit summary"
          >
            <Edit3 size={12} />
          </button>
        </div>
      )}

      {/* Parent / Epic pill if present */}
      {parent && (
        <span className="rounded bg-purple-50 border border-purple-200 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 truncate max-w-28" title={`${parent.id}: ${parent.summary}`}>
          {parent.id}
        </span>
      )}

      {item.labels.map((l) => (
        <span key={l} className="rounded bg-purple-100 px-1.5 py-0.5 text-[11px] text-purple-800">{l}</span>
      ))}

      {/* Status Dropdown with Add status, Edit status, Manage workflow */}
      <div onPointerDown={(e) => e.stopPropagation()}>
        <StatusDropdown
          value={item.status}
          onChange={(s) => workItemService.update(item.id, { status: s })}
          projectKey={project.key}
          variant="compact"
        />
      </div>

      {/* Priority Selector */}
      <div className="relative" onPointerDown={(e) => e.stopPropagation()}>
        <select
          className="rounded border border-transparent hover:border-slate-200 bg-transparent px-1 py-0.5 text-xs text-slate-700 cursor-pointer"
          value={item.priority}
          onChange={(e) => workItemService.update(item.id, { priority: e.target.value as Priority })}
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* Assignee Selector */}
      <div className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
        <select
          className="w-8 appearance-none bg-transparent cursor-pointer"
          value={item.assigneeId ?? ''}
          title={assignee ? assignee.name : 'Unassigned'}
          onChange={(e) => workItemService.update(item.id, { assigneeId: e.target.value || null })}
        >
          <option value="">—</option>
          {members.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <Avatar user={assignee} size={20} />
      </div>

      {/* Story points */}
      <div onPointerDown={(e) => e.stopPropagation()}>
        <input
          type="text"
          className="w-7 rounded bg-slate-100 text-center text-xs font-semibold text-slate-600 hover:bg-slate-200 border-0 outline-none"
          value={item.storyPoints?.toString() ?? ''}
          placeholder="-"
          title="Story points"
          onChange={(e) => {
            const val = e.target.value.trim()
            if (!val) {
              workItemService.update(item.id, { storyPoints: null })
            } else if (!isNaN(Number(val))) {
              workItemService.update(item.id, { storyPoints: Number(val) })
            }
          }}
        />
      </div>
    </div>
  )
}

function Row({ item, selected, issueOpen, onSelect, onOpen }: { item: WorkItem; selected: boolean; issueOpen?: boolean; onSelect: (id: string, on: boolean) => void; onOpen?: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id })
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={clsx(isDragging && 'opacity-40')}>
      <RowView item={item} selected={selected} issueOpen={issueOpen} onSelect={onSelect} onOpen={onOpen} />
    </div>
  )
}

function SprintForm({
  title,
  initial,
  submitLabel,
  onClose,
  onSubmit,
}: {
  title: string
  initial: { name: string; goal: string; startDate: string; endDate: string }
  submitLabel: string
  onClose: () => void
  onSubmit: (v: { name: string; goal: string; startDate: string; endDate: string }) => Promise<void> | void
}) {
  const [name, setName] = useState(initial.name)
  const [goal, setGoal] = useState(initial.goal)
  const [startDate, setStartDate] = useState(initial.startDate)
  const [endDate, setEndDate] = useState(initial.endDate)
  const [duration, setDuration] = useState('14')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const applyDuration = (days: string, start: string) => {
    setDuration(days)
    if (days !== 'custom' && start) setEndDate(format(addDays(new Date(start), Number(days)), 'yyyy-MM-dd'))
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      width={520}
      footer={
        <>
          <button className="btn-subtle" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              setError(null)
              try {
                await onSubmit({ name, goal, startDate, endDate })
                onClose()
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Could not save sprint')
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? 'Saving…' : submitLabel}
          </button>
        </>
      }
    >
      {error && <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <label className="label">Sprint name</label>
      <input className="input mb-3" value={name} onChange={(e) => setName(e.target.value)} />
      <label className="label">Duration</label>
      <select className="input mb-3" value={duration} onChange={(e) => applyDuration(e.target.value, startDate)}>
        <option value="7">1 week</option>
        <option value="14">2 weeks</option>
        <option value="21">3 weeks</option>
        <option value="28">4 weeks</option>
        <option value="custom">Custom</option>
      </select>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <div>
          <label className="label">Start date</label>
          <input type="date" className="input" value={startDate} onChange={(e) => { setStartDate(e.target.value); if (duration !== 'custom') applyDuration(duration, e.target.value) }} />
        </div>
        <div>
          <label className="label">End date</label>
          <input type="date" className="input" value={endDate} onChange={(e) => { setEndDate(e.target.value); setDuration('custom') }} />
        </div>
      </div>
      <label className="label">Sprint goal</label>
      <textarea className="input min-h-20" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="What do you want to achieve?" />
    </Modal>
  )
}

export default function Backlog() {
  const project = useProject()
  const me = useCurrentUser()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedIssueId = searchParams.get('selectedIssue')
  const closeIssue = () => {
    searchParams.delete('selectedIssue')
    setSearchParams(searchParams)
  }
  const allItems = useStore((s) => s.items)
  const openIssue = (id: string) => {
    const item = allItems.find((i) => i.id === id)
    if (!item || (item.type !== 'Task' && item.type !== 'Story' && item.type !== 'Bug')) return
    setSearchParams({ selectedIssue: id })
  }
  const allSprints = useStore((s) => s.sprints)
  const users = useStore((s) => s.users)
  const openCreate = useUi((s) => s.openCreateItem)
  const showToast = useUi((s) => s.showToast)
  const [completing, setCompleting] = useState<Sprint | null>(null)
  const [editing, setEditing] = useState<Sprint | null>(null)
  const [starting, setStarting] = useState<Sprint | null>(null)
  const [deleting, setDeleting] = useState<Sprint | null>(null)
  const [creating, setCreating] = useState(false)
  const [moveTo, setMoveTo] = useState('')
  const [showCompleted, setShowCompleted] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [q, setQ] = useState('')
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
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const manage = canManageSprints(me)

  const sprints = useMemo(() => allSprints.filter((s) => s.projectId === project.id), [allSprints, project.id])
  const members = users

  useEffect(() => {
    let cancelled = false
    void userAdminService.list()
      .then((rows) => {
        if (cancelled || !rows.length) return
        const existing = useStore.getState().users
        const seen = new Set(existing.map((u) => `${u.id}|${u.email.toLowerCase()}`))
        const extra = rows.filter((u) => !seen.has(`${u.id}|${u.email.toLowerCase()}`) && !existing.some((e) => e.id === u.id || e.email.toLowerCase() === u.email.toLowerCase()))
        if (extra.length) useStore.setState({ users: [...existing, ...extra] })
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])
  const items = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return allItems.filter((i) => {
      if (i.projectId !== project.id || i.type === 'Epic' || i.type === 'Subtask') return false
      if (ql && !i.summary.toLowerCase().includes(ql) && !i.id.toLowerCase().includes(ql)) return false
      if (assigneeFilter.length && !assigneeFilter.includes(i.assigneeId ?? 'none')) return false
      if (typeFilter.length && !typeFilter.includes(i.type)) return false
      if (statusFilter.length && !statusFilter.includes(i.status)) return false
      if (parentFilter.length && !parentFilter.includes(i.parentId ?? 'none')) return false
      if (labelFilter.length && !labelFilter.some((l) => i.labels.includes(l))) return false
      if (priorityFilter.length && !priorityFilter.includes(i.priority)) return false
      return true
    })
  }, [allItems, project.id, q, assigneeFilter, typeFilter, statusFilter, parentFilter, labelFilter, priorityFilter])

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

  const active = sprints.filter((s) => s.state === 'active')
  const planned = sprints.filter((s) => s.state === 'planned')
  const completed = sprints.filter((s) => s.state === 'completed')
  const backlogItems = items.filter((i) => !i.sprintId || !sprints.some((s) => s.id === i.sprintId))
  const droppableIds = useMemo(
    () => new Set(['backlog', ...sprints.filter((s) => s.state !== 'completed').map((s) => s.id)]),
    [sprints],
  )

  const collisionDetection: CollisionDetection = (args) => {
    const pointerHits = pointerWithin(args)
    const pointerContainers = pointerHits.filter((c) => droppableIds.has(String(c.id)))
    if (pointerContainers.length) return pointerContainers
    const rectHits = rectIntersection(args).filter((c) => droppableIds.has(String(c.id)))
    return rectHits.length ? rectHits : pointerHits
  }

  const sprintForOver = (overId: string): string | null => {
    if (overId === 'backlog') return null
    if (droppableIds.has(overId) && overId !== 'backlog') return overId
    const overItem = allItems.find((i) => i.id === overId)
    if (!overItem) return null
    return overItem.sprintId && droppableIds.has(overItem.sprintId) ? overItem.sprintId : null
  }

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    if (!e.over) return
    const item = allItems.find((i) => i.id === e.active.id)
    if (!item) return
    const nextSprintId = sprintForOver(String(e.over.id))
    const currentSprintId = item.sprintId && droppableIds.has(item.sprintId) ? item.sprintId : null
    if (currentSprintId !== nextSprintId) workItemService.update(item.id, { sprintId: nextSprintId })
  }

  const toggleSelect = (id: string, on: boolean) => setSelected((s) => (on ? [...s, id] : s.filter((x) => x !== id)))
  const setAll = (ids: string[], on: boolean) => setSelected((s) => on ? [...new Set([...s, ...ids])] : s.filter((id) => !ids.includes(id)))

  const run = async (fn: () => Promise<unknown> | unknown, ok?: string) => {
    setError(null)
    try {
      await fn()
      if (ok) showToast(ok)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sprint action failed')
      throw e
    }
  }

  const moveSelected = (sprintId: string | null) => {
    selected.forEach((id) => workItemService.update(id, { sprintId }))
    setSelected([])
  }

  const sprintBlock = (s: Sprint) => {
    const list = items.filter((i) => i.sprintId === s.id)
    const ids = list.map((i) => i.id)
    const allOn = ids.length > 0 && ids.every((id) => selected.includes(id))
    return (
      <SprintSection
        key={s.id}
        sprint={s}
        items={list}
        selected={selected}
        allOn={allOn}
        manage={manage}
        hasActive={active.length > 0}
        onToggleAll={(on) => setAll(ids, on)}
        onSelect={toggleSelect}
        onCreate={() => openCreate({ projectId: project.id, sprintId: s.id })}
        onStart={() => setStarting(s)}
        onComplete={() => { setCompleting(s); setMoveTo(planned[0]?.id ?? '') }}
        onEdit={() => setEditing(s)}
        onDelete={() => setDeleting(s)}
        onReport={() => navigate(`/projects/${project.key}/reports?sprint=${s.id}`)}
        openIssueId={selectedIssueId}
        onOpenIssue={openIssue}
      />
    )
  }

  const incomplete = completing ? items.filter((i) => i.sprintId === completing.id && !isDone(i.status)) : []
  const completeCount = completing ? items.filter((i) => i.sprintId === completing.id && isDone(i.status)).length : 0
  const startDefaults = (s: Sprint) => ({
    name: s.name,
    goal: s.goal,
    startDate: s.startDate ?? todayStr(),
    endDate: s.endDate ?? format(addDays(new Date(), 14), 'yyyy-MM-dd'),
  })

  return (
    <div className="flex h-full min-h-0">
    <div className="min-w-0 flex-1 space-y-3 overflow-auto p-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-56">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-8" placeholder="Search backlog" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex -space-x-1">
          {members.map((u) => (
            <button key={u.id} title={u.name} onClick={() => setAssigneeFilter((f) => (f.includes(u.id) ? f.filter((x) => x !== u.id) : [...f, u.id]))} className={clsx('rounded-full ring-2', assigneeFilter.includes(u.id) ? 'ring-brand-600' : 'ring-white')}>
              <Avatar user={u} size={28} />
            </button>
          ))}
        </div>
        <div className="relative" ref={filterRef}>
          <button
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
        {selected.length > 0 && (
          <div className="ml-2 flex items-center gap-2 text-sm">
            <span>{selected.length} selected</span>
            <select className="input w-44" defaultValue="" onChange={(e) => { if (e.target.value === 'backlog') moveSelected(null); else if (e.target.value) moveSelected(e.target.value); e.target.value = '' }}>
              <option value="" disabled>Move to…</option>
              <option value="backlog">Backlog</option>
              {sprints.filter((s) => s.state !== 'completed').map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button className="text-xs text-slate-500 hover:underline" onClick={() => setSelected([])}>Clear</button>
          </div>
        )}
        {project.type === 'Kanban' && <span className="text-xs text-slate-500">Kanban space – sprints are optional</span>}
      </div>
      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={(e) => setActiveId(String(e.active.id))} onDragCancel={() => setActiveId(null)} onDragEnd={onDragEnd}>
        {active.map(sprintBlock)}
        {planned.map(sprintBlock)}
        <BacklogSection
          items={backlogItems}
          selected={selected}
          manage={manage}
          onToggleAll={(on) => setAll(backlogItems.map((i) => i.id), on)}
          onSelect={toggleSelect}
          onCreate={() => openCreate({ projectId: project.id })}
          onCreateSprint={() => setCreating(true)}
          openIssueId={selectedIssueId}
          onOpenIssue={openIssue}
        />
        <DragOverlay>{activeId ? (() => { const it = allItems.find((i) => i.id === activeId); return it ? <RowView item={it} overlay /> : null })() : null}</DragOverlay>
      </DndContext>

      {completed.length > 0 && (
        <div className="rounded-lg border border-slate-200 p-2">
          <button className="flex items-center gap-1 text-sm font-semibold text-slate-600" onClick={() => setShowCompleted((o) => !o)}>
            {showCompleted ? <ChevronDown size={16} /> : <ChevronRight size={16} />} Completed sprints ({completed.length})
          </button>
          {showCompleted && completed.map((s) => {
            const si = allItems.filter((i) => i.sprintId === s.id)
            return (
              <div key={s.id} className="mt-2 rounded bg-slate-50 p-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {s.name}
                  <span className="text-xs font-normal text-slate-500">{fmtDate(s.startDate)} – {fmtDate(s.endDate)} · {si.length} items</span>
                  <button className="ml-auto text-xs text-brand-700 hover:underline" onClick={() => navigate(`/projects/${project.key}/reports?sprint=${s.id}`)}>Sprint report</button>
                </div>
                {si.map((i) => <div key={i.id} className="flex gap-2 py-0.5 pl-4 text-sm"><TypeIcon type={i.type} /><Link className="text-slate-600 hover:underline" to={`/browse/${i.id}`}>{i.id} {i.summary}</Link></div>)}
              </div>
            )
          })}
        </div>
      )}

      {starting && (
        <SprintForm
          title={`Start sprint: ${starting.name}`}
          initial={startDefaults(starting)}
          submitLabel="Start"
          onClose={() => setStarting(null)}
          onSubmit={(v) => run(() => sprintService.start(starting.id, v), `${v.name} started`)}
        />
      )}
      {editing && (
        <SprintForm
          title={`Edit sprint`}
          initial={startDefaults(editing)}
          submitLabel="Save"
          onClose={() => setEditing(null)}
          onSubmit={(v) => run(() => sprintService.update(editing.id, v), 'Sprint updated')}
        />
      )}
      {creating && (
        <SprintForm
          title="Create sprint"
          initial={{ name: `${project.key} Sprint ${sprints.length + 1}`, goal: '', startDate: todayStr(), endDate: format(addDays(new Date(), 14), 'yyyy-MM-dd') }}
          submitLabel="Create"
          onClose={() => setCreating(false)}
          onSubmit={(v) => run(() => sprintService.create(project.id, v), 'Sprint created')}
        />
      )}
      <Modal
        open={!!completing}
        onClose={() => setCompleting(null)}
        title={`Complete ${completing?.name ?? ''}`}
        width={480}
        footer={
          <>
            <button className="btn-subtle" onClick={() => setCompleting(null)}>Cancel</button>
            <button className="btn-primary" onClick={() => { if (completing) run(() => sprintService.complete(completing.id, moveTo || null), 'Sprint completed'); setCompleting(null) }}>Complete sprint</button>
          </>
        }
      >
        <p className="text-sm">This sprint contains <b>{completeCount}</b> completed and <b>{incomplete.length}</b> open work items.</p>
        {incomplete.length > 0 && (
          <div className="mt-4">
            <label className="label">Move open work items to</label>
            <select className="input" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
              <option value="">Backlog</option>
              {planned.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
      </Modal>
      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Delete ${deleting?.name ?? ''}`}
        width={440}
        footer={
          <>
            <button className="btn-subtle" onClick={() => setDeleting(null)}>Cancel</button>
            <button className="btn-danger" onClick={() => { if (deleting) run(() => sprintService.remove(deleting.id), 'Sprint deleted'); setDeleting(null) }}>Delete</button>
          </>
        }
      >
        <p className="text-sm">Work items in this sprint will be moved to the backlog. This cannot be undone.</p>
      </Modal>
    </div>
    {selectedIssueId && (() => {
      const opened = allItems.find((i) => i.id === selectedIssueId)
      return opened && (opened.type === 'Task' || opened.type === 'Story' || opened.type === 'Bug')
        ? <WorkItemDrawer itemId={selectedIssueId} onClose={closeIssue} />
        : null
    })()}
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

function SprintSection({ sprint, items, selected, allOn, manage, hasActive, onToggleAll, onSelect, onCreate, onStart, onComplete, onEdit, onDelete, onReport, openIssueId, onOpenIssue }: {
  sprint: Sprint
  items: WorkItem[]
  selected: string[]
  allOn: boolean
  manage: boolean
  hasActive: boolean
  onToggleAll: (on: boolean) => void
  onSelect: (id: string, on: boolean) => void
  onCreate: () => void
  onStart: () => void
  onComplete: () => void
  onEdit: () => void
  onDelete: () => void
  onReport: () => void
  openIssueId?: string | null
  onOpenIssue?: (id: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: sprint.id })
  const [open, setOpen] = useState(true)
  const dates = sprint.startDate && sprint.endDate ? `${fmtDate(sprint.startDate)} – ${fmtDate(sprint.endDate)}` : null
  return (
    <div ref={setNodeRef} className={clsx('rounded-lg bg-slate-50 p-2', isOver && 'ring-2 ring-brand-500 ring-inset')}>
      <div className="flex flex-wrap items-center gap-2 px-1 py-1">
        <input type="checkbox" checked={allOn} onChange={(e) => onToggleAll(e.target.checked)} disabled={items.length === 0} />
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 font-semibold">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />} {sprint.name}
        </button>
        {manage && (
          <button className="text-xs text-brand-700 hover:underline" onClick={onEdit}>
            {dates ?? 'Add dates'}
          </button>
        )}
        {sprint.goal && <span className="max-w-xs truncate text-xs text-slate-500">{sprint.goal}</span>}
        <span className="text-xs text-slate-500">({items.length} work item{items.length === 1 ? '' : 's'})</span>
        <EstimatePills items={items} />
        <div className="ml-auto flex items-center gap-2">
          {manage && sprint.state === 'active' && <button className="btn-default" onClick={onComplete}>Complete sprint</button>}
          {manage && sprint.state === 'planned' && (
            <button className="btn-primary" disabled={hasActive} title={hasActive ? 'Complete the active sprint first' : ''} onClick={onStart}>Start sprint</button>
          )}
          <Dropdown
            align="right"
            trigger={() => <button className="rounded p-1 hover:bg-slate-200"><MoreHorizontal size={16} /></button>}
          >
            {(close) => (
              <>
                {manage && <MenuItem onClick={() => { onEdit(); close() }}><Pencil size={14} /> Edit sprint</MenuItem>}
                <MenuItem onClick={() => { onReport(); close() }}>Sprint report</MenuItem>
                {manage && sprint.state !== 'active' && <MenuItem danger onClick={() => { onDelete(); close() }}>Delete sprint</MenuItem>}
              </>
            )}
          </Dropdown>
        </div>
      </div>
      {open && (
        <div className={clsx('mt-1 min-h-[72px] rounded border border-dashed', isOver ? 'border-brand-500 bg-brand-50' : 'border-transparent')}>
          {items.map((i) => <Row key={i.id} item={i} selected={selected.includes(i.id)} issueOpen={openIssueId === i.id} onSelect={onSelect} onOpen={onOpenIssue} />)}
          {items.length === 0 && <div className="py-3 text-center text-xs text-slate-400">Plan this sprint by dragging work items here</div>}
          <button onClick={onCreate} className="flex w-full items-center gap-1 px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100"><Plus size={14} /> Create</button>
        </div>
      )}
    </div>
  )
}

function BacklogSection({ items, selected, manage, onToggleAll, onSelect, onCreate, onCreateSprint, openIssueId, onOpenIssue }: {
  items: WorkItem[]
  selected: string[]
  manage: boolean
  onToggleAll: (on: boolean) => void
  onSelect: (id: string, on: boolean) => void
  onCreate: () => void
  onCreateSprint: () => void
  openIssueId?: string | null
  onOpenIssue?: (id: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: 'backlog' })
  const [open, setOpen] = useState(true)
  const ids = items.map((i) => i.id)
  const allOn = ids.length > 0 && ids.every((id) => selected.includes(id))
  return (
    <div ref={setNodeRef} className={clsx('rounded-lg bg-slate-50 p-2', isOver && 'ring-2 ring-brand-500 ring-inset')}>
      <div className="flex flex-wrap items-center gap-2 px-1 py-1">
        <input type="checkbox" checked={allOn} onChange={(e) => onToggleAll(e.target.checked)} disabled={items.length === 0} />
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 font-semibold">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />} Backlog
        </button>
        <span className="text-xs text-slate-500">({items.length} work item{items.length === 1 ? '' : 's'})</span>
        <EstimatePills items={items} />
        {manage && <button className="btn-default ml-auto" onClick={onCreateSprint}><Plus size={14} /> Create sprint</button>}
      </div>
      {open && (
        <div className={clsx('mt-1 min-h-[72px] rounded border border-dashed', isOver ? 'border-brand-500 bg-brand-50' : 'border-transparent')}>
          {items.map((i) => <Row key={i.id} item={i} selected={selected.includes(i.id)} issueOpen={openIssueId === i.id} onSelect={onSelect} onOpen={onOpenIssue} />)}
          {items.length === 0 && <div className="py-3 text-center text-xs text-slate-400">Your backlog is empty</div>}
          <button onClick={onCreate} className="flex w-full items-center gap-1 px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100"><Plus size={14} /> Create</button>
        </div>
      )}
    </div>
  )
}
