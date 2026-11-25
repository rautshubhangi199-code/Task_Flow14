import { useMemo, useState, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { BarChart3, Boxes, Building2, Info, Rocket, Target, X } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useCurrentUser } from '../../store/hooks'
import { useUi } from '../../store/uiStore'
import { userAdminService } from '../../services/api'
import { ADMIN_ACCESS_OPTIONS, EMAIL_RE, parseInviteEmails } from '../../lib/adminUsers'
import { canGrantOrgAdmin, canManageUsers } from '../../lib/permissions'
import type { AdminAccess, AppAccess } from '../../types'

type InviteApp = {
  id: string
  name: string
  site: 'org' | 'team'
  plan: string
  icon: 'studio' | 'insights' | 'assets' | 'goals' | 'jira' | 'projects' | 'jira-admin'
  defaultRole: 'User' | 'None'
}

function JiraMark({ admin }: { admin?: boolean }) {
  return (
    <span className={`flex h-8 w-8 items-center justify-center rounded ${admin ? 'bg-[#1868DB]' : 'bg-[#1868DB]'}`}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M11.5 4 6 12.5h5.2L12.8 20 18.5 11H13L11.5 4Z" fill="white" />
      </svg>
    </span>
  )
}

function AppGlyph({ kind }: { kind: InviteApp['icon'] }) {
  const wrap = (node: ReactNode, className: string) => (
    <span className={`flex h-8 w-8 items-center justify-center rounded ${className}`}>{node}</span>
  )
  if (kind === 'jira') return <JiraMark />
  if (kind === 'jira-admin') return <JiraMark admin />
  if (kind === 'studio') return wrap(<Building2 size={16} className="text-white" />, 'bg-[#505F79]')
  if (kind === 'insights') return wrap(<BarChart3 size={16} className="text-white" />, 'bg-[#6B5B95]')
  if (kind === 'assets') return wrap(<Boxes size={16} className="text-white" />, 'bg-[#6554C0]')
  if (kind === 'goals') return wrap(<Target size={16} className="text-white" />, 'bg-[#172B4D]')
  return wrap(<Rocket size={16} className="text-white" />, 'bg-slate-200')
}

function inviteApps(): InviteApp[] {
  return [
    { id: 'jira', name: 'Jira', site: 'org', plan: 'Standard', icon: 'jira', defaultRole: 'User' },
    { id: 'jira-admin', name: 'Jira Administration', site: 'org', plan: '', icon: 'jira-admin', defaultRole: 'None' },
  ]
}

