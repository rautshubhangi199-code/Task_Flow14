import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { Filter, Plus } from 'lucide-react'
import { ISSUE_TYPES, PRIORITIES, STATUSES, type User, type WorkItem } from '../../types'
import { Avatar } from '../../components/ui'

export type BacklogFilterState = {
  assigneeFilter: string[]
  typeFilter: string[]
  statusFilter: string[]
  parentFilter: string[]
  labelFilter: string[]
  priorityFilter: string[]
}

export function matchesBacklogFilter(i: WorkItem, f: BacklogFilterState) {
  if (f.assigneeFilter.length && !f.assigneeFilter.includes(i.assigneeId ?? 'none')) return false
  if (f.typeFilter.length && !f.typeFilter.includes(i.type)) return false
  if (f.statusFilter.length && !f.statusFilter.includes(i.status)) return false
  if (f.parentFilter.length && !f.parentFilter.includes(i.parentId ?? 'none')) return false
  if (f.labelFilter.length && !f.labelFilter.some((l) => i.labels.includes(l))) return false
  if (f.priorityFilter.length && !f.priorityFilter.includes(i.priority)) return false
  return true
}

export function useBacklogFilter() {
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>([])
  const [typeFilter, setTypeFilter] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [parentFilter, setParentFilter] = useState<string[]>([])
  const [labelFilter, setLabelFilter] = useState<string[]>([])
  const [priorityFilter, setPriorityFilter] = useState<string[]>([])
  const state: BacklogFilterState = { assigneeFilter, typeFilter, statusFilter, parentFilter, labelFilter, priorityFilter }
  const filterCount = assigneeFilter.length + typeFilter.length + statusFilter.length + parentFilter.length + labelFilter.length + priorityFilter.length
  const clearFilters = () => {
    setAssigneeFilter([])
    setTypeFilter([])
    setStatusFilter([])
    setParentFilter([])
    setLabelFilter([])
    setPriorityFilter([])
  }
  const matches = useCallback(
    (i: WorkItem) => matchesBacklogFilter(i, { assigneeFilter, typeFilter, statusFilter, parentFilter, labelFilter, priorityFilter }),
    [assigneeFilter, typeFilter, statusFilter, parentFilter, labelFilter, priorityFilter],
  )
  return {
    ...state,
    setAssigneeFilter,
    filterCount,
    clearFilters,
    matches,
    panelProps: {
      state,
      setAssigneeFilter,
      setTypeFilter,
      setStatusFilter,
      setParentFilter,
      setLabelFilter,
      setPriorityFilter,
      filterCount,
      clearFilters,
    },
  }
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

export function BacklogFilterBar({
  users,
  projectItems,
  state,
  setAssigneeFilter,
  setTypeFilter,
  setStatusFilter,
  setParentFilter,
  setLabelFilter,
  setPriorityFilter,
  filterCount,
  clearFilters,
  showAvatars = true,
}: {
  users: User[]
  projectItems: WorkItem[]
  state: BacklogFilterState
  setAssigneeFilter: (v: string[] | ((p: string[]) => string[])) => void
  setTypeFilter: (v: string[] | ((p: string[]) => string[])) => void
  setStatusFilter: (v: string[] | ((p: string[]) => string[])) => void
  setParentFilter: (v: string[] | ((p: string[]) => string[])) => void
  setLabelFilter: (v: string[] | ((p: string[]) => string[])) => void
  setPriorityFilter: (v: string[] | ((p: string[]) => string[])) => void
  filterCount: number
  clearFilters: () => void
  showAvatars?: boolean
}) {
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterField, setFilterField] = useState<string | null>(null)
  const [extraFields, setExtraFields] = useState<string[]>([])
  const [addFieldOpen, setAddFieldOpen] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)
  const parentOptions = useMemo(() => projectItems.filter((i) => i.type === 'Epic'), [projectItems])
  const labelOptions = useMemo(() => [...new Set(projectItems.flatMap((i) => i.labels))].sort(), [projectItems])

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

  const toggleVal = (list: string[], set: (v: string[] | ((p: string[]) => string[])) => void, value: string) =>
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value])

  return (
    <>
      {showAvatars && (
        <div className="flex -space-x-1">
          {users.map((u) => (
            <button
              key={u.id}
              title={u.name}
              onClick={() => setAssigneeFilter((f) => (f.includes(u.id) ? f.filter((x) => x !== u.id) : [...f, u.id]))}
              className={clsx('rounded-full ring-2', state.assigneeFilter.includes(u.id) ? 'ring-brand-600' : 'ring-white')}
            >
              <Avatar user={u} size={28} />
            </button>
          ))}
        </div>
      )}
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
                  ['parent', 'Epic'],
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
                  <button type="button" className="btn-default w-full justify-center" onClick={() => setAddFieldOpen((o) => !o)}>
                    <Plus size={14} /> Add field
                  </button>
                  {addFieldOpen && (
                    <div className="absolute left-3 right-3 z-10 mt-1 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                      {['priority'].filter((f) => !extraFields.includes(f)).map((f) => (
                        <button
                          key={f}
                          type="button"
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
                    selected={state.parentFilter}
                    onToggle={(v) => toggleVal(state.parentFilter, setParentFilter, v)}
                  />
                )}
                {filterField === 'assignee' && (
                  <CheckList
                    options={[{ value: 'none', label: 'Unassigned' }, ...users.map((u) => ({ value: u.id, label: u.name }))]}
                    selected={state.assigneeFilter}
                    onToggle={(v) => toggleVal(state.assigneeFilter, setAssigneeFilter, v)}
                  />
                )}
                {filterField === 'status' && (
                  <CheckList options={STATUSES.map((s) => ({ value: s, label: s }))} selected={state.statusFilter} onToggle={(v) => toggleVal(state.statusFilter, setStatusFilter, v)} />
                )}
                {filterField === 'type' && (
                  <CheckList options={ISSUE_TYPES.filter((t) => t !== 'Epic' && t !== 'Subtask').map((t) => ({ value: t, label: t }))} selected={state.typeFilter} onToggle={(v) => toggleVal(state.typeFilter, setTypeFilter, v)} />
                )}
                {filterField === 'labels' && (
                  labelOptions.length === 0
                    ? <p className="text-sm text-slate-500">No labels in this space yet.</p>
                    : <CheckList options={labelOptions.map((l) => ({ value: l, label: l }))} selected={state.labelFilter} onToggle={(v) => toggleVal(state.labelFilter, setLabelFilter, v)} />
                )}
                {filterField === 'priority' && (
                  <CheckList options={PRIORITIES.map((p) => ({ value: p, label: p }))} selected={state.priorityFilter} onToggle={(v) => toggleVal(state.priorityFilter, setPriorityFilter, v)} />
                )}
              </div>
            </div>
            <div className="border-t border-slate-200 px-4 py-2">
              <button
                type="button"
                className={clsx('text-sm', filterCount ? 'text-slate-700 hover:underline' : 'cursor-default text-slate-300')}
                disabled={filterCount === 0}
                onClick={() => { clearFilters(); setFilterField(null) }}
              >
                Clear all
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
