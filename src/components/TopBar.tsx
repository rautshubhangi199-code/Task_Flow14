import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, LogOut, PanelLeft, Plus, RotateCcw, Search, Settings, User, UserCog, X } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useCurrentUser } from '../store/hooks'
import { useUi } from '../store/uiStore'
import { authService } from '../services/api'
import { NotificationsBell } from './NotificationsBell'
import { Avatar, Dropdown, MenuItem } from './ui'

export function TopBar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const user = useCurrentUser()
  const users = useStore((s) => s.users)
  const org = useStore((s) => s.organization)
  const openCreateItem = useUi((s) => s.openCreateItem)
  const navigate = useNavigate()
  const [q, setQ] = useState('')

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3">
      <button className="rounded p-1.5 text-slate-600 hover:bg-slate-100" onClick={onToggleSidebar} title="Expand / collapse sidebar">
        <PanelLeft size={18} />
      </button>
      <button onClick={() => navigate('/for-you')} className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded bg-brand-600 text-sm font-bold text-white">TF</span>
        <span className="text-base font-semibold text-slate-800">TaskFlow</span>
        <span className="hidden text-xs text-slate-500 lg:inline">· {org.name}</span>
      </button>
      <form
        className="mx-auto flex w-full max-w-xl items-center"
        onSubmit={(e) => {
          e.preventDefault()
          const text = q.trim()
          navigate(text ? `/filters/search?jql=${encodeURIComponent(`text ~ "${text.replace(/"/g, '')}"`)}` : '/filters/search')
        }}
      >
        <div className="relative w-full">
          <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search work items (press Enter)" className="input pl-8" />
        </div>
      </form>
      <button className="btn-primary" onClick={() => openCreateItem()}>
        <Plus size={16} /> Create
      </button>
      <Dropdown
        align="right"
        menuClassName="!min-w-[420px] rounded-lg border-slate-200 !p-0 !py-0 shadow-xl"
        trigger={(open) => (
          <button
            className={`rounded-md p-1.5 text-slate-600 hover:bg-slate-100 ${open ? 'bg-white text-brand-600 ring-2 ring-brand-600' : ''}`}
            title="Settings"
            aria-label="Settings"
          >
            <Settings size={20} />
          </button>
        )}
      >
        {(close) => (
          <div className="w-[420px] p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="text-[15px] font-semibold text-slate-800">Personal Jira settings</div>
              <button className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={(e) => { e.stopPropagation(); close() }} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <button
              className="flex w-full items-start gap-3 rounded-md px-2 py-2.5 text-left hover:bg-slate-50"
              onClick={() => { navigate('/settings/general'); close() }}
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center text-slate-500">
                <User size={22} strokeWidth={1.75} />
              </span>
              <span>
                <span className="block text-[15px] font-medium text-slate-800">General settings</span>
                <span className="mt-0.5 block text-sm text-slate-500">Manage language, time zone, and other personal preferences</span>
              </span>
            </button>
            <button
              className="flex w-full items-start gap-3 rounded-md px-2 py-2.5 text-left hover:bg-slate-50"
              onClick={() => { navigate('/settings/notifications'); close() }}
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center text-slate-500">
                <Bell size={22} strokeWidth={1.75} />
              </span>
              <span>
                <span className="block text-[15px] font-medium text-slate-800">Notification settings</span>
                <span className="mt-0.5 block text-sm text-slate-500">Manage email and in-app notifications from Jira</span>
              </span>
            </button>
          </div>
        )}
      </Dropdown>
      <NotificationsBell />
      <Dropdown
        align="right"
        trigger={() => (
          <button className="flex items-center gap-2 rounded-full p-0.5 hover:bg-slate-100" title="Account">
            <Avatar user={user} size={30} />
          </button>
        )}
      >
        {(close) => (
          <div className="w-64">
            <div className="border-b border-slate-200 px-3 py-2">
              <div className="font-semibold">{user?.name}</div>
              <div className="text-xs text-slate-500">{user?.email} · {user?.role}</div>
            </div>
            <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase text-slate-500"><UserCog size={12} className="mr-1 inline" />Switch user (demo)</div>
            {users.map((u) => (
              <MenuItem key={u.id} active={u.id === user?.id} onClick={() => { authService.login(u.id); close() }}>
                <Avatar user={u} size={20} />
                <span className="flex-1">{u.name}</span>
                <span className="text-xs text-slate-500">{u.role}</span>
              </MenuItem>
            ))}
            <div className="my-1 border-t border-slate-200" />
            <MenuItem onClick={() => { if (confirm('Reset all demo data to the original seed?')) authService.resetDemo(); close() }}>
              <RotateCcw size={14} /> Reset demo data
            </MenuItem>
            <MenuItem onClick={() => { authService.logout(); close(); navigate('/login') }}>
              <LogOut size={14} /> Log out
            </MenuItem>
          </div>
        )}
      </Dropdown>
    </header>
  )
}
