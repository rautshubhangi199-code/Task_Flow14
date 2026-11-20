import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, Columns3, Search } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useProject } from './projectContext'
import { workItemService } from '../../services/api'
import { sortItems } from '../../lib/jql'
import { fmtDate, userName } from '../../lib/utils'
import { STATUSES, type Status, type WorkItem } from '../../types'
import { Avatar, Dropdown, PriorityIcon, StatusBadge, TypeIcon } from '../../components/ui'

type Col = 'type' | 'key' | 'summary' | 'status' | 'priority' | 'assignee' | 'reporter' | 'due' | 'created' | 'updated' | 'sprint' | 'points' | 'labels'
const COLS: { id: Col; label: string; sort?: string }[] = [
  { id: 'type', label: 'Type', sort: 'type' },
  { id: 'key', label: 'Key', sort: 'key' },
  { id: 'summary', label: 'Summary', sort: 'summary' },
  { id: 'status', label: 'Status', sort: 'status' },
  { id: 'priority', label: 'Priority', sort: 'priority' },
  { id: 'assignee', label: 'Assignee', sort: 'assignee' },
  { id: 'reporter', label: 'Reporter', sort: 'reporter' },
  { id: 'sprint', label: 'Sprint' },
  { id: 'points', label: 'Story points' },
  { id: 'labels', label: 'Labels' },
  { id: 'due', label: 'Due date', sort: 'due' },
  { id: 'created', label: 'Created', sort: 'created' },
  { id: 'updated', label: 'Updated', sort: 'updated' },
]
type Group = 'none' | 'type' | 'status' | 'assignee'

