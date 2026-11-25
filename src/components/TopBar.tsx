import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, ChevronRight, Contrast, CreditCard, ExternalLink, FileText, FolderKanban, LayoutGrid, LogOut, Maximize2, Monitor, PanelLeft, Plus, Puzzle, Search, Settings, User, Users, X } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useCurrentUser } from '../store/hooks'
import { useUi } from '../store/uiStore'
import { authService } from '../services/api'
import { canAccessSettings, canGrantOrgAdmin } from '../lib/permissions'
import { NotificationsBell } from './NotificationsBell'
import { Avatar, Dropdown, MenuItem, Modal } from './ui'
import type { User as UserType } from '../types'

type ThemeChoice = 'light' | 'dark' | 'match'
const THEME_KEY = 'taskflow_theme'

function readTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY)
    if (v === 'light' || v === 'dark' || v === 'match') return v
  } catch { /* ignore */ }
  return 'light'
}

function applyTheme(choice: ThemeChoice) {
  try {
    localStorage.setItem(THEME_KEY, choice)
  } catch { /* ignore */ }
  const dark =
    choice === 'dark' ||
    (choice === 'match' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

function ThemePreview({ kind }: { kind: ThemeChoice }) {
  if (kind === 'dark') {
    return (
      <svg width="44" height="32" viewBox="0 0 44 32" aria-hidden>
        <rect x="0.5" y="0.5" width="43" height="31" rx="4" fill="#1D2125" stroke="#3B444C" />
        <rect x="4" y="4" width="36" height="5" rx="1" fill="#2C333A" />
        <rect x="6" y="12" width="20" height="3" rx="1" fill="#44546F" />
        <rect x="6" y="18" width="28" height="3" rx="1" fill="#44546F" />
        <rect x="6" y="24" width="16" height="3" rx="1" fill="#44546F" />
      </svg>
    )
  }
  if (kind === 'match') {
    return (
      <svg width="44" height="32" viewBox="0 0 44 32" aria-hidden>
        <defs>
          <clipPath id="theme-match-left"><rect x="0" y="0" width="22" height="32" /></clipPath>
        </defs>
        <rect x="0.5" y="0.5" width="43" height="31" rx="4" fill="#fff" stroke="#DFE1E6" />
        <rect x="4" y="4" width="36" height="5" rx="1" fill="#F4F5F7" />
        <rect x="6" y="12" width="20" height="3" rx="1" fill="#DFE1E6" />
        <rect x="6" y="18" width="28" height="3" rx="1" fill="#DFE1E6" />
        <g clipPath="url(#theme-match-left)">
          <rect x="0.5" y="0.5" width="43" height="31" rx="4" fill="#1D2125" />
          <rect x="4" y="4" width="36" height="5" rx="1" fill="#2C333A" />
          <rect x="6" y="12" width="20" height="3" rx="1" fill="#44546F" />
          <rect x="6" y="18" width="28" height="3" rx="1" fill="#44546F" />
        </g>
        <rect x="0.5" y="0.5" width="43" height="31" rx="4" fill="none" stroke="#DFE1E6" />
      </svg>
    )
  }
  return (
    <svg width="44" height="32" viewBox="0 0 44 32" aria-hidden>
      <rect x="0.5" y="0.5" width="43" height="31" rx="4" fill="#fff" stroke="#DFE1E6" />
      <rect x="4" y="4" width="36" height="5" rx="1" fill="#F4F5F7" />
      <rect x="6" y="12" width="20" height="3" rx="1" fill="#DFE1E6" />
      <rect x="6" y="18" width="28" height="3" rx="1" fill="#DFE1E6" />
      <rect x="6" y="24" width="16" height="3" rx="1" fill="#DFE1E6" />
    </svg>
  )
}

export function TopBar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const user = useCurrentUser()
  const org = useStore((s) => s.organization)
  const openCreateItem = useUi((s) => s.openCreateItem)
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [theme, setTheme] = useState<ThemeChoice>(readTheme)
  const [themeOpen, setThemeOpen] = useState(false)
  const [accountPanel, setAccountPanel] = useState<'profile' | 'quickstart' | null>(null)

  useEffect(() => {
    applyTheme(theme)
    if (theme !== 'match') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('match')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  return (
    <>
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
      {canAccessSettings(user) && (
      <button className="btn-primary" onClick={() => openCreateItem()}>
        <Plus size={16} /> Create
      </button>
      )}
      <Dropdown
        align="right"
        menuClassName="!min-w-[400px] rounded-lg border-slate-200 !p-0 !py-0 shadow-xl"
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
        {(close) => canAccessSettings(user) ? (
          <div className="max-h-[min(80vh,640px)] w-[400px] overflow-y-auto py-2">
            <div className="px-4 pb-1.5 pt-1.5 text-[13px] font-semibold text-[#172B4D]">Jira admin settings</div>
            <AdminSettingRow
              icon={<Monitor size={22} strokeWidth={1.75} />}
              title="System"
              description="Manage general configuration, security, automation, user interface, and more"
              onClick={() => { navigate('/settings/system'); close() }}
            />
            <AdminSettingRow
              icon={<LayoutGrid size={22} strokeWidth={1.75} />}
              title="Jira apps"
              description="Manage access, settings, and integrations across Jira"
              onClick={() => { navigate('/settings/jira-apps'); close() }}
            />
            <AdminSettingRow
              icon={<FolderKanban size={22} strokeWidth={1.75} />}
              title="Spaces"
              description="Manage space settings, categories, and more"
              onClick={() => { navigate('/settings/spaces'); close() }}
            />
            <AdminSettingRow
              icon={<FileText size={22} strokeWidth={1.75} />}
              title="Work items"
              description="Configure work types, workflows, screens, fields, and more"
              onClick={() => { navigate('/settings/work-items'); close() }}
            />
            <AdminSettingRow
              icon={<Puzzle size={22} strokeWidth={1.75} />}
              title="Marketplace apps"
              description="Add and manage Jira Marketplace apps and integrations"
              onClick={() => { navigate('/settings/marketplace'); close() }}
            />
            <div className="mt-1 px-4 pb-1.5 pt-3 text-[13px] font-semibold text-[#172B4D]">Atlassian admin settings</div>
            {canGrantOrgAdmin(user) && (
            <AdminSettingRow
              icon={<User size={22} strokeWidth={1.75} />}
              title="User management"
              description="Manage users, groups, and access requests"
              external
              onClick={() => { navigate('/settings/users'); close() }}
            />
            )}
            <AdminSettingRow
              icon={<CreditCard size={22} strokeWidth={1.75} />}
              title="Billing"
              description="Update your billing details, manage subscriptions, and more"
              external
              onClick={() => { navigate('/settings/system'); close() }}
            />
          </div>
        ) : (
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
          <div className="w-[280px] py-1">
            <div className="bg-[#F7F8F9] px-4 py-3">
              <div className="flex items-center gap-3">
                <Avatar user={user} size={40} />
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-semibold text-[#172B4D]">{user?.name}</div>
                  <div className="truncate text-[13px] text-[#44546F]">{user?.email}</div>
                </div>
              </div>
            </div>
            <div className="py-1">
              <MenuItem onClick={() => { close(); setAccountPanel('profile') }}>
                <User size={18} className="text-[#44546F]" /> Profile
              </MenuItem>
              <MenuItem onClick={() => { close(); navigate('/settings/general') }}>
                <Settings size={18} className="text-[#44546F]" /> Account settings
              </MenuItem>
              <div className="relative">
                <button
                  type="button"
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${themeOpen ? 'bg-[#E9F2FF] text-[#0C66E4]' : 'hover:bg-slate-100'}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setThemeOpen((o) => !o)
                  }}
                >
                  <Contrast size={18} className={themeOpen ? 'text-[#0C66E4]' : 'text-[#44546F]'} />
                  <span className="flex-1">Theme</span>
                  <ChevronRight size={16} className={themeOpen ? 'text-[#0C66E4]' : 'text-[#626F86]'} />
                </button>
                {themeOpen && (
                  <div className="absolute right-full top-0 z-50 mr-1 w-[220px] rounded-lg border border-slate-200 bg-white py-2 shadow-[0_8px_16px_rgba(9,30,66,0.16)]">
                    {([
                      ['light', 'Light'],
                      ['dark', 'Dark'],
                      ['match', 'Match browser'],
                    ] as const).map(([id, label]) => {
                      const selected = theme === id
                      return (
                      <button
                        key={id}
                        type="button"
                        className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm ${selected ? 'bg-[#E9F2FF]' : 'hover:bg-slate-50'}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setTheme(id)
                          applyTheme(id)
                        }}
                      >
                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${selected ? 'border-[#0C66E4]' : 'border-slate-400'}`}>
                          {selected ? <span className="h-2 w-2 rounded-full bg-[#0C66E4]" /> : null}
                        </span>
                        <ThemePreview kind={id} />
                        <span className="font-medium text-[#172B4D]">{label}</span>
                      </button>
                      )
                    })}
                  </div>
                )}
              </div>
              <MenuItem onClick={() => { close(); setAccountPanel('quickstart') }}>
                <Maximize2 size={18} className="text-[#44546F]" /> Open Quickstart
              </MenuItem>
            </div>
            <div className="my-1 border-t border-slate-200" />
            <div className="py-1">
              <MenuItem onClick={() => { close(); authService.logout(); navigate('/login') }}>
                <Users size={18} className="text-[#44546F]" /> Switch account
              </MenuItem>
              <MenuItem onClick={() => { authService.logout(); close(); navigate('/login') }}>
                <LogOut size={18} className="text-[#44546F]" /> Log out
              </MenuItem>
            </div>
          </div>
        )}
      </Dropdown>
    </header>
    <ProfilePanel user={user} open={accountPanel === 'profile'} onClose={() => setAccountPanel(null)} />
    <QuickstartPanel
      open={accountPanel === 'quickstart'}
      onClose={() => setAccountPanel(null)}
      onGo={(path) => {
        setAccountPanel(null)
        navigate(path)
      }}
    />
    </>
  )
}

function ProfilePanel({ user, open, onClose }: { user: UserType | undefined; open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Profile" width={480}>
      <div className="flex items-center gap-4">
        <Avatar user={user} size={64} />
        <div className="min-w-0">
          <div className="text-lg font-semibold text-[#172B4D]">{user?.name}</div>
          <div className="text-sm text-[#44546F]">{user?.email}</div>
          {user?.role ? <div className="mt-1 text-xs text-slate-500">{user.role}</div> : null}
        </div>
      </div>
    </Modal>
  )
}

function QuickstartPanel({
  open,
  onClose,
  onGo,
}: {
  open: boolean
  onClose: () => void
  onGo: (path: string) => void
}) {
  return (
    <Modal open={open} onClose={onClose} title="Quickstart" width={520}>
      <p className="mb-4 text-sm text-[#44546F]">Get started with TaskFlow using these steps.</p>
      <div className="space-y-2">
        <button type="button" className="flex w-full items-center justify-between rounded border border-slate-200 px-3 py-2.5 text-left text-sm hover:bg-slate-50" onClick={() => onGo('/for-you')}>
          Your work
          <span className="text-xs text-[#0C66E4]">Open For you</span>
        </button>
        <button type="button" className="flex w-full items-center justify-between rounded border border-slate-200 px-3 py-2.5 text-left text-sm hover:bg-slate-50" onClick={() => onGo('/spaces')}>
          Browse spaces
          <span className="text-xs text-[#0C66E4]">Open Spaces</span>
        </button>
      </div>
    </Modal>
  )
}

function AdminSettingRow({
  icon,
  title,
  description,
  onClick,
  external,
}: {
  icon: ReactNode
  title: string
  description: string
  onClick: () => void
  external?: boolean
}) {
  return (
    <button
      type="button"
      className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
      onClick={onClick}
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center text-[#44546F]">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="text-[14px] font-medium text-[#172B4D]">{title}</span>
          {external && <ExternalLink size={12} className="text-[#626F86]" />}
        </span>
        <span className="mt-0.5 block text-[13px] leading-snug text-[#44546F]">{description}</span>
      </span>
    </button>
  )
}
