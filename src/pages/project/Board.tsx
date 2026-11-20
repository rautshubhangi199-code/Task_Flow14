import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { Filter, Plus, Search, Settings, X } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useCurrentUser } from '../../store/hooks'
import { useUi } from '../../store/uiStore'
import { useProject } from './projectContext'
import { commentService, workItemService } from '../../services/api'
import { ISSUE_TYPES, PRIORITIES, STATUSES, TEAMS, type Status, type User, type WorkItem } from '../../types'
import { Avatar, PriorityIcon, StatusBadge, TypeIcon } from '../../components/ui'
import { StatusDropdown } from '../../components/StatusDropdown'
import { timeAgo } from '../../lib/utils'

export default function Board() {
  const project = useProject()
  const allItems = useStore((s) => s.items)
  const users = useStore((s) => s.users)
  const sprints = useStore((s) => s.sprints)
  const openCreate = useUi((s) => s.openCreateItem)
  const projectSprints = sprints.filter((s) => s.projectId === project.id)
  const activeSprint = projectSprints.find((s) => s.state === 'active')
  const [q, setQ] = useState('')
  const [groupBy, setGroupBy] = useState<'none' | 'assignee'>('none')
  const [sprintId, setSprintId] = useState(activeSprint?.id ?? 'all')
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>([])
  const [typeFilter, setTypeFilter] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [parentFilter, setParentFilter] = useState<string[]>([])
  const [labelFilter, setLabelFilter] = useState<string[]>([])
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterField, setFilterField] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const filterRef = useRef<HTMLDivElement>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const members = users.filter((u) => project.memberIds.includes(u.id) || project.leadId === u.id)
  const projectItems = useMemo(() => allItems.filter((i) => i.projectId === project.id), [allItems, project.id])
  const parentOptions = useMemo(() => projectItems.filter((i) => i.type === 'Epic' || i.type === 'Story'), [projectItems])
  const labelOptions = useMemo(() => [...new Set(projectItems.flatMap((i) => i.labels))].sort(), [projectItems])
  const filterCount = assigneeFilter.length + typeFilter.length + statusFilter.length + parentFilter.length + labelFilter.length

  const items = useMemo(() => {
    const ql = q.toLowerCase()
    return projectItems.filter((i) => {
      if (i.type === 'Epic') return false
      if (sprintId !== 'all' && i.sprintId !== sprintId) return false
      if (ql && !i.summary.toLowerCase().includes(ql) && !i.id.toLowerCase().includes(ql)) return false
      if (assigneeFilter.length && !assigneeFilter.includes(i.assigneeId ?? 'none')) return false
      if (typeFilter.length && !typeFilter.includes(i.type)) return false
      if (statusFilter.length && !statusFilter.includes(i.status)) return false
      if (parentFilter.length && !parentFilter.includes(i.parentId ?? 'none')) return false
      if (labelFilter.length && !labelFilter.some((l) => i.labels.includes(l))) return false
      return true
    })
  }, [projectItems, sprintId, q, assigneeFilter, typeFilter, statusFilter, parentFilter, labelFilter])

  useEffect(() => {
    if (!filterOpen) return
    const onDoc = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [filterOpen])

  const lanes = groupBy === 'assignee'
    ? [...members.map((u) => ({ id: u.id, name: u.name, user: u })), { id: 'none', name: 'Unassigned', user: undefined }].filter((l) => items.some((i) => (i.assigneeId ?? 'none') === l.id))
    : [{ id: 'all', name: '', user: undefined }]

  const extraAvatars = Math.max(0, members.length - 5)
  const shownMembers = members.slice(0, 5)

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over) return
    const [lane, status] = String(e.over.id).split('::')
    const item = allItems.find((i) => i.id === e.active.id)
    if (!item) return
    const patch: Partial<WorkItem> = {}
    if (item.status !== status) patch.status = status as Status
    if (groupBy === 'assignee' && (item.assigneeId ?? 'none') !== lane) patch.assigneeId = lane === 'none' ? null : lane
    if (Object.keys(patch).length) workItemService.update(item.id, patch)
  }

  const clearFilters = () => {
    setAssigneeFilter([])
    setTypeFilter([])
    setStatusFilter([])
    setParentFilter([])
    setLabelFilter([])
    setFilterField(null)
  }

  const toggleVal = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value])

  const openItem = (id: string) => setOpenId(id)

  const sprintForCreate = sprintId === 'all' ? activeSprint?.id : sprintId

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex flex-nowrap items-center gap-2 overflow-x-auto">
        <div className="relative w-52">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-8" placeholder="Search board" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex -space-x-1">
          {shownMembers.map((u) => (
            <button key={u.id} title={u.name} onClick={() => setAssigneeFilter((f) => (f.includes(u.id) ? f.filter((x) => x !== u.id) : [...f, u.id]))} className={clsx('rounded-full ring-2', assigneeFilter.includes(u.id) ? 'ring-brand-600' : 'ring-white')}>
              <Avatar user={u} size={28} />
            </button>
          ))}
          {extraAvatars > 0 && <span className="flex h-7 items-center rounded-full bg-slate-100 px-1.5 text-xs text-slate-600 ring-2 ring-white">+{extraAvatars}</span>}
        </div>
        <div className="relative" ref={filterRef}>
          <button className={clsx('btn-default', (filterOpen || filterCount > 0) && 'border-brand-600 bg-brand-50 text-brand-700')} onClick={() => setFilterOpen((o) => !o)}>
            <Filter size={14} /> Filter{filterCount > 0 ? ` ${filterCount}` : ''}
          </button>
          {filterOpen && (
            <div className="absolute z-30 mt-1 flex w-[520px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
              <div className="flex min-h-[260px]">
                <div className="w-44 shrink-0 border-r border-slate-200 py-2">
                  {([['parent', 'Parent'], ['assignee', 'Assignee'], ['status', 'Status'], ['type', 'Work type'], ['labels', 'Labels']] as const).map(([id, label]) => (
                    <button key={id} className={clsx('flex w-full px-4 py-2 text-left text-sm', filterField === id ? 'bg-slate-100 font-medium' : 'text-slate-700 hover:bg-slate-50')} onClick={() => setFilterField(id)}>{label}</button>
                  ))}
                </div>
                <div className="flex-1 p-4">
                  {!filterField && <p className="text-sm text-slate-500">Select a field to start creating a filter.</p>}
                  {filterField === 'parent' && <CheckList options={[{ value: 'none', label: 'No parent' }, ...parentOptions.map((p) => ({ value: p.id, label: `${p.id} ${p.summary}` }))]} selected={parentFilter} onToggle={(v) => toggleVal(parentFilter, setParentFilter, v)} />}
                  {filterField === 'assignee' && <CheckList options={[{ value: 'none', label: 'Unassigned' }, ...members.map((u) => ({ value: u.id, label: u.name }))]} selected={assigneeFilter} onToggle={(v) => toggleVal(assigneeFilter, setAssigneeFilter, v)} />}
                  {filterField === 'status' && <CheckList options={STATUSES.map((s) => ({ value: s, label: s }))} selected={statusFilter} onToggle={(v) => toggleVal(statusFilter, setStatusFilter, v)} />}
                  {filterField === 'type' && <CheckList options={ISSUE_TYPES.filter((t) => t !== 'Epic').map((t) => ({ value: t, label: t }))} selected={typeFilter} onToggle={(v) => toggleVal(typeFilter, setTypeFilter, v)} />}
                  {filterField === 'labels' && (labelOptions.length ? <CheckList options={labelOptions.map((l) => ({ value: l, label: l }))} selected={labelFilter} onToggle={(v) => toggleVal(labelFilter, setLabelFilter, v)} /> : <p className="text-sm text-slate-500">No labels yet.</p>)}
                </div>
              </div>
              <div className="border-t border-slate-200 px-4 py-2">
                <button className={clsx('text-sm', filterCount ? 'text-slate-700 hover:underline' : 'text-slate-300')} disabled={!filterCount} onClick={clearFilters}>Clear all</button>
              </div>
            </div>
          )}
        </div>
        {filterCount > 0 && <button className="text-sm text-slate-600 hover:underline" onClick={clearFilters}>Clear filters</button>}
        <label className="flex items-center gap-2 text-sm">
          <span className="text-slate-600">Group</span>
          <select className="input w-32" value={groupBy} onChange={(e) => setGroupBy(e.target.value as 'none' | 'assignee')}>
            <option value="none">None</option>
            <option value="assignee">Assignee</option>
          </select>
        </label>
        <select className="input ml-auto w-56" value={sprintId} onChange={(e) => setSprintId(e.target.value)}>
          <option value="all">All work items</option>
          {projectSprints.filter((s) => s.state !== 'completed').map((s) => (
            <option key={s.id} value={s.id}>{s.name}{s.state === 'active' ? ' (active)' : ''}</option>
          ))}
        </select>
      </div>

      <DndContext
        sensors={sensors}
        autoScroll={false}
        onDragEnd={onDragEnd}
      >
        <div className="min-h-0 flex-1 overflow-auto">
          {lanes.map((lane) => (
            <div key={lane.id} className={groupBy === 'assignee' ? 'mb-4' : ''}>
              {groupBy === 'assignee' && (
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Avatar user={lane.user} size={20} /> {lane.name}
                </div>
              )}
              <div className="flex w-max items-start gap-3">
                {STATUSES.map((s) => {
                  const colItems = items.filter((i) => i.status === s && (lane.id === 'all' || (i.assigneeId ?? 'none') === lane.id))
                  return (
                    <Column
                      key={s}
                      id={`${lane.id}::${s}`}
                      status={s}
                      count={colItems.length}
                      items={colItems}
                      allItems={projectItems}
                      onOpen={openItem}
                      onCreate={() => openCreate({ projectId: project.id, status: s, sprintId: sprintForCreate ?? null, type: 'Task' })}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </DndContext>

      {openId && <IssuePopup id={openId} onClose={() => setOpenId(null)} />}
    </div>
  )
}

function Column({ id, status, count, items, allItems, onOpen, onCreate }: {
  id: string
  status: Status
  count: number
  items: WorkItem[]
  allItems: WorkItem[]
  onOpen: (id: string) => void
  onCreate: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div className="w-[260px] shrink-0">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="text-sm font-medium text-slate-700">{status}</span>
        <span className="text-xs text-slate-500">{count}</span>
        <button className="ml-auto rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700" title={`Create in ${status}`} onClick={onCreate}><Plus size={16} /></button>
      </div>
      <div ref={setNodeRef} className={clsx('flex min-h-[120px] flex-col gap-2 rounded-lg p-1', isOver ? 'bg-brand-50 ring-2 ring-brand-200' : 'bg-slate-100')}>
        {items.map((i) => <Card key={i.id} item={i} allItems={allItems} onOpen={onOpen} />)}
        <button className="flex h-8 items-center justify-center rounded-md text-slate-400 hover:bg-white hover:text-slate-700" onClick={onCreate}><Plus size={16} /></button>
      </div>
    </div>
  )
}

function Card({ item, allItems, onOpen }: { item: WorkItem; allItems: WorkItem[]; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id })
  const users = useStore((s) => s.users)
  const assignee = users.find((u) => u.id === item.assigneeId)
  const parent = allItems.find((i) => i.id === item.parentId)
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={clsx(isDragging && 'opacity-40')}>
      <div
        data-issue-key={item.id}
        onClick={() => onOpen(item.id)}
      >
        <CardView item={item} parent={parent} assignee={assignee} />
      </div>
    </div>
  )
}

function CardView({ item, parent, assignee }: { item: WorkItem; parent?: WorkItem; assignee?: User }) {
  return (
    <div className="cursor-pointer rounded-md border border-slate-200 bg-white p-3 shadow-sm hover:bg-slate-50">
      <div className="text-sm font-medium text-slate-800">{item.summary}</div>
      {item.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {item.labels.map((l) => <span key={l} className="rounded bg-teal-50 px-1.5 py-0.5 text-[11px] text-teal-800">{l}</span>)}
        </div>
      )}
      {parent && (
        <div className="mt-2 inline-flex max-w-full items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
          <TypeIcon type={parent.type} size={12} />
          <span className="truncate">{parent.id} {parent.summary}</span>
        </div>
      )}
      <div className="mt-3 flex items-center gap-1.5">
        <TypeIcon type={item.type} size={14} />
        <span className="text-xs font-medium text-slate-500">{item.id}</span>
        <PriorityIcon priority={item.priority} />
        <span className="ml-auto"><Avatar user={assignee} size={22} /></span>
      </div>
    </div>
  )
}

function CheckList({ options, selected, onToggle }: { options: { value: string; label: string }[]; selected: string[]; onToggle: (value: string) => void }) {
  return (
    <div className="max-h-52 overflow-auto">
      {options.map((o) => (
        <label key={o.value} className="flex items-center gap-2 rounded px-1 py-1.5 text-sm hover:bg-slate-50">
          <input type="checkbox" checked={selected.includes(o.value)} onChange={() => onToggle(o.value)} />
          <span className="truncate">{o.label}</span>
        </label>
      ))}
    </div>
  )
}

function IssuePopup({ id, onClose }: { id: string; onClose: () => void }) {
  const items = useStore((s) => s.items)
  const users = useStore((s) => s.users)
  const sprints = useStore((s) => s.sprints)
  const allComments = useStore((s) => s.comments)
  const me = useCurrentUser()
  const navigate = useNavigate()
  const projects = useStore((s) => s.projects)
  const item = items.find((i) => i.id === id)
  const project = projects.find((p) => p.id === item?.projectId)
  const comments = allComments.filter((c) => c.itemId === id)
  const [body, setBody] = useState('')
  const [summary, setSummary] = useState(item?.summary ?? '')
  const [desc, setDesc] = useState(item?.description ?? '')
  const openedAt = useRef(performance.now())

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!item) return null

  const parent = items.find((i) => i.id === item.parentId)
  const parentChoices = items.filter((i) => i.projectId === item.projectId && (i.type === 'Epic' || i.type === 'Story') && i.id !== item.id)
  const projectSprints = sprints.filter((s) => s.projectId === item.projectId && (s.state !== 'completed' || s.id === item.sprintId))
  const update = (patch: Partial<WorkItem>) => workItemService.update(item.id, patch)

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-4 pt-10"
      onMouseDown={() => {
        if (performance.now() - openedAt.current < 400) return
        onClose()
      }}
    >
      <div className="flex max-h-[calc(100vh-5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2">
          <TypeIcon type={item.type} size={16} />
          <span className="text-sm font-medium text-slate-600">{item.id}</span>
          {parent && (
            <span className="ml-2 flex items-center gap-1 text-xs text-slate-500">
              <TypeIcon type={parent.type} size={12} /> {parent.id}
            </span>
          )}
          <Link to={`/browse/${item.id}`} className="ml-3 text-xs text-brand-700 hover:underline">Open in full view</Link>
          <button className="ml-auto rounded p-1 text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-[1fr_260px] overflow-y-auto">
          <div className="min-w-0 space-y-4 p-5">
            <input
              className="w-full border-0 text-xl font-semibold outline-none"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              onBlur={() => { if (summary.trim() && summary.trim() !== item.summary) update({ summary: summary.trim() }) }}
            />
            <div>
              <div className="mb-1 text-sm font-semibold">Description</div>
              <textarea
                className="input min-h-28"
                placeholder="Add a description…"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                onBlur={() => { if (desc !== item.description) update({ description: desc }) }}
              />
            </div>
            <div>
              <div className="mb-2 text-sm font-semibold">Comments</div>
              <div className="space-y-3">
                {comments.map((c) => {
                  const u = users.find((x) => x.id === c.authorId)
                  return (
                    <div key={c.id} className="flex gap-2">
                      <Avatar user={u} size={28} />
                      <div>
                        <div className="text-xs text-slate-500"><span className="font-medium text-slate-700">{u?.name}</span> · {timeAgo(c.createdAt)}</div>
                        <div className="text-sm">{c.body}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-3 flex gap-2">
                <Avatar user={me} size={28} />
                <div className="flex-1">
                  <textarea className="input min-h-14" placeholder="Add a comment…" value={body} onChange={(e) => setBody(e.target.value)} />
                  {body.trim() && (
                    <div className="mt-1 flex gap-2">
                      <button className="btn-primary" onClick={() => { commentService.add(item.id, body.trim()); setBody('') }}>Save</button>
                      <button className="btn-subtle" onClick={() => setBody('')}>Cancel</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <aside className="space-y-3 border-l border-slate-100 bg-slate-50 p-4">
            <Field label="Status">
              <StatusDropdown
                value={item.status}
                onChange={(s) => update({ status: s })}
                projectKey={project?.key}
                variant="select"
              />
            </Field>
            <Field label="Assignee">
              <select className="input py-1" value={item.assigneeId ?? ''} onChange={(e) => update({ assigneeId: e.target.value || null })}>
                <option value="">Automatic</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Field>
            <Field label="Reporter">
              <select className="input py-1" value={item.reporterId} onChange={(e) => update({ reporterId: e.target.value })}>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Field>
            <Field label="Priority">
              <select className="input py-1" value={item.priority} onChange={(e) => update({ priority: e.target.value as WorkItem['priority'] })}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Parent">
              <select className="input py-1" value={item.parentId ?? ''} onChange={(e) => update({ parentId: e.target.value || null })}>
                <option value="">None</option>
                {parentChoices.map((p) => <option key={p.id} value={p.id}>{p.id} · {p.summary}</option>)}
              </select>
            </Field>
            <Field label="Sprint">
              <select className="input py-1" value={item.sprintId ?? ''} onChange={(e) => update({ sprintId: e.target.value || null })}>
                <option value="">Backlog</option>
                {projectSprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Due date">
              <input type="date" className="input py-1" value={item.dueDate ?? ''} onChange={(e) => update({ dueDate: e.target.value || null })} />
            </Field>
            <Field label="Team">
              <select className="input py-1" value={item.team ?? ''} onChange={(e) => update({ team: e.target.value || null })}>
                <option value="">None</option>
                {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <div className="flex items-center justify-between pt-2 text-xs text-slate-500">
              <StatusBadge status={item.status} />
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900"
                onClick={() => {
                  onClose()
                  navigate(`/projects/${project?.key ?? 'CP'}/settings/work-types?type=${item.type}`)
                }}
              >
                <Settings size={13} /> Configure
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      {children}
    </div>
  )
}
