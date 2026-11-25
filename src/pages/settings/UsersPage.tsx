import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { Check, ChevronDown, Clock, Info, Mail, MoreHorizontal, RefreshCw, Search, Shield } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useCurrentUser } from '../../store/hooks'
import { useUi } from '../../store/uiStore'
import { userAdminService } from '../../services/api'
import { API_ENDPOINTS } from '../../Network/apiEndpoints'
import { http } from '../../services/http'
import { ACCOUNT_TYPES, ADMIN_ACCESS_OPTIONS, EMAIL_RE } from '../../lib/adminUsers'
import { canGrantOrgAdmin } from '../../lib/permissions'
import type { AccountStatus, AccountType, AdminAccess, OrgApp, Role, User } from '../../types'
import { Avatar, Dropdown, EmptyState, MenuItem } from '../../components/ui'
import { fmtDate } from '../../lib/utils'

const ROLES: Role[] = ['Admin', 'Project Manager', 'Project Coordinator', 'Developer', 'QA']
const STATUSES: AccountStatus[] = ['active', 'invited', 'deactivated']

const DIRECTORY_NAV = [
  { label: 'Overview', section: 'top' },
  { label: 'Directory', section: 'heading' },
  { label: 'Users', section: 'item', active: true },
  { label: 'Groups', section: 'item' },
  { label: 'Teams', section: 'item' },
  { label: 'Managed accounts', section: 'item' },
  { label: 'Service accounts', section: 'item' },
  { label: 'Domains', section: 'item' },
  { label: 'Apps', section: 'heading' },
  { label: 'Connectors', section: 'item' },
  { label: 'AI and Rovo', section: 'item' },
  { label: 'Security', section: 'heading' },
  { label: 'Data management', section: 'item' },
  { label: 'Insights', section: 'item' },
  { label: 'Usage', section: 'item' },
  { label: 'Billing and subscriptions', section: 'item' },
]

function statusLabel(s: AccountStatus) {
  if (s === 'active') return 'Active'
  if (s === 'invited') return 'Not Invited'
  return 'Deactivated'
}

function lastSeenLabel(value: string | null) {
  if (!value) return 'Unavailable'
  const formatted = fmtDate(value, 'MMM d, yyyy')
  return formatted === '—' ? 'Unavailable' : formatted
}

function lastSeenLong(value: string | null) {
  if (!value) return 'Unavailable'
  const formatted = fmtDate(value, 'MMMM d, yyyy')
  return formatted === '—' ? 'Unavailable' : formatted
}

function lastSeenClock(value: string | null) {
  if (!value) return null
  try {
    return `${format(parseISO(value), 'h:mm a')} GMT+0`
  } catch {
    return null
  }
}

function isAdminAccount(user: User | undefined) {
  return !!user && user.role === 'Admin'
}

