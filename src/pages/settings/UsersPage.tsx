import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Search, UserPlus } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useCurrentUser } from '../../store/hooks'
import { useUi } from '../../store/uiStore'
import { userAdminService } from '../../services/api'
import { ACCOUNT_TYPES, ADMIN_ACCESS_OPTIONS } from '../../lib/adminUsers'
import { canGrantOrgAdmin } from '../../lib/permissions'
import type { AccountStatus, AccountType, AdminAccess, Role, User } from '../../types'
import { Avatar, Dropdown, EmptyState, MenuItem } from '../../components/ui'
import { timeAgo } from '../../lib/utils'

const PAGE_SIZES = [10, 25, 50]
const ROLES: Role[] = ['Admin', 'Project Manager', 'Project Coordinator', 'Developer', 'QA']
const STATUSES: AccountStatus[] = ['active', 'invited', 'deactivated']

function statusLabel(s: AccountStatus) {
  if (s === 'active') return 'Active'
  if (s === 'invited') return 'Invited'
  return 'Deactivated'
}

export default function UsersPage() {
  const me = useCurrentUser()
  const users = useStore((s) => s.users)
  const orgApps = useStore((s) => s.orgApps)
  const groups = useStore((s) => s.groups)
  const auditLogs = useStore((s) => s.auditLogs)
  const showToast = useUi((s) => s.showToast)

  const [q, setQ] = useState('')
  const [accountType, setAccountType] = useState<AccountType | ''>('')
  const [role, setRole] = useState<Role | ''>('')
  const [appId, setAppId] = useState('')
  const [status, setStatus] = useState<AccountStatus | ''>('')
  const [managed, setManaged] = useState<'' | 'yes' | 'no'>('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const totals = useMemo(() => ({
    total: users.length,
    active: users.filter((u) => u.accountStatus === 'active').length,
    managed: users.filter((u) => u.managed).length,
    admins: users.filter((u) => u.orgAdmin || u.adminAccess === 'org-admin' || u.role === 'Admin').length,
  }), [users])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return users.filter((u) => {
      if (query && !u.name.toLowerCase().includes(query) && !u.email.toLowerCase().includes(query)) return false
      if (accountType && u.accountType !== accountType) return false
      if (role && u.role !== role) return false
      if (appId && !(u.appAccess ?? []).some((a) => a.appId === appId)) return false
      if (status && u.accountStatus !== status) return false
      if (managed === 'yes' && !u.managed) return false
      if (managed === 'no' && u.managed) return false
      return true
    })
  }, [users, q, accountType, role, appId, status, managed])

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const current = Math.min(page, pages - 1)
  const pageItems = filtered.slice(current * pageSize, current * pageSize + pageSize)

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key)
    setError(null)
    try {
      await fn()
      showToast(ok)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-sm text-slate-500">Directory for this organization. Counts come from current accounts.</p>
        </div>
        <Link to="/settings/users/invite" className="btn-primary">
          <UserPlus size={16} /> Invite users
        </Link>
      </div>

      {error && <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Total users', totals.total],
          ['Active users', totals.active],
          ['Managed accounts', totals.managed],
          ['Organization admins', totals.admins],
        ].map(([label, value]) => (
          <div key={String(label)} className="card px-4 py-3">
            <div className="text-2xl font-semibold text-slate-800">{value}</div>
            <div className="text-xs font-medium text-slate-500">{label}</div>
          </div>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(0) }}
            placeholder="Search by name or email"
            className="input pl-8"
          />
        </div>
        <select className="input w-auto" value={accountType} onChange={(e) => { setAccountType(e.target.value as AccountType | ''); setPage(0) }}>
          {ACCOUNT_TYPES.map((o) => <option key={o.label} value={o.value}>{o.label}</option>)}
        </select>
        <select className="input w-auto" value={role} onChange={(e) => { setRole(e.target.value as Role | ''); setPage(0) }}>
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="input w-auto" value={appId} onChange={(e) => { setAppId(e.target.value); setPage(0) }}>
          <option value="">All apps</option>
          {orgApps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <Dropdown
          trigger={(open) => (
            <button className={`btn-default ${open ? 'bg-slate-200' : ''}`}>
              More filters <ChevronDown size={14} />
            </button>
          )}
        >
          {(close) => (
            <div className="w-56 p-2">
              <label className="label">Status</label>
              <select className="input mb-2" value={status} onChange={(e) => { setStatus(e.target.value as AccountStatus | ''); setPage(0) }}>
                <option value="">Any status</option>
                {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
              </select>
              <label className="label">Managed accounts</label>
              <select className="input" value={managed} onChange={(e) => { setManaged(e.target.value as '' | 'yes' | 'no'); setPage(0) }}>
                <option value="">Any</option>
                <option value="yes">Managed</option>
                <option value="no">Not managed</option>
              </select>
              <button className="btn-subtle mt-2 w-full justify-center" onClick={() => { setStatus(''); setManaged(''); close() }}>Clear extra filters</button>
            </div>
          )}
        </Dropdown>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[720px]">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="th">User</th>
              <th className="th">Status</th>
              <th className="th">Last seen</th>
              <th className="th">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                groups={groups}
                orgApps={orgApps}
                meId={me?.id}
                canGrantAdmin={canGrantOrgAdmin(me)}
                busy={busy}
                onStatus={(statusValue) => run(`${u.id}-status`, () => userAdminService.setStatus(u.id, statusValue), `Updated ${u.email}`)}
                onAdmin={(access) => run(`${u.id}-admin`, () => userAdminService.setAdminAccess(u.id, access), `Administrator access updated for ${u.email}`)}
              />
            ))}
          </tbody>
        </table>
        {pageItems.length === 0 && (
          <div className="p-6">
            <EmptyState title={users.length === 0 ? 'No users in this organization' : 'No users match these filters'}>
              {users.length === 0 ? 'Invite people to get started.' : 'Try a different search or clear filters.'}
            </EmptyState>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span>{filtered.length} user{filtered.length === 1 ? '' : 's'}</span>
          <select className="input w-auto" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0) }}>
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} / page</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button className="btn-subtle" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button>
          {Array.from({ length: pages }, (_, n) => (
            <button key={n} onClick={() => setPage(n)} className={`h-8 w-8 rounded text-sm ${n === current ? 'bg-brand-600 text-white' : 'hover:bg-slate-100'}`}>{n + 1}</button>
          ))}
          <button className="btn-subtle" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Next</button>
        </div>
      </div>

      <h2 className="mb-2 mt-8 text-sm font-semibold text-slate-700">Audit log</h2>
      {auditLogs.length === 0 ? (
        <p className="text-sm text-slate-500">No invitation or permission changes recorded yet.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
          {auditLogs.slice(0, 20).map((log) => {
            const actor = users.find((u) => u.id === log.actorId)
            return (
              <li key={log.id} className="px-3 py-2 text-sm">
                <div className="font-medium text-slate-800">{log.action} · {log.target}</div>
                <div className="text-xs text-slate-500">{actor?.name ?? log.actorId} · {timeAgo(log.createdAt)} · {log.details}</div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function UserRow({
  user, groups, orgApps, meId, canGrantAdmin, busy, onStatus, onAdmin,
}: {
  user: User
  groups: { id: string; name: string }[]
  orgApps: { id: string; name: string }[]
  meId?: string
  canGrantAdmin: boolean
  busy: string | null
  onStatus: (s: AccountStatus) => void
  onAdmin: (a: AdminAccess) => void
}) {
  const apps = user.appAccess.map((a) => orgApps.find((o) => o.id === a.appId)?.name ?? a.appId).join(', ')
  const groupNames = user.groupIds.map((id) => groups.find((g) => g.id === id)?.name ?? id).join(', ')
  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50">
      <td className="td">
        <div className="flex items-center gap-2">
          <Avatar user={user} size={28} />
          <div>
            <div className="font-medium">{user.name}</div>
            <div className="text-xs text-slate-500">{user.email}</div>
            <div className="text-xs text-slate-400">{user.role}{apps ? ` · ${apps}` : ''}{groupNames ? ` · ${groupNames}` : ''}</div>
          </div>
        </div>
      </td>
      <td className="td">
        <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase ${user.accountStatus === 'active' ? 'bg-green-100 text-green-800' : user.accountStatus === 'invited' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'}`}>
          {statusLabel(user.accountStatus)}
        </span>
      </td>
      <td className="td whitespace-nowrap text-slate-600">{user.lastSeenAt ? timeAgo(user.lastSeenAt) : 'Never'}</td>
      <td className="td">
        <Dropdown
          align="right"
          trigger={() => (
            <button className="btn-subtle" disabled={busy?.startsWith(user.id)}>Actions</button>
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
      </td>
    </tr>
  )
}
