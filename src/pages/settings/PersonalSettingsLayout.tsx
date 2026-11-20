import { NavLink, Outlet } from 'react-router-dom'
import clsx from 'clsx'
import { ChevronLeft } from 'lucide-react'

const ITEMS = [
  { to: '/settings/general', label: 'General', end: true },
  { to: '/settings/notifications', label: 'Emails and notifications', end: false },
  { to: '/settings/digests', label: 'Digests', end: false },
]

export default function PersonalSettingsLayout() {
  return (
    <div className="flex min-h-full bg-white">
      <aside className="w-56 shrink-0 border-r border-slate-200 px-2 py-4">
        <NavLink to="/settings/general" className="mb-3 flex items-center gap-1 px-2 text-sm font-semibold text-slate-800 hover:text-brand-700">
          <ChevronLeft size={16} /> Personal settings
        </NavLink>
        <div className="px-3 py-1 text-xs font-medium text-slate-500">Jira</div>
        {ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              clsx('block rounded px-3 py-1.5 text-sm', isActive ? 'bg-brand-50 font-medium text-brand-700' : 'text-slate-700 hover:bg-slate-100')
            }
          >
            {item.label}
          </NavLink>
        ))}
      </aside>
      <div className="min-w-0 flex-1 overflow-auto px-8 py-8 lg:px-12">
        <Outlet />
      </div>
    </div>
  )
}