export default function InviteUsersPage() {
  const navigate = useNavigate()
  const me = useCurrentUser()
  const org = useStore((s) => s.organization)
  const groups = useStore((s) => s.groups)
  const showToast = useUi((s) => s.showToast)

  const orgLabel = org.name?.trim() || 'your organization'
  const orgSlug = (org.name.split(/\s+/)[0] || 'org').toLowerCase()
  const teamSlug = `${orgSlug}-team`
  const apps = useMemo(() => inviteApps(), [])

  const [emailsRaw, setEmailsRaw] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [adminAccess, setAdminAccess] = useState<AdminAccess>('none')
  const [appRoles, setAppRoles] = useState<Record<string, string>>(() =>
    Object.fromEntries(inviteApps().map((a) => [a.id, a.defaultRole])),
  )
  const [groupId, setGroupId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [adminHint, setAdminHint] = useState(false)
  const [hoverId, setHoverId] = useState<string | null>(null)

  const grantOrg = canGrantOrgAdmin(me)
  const canSend = parseInviteEmails(emailsRaw).length > 0 && !submitting

  const submit = async () => {
    const emails = parseInviteEmails(emailsRaw)
    const next: string[] = []
    if (!emails.length) next.push('Enter at least one email address.')
    for (const email of emails) {
      if (!EMAIL_RE.test(email)) next.push(`Invalid email address: ${email}`)
    }
    if (adminAccess === 'org-admin' && !grantOrg) next.push('You are not allowed to assign organization admin access.')
    if (next.length) {
      setErrors(next)
      return
    }
    setSubmitting(true)
    setErrors([])
    try {
      const appAccess = Object.entries(appRoles)
        .filter(([, role]) => role && role !== 'None')
        .map(([appId, role]) => ({ appId, role })) as AppAccess[]
      const result = await userAdminService.invite({
        emails,
        username,
        password,
        adminAccess,
        appAccess,
        groupIds: groupId ? [groupId] : [],
        message: '',
        sendEmail: true,
      })
      if (!result.created.length) {
        setErrors(result.errors.length ? result.errors : ['No users were invited.'])
        return
      }
      showToast(`Invited ${result.created.length} user${result.created.length === 1 ? '' : 's'}`)
      setEmailsRaw('')
      setUsername('')
      setPassword('')
    } catch (e) {
      setErrors([e instanceof Error ? e.message : 'Invitation failed'])
    } finally {
      setSubmitting(false)
    }
  }

  if (!canManageUsers(me)) return <Navigate to="/for-you" replace />

  return (
    <div className="min-h-full bg-white">
      <button
        type="button"
        className="absolute left-4 top-4 rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        aria-label="Close"
        onClick={() => navigate('/for-you')}
      >
        <X size={20} />
      </button>

      <div className="mx-auto max-w-3xl px-6 pb-10 pt-16 sm:px-10">
        <h1 className="text-[28px] font-semibold tracking-tight text-slate-900">Invite people to {orgLabel}</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-snug text-slate-600">
          Invite teammates to collaborate and use apps in your organization. We&apos;ll ask new users to enter their personal details when they sign up.
        </p>

        {errors.length > 0 && (
          <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <ul className="list-disc pl-4">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
          </div>
        )}

        <div className="mt-8">
          <label className="mb-1.5 block text-sm font-medium text-slate-800">Email addresses</label>
          <input
            className="h-10 w-full rounded-[3px] border border-slate-400 px-3 text-[15px] outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600"
            placeholder="Invite by email address..."
            value={emailsRaw}
            onChange={(e) => setEmailsRaw(e.target.value)}
          />
          <p className="mt-1.5 text-[13px] text-slate-500">
            Separate emails using a comma. Note, we can&apos;t send invitations to distribution lists.
          </p>
        </div>

        <div className="mt-5">
          <label className="mb-1.5 block text-sm font-medium text-slate-800">Username</label>
          <input
            name="username"
            autoComplete="username"
            className="h-10 w-full rounded-[3px] border border-slate-400 px-3 text-[15px] outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <div className="mt-5">
          <label className="mb-1.5 block text-sm font-medium text-slate-800">Password</label>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            className="h-10 w-full rounded-[3px] border border-slate-400 px-3 text-[15px] outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="mt-5">
          <label className="mb-1.5 flex items-center gap-1 text-sm font-medium text-slate-800">
            Administrator access
            <button
              type="button"
              className="rounded p-0.5 text-slate-500 hover:text-slate-800"
              aria-label="Administrator access info"
              onClick={() => setAdminHint((v) => !v)}
            >
              <Info size={14} />
            </button>
          </label>
          {adminHint && (
            <p className="mb-2 text-[13px] text-slate-500">
              Organization admins can manage users, billing, and security. User access admins can manage product access.
            </p>
          )}
          <select
            className="h-10 w-full max-w-[280px] rounded-[3px] border border-slate-400 bg-white px-3 text-[15px] outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600"
            value={adminAccess}
            onChange={(e) => setAdminAccess(e.target.value as AdminAccess)}
          >
            {ADMIN_ACCESS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} disabled={o.value === 'org-admin' && !grantOrg}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-6 overflow-hidden rounded-[3px] border border-slate-200">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 text-[13px] font-semibold text-slate-700">
                <th className="px-4 py-3">App</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span>Roles</span>
                    <button
                      type="button"
                      className="text-[13px] font-medium text-[#0C66E4] hover:underline"
                      onClick={() => setAppRoles(Object.fromEntries(apps.map((a) => [a.id, 'None'])))}
                    >
                      Unselect all
                    </button>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app) => (
                <tr
                  key={app.id}
                  className={`border-b border-slate-100 last:border-b-0 ${hoverId === app.id ? 'bg-slate-50' : 'bg-white'}`}
                  onMouseEnter={() => setHoverId(app.id)}
                  onMouseLeave={() => setHoverId(null)}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <AppGlyph kind={app.icon} />
                      <span>
                        <span className="block text-[14px] font-medium text-slate-900">{app.name}</span>
                        <span className="block text-[12px] text-slate-500">{app.site === 'team' ? teamSlug : orgSlug}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-[14px] text-slate-700">{app.plan || ''}</td>
                  <td className="px-4 py-2.5">
                    <select
                      className="h-9 w-full max-w-[140px] rounded-[3px] border border-slate-400 bg-white px-2 text-[14px] outline-none focus:border-brand-600"
                      value={appRoles[app.id] ?? 'None'}
                      onChange={(e) => setAppRoles((prev) => ({ ...prev, [app.id]: e.target.value }))}
                    >
                      <option value="User">User</option>
                      <option value="None">None</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8">
          <label className="mb-1.5 block text-sm font-medium text-slate-800">
            Group membership<span className="text-red-600">*</span>
          </label>
          <select
            className="h-10 w-full rounded-[3px] border border-slate-400 bg-white px-3 text-[15px] text-slate-700 outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
          >
            <option value="">Select</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <p className="mt-1.5 text-[13px] leading-snug text-slate-500">
            Customized groups give users access to specific projects or spaces. Avoid adding guests to groups that have regular app access, as this will give them full app access.
          </p>
        </div>

        <div className="mt-6 flex items-center justify-end gap-4">
          <button type="button" className="text-sm text-slate-700 hover:underline" onClick={() => navigate('/for-you')}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSend}
            className="h-8 rounded-[3px] bg-[#0C66E4] px-3 text-sm font-medium text-white hover:bg-[#0055CC] disabled:bg-slate-200 disabled:text-slate-500"
            onClick={() => void submit()}
          >
            {submitting ? 'Sending…' : 'Send invite'}
          </button>
        </div>
      </div>
    </div>
  )
}
