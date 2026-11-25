import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import {
  AlignJustify, AppWindow, Boxes, ChevronDown, ChevronRight, Clock, Columns3, Filter, Gauge, Goal, Home, LayoutGrid, ListChecks, Map as MapIcon, MoreHorizontal, Plus,
  Search, Star, Users, X,
} from 'lucide-react'
import { useAccessibleItems, useAccessibleProjects, useCurrentUser } from '../store/hooks'
import { useStore } from '../store/useStore'
import type { IssueType, Project } from '../types'
import { canSee, type NavKey } from '../lib/permissions'
import { useUi } from '../store/uiStore'
import { Dropdown, MenuItem, ProjectIcon, TypeIcon } from './ui'
import { DEFAULT_FILTERS } from '../lib/jql'
import { timeAgo } from '../lib/utils'

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

type RecentKind = 'board' | 'space' | 'item' | 'filter'

interface RecentRow {
  id: string
  kind: RecentKind
  title: string
  at: string
  to: string
  project?: Project
  itemType?: IssueType
}

function dayGroup(iso: string): 'Today' | 'Yesterday' | 'Older' {
  const d = new Date(iso)
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = start(new Date()) - start(d)
  if (diff === 0) return 'Today'
  if (diff === 86400000) return 'Yesterday'
  return 'Older'
}

function recentWhen(iso: string) {
  return timeAgo(iso).replace(/^about /, '').replace(/^less than /, '')
}

function RecentIcon({ row }: { row: RecentRow }) {
  if (row.kind === 'board') return <Columns3 size={16} className="shrink-0 text-slate-500" />
  if (row.kind === 'filter') return <AlignJustify size={16} className="shrink-0 text-slate-500" />
  if (row.kind === 'space' && row.project) return <ProjectIcon icon={row.project.icon} size={18} />
  if (row.itemType) return <TypeIcon type={row.itemType} size={16} />
  return <Clock size={16} className="shrink-0 text-slate-400" />
}

