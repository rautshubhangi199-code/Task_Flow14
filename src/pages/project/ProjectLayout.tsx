import { useRef, useState } from 'react'
import { NavLink, Outlet, useParams } from 'react-router-dom'
import clsx from 'clsx'
import { CalendarDays, ClipboardList, Columns3, GanttChart, GitBranch, LayoutDashboard, List, Pencil, Plus, Star, Target, Timer } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useCurrentUser, useProjectByKey } from '../../store/hooks'
import { useUi } from '../../store/uiStore'
import { projectService } from '../../services/api'
import { canCreateWorkItems } from '../../lib/permissions'
import { EmptyState, Modal, ProjectIcon } from '../../components/ui'

function spaceAvatar(bg: string, art: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="8" fill="${bg}"/>${art}</svg>`,
  )}`
}

const SPACE_AVATARS = [
  spaceAvatar('#7DD3FC', '<rect x="10" y="14" width="20" height="14" rx="3" fill="#0F172A"/><circle cx="20" cy="21" r="5" fill="#BAE6FD"/><circle cx="20" cy="21" r="2" fill="#0F172A"/><rect x="16" y="11" width="8" height="4" rx="1" fill="#0F172A"/>'),
  spaceAvatar('#38BDF8', '<circle cx="20" cy="20" r="9" fill="none" stroke="#fff" stroke-width="2"/><ellipse cx="20" cy="20" rx="4" ry="9" fill="none" stroke="#fff" stroke-width="2"/><path d="M11 20h18M12 16h16M12 24h16" stroke="#fff" stroke-width="1.6"/>'),
  spaceAvatar('#E0F2FE', '<ellipse cx="20" cy="22" rx="11" ry="7" fill="#fff"/><circle cx="14" cy="20" r="5" fill="#fff"/><circle cx="24" cy="19" r="6" fill="#fff"/>'),
  spaceAvatar('#FED7AA', '<ellipse cx="20" cy="24" rx="8" ry="6" fill="#9A3412"/><path d="M20 18c4 0 6-6 3-8" stroke="#fff" stroke-width="1.8" fill="none"/><ellipse cx="20" cy="18" rx="5" ry="2" fill="#FDBA74"/>'),
  spaceAvatar('#F97316', '<path d="M12 24l16-8-4 12-4-3-8-1z" fill="#fff"/><circle cx="28" cy="14" r="2.5" fill="#FDE68A"/>'),
  spaceAvatar('#FDE68A', '<rect x="13" y="10" width="14" height="20" rx="2" fill="#fff"/><path d="M16 16h8M16 20h8M16 24h6" stroke="#94A3B8" stroke-width="1.6"/>'),
  spaceAvatar('#86EFAC', '<rect x="8" y="12" width="24" height="16" rx="2" fill="#fff"/><path d="M8 24l7-6 5 4 6-7 6 9H8z" fill="#22C55E"/><circle cx="16" cy="17" r="2" fill="#FDE047"/>'),
  spaceAvatar('#FB923C', ''),
  spaceAvatar('#CBD5E1', '<circle cx="20" cy="16" r="7" fill="#64748B"/><ellipse cx="20" cy="28" rx="9" ry="6" fill="#94A3B8"/><circle cx="17" cy="15" r="1.2" fill="#0F172A"/><circle cx="23" cy="15" r="1.2" fill="#0F172A"/>'),
  spaceAvatar('#D6B894', '<rect x="12" y="14" width="16" height="14" rx="3" fill="#7C4A2D"/><path d="M16 14v-2a4 4 0 018 0v2" stroke="#7C4A2D" stroke-width="2" fill="none"/><circle cx="26" cy="22" r="1.4" fill="#FDE68A"/>'),
  spaceAvatar('#67E8F9', '<path d="M8 28l8-12 6 8 4-6 6 10H8z" fill="#0F766E"/><path d="M8 28h24v4H8z" fill="#155E75"/>'),
  spaceAvatar('#FDE047', '<rect x="18" y="8" width="4" height="10" rx="1" fill="#CA8A04"/><path d="M12 28l8-12 8 12H12z" fill="#FACC15"/><path d="M14 28h12" stroke="#CA8A04" stroke-width="2"/>'),
  spaceAvatar('#F43F5E', '<path d="M18 28V16l10-4-2 8-8 2z" fill="#fff"/><rect x="16" y="26" width="8" height="4" rx="1" fill="#FB7185"/><circle cx="28" cy="11" r="2" fill="#FDE68A"/>'),
  spaceAvatar('#F9A8D4', '<path d="M14 26l4-12 2 4 2-4 4 12" stroke="#fff" stroke-width="2" fill="none"/><circle cx="16" cy="14" r="3" fill="#E11D48"/><circle cx="24" cy="14" r="3" fill="#fff"/>'),
  spaceAvatar('#FB923C', '<rect x="13" y="16" width="14" height="12" rx="2" fill="#FDBA74"/><path d="M13 18h14" stroke="#EA580C" stroke-width="2"/><path d="M20 16v12" stroke="#EA580C" stroke-width="2"/><rect x="17" y="12" width="6" height="5" rx="2" fill="#F43F5E"/>'),
  spaceAvatar('#EF4444', ''),
  spaceAvatar('#F9A8D4', '<circle cx="20" cy="20" r="7" fill="#FB7185"/><circle cx="20" cy="20" r="3" fill="#FDE68A"/>'),
  spaceAvatar('#FDE68A', '<circle cx="20" cy="20" r="8" fill="#FACC15"/><circle cx="20" cy="20" r="3" fill="#CA8A04"/>'),
  spaceAvatar('#E2E8F0', '<rect x="11" y="12" width="4" height="16" rx="1" fill="#64748B"/><rect x="18" y="16" width="4" height="12" rx="1" fill="#64748B"/><rect x="25" y="10" width="4" height="18" rx="1" fill="#64748B"/>'),
  spaceAvatar('#FDBA74', '<path d="M12 24h16l-3-3 3-3H12l3 3-3 3z" fill="#fff"/><circle cx="28" cy="14" r="3" fill="#fff"/>'),
  spaceAvatar('#BAE6FD', '<circle cx="26" cy="14" r="5" fill="#FDE047"/><ellipse cx="18" cy="24" rx="10" ry="6" fill="#fff"/>'),
  spaceAvatar('#FECACA', '<circle cx="20" cy="20" r="10" fill="#fff" stroke="#EF4444" stroke-width="4"/><rect x="18" y="12" width="4" height="16" fill="#EF4444"/><rect x="12" y="18" width="16" height="4" fill="#EF4444"/>'),
  spaceAvatar('#93C5FD', '<circle cx="14" cy="16" r="5" fill="#1D4ED8"/><circle cx="26" cy="16" r="5" fill="#1D4ED8"/><ellipse cx="20" cy="28" rx="12" ry="6" fill="#1D4ED8"/>'),
  spaceAvatar('#F1F5F9', '<circle cx="20" cy="20" r="10" fill="#E2E8F0"/>'),
]

