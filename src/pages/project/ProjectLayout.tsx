import { NavLink, Outlet, useParams } from 'react-router-dom'
import clsx from 'clsx'
import { Plus, Star } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useCurrentUser, useProjectByKey } from '../../store/hooks'
import { useUi } from '../../store/uiStore'
import { projectService } from '../../services/api'
import { EmptyState, ProjectIcon } from '../../components/ui'

const TABS = [
  ['summary', 'Summary'],
  ['timeline', 'Timeline'],
  ['backlog', 'Backlog'],
  ['board', 'Board'],
  ['calendar', 'Calendar'],
  ['list', 'List'],
  ['reports', 'Reports'],
] as const

export default function ProjectLayout() {
  const { key } = useParams()
  const project = useProjectByKey(key)
  const me = useCurrentUser()
  const starred = useStore((s) => s.starredProjects)
  const openCreate = useUi((s) => s.openCreateItem)
  if (!project)
    return (
      <div className="p-6">
        <EmptyState title="Space not found">The space "{key}" doesn't exist or you don't have access to it.</EmptyState>
      </div>
    )
  const isStarred = !!me && (starred[me.id] ?? []).includes(project.id)
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 px-6 pt-4">
        <div className="text-xs text-slate-500">Spaces / {project.name}</div>
        <div className="mt-1 flex items-center gap-3">
          <ProjectIcon icon={project.icon} size={32} />
          <h1 className="text-xl font-semibold">{project.name}</h1>
          <button title={isStarred ? 'Unstar' : 'Star'} onClick={() => projectService.toggleStar(project.id)}>
            <Star size={18} className={isStarred ? 'fill-amber-400 text-amber-400' : 'text-slate-400 hover:text-slate-600'} />
          </button>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{project.type}</span>
          <button className="btn-default ml-auto" onClick={() => openCreate({ projectId: project.id })}><Plus size={16} /> Create in {project.key}</button>
        </div>
        <nav className="mt-3 flex gap-1">
          {TABS.map(([path, label]) => (
            <NavLink
              key={path}
              to={`/projects/${project.key}/${path}`}
              className={({ isActive }) => clsx('-mb-px border-b-2 px-3 py-2 text-sm font-medium', isActive ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-600 hover:text-slate-900')}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <Outlet context={{ project }} />
      </div>
    </div>
  )
}
