import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart } from 'recharts'
import { useStore } from '../../store/useStore'
import { useProject } from './projectContext'
import { isDone, fmtDate } from '../../lib/utils'
import type { Sprint, WorkItem } from '../../types'
import { TypeIcon } from '../../components/ui'

function sprintItems(all: WorkItem[], sprintId: string) {
  return all.filter((i) => i.sprintId === sprintId)
}

function remainingOn(day: string, items: WorkItem[]) {
  return items.reduce((sum, i) => {
    if (isDone(i.status) && i.resolvedAt && i.resolvedAt.slice(0, 10) <= day) return sum
    if (isDone(i.status) && !i.resolvedAt) return sum
    return sum + (i.storyPoints ?? 0)
  }, 0)
}

export default function Reports() {
  const project = useProject()
  const allItems = useStore((s) => s.items)
  const allSprints = useStore((s) => s.sprints)
  const [params, setParams] = useSearchParams()
  const sprints = useMemo(
    () => allSprints.filter((s) => s.projectId === project.id).sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? '')),
    [allSprints, project.id],
  )
  const selectedId = params.get('sprint') || sprints.find((s) => s.state === 'active')?.id || sprints[0]?.id || ''
  const sprint = sprints.find((s) => s.id === selectedId)
  const [tab, setTab] = useState<'report' | 'burndown' | 'velocity'>('report')

  const items = sprint ? sprintItems(allItems, sprint.id) : []
  const completed = items.filter((i) => isDone(i.status))
  const open = items.filter((i) => !isDone(i.status))
  const committed = items.reduce((a, i) => a + (i.storyPoints ?? 0), 0)
  const donePts = completed.reduce((a, i) => a + (i.storyPoints ?? 0), 0)

  const burndown = useMemo(() => {
    if (!sprint?.startDate || !sprint.endDate) return []
    const start = parseISO(sprint.startDate)
    const end = parseISO(sprint.endDate)
    const days = Math.max(1, differenceInCalendarDays(end, start))
    const startPts = remainingOn(sprint.startDate, items)
    const today = format(new Date(), 'yyyy-MM-dd')
    const last = today < sprint.endDate ? today : sprint.endDate
    const rows = []
    for (let d = 0; d <= days; d++) {
      const day = format(addDays(start, d), 'yyyy-MM-dd')
      const guideline = startPts - (startPts / days) * d
      rows.push({
        day: format(addDays(start, d), 'dd MMM'),
        guideline: Math.max(0, Math.round(guideline * 10) / 10),
        remaining: day <= last ? remainingOn(day, items) : undefined,
      })
    }
    return rows
  }, [sprint, items])

  const velocity = useMemo(() => {
    return sprints
      .filter((s) => s.state === 'completed' || s.state === 'active')
      .slice()
      .reverse()
      .map((s) => {
        const si = sprintItems(allItems, s.id)
        return {
          name: s.name.replace(`${project.key} `, ''),
          committed: si.reduce((a, i) => a + (i.storyPoints ?? 0), 0),
          completed: si.filter((i) => isDone(i.status)).reduce((a, i) => a + (i.storyPoints ?? 0), 0),
        }
      })
  }, [sprints, allItems, project.key])

  if (!sprint) {
    return (
      <div className="p-6 text-sm text-slate-600">
        No sprints yet. <Link className="text-brand-700 hover:underline" to={`/projects/${project.key}/backlog`}>Create one in the backlog</Link>.
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">Reports</h2>
        <select className="input w-56" value={selectedId} onChange={(e) => setParams({ sprint: e.target.value })}>
          {sprints.map((s) => (
            <option key={s.id} value={s.id}>{s.name} ({s.state})</option>
          ))}
        </select>
        <div className="flex gap-1 rounded-md bg-slate-100 p-0.5">
          {(['report', 'burndown', 'velocity'] as const).map((t) => (
            <button key={t} className={`rounded px-3 py-1 text-sm capitalize ${tab === t ? 'bg-white font-medium shadow-sm' : 'text-slate-600'}`} onClick={() => setTab(t)}>
              {t === 'report' ? 'Sprint report' : t === 'burndown' ? 'Burndown' : 'Velocity'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'report' && <SprintReport sprint={sprint} items={items} completed={completed} open={open} committed={committed} donePts={donePts} projectKey={project.key} />}
      {tab === 'burndown' && (
        <div className="card p-4">
          <h3 className="mb-1 font-semibold">Burndown chart</h3>
          <p className="mb-4 text-sm text-slate-500">Remaining story points vs a guideline of even completion. {sprint.startDate && sprint.endDate ? `${fmtDate(sprint.startDate)} – ${fmtDate(sprint.endDate)}` : 'Set sprint dates to plot a guideline.'}</p>
          {burndown.length === 0 ? (
            <p className="text-sm text-slate-500">Add start and end dates on the sprint to see a burndown.</p>
          ) : (
            <div className="h-80">
              <ResponsiveContainer>
                <LineChart data={burndown}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis label={{ value: 'Story points', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="guideline" name="Guideline" stroke="#94a3b8" strokeDasharray="4 4" dot={false} />
                  <Line type="monotone" dataKey="remaining" name="Remaining" stroke="#0c66e4" connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
      {tab === 'velocity' && (
        <div className="card p-4">
          <h3 className="mb-1 font-semibold">Velocity</h3>
          <p className="mb-4 text-sm text-slate-500">Committed vs completed story points by sprint.</p>
          {velocity.length === 0 ? (
            <p className="text-sm text-slate-500">Complete at least one sprint to see velocity.</p>
          ) : (
            <div className="h-80">
              <ResponsiveContainer>
                <BarChart data={velocity}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="committed" name="Committed" fill="#cce0ff" />
                  <Bar dataKey="completed" name="Completed" fill="#0c66e4" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SprintReport({ sprint, items, completed, open, committed, donePts, projectKey }: {
  sprint: Sprint
  items: WorkItem[]
  completed: WorkItem[]
  open: WorkItem[]
  committed: number
  donePts: number
  projectKey: string
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Work items" value={String(items.length)} />
        <Stat label="Completed" value={`${completed.length} (${donePts} pts)`} />
        <Stat label="Not completed" value={`${open.length} (${committed - donePts} pts)`} />
        <Stat label="Commitment" value={`${donePts}/${committed || 0} pts`} />
      </div>
      <div className="card p-4">
        <div className="text-sm text-slate-500">{fmtDate(sprint.startDate)} – {fmtDate(sprint.endDate)} · {sprint.state}</div>
        <h3 className="mt-1 font-semibold">{sprint.name}</h3>
        {sprint.goal ? <p className="mt-1 text-sm text-slate-600">Goal: {sprint.goal}</p> : <p className="mt-1 text-sm text-slate-400">No sprint goal</p>}
        <Link className="mt-2 inline-block text-sm text-brand-700 hover:underline" to={`/projects/${projectKey}/backlog`}>Back to backlog</Link>
      </div>
      <ItemTable title="Completed work items" rows={completed} />
      <ItemTable title="Work items not completed" rows={open} />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  )
}

function ItemTable({ title, rows }: { title: string; rows: WorkItem[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-2 text-sm font-semibold">{title} ({rows.length})</div>
      {rows.length === 0 && <div className="px-4 py-6 text-sm text-slate-500">None</div>}
      {rows.map((i) => (
        <div key={i.id} className="flex items-center gap-2 border-b border-slate-100 px-4 py-2 text-sm last:border-0">
          <TypeIcon type={i.type} />
          <Link to={`/browse/${i.id}`} className="w-20 text-xs text-slate-500 hover:underline">{i.id}</Link>
          <Link to={`/browse/${i.id}`} className="flex-1 truncate hover:underline">{i.summary}</Link>
          <span className="text-xs text-slate-500">{i.status}</span>
          <span className="w-8 text-right text-xs">{i.storyPoints ?? '–'}</span>
        </div>
      ))}
    </div>
  )
}