const TABS = [
  ['summary', 'Summary', LayoutDashboard],
  ['timeline', 'Timeline', GanttChart],
  ['backlog', 'Backlog', List],
  ['board', 'Board', Columns3],
  ['calendar', 'Calendar', CalendarDays],
  ['list', 'List', List],
  ['forms', 'Forms', ClipboardList],
  ['goals', 'Goals', Target],
  ['development', 'Development', GitBranch],
  ['worklog', 'Worklogs', Timer],
  ['reports', 'Reports', LayoutDashboard],
] as const

export default function ProjectLayout() {
  const { key } = useParams()
  const project = useProjectByKey(key)
  const me = useCurrentUser()
  const isAdmin = me?.role === 'Admin'
  const starred = useStore((s) => s.starredProjects)
  const openCreate = useUi((s) => s.openCreateItem)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  if (!project)
    return (
      <div className="p-6">
        <EmptyState title="Space not found">The space "{key}" doesn't exist or you don't have access to it.</EmptyState>
      </div>
    )
  const isStarred = !!me && (starred[me.id] ?? []).includes(project.id)
  const applyIcon = (icon: string) => {
    projectService.update(project.id, { icon })
    setAvatarOpen(false)
  }
  const applyFile = (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') applyIcon(reader.result)
    }
    reader.readAsDataURL(file)
  }
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 px-6 pt-4">
        <div className="text-xs text-slate-500">Spaces / {project.name}</div>
        <div className="mt-1 flex items-center gap-3">
          <div className="relative shrink-0">
            <ProjectIcon icon={project.icon} size={32} />
            {isAdmin && (
              <button
                type="button"
                className="absolute -bottom-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
                title="Edit"
                aria-label="Edit space avatar"
                onClick={() => setAvatarOpen(true)}
              >
                <Pencil size={11} />
              </button>
            )}
          </div>
          <h1 className="text-xl font-semibold">{project.name}</h1>
          <button title={isStarred ? 'Unstar' : 'Star'} onClick={() => projectService.toggleStar(project.id)}>
            <Star size={18} className={isStarred ? 'fill-amber-400 text-amber-400' : 'text-slate-400 hover:text-slate-600'} />
          </button>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{project.type}</span>
          {canCreateWorkItems(me) && <button className="btn-default ml-auto" onClick={() => openCreate({ projectId: project.id })}><Plus size={16} /> Create in {project.key}</button>}
        </div>
        <nav className="mt-3 flex gap-0 overflow-x-auto whitespace-nowrap">
          {TABS.map(([path, label, Icon]) => (
            <NavLink
              key={path}
              to={`/projects/${project.key}/${path}`}
              className={({ isActive }) => clsx('-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium', isActive ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-600 hover:text-slate-900')}
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <Outlet context={{ project }} />
      </div>
      {isAdmin && (
        <Modal open={avatarOpen} onClose={() => setAvatarOpen(false)} title="Select an avatar" width={420}>
          <div className="grid grid-cols-8 gap-2">
            {SPACE_AVATARS.map((avatar) => {
              const selected = project.icon === avatar
              const isImage = avatar.startsWith('data:') || avatar.startsWith('http://') || avatar.startsWith('https://')
              return (
                <button
                  key={avatar}
                  type="button"
                  title="Select avatar"
                  onClick={() => applyIcon(avatar)}
                  className={clsx(
                    'relative h-9 w-9 overflow-hidden rounded-lg hover:ring-2 hover:ring-brand-400',
                    selected && 'ring-2 ring-brand-600',
                  )}
                >
                  {isImage ? (
                    <img src={avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-slate-100 text-base">{avatar}</span>
                  )}
                  {selected && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                      <Pencil size={14} className="text-white" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <div className="mt-4 border-t border-slate-200 pt-4">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                applyFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <button
              type="button"
              className={clsx(
                'flex w-full flex-col items-center justify-center rounded-lg border border-dashed px-4 py-6 text-center text-sm',
                dragOver ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-white',
              )}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                applyFile(e.dataTransfer.files[0])
              }}
            >
              <span className="font-medium text-brand-700">Select an image to upload</span>
              <span className="text-xs text-slate-500">or drag and drop it here</span>
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
