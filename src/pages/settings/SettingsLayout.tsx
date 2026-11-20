import { NavLink, Navigate, Outlet } from 'react-router-dom'
import clsx from 'clsx'
import { useCurrentUser } from '../../store/hooks'
import { canAccessSettings } from '../../lib/permissions'

const JIRA_ADMIN = [
  { to: '/settings/system', label: 'System' },
  { to: '/settings/jira-apps', label: 'Jira apps' },
  { to: '/settings/spaces', label: 'Spaces' },
  { to: '/settings/work-items', label: 'Work items' },
  { to: '/settings/marketplace', label: 'Marketplace apps' },
]

const ATLASSIAN_ADMIN = [{ to: '/settings/users', label: 'User management' }]

export default function SettingsLayout() {
  const user = useCurrentUser()
  if (!canAccessSettings(user)) {
    return <Navigate to="/for-you" replace />
  }
  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <aside className="w-full shrink-0 border-b border-slate-200 bg-slate-50 md:w-56 md:border-b-0 md:border-r">
        <div className="px-4 py-4 text-sm font-semibold text-slate-800">Settings</div>
        <div className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Jira admin</div>
        {JIRA_ADMIN.map((l) => (
          <NavLink key={l.to} to={l.to} className={({ isActive }) => clsx('block px-4 py-1.5 text-sm', isActive ? 'bg-brand-50 font-medium text-brand-700' : 'text-slate-700 hover:bg-slate-100')}>
            {l.label}
          </NavLink>
        ))}
        <div className="mt-3 px-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Atlassian admin</div>
        {ATLASSIAN_ADMIN.map((l) => (
          <NavLink key={l.to} to={l.to} className={({ isActive }) => clsx('block px-4 py-1.5 text-sm', isActive ? 'bg-brand-50 font-medium text-brand-700' : 'text-slate-700 hover:bg-slate-100')}>
            {l.label}
          </NavLink>
        ))}
      </aside>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  )
}
