import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import { useProject } from './projectContext'
import { Avatar, ProgressBar, TypeIcon } from '../../components/ui'
import { ISSUE_TYPES, STATUSES } from '../../types'
import { fmtDate, isDone, nowMs, STATUS_COLOR, timeAgo } from '../../lib/utils'

export default function Summary() {
  const project = useProject()
  const allItems = useStore((s) => s.items)
  const history = useStore((s) => s.history)
  const users = useStore((s) => s.users)
  const sprints = useStore((s) => s.sprints)
  const items = useMemo(() => allItems.filter((i) => i.projectId === project.id), [allItems, project.id])
  const done = items.filter((i) => isDone(i.status)).length
  const assigned = items.filter((i) => i.assigneeId).length
  const pct = items.length ? Math.round((done / items.length) * 100) : 0
  const activeSprint = sprints.find((s) => s.projectId === project.id && s.state === 'active')
  const sprintItems = activeSprint ? items.filter((i) => i.sprintId === activeSprint.id) : []
  const sprintDone = sprintItems.filter((i) => isDone(i.status))
  const pts = (arr: typeof items) => arr.reduce((a, i) => a + (i.storyPoints ?? 0), 0)
  const ids = new Set(items.map((i) => i.id))
  const activity = history.filter((h) => ids.has(h.itemId)).sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 12)
  const created7 = items.filter((i) => nowMs() - new Date(i.createdAt).getTime() < 7 * 864e5).length
  const updated7 = items.filter((i) => nowMs() - new Date(i.updatedAt).getTime() < 7 * 864e5).length
  const due7 = items.filter((i) => i.dueDate && !isDone(i.status) && new Date(i.dueDate).getTime() - nowMs() < 7 * 864e5).length
  const maxStatus = Math.max(1, ...STATUSES.map((s) => items.filter((i) => i.status === s).length))

  return (
    <div className="space-y-6 p-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ['Completed', done, 'in total'],
          ['Updated', updated7, 'in the last 7 days'],
          ['Created', created7, 'in the last 7 days'],
          ['Due soon / overdue', due7, 'within 7 days'],
        ].map(([l, v, sub]) => (
          <div key={l as string} className="card p-4">
            <div className="text-2xl font-semibold">{v}</div>
            <div className="text-sm font-medium text-slate-700">{l}</div>
            <div className="text-xs text-slate-500">{sub}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="mb-3 font-semibold">Status overview</h3>
          <div className="space-y-2">
            {STATUSES.map((s) => {
              const n = items.filter((i) => i.status === s).length
              return (
                <div key={s} className="flex items-center gap-3 text-sm">
                  <span className="w-32 text-slate-600">{s}</span>
                  <div className="h-4 flex-1 rounded bg-slate-100">
                    <div className="h-4 rounded" style={{ width: `${(n / maxStatus) * 100}%`, background: STATUS_COLOR[s] }} />
                  </div>
                  <span className="w-6 text-right font-medium">{n}</span>
                </div>
              )
            })}
          </div>
        </div>
        <div className="card p-4">
          <h3 className="mb-3 font-semibold">Types of work</h3>
          <div className="space-y-2">
            {ISSUE_TYPES.map((t) => {
              const n = items.filter((i) => i.type === t).length
              return (
                <div key={t} className="flex items-center gap-3 text-sm">
                  <TypeIcon type={t} />
                  <span className="w-20">{t}</span>
                  <div className="flex-1"><ProgressBar value={items.length ? (n / items.length) * 100 : 0} color="bg-brand-500" /></div>
                  <span className="w-10 text-right text-slate-600">{items.length ? Math.round((n / items.length) * 100) : 0}%</span>
                  <span className="w-6 text-right font-medium">{n}</span>
                </div>
              )
            })}
          </div>
          <h3 className="mb-2 mt-5 font-semibold">Overall progress</h3>
          <ProgressBar value={pct} />
          <div className="mt-1 text-xs text-slate-500">{done} of {items.length} work items done ({pct}%)</div>
          <h3 className="mb-2 mt-5 font-semibold">Assigned vs unassigned</h3>
          <div className="flex h-4 overflow-hidden rounded">
            <div className="bg-brand-500" style={{ width: `${items.length ? (assigned / items.length) * 100 : 0}%` }} />
            <div className="flex-1 bg-slate-200" />
          </div>
          <div className="mt-1 flex justify-between text-xs text-slate-500"><span>Assigned: {assigned}</span><span>Unassigned: {items.length - assigned}</span></div>
        </div>
        <div className="card p-4">
          <h3 className="mb-3 font-semibold">Sprint progress</h3>
          {activeSprint ? (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{activeSprint.name}</span>
                <span className="text-xs text-slate-500">{fmtDate(activeSprint.startDate)} – {fmtDate(activeSprint.endDate)}</span>
              </div>
              {activeSprint.goal && <div className="text-xs text-slate-500">Goal: {activeSprint.goal}</div>}
              <div className="mt-3"><ProgressBar value={sprintItems.length ? (sprintDone.length / sprintItems.length) * 100 : 0} /></div>
              <div className="mt-1 text-xs text-slate-500">{sprintDone.length}/{sprintItems.length} items · {pts(sprintDone)}/{pts(sprintItems)} story points done</div>
              <div className="mt-3 flex gap-2 text-xs">
                {STATUSES.filter((s) => sprintItems.some((i) => i.status === s)).map((s) => (
                  <span key={s} className="rounded px-1.5 py-0.5 text-white" style={{ background: STATUS_COLOR[s] }}>{s}: {sprintItems.filter((i) => i.status === s).length}</span>
                ))}
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-500">No active sprint. {project.type === 'Scrum' && <Link className="text-brand-600 hover:underline" to={`/projects/${project.key}/backlog`}>Plan one in the backlog</Link>}</div>
          )}
        </div>
        <div className="card p-4">
          <h3 className="mb-3 font-semibold">Recent activity</h3>
          <div className="space-y-3">
            {activity.map((h) => {
              const u = users.find((x) => x.id === h.userId)
              return (
                <div key={h.id} className="flex gap-2 text-sm">
                  <Avatar user={u} size={22} />
                  <div>
                    <span className="font-medium">{u?.name}</span>{' '}
                    {h.field === 'Created' ? 'created' : <>changed <b>{h.field}</b>{h.oldValue && <> from <i>{h.oldValue}</i></>} to <i>{h.newValue || 'None'}</i> on</>}{' '}
                    <Link to={`/browse/${h.itemId}`} className="text-brand-700 hover:underline">{h.itemId}</Link>
                    <div className="text-xs text-slate-500">{timeAgo(h.timestamp)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
