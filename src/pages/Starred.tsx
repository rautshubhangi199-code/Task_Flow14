import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Star } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useAccessibleItems, useAccessibleProjects, useCurrentUser } from '../store/hooks'
import { WorkItemActivityList } from '../components/WorkItemList'
import { EmptyState, ProjectIcon } from '../components/ui'
import { projectService } from '../services/api'

export default function Starred() {
  const me = useCurrentUser()!
  const items = useAccessibleItems()
  const projects = useAccessibleProjects()
  const starredItems = useStore((s) => s.starredItems)
  const starredProjects = useStore((s) => s.starredProjects)
  const filters = useStore((s) => s.savedFilters)
  const rows = useMemo(() => items.filter((i) => (starredItems[me.id] ?? []).includes(i.id)).map((i) => ({ item: i, at: i.updatedAt })), [items, starredItems, me.id])
  const sp = projects.filter((p) => (starredProjects[me.id] ?? []).includes(p.id))
  const sf = filters.filter((f) => f.starred)
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Starred</h1>
      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">Spaces</h2>
        {sp.length === 0 ? <EmptyState title="No starred spaces">Star a space from its header.</EmptyState> : (
          <div className="grid grid-cols-3 gap-3">
            {sp.map((p) => (
              <div key={p.id} className="card flex items-center gap-3 p-3">
                <ProjectIcon icon={p.icon} size={28} />
                <Link to={`/projects/${p.key}/summary`} className="flex-1 font-medium hover:underline">{p.name}</Link>
                <button onClick={() => projectService.toggleStar(p.id)} title="Unstar"><Star size={16} className="fill-amber-400 text-amber-400" /></button>
              </div>
            ))}
          </div>
        )}
      </section>
      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">Filters</h2>
        {sf.length === 0 ? <EmptyState title="No starred filters" /> : (
          <div className="space-y-1">
            {sf.map((f) => <Link key={f.id} to={`/filters/search?filter=${f.id}`} className="block text-brand-700 hover:underline">{f.name}</Link>)}
          </div>
        )}
      </section>
      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">Work items</h2>
        <WorkItemActivityList rows={rows} empty="No starred work items" />
      </section>
    </div>
  )
}
