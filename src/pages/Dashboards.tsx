import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, CheckCircle2, CircleDot, ListTodo, Layers } from 'lucide-react'
import { subDays } from 'date-fns'
import { useStore } from '../store/useStore'
import { useAccessibleItems, useAccessibleProjects, useCurrentUser } from '../store/hooks'
import { canSeeAllWorklogs } from '../lib/permissions'
import { formatDuration, isDone, now, STATUS_COLOR, timeAgo, todayStr } from '../lib/utils'
import { STATUSES } from '../types'
import { Avatar, ProgressBar } from '../components/ui'

const PROJECT_COLORS = ['#0c66e4', '#22a06b', '#e56910', '#9f5ee7', '#c9372c', '#1d7a8c']

function Kpi({ label, value, icon, color, to }: { label: string; value: number; icon: ReactNode; color: string; to: string }) {
  return (
    <Link to={to} className="card flex items-center gap-3 p-4 hover:shadow-md">
      <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>{icon}</span>
      <div>
        <div className="text-2xl font-semibold">{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    </Link>
  )
}

export default function Dashboards() {
  const me = useCurrentUser()!
  const projects = useAccessibleProjects()
  const allItems = useAccessibleItems()
  const users = useStore((s) => s.users)
  const sprints = useStore((s) => s.sprints)
  const history = useStore((s) => s.history)
  const worklogs = useStore((s) => s.worklogs)
  const [projectFilter, setProjectFilter] = useState('')
  const [range, setRange] = useState(30)

  const items = useMemo(() => allItems.filter((i) => !projectFilter || i.projectId === projectFilter), [allItems, projectFilter])
  const today = todayStr()
  const total = items.length
  const todo = items.filter((i) => i.status === 'To Do').length
  const inProgress = items.filter((i) => !isDone(i.status) && i.status !== 'To Do').length
  const completed = items.filter((i) => isDone(i.status)).length
  const overdue = items.filter((i) => i.dueDate && i.dueDate < today && !isDone(i.status))

  const statusData = STATUSES.map((s) => ({ name: s, value: items.filter((i) => i.status === s).length })).filter((d) => d.value)
  const workload = users
    .map((u) => {
      const mine = items.filter((i) => i.assigneeId === u.id && !isDone(i.status))
      return { name: u.name.split(' ')[0], user: u, open: mine.length, points: mine.reduce((a, i) => a + (i.storyPoints ?? 0), 0) }
    })
    .filter((d) => d.open > 0)

  const itemIds = new Set(items.map((i) => i.id))
  const recent = history.filter((h) => itemIds.has(h.itemId)).sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 10)
  const activeSprints = sprints.filter((s) => s.state === 'active' && projects.some((p) => p.id === s.projectId) && (!projectFilter || s.projectId === projectFilter))

  const since = range ? subDays(now(), range).toISOString().slice(0, 10) : ''
  const allowAll = canSeeAllWorklogs(me)
  const logs = worklogs.filter((w) => itemIds.has(w.itemId) && (!since || w.date >= since) && (allowAll || w.userId === me.id))
  const itemProject = new Map(allItems.map((i) => [i.id, i.projectId]))
  const visibleProjects = projects.filter((p) => !projectFilter || p.id === projectFilter)
  const employeeReport = users
    .map((u) => {
      const row: Record<string, string | number> = { name: u.name.split(' ')[0], full: u.name, total: 0 }
      for (const p of visibleProjects) {
        const h = logs.filter((w) => w.userId === u.id && itemProject.get(w.itemId) === p.id).reduce((a, w) => a + w.minutes, 0) / 60
        row[p.key] = Math.round(h * 10) / 10
        row.total = (row.total as number) + h
      }
      return row
    })
    .filter((r) => (r.total as number) > 0)
  const projectReport = visibleProjects.map((p) => {
    const m = logs.filter((w) => itemProject.get(w.itemId) === p.id).reduce((a, w) => a + w.minutes, 0)
    const est = allItems.filter((i) => i.projectId === p.id).reduce((a, i) => a + (i.originalEstimate ?? 0), 0)
    return { name: p.key, project: p, hours: Math.round((m / 60) * 10) / 10, minutes: m, estimate: est }
  })

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <select className="input ml-auto w-52" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
          <option value="">All accessible spaces</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Kpi label="Total work items" value={total} icon={<Layers size={20} className="text-brand-700" />} color="bg-brand-50" to="/filters/all" />
        <Kpi label="To Do" value={todo} icon={<ListTodo size={20} className="text-slate-700" />} color="bg-slate-100" to={`/filters/search?jql=${encodeURIComponent('status = "To Do"')}`} />
        <Kpi label="In Progress" value={inProgress} icon={<CircleDot size={20} className="text-blue-700" />} color="bg-blue-50" to={`/filters/search?jql=${encodeURIComponent('statusCategory = "In Progress"')}`} />
        <Kpi label="Completed" value={completed} icon={<CheckCircle2 size={20} className="text-green-700" />} color="bg-green-50" to="/filters/search?default=done" />
        <Kpi label="Overdue" value={overdue.length} icon={<AlertTriangle size={20} className="text-red-700" />} color="bg-red-50" to={`/filters/search?jql=${encodeURIComponent('due < startOfDay() AND statusCategory != Done')}`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="mb-2 font-semibold">Work items by status</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {statusData.map((d) => <Cell key={d.name} fill={STATUS_COLOR[d.name as keyof typeof STATUS_COLOR]} />)}
                </Pie>
                <Tooltip />
                <Legend layout="vertical" align="right" verticalAlign="middle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-4">
          <h3 className="mb-2 font-semibold">Employee workload (open items)</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={workload}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar dataKey="open" name="Open items" fill="#0c66e4" radius={[4, 4, 0, 0]} />
                <Bar dataKey="points" name="Story points" fill="#8f7ee7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-4">
          <h3 className="mb-3 font-semibold">Sprint progress</h3>
          {activeSprints.length === 0 && <div className="text-sm text-slate-500">No active sprints</div>}
          <div className="space-y-4">
            {activeSprints.map((s) => {
              const si = allItems.filter((i) => i.sprintId === s.id)
              const d = si.filter((i) => isDone(i.status)).length
              const p = projects.find((x) => x.id === s.projectId)
              return (
                <div key={s.id}>
                  <div className="mb-1 flex justify-between text-sm"><Link to={`/projects/${p?.key}/backlog`} className="font-medium hover:underline">{s.name}</Link><span className="text-xs text-slate-500">{d}/{si.length} done · ends {s.endDate}</span></div>
                  <ProgressBar value={si.length ? (d / si.length) * 100 : 0} />
                </div>
              )
            })}
          </div>
          {overdue.length > 0 && (
            <>
              <h3 className="mb-2 mt-5 font-semibold text-red-700">Overdue work items</h3>
              <div className="space-y-1 text-sm">
                {overdue.slice(0, 6).map((i) => <Link key={i.id} to={`/browse/${i.id}`} className="flex justify-between hover:underline"><span>{i.id} {i.summary}</span><span className="text-xs text-red-600">due {i.dueDate}</span></Link>)}
              </div>
            </>
          )}
        </div>
        <div className="card p-4">
          <h3 className="mb-3 font-semibold">Recent activities</h3>
          <div className="space-y-2.5">
            {recent.map((h) => {
              const u = users.find((x) => x.id === h.userId)
              return (
                <div key={h.id} className="flex items-start gap-2 text-sm">
                  <Avatar user={u} size={22} />
                  <div className="min-w-0 flex-1">
                    <b>{u?.name}</b> {h.field === 'Created' ? 'created' : <>updated <b>{h.field}</b> → {h.newValue || 'None'} on</>}{' '}
                    <Link className="text-brand-700 hover:underline" to={`/browse/${h.itemId}`}>{h.itemId}</Link>
                  </div>
                  <span className="shrink-0 text-xs text-slate-500">{timeAgo(h.timestamp)}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="card p-4">
        <div className="mb-3 flex items-center gap-3">
          <h3 className="font-semibold">Worklog reports</h3>
          {!allowAll && <span className="text-xs text-slate-500">(showing your own worklogs only)</span>}
          <select className="input ml-auto w-40" value={range} onChange={(e) => setRange(Number(e.target.value))}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={0}>All time</option>
          </select>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-600">Employee-wise (hours)</h4>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={employeeReport} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" fontSize={12} />
                  <YAxis type="category" dataKey="name" fontSize={12} width={60} />
                  <Tooltip />
                  <Legend />
                  {visibleProjects.map((p, idx) => <Bar key={p.id} dataKey={p.key} stackId="a" fill={PROJECT_COLORS[idx % PROJECT_COLORS.length]} />)}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <table className="mt-2 w-full text-sm">
              <thead><tr className="border-b border-slate-200"><th className="th">Employee</th><th className="th text-right">Logged</th></tr></thead>
              <tbody>
                {employeeReport.map((r) => <tr key={r.full as string} className="border-b border-slate-100"><td className="td">{r.full}</td><td className="td text-right">{formatDuration((r.total as number) * 60)}</td></tr>)}
                {employeeReport.length === 0 && <tr><td colSpan={2} className="td text-center text-slate-500">No worklogs in this period</td></tr>}
              </tbody>
            </table>
          </div>
          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-600">Project-wise (hours)</h4>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={projectReport}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="hours" name="Hours logged" radius={[4, 4, 0, 0]}>
                    {projectReport.map((p, idx) => <Cell key={p.name} fill={PROJECT_COLORS[idx % PROJECT_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <table className="mt-2 w-full text-sm">
              <thead><tr className="border-b border-slate-200"><th className="th">Project</th><th className="th text-right">Logged</th><th className="th text-right">Total estimate</th></tr></thead>
              <tbody>
                {projectReport.map((r) => <tr key={r.name} className="border-b border-slate-100"><td className="td">{r.project.icon} {r.project.name}</td><td className="td text-right">{formatDuration(r.minutes)}</td><td className="td text-right">{formatDuration(r.estimate)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
