import { useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import clsx from 'clsx'
import {
  AppWindow, Boxes, ChevronDown, ChevronRight, Clock, Filter, Gauge, Goal, Home, LayoutGrid, ListChecks, Map, Plus,
  Search, Star, Users,
} from 'lucide-react'
import { useAccessibleProjects, useCurrentUser } from '../store/hooks'
import { canCreateSpace, canSee, type NavKey } from '../lib/permissions'
import { useUi } from '../store/uiStore'
import { ProjectIcon } from './ui'
import { DEFAULT_FILTERS } from '../lib/jql'

const itemCls = (active: boolean, collapsed: boolean) =>
  clsx(
    'flex items-center gap-2.5 rounded px-2 py-1.5 text-sm font-medium',
    collapsed && 'justify-center',
    active ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-100',
  )

function NavItem({ to, icon, label, collapsed, end }: { to: string; icon: ReactNode; label: string; collapsed: boolean; end?: boolean }) {
  return (
    <NavLink to={to} end={end} title={label} className={({ isActive }) => itemCls(isActive, collapsed)}>
      {icon}
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  )
}

function SubLink({ to, label, icon }: { to: string; label: string; icon?: ReactNode }) {
  const loc = useLocation()
  const [path, search = ''] = to.split('?')
  const active = loc.pathname === path && (search ? loc.search === `?${search}` : !loc.search)
  return (
    <Link to={to} className={clsx(itemCls(active, false), 'py-1 pl-8 font-normal')}>
      {icon}
      <span className="truncate">{label}</span>
    </Link>
  )
}

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const user = useCurrentUser()
  const projects = useAccessibleProjects()
  const setCreateSpaceOpen = useUi((s) => s.setCreateSpaceOpen)
  const loc = useLocation()
  const [spacesOpen, setSpacesOpen] = useState(true)
  const [filtersOpen, setFiltersOpen] = useState(loc.pathname.startsWith('/filters'))
  const [defaultsOpen, setDefaultsOpen] = useState(false)
  const show = (k: NavKey) => canSee(user, k)
  const ic = 18

  const section = (label: string, open: boolean, toggle: () => void, icon: ReactNode, active: boolean, extra?: ReactNode) => (
    <div className={clsx('group flex items-center rounded', active && !open ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-100')}>
      <button onClick={toggle} title={label} className={clsx('flex flex-1 items-center gap-2.5 px-2 py-1.5 text-sm font-medium', collapsed && 'justify-center')}>
        {icon}
        {!collapsed && <span className="flex-1 text-left">{label}</span>}
        {!collapsed && (open ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
      </button>
      {!collapsed && extra}
    </div>
  )

  return (
    <aside className={clsx('flex shrink-0 flex-col border-r border-slate-200 bg-white transition-all', collapsed ? 'w-14' : 'w-64')}>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {show('forYou') && <NavItem to="/for-you" icon={<Home size={ic} />} label="For you" collapsed={collapsed} />}
        {show('recent') && <NavItem to="/recent" icon={<Clock size={ic} />} label="Recent" collapsed={collapsed} />}
        {show('starred') && <NavItem to="/starred" icon={<Star size={ic} />} label="Starred" collapsed={collapsed} />}
        {show('apps') && <NavItem to="/apps" icon={<AppWindow size={ic} />} label="Apps" collapsed={collapsed} />}
        {show('plans') && <NavItem to="/plans" icon={<Map size={ic} />} label="Plans" collapsed={collapsed} />}

        {show('spaces') && (
          <div className="pt-2">
            {section('Spaces', spacesOpen, () => setSpacesOpen((o) => !o), <LayoutGrid size={ic} />, loc.pathname.startsWith('/projects') || loc.pathname === '/spaces',
              canCreateSpace(user) && (
                <button title="Create space" onClick={() => setCreateSpaceOpen(true)} className="mr-1 rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-800">
                  <Plus size={14} />
                </button>
              ))}
            {spacesOpen && !collapsed && (
              <div className="mt-0.5 space-y-0.5">
                {projects.map((p) => {
                  const active = loc.pathname.startsWith(`/projects/${p.key}/`) || loc.pathname === `/projects/${p.key}`
                  return (
                    <Link key={p.id} to={`/projects/${p.key}/summary`} className={clsx(itemCls(active, false), 'pl-6 font-normal')}>
                      <ProjectIcon icon={p.icon} size={20} />
                      <span className="truncate">{p.name}</span>
                    </Link>
                  )
                })}
                {projects.length === 0 && <div className="px-8 py-1 text-xs text-slate-500">No spaces you can access</div>}
                <SubLink to="/spaces" label="View all spaces" />
              </div>
            )}
          </div>
        )}

        {show('filters') && (
          <div>
            {section('Filters', filtersOpen, () => setFiltersOpen((o) => !o), <Filter size={ic} />, loc.pathname.startsWith('/filters'))}
            {filtersOpen && !collapsed && (
              <div className="mt-0.5 space-y-0.5">
                <SubLink to="/filters/search" label="Search work items" icon={<Search size={14} />} />
                <SubLink to="/filters?tab=starred" label="Starred filters" icon={<Star size={14} />} />
                <SubLink to="/filters/all" label="All work items" icon={<ListChecks size={14} />} />
                <SubLink to="/filters/search?default=today" label="Today's work items" icon={<Clock size={14} />} />
                <button onClick={() => setDefaultsOpen((o) => !o)} className={clsx(itemCls(false, false), 'w-full py-1 pl-8 font-normal')}>
                  {defaultsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span>Default filters</span>
                </button>
                {defaultsOpen && (
                  <div className="ml-4">
                    {DEFAULT_FILTERS.map((f) => (
                      <SubLink key={f.id} to={`/filters/search?default=${f.id}`} label={f.name} />
                    ))}
                  </div>
                )}
                <SubLink to="/filters" label="View all filters" />
              </div>
            )}
          </div>
        )}

        {show('dashboards') && <NavItem to="/dashboards" icon={<Gauge size={ic} />} label="Dashboards" collapsed={collapsed} />}
        {show('assets') && <NavItem to="/assets" icon={<Boxes size={ic} />} label="Assets" collapsed={collapsed} />}
        {show('teams') && <NavItem to="/teams" icon={<Users size={ic} />} label="Teams" collapsed={collapsed} />}
        {show('goals') && <NavItem to="/goals" icon={<Goal size={ic} />} label="Goals" collapsed={collapsed} />}
      </nav>
      {!collapsed && user && (
        <div className="border-t border-slate-200 p-3 text-xs text-slate-500">
          Signed in as <span className="font-semibold text-slate-700">{user.name}</span>
          <br />
          Role: {user.role}
        </div>
      )}
    </aside>
  )
}
