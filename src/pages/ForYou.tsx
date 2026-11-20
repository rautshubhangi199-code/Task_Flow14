import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bot } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useAccessibleItems, useAccessibleProjects, useCurrentUser } from '../store/hooks'
import { Avatar, EmptyState, ProjectIcon, Tabs } from '../components/ui'
import { WorkItemActivityList, type ActivityRow } from '../components/WorkItemList'
import { isDone } from '../lib/utils'

type Tab = 'recommended' | 'assigned' | 'agents' | 'starred' | 'worked' | 'viewed'

export default function ForYou() {
  const me = useCurrentUser()!
  const projects = useAccessibleProjects()
  const items = useAccessibleItems()
  const users = useStore((s) => s.users)
  const views = useStore((s) => s.views)
  const history = useStore((s) => s.history)
  const comments = useStore((s) => s.comments)
  const worklogs = useStore((s) => s.worklogs)
  const starredItems = useStore((s) => s.starredItems)
  const [tab, setTab] = useState<Tab>('recommended')

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])

  const lists = useMemo(() => {
    const viewed: ActivityRow[] = views.filter((v) => v.userId === me.id && byId.has(v.itemId)).map((v) => ({ item: byId.get(v.itemId)!, at: v.at, label: 'Viewed' }))
    const assigned: ActivityRow[] = items
      .filter((i) => i.assigneeId === me.id && !isDone(i.status))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((i) => ({ item: i, at: i.updatedAt }))
    const starred: ActivityRow[] = (starredItems[me.id] ?? []).filter((id) => byId.has(id)).map((id) => ({ item: byId.get(id)!, at: byId.get(id)!.updatedAt }))
    const touched = new Map<string, string>()
    const touch = (id: string, at: string) => { if (byId.has(id) && (!touched.has(id) || touched.get(id)! < at)) touched.set(id, at) }
    history.filter((h) => h.userId === me.id).forEach((h) => touch(h.itemId, h.timestamp))
    comments.filter((c) => c.authorId === me.id).forEach((c) => touch(c.itemId, c.createdAt))
    worklogs.filter((w) => w.userId === me.id).forEach((w) => touch(w.itemId, w.createdAt))
    const worked: ActivityRow[] = [...touched.entries()].sort((a, b) => b[1].localeCompare(a[1])).map(([id, at]) => ({ item: byId.get(id)!, at, label: 'Worked on' }))
    const seen = new Set<string>()
    const recommended = [...assigned.slice(0, 5), ...viewed, ...worked].filter((r) => (seen.has(r.item.id) ? false : (seen.add(r.item.id), true))).slice(0, 12)
    return { viewed, assigned, starred, worked, recommended }
  }, [views, history, comments, worklogs, starredItems, items, byId, me.id])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'recommended', label: 'Recommended' },
    { id: 'assigned', label: `Assigned to me (${lists.assigned.length})` },
    { id: 'agents', label: 'Agent sessions' },
    { id: 'starred', label: 'Starred' },
    { id: 'worked', label: 'Worked on' },
    { id: 'viewed', label: 'Viewed' },
  ]

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="mb-1 text-2xl font-semibold">For you</h1>
      <p className="mb-6 text-sm text-slate-500">Welcome back, {me.name.split(' ')[0]}.</p>

      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Recommended spaces</h2>
        <Link to="/spaces" className="text-sm text-brand-600 hover:underline">View all spaces</Link>
      </div>
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((p) => {
          const pi = items.filter((i) => i.projectId === p.id)
          const open = pi.filter((i) => !isDone(i.status)).length
          const mine = pi.filter((i) => i.assigneeId === me.id && !isDone(i.status)).length
          const lead = users.find((u) => u.id === p.leadId)
          return (
            <div key={p.id} className="card flex flex-col p-4 shadow-sm transition hover:shadow-md">
              <Link to={`/projects/${p.key}/summary`} className="flex items-center gap-3">
                <ProjectIcon icon={p.icon} size={36} />
                <div className="min-w-0">
                  <div className="truncate font-semibold">{p.name}</div>
                  <div className="text-xs text-slate-500">{p.type} space · {p.key}</div>
                </div>
              </Link>
              <div className="mt-3 text-xs font-semibold text-slate-500">QUICK LINKS</div>
              <div className="mt-1 space-y-1 text-sm">
                <Link to={`/filters/search?jql=${encodeURIComponent(`project = ${p.key} AND assignee = currentUser() AND statusCategory != Done`)}`} className="flex justify-between hover:text-brand-700">
                  <span>My open work items</span><span className="rounded bg-slate-100 px-1.5 text-xs">{mine}</span>
                </Link>
                <Link to={`/projects/${p.key}/list`} className="flex justify-between hover:text-brand-700">
                  <span>All open work items</span><span className="rounded bg-slate-100 px-1.5 text-xs">{open}</span>
                </Link>
              </div>
              <div className="mt-auto flex items-center gap-2 pt-3 text-xs text-slate-500">
                <Avatar user={lead} size={18} /> Lead: {lead?.name}
                <Link to={`/projects/${p.key}/board`} className="ml-auto text-brand-600 hover:underline">Board</Link>
              </div>
            </div>
          )
        })}
        {projects.length === 0 && <EmptyState title="You don't have access to any spaces yet" />}
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      <div className="mt-4">
        {tab === 'agents' ? (
          <div className="flex flex-col items-center rounded-lg border border-dashed border-slate-300 py-12 text-center text-slate-500">
            <Bot size={32} className="mb-2 text-slate-400" />
            <div className="font-semibold text-slate-700">Agent sessions are coming soon</div>
            <div className="text-sm">AI agent work sessions will appear here once the integration is available.</div>
          </div>
        ) : (
          <WorkItemActivityList
            rows={lists[tab]}
            empty={
              { recommended: 'Nothing recommended yet', assigned: 'Nothing assigned to you', starred: 'No starred work items', worked: "You haven't worked on anything yet", viewed: "You haven't viewed any work items yet" }[tab]
            }
          />
        )}
      </div>
    </div>
  )
}