export default function List() {
  const project = useProject()
  const allItems = useStore((s) => s.items)
  const users = useStore((s) => s.users)
  const projects = useStore((s) => s.projects)
  const sprints = useStore((s) => s.sprints)
  const [q, setQ] = useState('')
  const [groupBy, setGroupBy] = useState<Group>('none')
  const [sort, setSort] = useState<{ field: string; dir: 'asc' | 'desc' }>({ field: 'key', dir: 'asc' })
  const [visible, setVisible] = useState<Col[]>(['type', 'key', 'summary', 'status', 'priority', 'assignee', 'due', 'updated'])
  const [selected, setSelected] = useState<string[]>([])

  const items = useMemo(() => {
    const ql = q.toLowerCase()
    const f = allItems.filter((i) => i.projectId === project.id && (!ql || `${i.id} ${i.summary}`.toLowerCase().includes(ql)))
    return sortItems(f, [sort], { users, projects })
  }, [allItems, project.id, q, sort, users, projects])

  const groups = useMemo(() => {
    if (groupBy === 'none') return [{ key: 'all', label: '', items }]
    const m = new Map<string, WorkItem[]>()
    for (const i of items) {
      const k = groupBy === 'type' ? i.type : groupBy === 'status' ? i.status : userName(users, i.assigneeId)
      m.set(k, [...(m.get(k) ?? []), i])
    }
    return [...m.entries()].map(([key, its]) => ({ key, label: key, items: its }))
  }, [items, groupBy, users])

  const toggleSort = (field: string) => setSort((s) => (s.field === field ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' }))
  const members = users.filter((u) => project.memberIds.includes(u.id) || project.leadId === u.id)
  const cols = COLS.filter((c) => visible.includes(c.id))

  const cell = (i: WorkItem, c: Col) => {
    switch (c) {
      case 'type': return <TypeIcon type={i.type} />
      case 'key': return <Link to={`/browse/${i.id}`} className="text-brand-700 hover:underline">{i.id}</Link>
      case 'summary': return <Link to={`/browse/${i.id}`} className="hover:underline">{i.summary}</Link>
      case 'status': return <StatusBadge status={i.status} />
      case 'priority': return <span className="flex items-center gap-1"><PriorityIcon priority={i.priority} />{i.priority}</span>
      case 'assignee': return <span className="flex items-center gap-1.5"><Avatar user={users.find((u) => u.id === i.assigneeId)} size={20} />{userName(users, i.assigneeId)}</span>
      case 'reporter': return userName(users, i.reporterId)
      case 'sprint': return sprints.find((s) => s.id === i.sprintId)?.name ?? '—'
      case 'points': return i.storyPoints ?? '—'
      case 'labels': return i.labels.join(', ') || '—'
      case 'due': return fmtDate(i.dueDate)
      case 'created': return fmtDate(i.createdAt)
      case 'updated': return fmtDate(i.updatedAt)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="relative w-60">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-8" placeholder="Search list" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          Group by
          <select className="input w-32" value={groupBy} onChange={(e) => setGroupBy(e.target.value as Group)}>
            <option value="none">None</option><option value="type">Type</option><option value="status">Status</option><option value="assignee">Assignee</option>
          </select>
        </label>
        <Dropdown align="right" className="ml-auto" trigger={() => <button className="btn-default"><Columns3 size={14} /> Columns</button>}>
          {() => (
            <div className="p-2">
              {COLS.map((c) => (
                <label key={c.id} className="flex items-center gap-2 px-2 py-1 text-sm hover:bg-slate-50">
                  <input type="checkbox" checked={visible.includes(c.id)} disabled={c.id === 'summary'} onChange={(e) => setVisible((v) => (e.target.checked ? [...v, c.id] : v.filter((x) => x !== c.id)))} />
                  {c.label}
                </label>
              ))}
            </div>
          )}
        </Dropdown>
      </div>
      {selected.length > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-md bg-brand-50 px-3 py-2 text-sm">
          <b>{selected.length} selected</b>
          <select className="input w-44" value="" onChange={(e) => { if (e.target.value) workItemService.bulkUpdate(selected, { status: e.target.value as Status }) }}>
            <option value="">Change status…</option>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select className="input w-44" value="" onChange={(e) => { if (e.target.value) workItemService.bulkUpdate(selected, { assigneeId: e.target.value === 'none' ? null : e.target.value }) }}>
            <option value="">Change assignee…</option>
            <option value="none">Unassigned</option>
            {members.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <button className="btn-subtle ml-auto" onClick={() => setSelected([])}>Clear selection</button>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="th w-8">
                <input type="checkbox" checked={items.length > 0 && selected.length === items.length} onChange={(e) => setSelected(e.target.checked ? items.map((i) => i.id) : [])} />
              </th>
              {cols.map((c) => (
                <th key={c.id} className={`th ${c.sort ? 'cursor-pointer hover:text-slate-800' : ''}`} onClick={() => c.sort && toggleSort(c.sort)}>
                  <span className="inline-flex items-center gap-1">{c.label}{sort.field === c.sort && (sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <GroupRows key={g.key} label={g.label} count={g.items.length} span={cols.length + 1}>
                {g.items.map((i) => (
                  <tr key={i.id} className={`border-b border-slate-100 hover:bg-slate-50 ${selected.includes(i.id) ? 'bg-brand-50/50' : ''}`}>
                    <td className="td"><input type="checkbox" checked={selected.includes(i.id)} onChange={(e) => setSelected((s) => (e.target.checked ? [...s, i.id] : s.filter((x) => x !== i.id)))} /></td>
                    {cols.map((c) => <td key={c.id} className="td">{cell(i, c.id)}</td>)}
                  </tr>
                ))}
              </GroupRows>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <div className="p-6 text-center text-sm text-slate-500">No work items</div>}
      </div>
      <div className="mt-2 text-xs text-slate-500">{items.length} work items</div>
    </div>
  )
}

function GroupRows({ label, count, span, children }: { label: string; count: number; span: number; children: ReactNode }) {
  return (
    <>
      {label && (
        <tr className="bg-slate-100">
          <td colSpan={span} className="px-3 py-1.5 text-xs font-semibold text-slate-600">{label} <span className="font-normal">({count})</span></td>
        </tr>
      )}
      {children}
    </>
  )
}