export default function UsersPage() {
  const me = useCurrentUser()
  const org = useStore((s) => s.organization)
  const orgApps = useStore((s) => s.orgApps)
  const groups = useStore((s) => s.groups)
  const localUsers = useStore((s) => s.users)
  const showToast = useUi((s) => s.showToast)

  const [users, setUsers] = useState<User[]>(localUsers)
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [accountType, setAccountType] = useState<AccountType | ''>('')
  const [role, setRole] = useState<Role | ''>('')
  const [appId, setAppId] = useState('')
  const [status, setStatus] = useState<AccountStatus | ''>('')
  const [managed, setManaged] = useState<'' | 'yes' | 'no'>('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [profileExtras, setProfileExtras] = useState<Record<string, { jobTitle: string; department: string; location: string }>>({})

  const loadUsers = async () => {
    setError(null)
    try {
      const rows = await userAdminService.list()
      const local = useStore.getState().users
      setUsers(rows.length ? rows : local)
    } catch {
      setUsers(useStore.getState().users)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isAdminAccount(me)) return
    void loadUsers()
    // Load once when an admin opens the directory.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id])

  const directoryUsers = useMemo(() => users.filter((u) => isAdminAccount(u)), [users])

  const totals = useMemo(() => ({
    total: directoryUsers.length,
    active: directoryUsers.filter((u) => u.accountStatus === 'active').length,
    managed: directoryUsers.filter((u) => u.managed).length,
    admins: directoryUsers.filter((u) => u.orgAdmin || u.adminAccess === 'org-admin' || u.role === 'Admin').length,
  }), [directoryUsers])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return directoryUsers.filter((u) => {
      if (query && !u.name.toLowerCase().includes(query) && !u.email.toLowerCase().includes(query)) return false
      if (accountType && u.accountType !== accountType) return false
      if (role && u.role !== role) return false
      if (appId && !(u.appAccess ?? []).some((a) => a.appId === appId)) return false
      if (status && u.accountStatus !== status) return false
      if (managed === 'yes' && !u.managed) return false
      if (managed === 'no' && u.managed) return false
      return true
    })
  }, [directoryUsers, q, accountType, role, appId, status, managed])

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key)
    setError(null)
    try {
      await fn()
      showToast(ok)
      await loadUsers()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(null)
    }
  }

  if (!isAdminAccount(me)) return <Navigate to="/for-you" replace />

  const orgLabel = org.name?.trim() || 'ordinet'
  const selectedUser = directoryUsers.find((u) => u.id === selectedId) ?? null

  return (
    <div className="flex min-h-full bg-white">
      <aside className="w-[220px] shrink-0 border-r border-[#DCDFE4] bg-[#F7F8F9] px-3 py-4">
        <div className="mb-3 flex items-center gap-2 px-2 text-[13px] font-semibold text-[#172B4D]">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-[#44546F] text-[11px] text-white">A</span>
          Administration
        </div>
        <button type="button" className="mb-3 flex w-full items-center justify-between rounded border border-[#DCDFE4] bg-white px-2 py-1.5 text-left text-[13px] text-[#172B4D]">
          {orgLabel.toLowerCase().split(/\s+/)[0]}
          <ChevronDown size={14} className="text-slate-500" />
        </button>
        {DIRECTORY_NAV.map((item) => {
          if (item.section === 'heading') {
            return <div key={item.label} className="mb-1 mt-3 px-2 text-[11px] font-semibold uppercase tracking-wide text-[#626F86]">{item.label}</div>
          }
          if (item.section === 'top') {
            return <div key={item.label} className="rounded px-2 py-1.5 text-[13px] text-[#44546F]">{item.label}</div>
          }
          return (
            <button
              type="button"
              key={item.label}
              className={`w-full rounded px-2 py-1.5 text-left text-[13px] ${item.active ? 'bg-white font-medium text-[#0C66E4] shadow-sm' : 'text-[#44546F]'}`}
              onClick={() => { if (item.label === 'Users') setSelectedId(null) }}
            >
              {item.label}
            </button>
          )
        })}
      </aside>

      <div className="min-w-0 flex-1 px-8 py-6">
        {selectedUser ? (
          <UserDetail
            user={selectedUser}
            orgLabel={orgLabel}
            orgApps={orgApps}
            groups={groups}
            meId={me?.id}
            canGrantAdmin={canGrantOrgAdmin(me)}
            onStatus={(statusValue) => run(`${selectedUser.id}-status`, () => userAdminService.setStatus(selectedUser.id, statusValue), `Updated ${selectedUser.email}`)}
            onAdmin={(access) => run(`${selectedUser.id}-admin`, () => userAdminService.setAdminAccess(selectedUser.id, access), `Administrator access updated for ${selectedUser.email}`)}
            extras={profileExtras[selectedUser.id]}
            onSaveDetails={async (patch) => {
              const id = Number(selectedUser.id)
              try {
                await http.patch(API_ENDPOINTS.UPDATE_user, {
                  id: Number.isFinite(id) ? id : selectedUser.id,
                  display_name: patch.name,
                  name: patch.name,
                  email: patch.email,
                  job_title: patch.jobTitle,
                  department: patch.department,
                  location: patch.location,
                })
              } catch {
                /* local profile still updates if the host is unreachable */
              }
              setUsers((prev) => prev.map((u) => (u.id === selectedUser.id ? { ...u, name: patch.name, email: patch.email } : u)))
              useStore.setState((s) => ({
                users: s.users.map((u) => (u.id === selectedUser.id ? { ...u, name: patch.name, email: patch.email } : u)),
              }))
              setProfileExtras((prev) => ({
                ...prev,
                [selectedUser.id]: { jobTitle: patch.jobTitle, department: patch.department, location: patch.location },
              }))
              showToast('Details updated')
            }}
          />
        ) : (
        <>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[24px] font-semibold text-[#172B4D]">Users</h1>
            <p className="mt-1 text-[13px] text-[#44546F]">
              Find people across all your directories and any accounts you manage.{' '}
              <span className="text-[#0C66E4]">About managed accounts and external users</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/settings/users/invite" className="rounded bg-[#0C66E4] px-3 py-1.5 text-[14px] font-medium text-white hover:bg-[#0055CC]">
              Invite users
            </Link>
            <button type="button" className="rounded border border-[#DCDFE4] bg-white px-3 py-1.5 text-[14px] text-[#172B4D]">
              Approve requests <span className="ml-1 text-[#626F86]">0</span>
            </button>
            <button type="button" className="rounded border border-[#DCDFE4] bg-white p-1.5 text-[#44546F]" aria-label="More">
              <MoreHorizontal size={16} />
            </button>
          </div>
        </div>

        {error && <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ['Total users', totals.total, true],
            ['Active users', totals.active, false],
            ['Managed accounts', totals.managed, true],
            ['Organization admins', totals.admins, false],
          ].map(([label, value, info]) => (
            <div key={String(label)} className="rounded-lg border border-[#DCDFE4] bg-white px-4 py-3">
              <div className="flex items-center gap-1 text-[12px] font-medium text-[#44546F]">
                {label}
                {info ? <Info size={12} className="text-[#626F86]" /> : null}
              </div>
              <div className="mt-2 text-[28px] font-semibold leading-none text-[#172B4D]">{loading ? '—' : value}</div>
            </div>
          ))}
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or email"
              className="input pl-8"
            />
          </div>
          <select className="input w-auto" value={accountType} onChange={(e) => setAccountType(e.target.value as AccountType | '')}>
            {ACCOUNT_TYPES.map((o) => <option key={o.label} value={o.value}>{o.value ? o.label : 'Account type'}</option>)}
          </select>
          <select className="input w-auto" value={role} onChange={(e) => setRole(e.target.value as Role | '')}>
            <option value="">Role</option>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select className="input w-auto" value={appId} onChange={(e) => setAppId(e.target.value)}>
            <option value="">Apps</option>
            {orgApps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <Dropdown
            trigger={(open) => (
              <button className={`btn-default ${open ? 'bg-slate-200' : ''}`}>
                More +
              </button>
            )}
          >
            {(close) => (
              <div className="w-56 p-2">
                <label className="label">Status</label>
                <select className="input mb-2" value={status} onChange={(e) => setStatus(e.target.value as AccountStatus | '')}>
                  <option value="">Any status</option>
                  {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                </select>
                <label className="label">Managed accounts</label>
                <select className="input" value={managed} onChange={(e) => setManaged(e.target.value as '' | 'yes' | 'no')}>
                  <option value="">Any</option>
                  <option value="yes">Managed</option>
                  <option value="no">Not managed</option>
                </select>
                <button className="btn-subtle mt-2 w-full justify-center" onClick={() => { setStatus(''); setManaged(''); close() }}>Clear extra filters</button>
              </div>
            )}
          </Dropdown>
        </div>

        <div className="mb-2 flex items-center gap-2 text-[13px] text-[#44546F]">
          Showing results
          <button type="button" className="rounded p-0.5 hover:bg-slate-100" onClick={() => void loadUsers()} aria-label="Refresh users">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-[#DCDFE4]">
          <table className="w-full min-w-[720px]">
            <thead className="border-b border-[#DCDFE4] bg-white">
              <tr>
                <th className="th text-left">User</th>
                <th className="th text-left">Status</th>
                <th className="th text-left">Last seen</th>
                <th className="th text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  groups={groups}
                  orgApps={orgApps}
                  meId={me?.id}
                  canGrantAdmin={canGrantOrgAdmin(me)}
                  busy={busy}
                  onOpen={() => setSelectedId(u.id)}
                  onStatus={(statusValue) => run(`${u.id}-status`, () => userAdminService.setStatus(u.id, statusValue), `Updated ${u.email}`)}
                  onAcceptInvite={() => run(`${u.id}-accept`, () => userAdminService.acceptInvite(u.id), `Accepted invite for ${u.email}`)}
                  onAdmin={(access) => run(`${u.id}-admin`, () => userAdminService.setAdminAccess(u.id, access), `Administrator access updated for ${u.email}`)}
                />
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && !loading && (
            <div className="p-6">
              <EmptyState title={directoryUsers.length === 0 ? 'No users in this organization' : 'No users match these filters'}>
                {directoryUsers.length === 0 ? 'Invite people to get started.' : 'Try a different search or clear filters.'}
              </EmptyState>
            </div>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  )
}

function UserRow({
  user, groups, orgApps, meId, canGrantAdmin, busy, onOpen, onStatus, onAcceptInvite, onAdmin,
}: {
  user: User
  groups: { id: string; name: string }[]
  orgApps: { id: string; name: string }[]
  meId?: string
  canGrantAdmin: boolean
  busy: string | null
  onOpen: () => void
  onStatus: (s: AccountStatus) => void
  onAcceptInvite: () => void
  onAdmin: (a: AdminAccess) => void
}) {
  const apps = user.appAccess.map((a) => orgApps.find((o) => o.id === a.appId)?.name ?? a.appId).join(', ')
  const groupNames = user.groupIds.map((id) => groups.find((g) => g.id === id)?.name ?? id).join(', ')
  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50">
      <td className="td">
        <button type="button" className="flex items-center gap-2 text-left" onClick={onOpen}>
          <Avatar user={user} size={32} />
          <div>
            <div className="font-medium text-[#0C66E4] hover:underline">{user.name}</div>
            <div className="text-xs text-[#44546F]">{user.email}</div>
            {(apps || groupNames) ? (
              <div className="text-xs text-slate-400">{user.role}{apps ? ` · ${apps}` : ''}{groupNames ? ` · ${groupNames}` : ''}</div>
            ) : null}
          </div>
        </button>
      </td>
      <td className="td">
        <span className={`rounded-full px-2 py-0.5 text-[12px] font-medium ${user.accountStatus === 'active' ? 'bg-[#DCFFF1] text-[#216E4E]' : user.accountStatus === 'invited' ? 'bg-[#F1F2F4] text-[#44546F]' : 'bg-slate-200 text-slate-600'}`}>
          {statusLabel(user.accountStatus)}
        </span>
      </td>
      <td className="td whitespace-nowrap text-[#44546F]">{lastSeenLabel(user.lastSeenAt)}</td>
      <td className="td">
        <div className="flex items-center justify-end gap-2">
        {user.accountStatus === 'invited' && (
          <button
            type="button"
            className="btn-primary"
            disabled={busy?.startsWith(user.id)}
            onClick={onAcceptInvite}
          >
            {busy === `${user.id}-accept` ? 'Accepting…' : 'Accept invite'}
          </button>
        )}
        <Dropdown
          align="right"
          trigger={() => (
            <button className="rounded p-1 text-[#44546F] hover:bg-slate-100" disabled={busy?.startsWith(user.id)} aria-label="Actions">
              <MoreHorizontal size={16} />
            </button>
          )}
        >
          {(close) => (
            <>
              {user.accountStatus !== 'active' && (
                <MenuItem onClick={() => { onStatus('active'); close() }}>Activate</MenuItem>
              )}
              {user.accountStatus === 'active' && user.id !== meId && (
                <MenuItem onClick={() => { onStatus('deactivated'); close() }}>Deactivate</MenuItem>
              )}
              {canGrantAdmin && user.adminAccess !== 'org-admin' && (
                <MenuItem onClick={() => { onAdmin('org-admin'); close() }}>Grant organization admin</MenuItem>
              )}
              {user.adminAccess === 'none' && (
                <MenuItem onClick={() => { onAdmin('user-access-admin'); close() }}>Grant user access admin</MenuItem>
              )}
              {user.adminAccess !== 'none' && user.id !== meId && (
                <MenuItem danger onClick={() => { onAdmin('none'); close() }}>Remove administrator access</MenuItem>
              )}
              {!canGrantAdmin && (
                <div className="px-3 py-1.5 text-xs text-slate-500">
                  {ADMIN_ACCESS_OPTIONS.find((o) => o.value === user.adminAccess)?.label}
                </div>
              )}
            </>
          )}
        </Dropdown>
        </div>
      </td>
    </tr>
  )
}

function JiraGlyph() {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded bg-[#1868DB]">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M11.5 4 6 12.5h5.2L12.8 20 18.5 11H13L11.5 4Z" fill="white" />
      </svg>
    </span>
  )
}

function appDisplay(app: OrgApp | undefined, appId: string, orgSlug: string) {
  const id = (app?.id ?? appId).toLowerCase()
  const name = (app?.name ?? appId).toLowerCase()
  if (id === 'taskflow' || name.includes('jira') || name.includes('taskflow')) {
    return { title: 'Jira', site: orgSlug, plan: app?.plan || 'Standard', icon: 'jira' as const }
  }
  if (id === 'assets' || name.includes('studio') || name.includes('asset')) {
    return { title: 'Studio', site: 'Studio', plan: app?.plan || 'Free', icon: 'studio' as const }
  }
  return { title: app?.name ?? appId, site: orgSlug, plan: app?.plan || 'Standard', icon: 'other' as const }
}

function UserDetail({
  user, orgLabel, orgApps, groups, meId, canGrantAdmin, onStatus, onAdmin, extras, onSaveDetails,
}: {
  user: User
  orgLabel: string
  orgApps: OrgApp[]
  groups: { id: string; name: string }[]
  meId?: string
  canGrantAdmin: boolean
  onStatus: (s: AccountStatus) => void
  onAdmin: (a: AdminAccess) => void
  extras?: { jobTitle: string; department: string; location: string }
  onSaveDetails: (patch: { name: string; email: string; jobTitle: string; department: string; location: string }) => Promise<void>
}) {
  const [tab, setTab] = useState<'apps' | 'groups' | 'admin' | 'orgs' | 'security'>('apps')
  const [appQ, setAppQ] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const orgSlug = orgLabel.toLowerCase().split(/\s+/)[0] || 'ordinet'
  const clock = lastSeenClock(user.lastSeenAt)
  const access = user.appAccess.length ? user.appAccess : [{ appId: orgApps[0]?.id ?? 'taskflow', role: user.role === 'Admin' ? 'Administrator' : 'User' }]
  const appRows = access
    .map((a) => {
      const app = orgApps.find((o) => o.id === a.appId)
      return { access: a, app, display: appDisplay(app, a.appId, orgSlug) }
    })
    .filter((row) => {
      const q = appQ.trim().toLowerCase()
      if (!q) return true
      return row.display.title.toLowerCase().includes(q) || row.display.site.toLowerCase().includes(q)
    })
  const tabs: { id: typeof tab; label: string }[] = [
    { id: 'apps', label: 'Apps' },
    { id: 'groups', label: 'Groups' },
    { id: 'admin', label: 'Site admin' },
    { id: 'orgs', label: 'Other organizations' },
    { id: 'security', label: 'Security' },
  ]

  return (
    <div>
      <div className="text-[13px] text-[#44546F]">Users</div>
      <div className="mt-1 mb-5 flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-[24px] font-semibold text-[#172B4D]">{user.name}</h1>
        <div className="flex items-center gap-2">
          <Dropdown
            trigger={() => (
              <button type="button" className="rounded bg-[#0C66E4] px-3 py-1.5 text-[14px] font-medium text-white hover:bg-[#0055CC]">
                Grant access
              </button>
            )}
          >
            {(close) => (
              <>
                {user.accountStatus !== 'active' && (
                  <MenuItem onClick={() => { onStatus('active'); close() }}>Activate</MenuItem>
                )}
                {canGrantAdmin && user.adminAccess !== 'org-admin' && (
                  <MenuItem onClick={() => { onAdmin('org-admin'); close() }}>Grant organization admin</MenuItem>
                )}
                {user.adminAccess === 'none' && (
                  <MenuItem onClick={() => { onAdmin('user-access-admin'); close() }}>Grant user access admin</MenuItem>
                )}
              </>
            )}
          </Dropdown>
          <Dropdown
            trigger={() => (
              <button type="button" className="rounded border border-[#DCDFE4] bg-white px-3 py-1.5 text-[14px] text-[#172B4D]">
                Add to group
              </button>
            )}
          >
            {() => (
              <div className="max-h-56 overflow-auto py-1">
                {groups.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-slate-500">No groups</div>
                ) : groups.map((g) => (
                  <div key={g.id} className="px-3 py-1.5 text-sm text-[#172B4D]">{g.name}</div>
                ))}
              </div>
            )}
          </Dropdown>
          <Dropdown
            align="right"
            trigger={() => (
              <button type="button" className="rounded border border-[#DCDFE4] bg-white p-1.5 text-[#44546F]" aria-label="More">
                <MoreHorizontal size={16} />
              </button>
            )}
          >
            {(close) => (
              <>
                {user.accountStatus === 'active' && user.id !== meId && (
                  <MenuItem onClick={() => { onStatus('deactivated'); close() }}>Deactivate</MenuItem>
                )}
                {user.adminAccess !== 'none' && user.id !== meId && (
                  <MenuItem danger onClick={() => { onAdmin('none'); close() }}>Remove administrator access</MenuItem>
                )}
              </>
            )}
          </Dropdown>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="rounded-lg border border-[#DCDFE4] bg-white px-6 py-8 text-center">
          <div className="flex justify-center">
            <span
              className="inline-flex h-[120px] w-[120px] items-center justify-center rounded-full text-[36px] font-semibold text-white"
              style={{ background: user.color || '#1D2B3A' }}
            >
              {user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || 'U'}
            </span>
          </div>
          {user.managed && (
            <div className="mt-4 inline-flex items-center gap-1 rounded-full border border-[#DCDFE4] px-2 py-0.5 text-[12px] text-[#44546F]">
              <Shield size={12} /> Managed account
            </div>
          )}
          <div className="mt-5 space-y-2 text-left text-[13px] text-[#44546F]">
            <div className="flex items-center gap-2">
              <Mail size={14} /> {user.email}
            </div>
            {clock && (
              <div className="flex items-center gap-2">
                <Clock size={14} /> {clock}
              </div>
            )}
          </div>
          <button type="button" className="mt-4 text-[14px] font-medium text-[#0C66E4]" onClick={() => setEditOpen(true)}>Edit details</button>
        </div>

        <div>
          <div className="mb-4 flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[13px] font-medium ${user.accountStatus === 'active' ? 'bg-[#DCFFF1] text-[#216E4E]' : 'bg-[#F1F2F4] text-[#44546F]'}`}>
              <Check size={14} /> {statusLabel(user.accountStatus)}
            </span>
          </div>
          <div className="mb-3 text-[13px] text-[#44546F]">
            Last seen {lastSeenLong(user.lastSeenAt)} <Info size={12} className="mb-0.5 inline text-[#626F86]" />
          </div>

          <div className="mb-4 flex flex-wrap gap-4 border-b border-[#DCDFE4] text-[14px]">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`-mb-px border-b-2 pb-2 ${tab === t.id ? 'border-[#0C66E4] font-medium text-[#0C66E4]' : 'border-transparent text-[#44546F]'}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'apps' && (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="relative min-w-[220px] flex-1">
                  <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={appQ} onChange={(e) => setAppQ(e.target.value)} placeholder="Search by app name" className="input pl-8" />
                </div>
                <button type="button" className="rounded border border-[#DCDFE4] bg-white px-3 py-1.5 text-[14px] text-[#172B4D]">
                  App <ChevronDown size={14} className="ml-1 inline" />
                </button>
              </div>
              <div className="mb-2 flex items-center gap-2 text-[13px] text-[#44546F]">
                Showing results <RefreshCw size={14} />
              </div>
              <div className="overflow-x-auto rounded-lg border border-[#DCDFE4]">
                <table className="w-full min-w-[560px]">
                  <thead className="border-b border-[#DCDFE4] bg-[#F7F8F9] text-left text-[12px] font-semibold text-[#44546F]">
                    <tr>
                      <th className="px-3 py-2">App</th>
                      <th className="px-3 py-2">Last seen <Info size={12} className="mb-0.5 inline" /></th>
                      <th className="px-3 py-2">Plan</th>
                      <th className="px-3 py-2">Roles</th>
                      <th className="px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appRows.map((row) => (
                      <tr key={row.access.appId} className="border-b border-[#F1F2F4]">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            {row.display.icon === 'jira' ? <JiraGlyph /> : (
                              <span className="flex h-8 w-8 items-center justify-center rounded bg-[#F1F2F4] text-[11px] font-semibold text-[#44546F]">
                                {row.display.title.slice(0, 2).toUpperCase()}
                              </span>
                            )}
                            <div>
                              <div className="text-[14px] font-medium text-[#172B4D]">{row.display.title}</div>
                              <div className="text-[12px] text-[#626F86]">{row.display.site}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-[13px] text-[#44546F]">
                          {user.lastSeenAt ? lastSeenLabel(user.lastSeenAt) : 'Unavailable'}
                          {!user.lastSeenAt && <Info size={12} className="ml-1 inline text-[#626F86]" />}
                        </td>
                        <td className="px-3 py-3 text-[13px] text-[#172B4D]">{row.display.plan}</td>
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center gap-1 rounded border border-[#DCDFE4] px-2 py-1 text-[13px] text-[#172B4D]">
                            {row.access.role} <span className="text-[#626F86]">×</span>
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <button type="button" className="rounded p-1 text-[#44546F]" aria-label="App actions">
                            <MoreHorizontal size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {tab === 'groups' && (
            <ul className="rounded-lg border border-[#DCDFE4] divide-y divide-[#F1F2F4]">
              {user.groupIds.length === 0 && <li className="px-3 py-3 text-sm text-slate-500">No groups</li>}
              {user.groupIds.map((id) => (
                <li key={id} className="px-3 py-3 text-sm text-[#172B4D]">{groups.find((g) => g.id === id)?.name ?? id}</li>
              ))}
            </ul>
          )}
          {tab === 'admin' && (
            <p className="text-sm text-[#44546F]">{ADMIN_ACCESS_OPTIONS.find((o) => o.value === user.adminAccess)?.label ?? 'None'}</p>
          )}
          {tab === 'orgs' && <p className="text-sm text-[#44546F]">No other organizations</p>}
          {tab === 'security' && (
            <p className="text-sm text-[#44546F]">Account status: {statusLabel(user.accountStatus)}</p>
          )}
        </div>
      </div>
      {editOpen && (
        <EditDetailsDialog
          user={user}
          extras={extras}
          onClose={() => setEditOpen(false)}
          onSave={onSaveDetails}
        />
      )}
    </div>
  )
}

function FieldLabel({ children, required }: { children: string; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-[13px] font-medium text-[#172B4D]">
      {children}{required ? <span className="text-[#C9372C]"> *</span> : null}
    </label>
  )
}

function EditDetailsDialog({
  user, extras, onClose, onSave,
}: {
  user: User
  extras?: { jobTitle: string; department: string; location: string }
  onClose: () => void
  onSave: (patch: { name: string; email: string; jobTitle: string; department: string; location: string }) => Promise<void>
}) {
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [jobTitle, setJobTitle] = useState(extras?.jobTitle ?? '')
  const [department, setDepartment] = useState(extras?.department ?? '')
  const [location, setLocation] = useState(extras?.location ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    const fullName = name.trim()
    const mail = email.trim()
    if (!fullName) {
      setError('Full name is required.')
      return
    }
    if (!mail || !EMAIL_RE.test(mail)) {
      setError('Enter a valid email address.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onSave({ name: fullName, email: mail, jobTitle: jobTitle.trim(), department: department.trim(), location: location.trim() })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save details.')
    } finally {
      setBusy(false)
    }
  }

  const inputClass = 'h-10 w-full rounded-[3px] border border-[#8590A2] px-3 text-[14px] text-[#172B4D] outline-none focus:border-[#0C66E4] focus:ring-1 focus:ring-[#0C66E4]'

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#091E42]/40 p-4" onMouseDown={onClose}>
      <div
        className="w-full max-w-[560px] rounded-lg bg-white p-6 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="text-[20px] font-semibold text-[#172B4D]">Edit details</h2>
        <p className="mt-1 text-[13px] text-[#44546F]">
          Required fields are marked with an asterisk <span className="text-[#C9372C]">*</span>
        </p>
        {error && <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="mt-5 space-y-4">
          <div>
            <FieldLabel required>Full name</FieldLabel>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <FieldLabel required>Email address</FieldLabel>
            <input className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <FieldLabel>Job title</FieldLabel>
            <input className={inputClass} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
          </div>
          <div>
            <FieldLabel>Department</FieldLabel>
            <input className={inputClass} value={department} onChange={(e) => setDepartment(e.target.value)} />
          </div>
          <div>
            <FieldLabel>Location</FieldLabel>
            <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button type="button" className="text-[14px] font-medium text-[#44546F] hover:underline" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="rounded bg-[#0C66E4] px-4 py-1.5 text-[14px] font-medium text-white hover:bg-[#0055CC] disabled:opacity-60"
            onClick={() => void save()}
            disabled={busy}
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