function RecentNav({ collapsed }: { collapsed: boolean }) {
  const user = useCurrentUser()
  const projects = useAccessibleProjects()
  const items = useAccessibleItems()
  const views = useStore((s) => s.views)
  const filters = useStore((s) => s.savedFilters)
  const loc = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const wrapRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect()
      if (!r) return
      setPos({ top: Math.max(8, r.top), left: r.right + 8 })
    }
    place()
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (wrapRef.current?.contains(t) || panelRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', place)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', place)
    }
  }, [open])

  const rows = useMemo(() => {
    const list: RecentRow[] = []
    const seenProject = new Set<string>()
    const byId = new Map(items.map((i) => [i.id, i]))
    for (const v of views ?? []) {
      if (user && v.userId !== user.id) continue
      const item = byId.get(v.itemId)
      if (!item) continue
      const project = projects.find((p) => p.id === item.projectId)
      if (project && !seenProject.has(project.id)) {
        seenProject.add(project.id)
        list.push({
          id: `board-${project.id}`,
          kind: 'board',
          title: `${project.key} board`,
          at: v.at,
          to: `/projects/${project.key}/board`,
        })
        list.push({
          id: `space-${project.id}`,
          kind: 'space',
          title: project.name,
          at: v.at,
          to: `/projects/${project.key}/summary`,
          project,
        })
      }
      list.push({
        id: item.id,
        kind: 'item',
        title: item.summary,
        at: v.at,
        to: `/browse/${item.id}`,
        itemType: item.type,
      })
    }
    const yesterday = new Date(Date.now() - 86400000).toISOString()
    list.push({ id: 'filter-all', kind: 'filter', title: 'All work items', at: yesterday, to: '/filters/all' })
    list.push({
      id: 'filter-open',
      kind: 'filter',
      title: 'Open work items',
      at: yesterday,
      to: `/filters/search?jql=${encodeURIComponent('statusCategory != Done')}`,
    })
    for (const f of filters) {
      list.push({
        id: `filter-${f.id}`,
        kind: 'filter',
        title: f.name,
        at: f.createdAt,
        to: `/filters/search?filter=${f.id}`,
      })
    }
    list.sort((a, b) => b.at.localeCompare(a.at))
    const seen = new Set<string>()
    return list.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
  }, [views, items, projects, user, filters])

  const filtered = rows.filter((r) => r.title.toLowerCase().includes(q.trim().toLowerCase()))
  const groups = (['Today', 'Yesterday', 'Older'] as const)
    .map((label) => ({ label, items: filtered.filter((r) => dayGroup(r.at) === label) }))
    .filter((g) => g.items.length > 0)

  const go = (to: string) => {
    setOpen(false)
    setQ('')
    navigate(to)
  }

  return (
    <div className="relative w-full" ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        title="Recent"
        onClick={() => setOpen((o) => !o)}
        className={clsx(itemCls(open || loc.pathname === '/recent', collapsed), 'w-full')}
      >
        <Clock size={18} />
        {!collapsed && <span className="truncate">Recent</span>}
      </button>
      {open && createPortal(
        <div
          ref={panelRef}
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-[80] w-[340px] rounded-lg border border-slate-200 bg-white shadow-[0_8px_24px_rgba(9,30,66,0.15)]"
        >
          <div className="flex items-center justify-between px-4 pt-3.5">
            <h2 className="text-[15px] font-semibold text-slate-800">Recent</h2>
            <button type="button" className="rounded p-1 text-slate-500 hover:bg-slate-100" onClick={() => setOpen(false)} aria-label="Close">
              <X size={16} />
            </button>
          </div>
          <div className="px-4 pb-2 pt-2">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search recent items"
                className="w-full rounded-[3px] border border-slate-300 bg-white py-1.5 pl-8 pr-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#0c66e4]"
              />
            </div>
          </div>
          <div className="overflow-visible px-1 pb-1">
            {groups.length === 0 && <div className="px-3 py-6 text-center text-sm text-slate-500">No recent items</div>}
            {groups.map((g) => (
              <div key={g.label}>
                <div className="px-3 py-1 text-xs font-semibold text-slate-500">{g.label}</div>
                {g.items.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => go(row.to)}
                    className="group relative flex w-full items-start gap-2.5 rounded-[3px] px-3 py-1.5 text-left hover:bg-slate-100"
                  >
                    <span className="mt-0.5"><RecentIcon row={row} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-slate-800">{row.title}</span>
                      <span className="block text-xs text-slate-500">{recentWhen(row.at)}</span>
                    </span>
                    <span className="pointer-events-none absolute left-[calc(100%-8px)] top-1 z-[90] hidden max-w-[280px] rounded bg-slate-900 px-2 py-1.5 text-left text-xs leading-4 text-white shadow-lg group-hover:block">
                      {row.title}
                      <span className="mt-1 block text-slate-300">{recentWhen(row.at)}</span>
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => go('/recent')}
            className="flex w-full items-center gap-2.5 border-t border-slate-200 px-4 py-2.5 text-left text-[14px] text-slate-700 hover:bg-slate-50"
          >
            <AlignJustify size={16} className="text-slate-500" />
            View all recent items
          </button>
        </div>,
        document.body,
      )}
    </div>
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
  const navigate = useNavigate()
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
        {show('recent') && <RecentNav collapsed={collapsed} />}
        {show('starred') && <NavItem to="/starred" icon={<Star size={ic} />} label="Starred" collapsed={collapsed} />}
        {show('apps') && <NavItem to="/apps" icon={<AppWindow size={ic} />} label="Apps" collapsed={collapsed} />}
        {show('plans') && <NavItem to="/plans" icon={<MapIcon size={ic} />} label="Plans" collapsed={collapsed} />}

        {show('spaces') && (
          <div className="pt-2">
            {section('Spaces', spacesOpen, () => setSpacesOpen((o) => !o), <LayoutGrid size={ic} />, loc.pathname.startsWith('/projects') || loc.pathname === '/spaces',
              <>
                <button
                  type="button"
                  title="Create space"
                  onClick={() => setCreateSpaceOpen(true)}
                  className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                >
                  <Plus size={14} />
                </button>
                <Dropdown
                  align="right"
                  trigger={() => (
                    <button type="button" title="More" className="mr-1 rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-800">
                      <MoreHorizontal size={14} />
                    </button>
                  )}
                >
                  {(close) => (
                    <>
                      <MenuItem onClick={() => { close(); navigate('/spaces') }}>View all spaces</MenuItem>
                      <MenuItem onClick={() => { close(); setCreateSpaceOpen(true) }}>Create space</MenuItem>
                    </>
                  )}
                </Dropdown>
              </>)}
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
