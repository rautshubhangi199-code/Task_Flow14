import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import {
  addDays, addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useUi } from '../../store/uiStore'
import { useProject } from './projectContext'
import { now, STATUS_COLOR } from '../../lib/utils'
import type { WorkItem } from '../../types'
import { Avatar, StatusBadge, TypeIcon } from '../../components/ui'
import { BacklogFilterBar, useBacklogFilter } from './BacklogFilter'

type View = 'day' | 'week' | 'month'

function Chip({ item }: { item: WorkItem }) {
  return (
    <Link to={`/browse/${item.id}`} title={`${item.id} ${item.summary}`} className="flex items-center gap-1 truncate rounded border-l-4 bg-white px-1 py-0.5 text-xs shadow-sm hover:bg-slate-50" style={{ borderLeftColor: STATUS_COLOR[item.status] }}>
      <TypeIcon type={item.type} size={12} />
      <span className="truncate">{item.summary}</span>
    </Link>
  )
}

export default function Calendar() {
  const project = useProject()
  const allItems = useStore((s) => s.items)
  const users = useStore((s) => s.users)
  const openCreate = useUi((s) => s.openCreateItem)
  const [view, setView] = useState<View>('month')
  const [cursor, setCursor] = useState(now)
  const [q, setQ] = useState('')
  const filter = useBacklogFilter()
  const projectItems = useMemo(() => allItems.filter((i) => i.projectId === project.id), [allItems, project.id])
  const items = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return projectItems.filter((i) => {
      if (!i.dueDate || !filter.matches(i)) return false
      if (ql && !i.summary.toLowerCase().includes(ql) && !i.id.toLowerCase().includes(ql)) return false
      return true
    })
  }, [projectItems, filter.matches, q])
  const on = (d: Date) => items.filter((i) => i.dueDate === format(d, 'yyyy-MM-dd'))

  const move = (dir: 1 | -1) => setCursor((c) => (view === 'month' ? addMonths(c, dir) : view === 'week' ? addWeeks(c, dir) : addDays(c, dir)))
  const title =
    view === 'month' ? format(cursor, 'MMMM yyyy') : view === 'week' ? `${format(startOfWeek(cursor, { weekStartsOn: 1 }), 'dd MMM')} – ${format(endOfWeek(cursor, { weekStartsOn: 1 }), 'dd MMM yyyy')}` : format(cursor, 'EEEE, dd MMMM yyyy')

  const days =
    view === 'month'
      ? eachDayOfInterval({ start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }) })
      : eachDayOfInterval({ start: startOfWeek(cursor, { weekStartsOn: 1 }), end: endOfWeek(cursor, { weekStartsOn: 1 }) })
  const unscheduled = projectItems.filter((i) => {
    if (i.dueDate || !filter.matches(i)) return false
    const ql = q.trim().toLowerCase()
    if (ql && !i.summary.toLowerCase().includes(ql) && !i.id.toLowerCase().includes(ql)) return false
    return true
  }).length

  return (
    <div className="p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-56">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-8"
            placeholder="Search calendar"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <BacklogFilterBar users={users} projectItems={projectItems} {...filter.panelProps} />
      </div>
      <div className="mb-3 flex items-center gap-2">
        <button className="btn-default" onClick={() => setCursor(now())}>Today</button>
        <button className="btn-subtle p-1.5!" onClick={() => move(-1)}><ChevronLeft size={16} /></button>
        <button className="btn-subtle p-1.5!" onClick={() => move(1)}><ChevronRight size={16} /></button>
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="text-xs text-slate-500">Items are placed on their due date · {unscheduled} without due date</span>
        <div className="ml-auto flex rounded border border-slate-300">
          {(['day', 'week', 'month'] as View[]).map((v) => (
            <button key={v} onClick={() => setView(v)} className={clsx('px-3 py-1 text-sm capitalize', view === v ? 'bg-brand-600 text-white' : 'hover:bg-slate-100')}>{v}</button>
          ))}
        </div>
      </div>
      {view === 'day' ? (
        <div className="card divide-y divide-slate-100">
          {on(cursor).length === 0 && <div className="p-6 text-center text-sm text-slate-500">Nothing due on this day</div>}
          {on(cursor).map((i) => (
            <Link key={i.id} to={`/browse/${i.id}`} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50">
              <TypeIcon type={i.type} /> <span className="text-xs text-slate-500">{i.id}</span> <span className="flex-1">{i.summary}</span>
              <StatusBadge status={i.status} /> <Avatar user={users.find((u) => u.id === i.assigneeId)} size={22} />
            </Link>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="px-2 py-1.5 text-xs font-semibold text-slate-500">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => (
              <div
                key={d.toISOString()}
                onDoubleClick={() => openCreate({ projectId: project.id, dueDate: format(d, 'yyyy-MM-dd') })}
                className={clsx('group space-y-1 border-b border-r border-slate-100 p-1', view === 'week' ? 'min-h-72' : 'min-h-28', view === 'month' && !isSameMonth(d, cursor) && 'bg-slate-50 text-slate-400')}
              >
                <div className="flex items-center justify-between">
                  <span className={clsx('inline-flex h-6 w-6 items-center justify-center rounded-full text-xs', isSameDay(d, now()) && 'bg-brand-600 font-bold text-white')}>{format(d, 'd')}</span>
                  <button onClick={() => openCreate({ projectId: project.id, dueDate: format(d, 'yyyy-MM-dd') })} className="hidden text-xs text-slate-400 hover:text-brand-600 group-hover:inline">+ Create</button>
                </div>
                {on(d).map((i) => <Chip key={i.id} item={i} />)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
