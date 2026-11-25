import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { API_ENDPOINTS } from '../Network/apiEndpoints'
import { useStore } from '../store/useStore'
import { authService } from '../services/api'
import { asList, asRecord, http, setAccessToken } from '../services/http'
import { mapUser } from '../services/mappers'
import { Avatar } from '../components/ui'
import { initials } from '../lib/utils'
import type { User } from '../types'

const REMEMBER_KEY = 'taskflow_remembered_account'

type RememberedAccount = {
  name: string
  email: string
  username: string
  password: string
  color: string
}

function readRemembered(): RememberedAccount | null {
  try {
    const raw = localStorage.getItem(REMEMBER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as RememberedAccount
    if (!parsed?.username) return null
    return parsed
  } catch {
    return null
  }
}

function writeRemembered(account: RememberedAccount) {
  try {
    localStorage.setItem(REMEMBER_KEY, JSON.stringify(account))
  } catch {
    /* ignore */
  }
}

function clearRemembered() {
  try {
    localStorage.removeItem(REMEMBER_KEY)
  } catch {
    /* ignore */
  }
}

export const ADMIN_TAB: User = {
  id: 'admin-login',
  name: 'Admin',
  email: 'Taskflow-admin',
  role: 'Admin',
  team: '',
  color: '#2563eb',
  accountStatus: 'active',
  accountType: 'atlassian',
  managed: false,
  orgAdmin: true,
  adminAccess: 'org-admin',
  lastSeenAt: null,
  appAccess: [],
  groupIds: [],
  invitedAt: null,
}

export function ensureAdminSessionUser() {
  let adminSession = false
  try {
    adminSession = sessionStorage.getItem('taskflow_admin_session') === '1'
  } catch {
    return
  }
  if (!adminSession) return
  const s = useStore.getState()
  const me = s.users.find((u) => u.id === s.currentUserId)
  if (me && me.id !== ADMIN_TAB.id) return
  const has = s.users.some((u) => u.id === ADMIN_TAB.id)
  if (has && s.currentUserId === ADMIN_TAB.id && me?.role === 'Admin') return
  useStore.setState({
    currentUserId: ADMIN_TAB.id,
    users: has
      ? s.users.map((u) =>
          u.id === ADMIN_TAB.id ? { ...u, role: 'Admin', orgAdmin: true, adminAccess: 'org-admin' } : u,
        )
      : [...s.users, ADMIN_TAB],
  })
}

function orgPk() {
  const n = Number(useStore.getState().organization.id)
  return Number.isFinite(n) ? n : undefined
}

async function loadAdminApis() {
  const organization_id = orgPk()
  await Promise.all([
    http.get(API_ENDPOINTS.GET_all_organizations).catch(() => []),
    http.get(API_ENDPOINTS.GET_user_summary, { organization_id }).catch(() => null),
    http.get(API_ENDPOINTS.GET_all_users, { organization_id }).catch(() => []),
    http.get(API_ENDPOINTS.GET_all_roles).catch(() => []),
    http.get(API_ENDPOINTS.GET_all_teams, { organization_id }).catch(() => []),
  ])
}

async function loadUserApis(userId: string | number | null | undefined) {
  const organization_id = orgPk()
  const uid = userId != null && userId !== '' ? Number(userId) || userId : undefined
  const projects = asList<Record<string, unknown>>(
    await http.get(API_ENDPOINTS.GET_all_projects, { organization_id, user_id: uid }).catch(() => []),
  )
  await Promise.all([
    uid != null ? http.get(API_ENDPOINTS.GET_assigned_to_me, { user_id: uid }).catch(() => []) : Promise.resolve([]),
    uid != null ? http.get(API_ENDPOINTS.GET_all_notifications, { user_id: uid }).catch(() => []) : Promise.resolve([]),
    uid != null ? http.get(API_ENDPOINTS.GET_all_saved_filters, { user_id: uid }).catch(() => []) : Promise.resolve([]),
  ])
  await Promise.all(
    projects
      .map((p) => Number(p.id))
      .filter((id) => Number.isFinite(id))
      .map((project_id) =>
        Promise.all([
          http.get(API_ENDPOINTS.GET_all_work_items, { project_id }).catch(() => []),
          http.get(API_ENDPOINTS.GET_all_sprints, { project_id }).catch(() => []),
        ]),
      ),
  )
}

function applyApiSessionUser(apiUser: Record<string, unknown>, formUsername: string): string | null {
  const formName = formUsername.trim()
  const hasIdentity =
    apiUser.id != null ||
    apiUser.user_id != null ||
    apiUser.email ||
    apiUser.username ||
    apiUser.display_name ||
    apiUser.name
  if (!hasIdentity && !formName) return null
  const mapped = mapUser({
    ...apiUser,
    display_name: apiUser.display_name ?? apiUser.name ?? apiUser.username ?? formName,
    email: apiUser.email ?? apiUser.email_address ?? '',
    username: apiUser.username ?? formName,
  })
  const name = String(apiUser.display_name ?? apiUser.name ?? apiUser.username ?? formName ?? mapped.name)
  const email = String(apiUser.email ?? apiUser.email_address ?? mapped.email)
  const session: User = { ...mapped, name, email }
  const s = useStore.getState()
  const formKey = formName.toLowerCase()
  const existing =
    s.users.find((u) => u.id !== ADMIN_TAB.id && u.id === session.id) ||
    (email ? s.users.find((u) => u.id !== ADMIN_TAB.id && u.email.toLowerCase() === email.toLowerCase()) : undefined) ||
    (formKey
      ? s.users.find(
          (u) =>
            u.id !== ADMIN_TAB.id &&
            (u.name.toLowerCase() === formKey || u.email.toLowerCase() === formKey || u.email.toLowerCase().startsWith(`${formKey}@`)),
        )
      : undefined)
  const id = existing?.id ?? session.id
  const next = { ...(existing ?? session), ...session, id, name: name || existing?.name || session.name, email: email || existing?.email || session.email }
  useStore.setState({
    currentUserId: id,
    users: existing
      ? s.users.map((u) => (u.id === existing.id ? next : u))
      : [...s.users, next],
  })
  return id
}

function pickAccessToken(data: Record<string, unknown>): string | null {
  const nested = data.tokens && typeof data.tokens === 'object' && !Array.isArray(data.tokens)
    ? (data.tokens as Record<string, unknown>)
    : null
  const token = data.access ?? data.access_token ?? data.token ?? nested?.access ?? nested?.access_token
  return token ? String(token) : null
}

export default function Login() {
  const users = useStore((s) => s.users)
  const org = useStore((s) => s.organization)
  const currentUserId = useStore((s) => s.currentUserId)
  const navigate = useNavigate()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remembered, setRemembered] = useState<RememberedAccount | null>(() => readRemembered())
  const [useAnother, setUseAnother] = useState(false)
  if (currentUserId) return <Navigate to="/for-you" replace />

  const submitForm = (e: FormEvent) => {
    e.preventDefault()
    const name = username.trim()
    const admin = name.toLowerCase() === 'taskflow-admin' || name.toLowerCase() === ADMIN_TAB.email.toLowerCase()
    void signIn(
      admin ? ADMIN_TAB.id : 'form-login',
      { username: name, password, email: name },
      admin ? ADMIN_TAB.id : undefined,
    )
  }

  const signIn = async (id: string, body: Record<string, unknown>, fallbackUserId?: string) => {
    setError('')
    setBusyId(id)
    try {
      const data = asRecord(await http.post(API_ENDPOINTS.POST_login, body))
      const token = pickAccessToken(data)
      if (token) setAccessToken(token)
      const apiUser = asRecord(data.user ?? data)
      const apiId = apiUser.id ?? apiUser.user_id
      const formName = String(body.username ?? body.email ?? '')
      const sessionId = applyApiSessionUser(apiUser, formName)
      const apiEmail = String(apiUser.email ?? '')
      const matched =
        sessionId ||
        (apiId != null && users.find((u) => u.id === String(apiId))?.id) ||
        users.find((u) => apiEmail && u.email.toLowerCase() === apiEmail.toLowerCase())?.id ||
        fallbackUserId
      const adminLogin = id === ADMIN_TAB.id
      if (adminLogin && !sessionId) {
        sessionStorage.setItem('taskflow_admin_session', '1')
        ensureAdminSessionUser()
        await authService.login(ADMIN_TAB.id)
        writeRemembered({
          name: ADMIN_TAB.name,
          email: ADMIN_TAB.email,
          username: 'Taskflow-admin',
          password: '12345',
          color: ADMIN_TAB.color,
        })
        await loadAdminApis()
        navigate('/for-you')
        return
      }
      if (adminLogin) sessionStorage.setItem('taskflow_admin_session', '1')
      else sessionStorage.removeItem('taskflow_admin_session')
      if (matched) await authService.login(matched)
      const me = useStore.getState().users.find((u) => u.id === matched)
      writeRemembered({
        name: me?.name || formName,
        email: me?.email || apiEmail || formName,
        username: formName || String(body.username ?? ''),
        password: String(body.password ?? ''),
        color: me?.color || '#1B2A4E',
      })
      await loadUserApis(apiId ?? matched)
      navigate('/for-you')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusyId(null)
    }
  }

  if (remembered && !useAnother) {
    return (
      <div className="flex min-h-full items-center justify-center bg-white p-6">
        <div className="w-full max-w-[400px] px-4 py-8">
          <div className="mb-8 flex items-center justify-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1868DB]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M11.5 4 6 12.5h5.2L12.8 20 18.5 11H13L11.5 4Z" fill="white" />
              </svg>
            </span>
            <span className="text-[28px] font-semibold tracking-tight text-[#1868DB]">Jira</span>
          </div>
          <h1 className="mb-8 text-center text-[20px] font-semibold text-[#172B4D]">Choose an account to continue</h1>
          {error ? <p className="mb-4 rounded bg-[#FFECEB] px-3 py-2 text-sm text-[#AE2E24]">{error}</p> : null}
          <div className="mb-8 flex items-center gap-4">
            <span
              className="inline-flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full text-[22px] font-semibold text-white"
              style={{ background: remembered.color || '#1B2A4E' }}
            >
              {initials(remembered.name)}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[18px] font-semibold text-[#172B4D]">{remembered.name}</div>
              <div className="truncate text-[14px] text-[#44546F]">{remembered.email}</div>
            </div>
          </div>
          <button
            type="button"
            disabled={busyId !== null}
            onClick={() =>
              void signIn('form-login', {
                username: remembered.username,
                password: remembered.password,
                email: remembered.username,
              })
            }
            className="mb-3 h-11 w-full rounded-[3px] bg-[#0C66E4] text-[16px] font-semibold text-white hover:bg-[#0055CC] disabled:opacity-60"
          >
            {busyId ? 'Continuing…' : 'Continue'}
          </button>
          <button
            type="button"
            disabled={busyId !== null}
            onClick={() => { setError(''); setUseAnother(true) }}
            className="mb-3 h-11 w-full rounded-[3px] border border-[#8590A2] bg-white text-[16px] font-medium text-[#172B4D] hover:bg-[#F7F8F9]"
          >
            Use another account
          </button>
          <button
            type="button"
            disabled={busyId !== null}
            onClick={() => { clearRemembered(); setRemembered(null); setError('') }}
            className="h-11 w-full rounded-[3px] border border-[#8590A2] bg-white text-[16px] font-medium text-[#172B4D] hover:bg-[#F7F8F9]"
          >
            Remove account
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-[#F7F8F9] p-6">
      <div className="w-full max-w-[400px] rounded-lg border border-[#DFE1E6] bg-white px-8 py-10 shadow-[0_8px_16px_rgba(9,30,66,0.08)]">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[#0C66E4] text-lg font-bold text-white">TF</span>
          <h1 className="text-2xl font-semibold tracking-tight text-[#172B4D]">Log in to your account</h1>
          <p className="mt-1 text-sm text-[#626F86]">{org.name}</p>
        </div>
        {error ? <p className="mb-4 rounded bg-[#FFECEB] px-3 py-2 text-sm text-[#AE2E24]">{error}</p> : null}
        <form onSubmit={submitForm} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[#44546F]">Username or email</span>
            <input
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-10 w-full rounded-[3px] border border-[#8590A2] px-3 text-sm text-[#172B4D] outline-none focus:border-[#0C66E4] focus:ring-2 focus:ring-[#0C66E4]/30"
              placeholder="Enter your username"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[#44546F]">Password</span>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 w-full rounded-[3px] border border-[#8590A2] px-3 pr-10 text-sm text-[#172B4D] outline-none focus:border-[#0C66E4] focus:ring-2 focus:ring-[#0C66E4]/30"
                placeholder="Enter your password"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[#626F86] hover:bg-slate-100"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
          <button
            type="submit"
            disabled={busyId !== null || !username.trim() || !password}
            className="h-10 w-full rounded-[3px] bg-[#0C66E4] text-sm font-semibold text-white hover:bg-[#0055CC] disabled:cursor-not-allowed disabled:bg-[#A8C7FA]"
          >
            {busyId ? 'Logging in…' : 'Log in'}
          </button>
        </form>
        <div className="my-6 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wide text-[#626F86]">
          <span className="h-px flex-1 bg-[#DFE1E6]" />
          Or continue as
          <span className="h-px flex-1 bg-[#DFE1E6]" />
        </div>
        <div className="space-y-2">
          <button
            type="button"
            disabled={busyId !== null}
            onClick={() =>
              void signIn(ADMIN_TAB.id, { username: 'Taskflow-admin', password: '12345' }, users.find((x) => x.role === 'Admin')?.id)
            }
            className="flex w-full items-center gap-3 rounded-[3px] border border-[#DFE1E6] px-3 py-2.5 text-left hover:bg-[#F7F8F9] disabled:opacity-60"
          >
            <Avatar user={ADMIN_TAB} size={32} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-[#172B4D]">{ADMIN_TAB.name}</div>
              <div className="truncate text-xs text-[#626F86]">{ADMIN_TAB.email}</div>
            </div>
            <span className="text-xs text-[#626F86]">{busyId === ADMIN_TAB.id ? 'Signing in…' : ADMIN_TAB.role}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
