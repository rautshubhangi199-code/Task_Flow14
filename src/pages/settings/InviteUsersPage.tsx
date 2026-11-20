import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import { useCurrentUser } from '../../store/hooks'
import { useUi } from '../../store/uiStore'
import { userAdminService } from '../../services/api'
import { ADMIN_ACCESS_OPTIONS, EMAIL_RE, parseInviteEmails } from '../../lib/adminUsers'
import { canGrantOrgAdmin } from '../../lib/permissions'
import type { AdminAccess, AppAccess } from '../../types'

export default function InviteUsersPage() {
  const navigate = useNavigate()
  const me = useCurrentUser()
  const orgApps = useStore((s) => s.orgApps)
  const groups = useStore((s) => s.groups)
  const showToast = useUi((s) => s.showToast)

  const [emailsRaw, setEmailsRaw] = useState('')
  const [adminAccess, setAdminAccess] = useState<AdminAccess>('none')
  const [appRoles, setAppRoles] = useState<Record<string, string>>({})
  const [groupIds, setGroupIds] = useState<string[]>([])
  const [personalize, setPersonalize] = useState(false)
  const [message, setMessage] = useState('')
  const [sendEmail, setSendEmail] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  const selectedApps = useMemo(
    () => Object.entries(appRoles).filter(([, role]) => role).map(([appId, role]) => ({ appId, role })),
    [appRoles],
  )
  const grantOrg = canGrantOrgAdmin(me)

  const submit = async () => {
    const emails = parseInviteEmails(emailsRaw)
    const next: string[] = []
    if (!emails.length) next.push('Enter at least one email address.')
    for (const email of emails) {
      if (!EMAIL_RE.test(email)) next.push(`Invalid email address: ${email}`)
    }
    if (personalize && message.length > 500) next.push('Invitation message cannot exceed 500 characters.')
    if (adminAccess === 'org-admin' && !grantOrg) next.push('You are not allowed to assign organization admin access.')
    if (next.length) {
      setErrors(next)
      return
    }
    setSubmitting(true)
    setErrors([])
    try {
      const result = await userAdminService.invite({
        emails,
        adminAccess,
        appAccess: selectedApps as AppAccess[],
        groupIds,
        message: personalize ? message : '',
        sendEmail,
      })
      const msgs = [...result.errors]
      if (result.invitation.emailDelivery === 'backend-required') {
        msgs.push('Invites were saved. Real email delivery requires POST /admin/invitations/:id/send.')
      }
      if (!result.created.length) {
        setErrors(msgs.length ? msgs : ['No users were invited.'])
        return
      }
      showToast(`Invited ${result.created.length} user${result.created.length === 1 ? '' : 's'}`)
      navigate('/settings/users')
    } catch (e) {
      setErrors([e instanceof Error ? e.message : 'Invitation failed'])
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Invite users</h1>
      <p className="mt-1 text-sm text-slate-500">Add people by email. They appear as Invited until activated.</p>

      {errors.length > 0 && (
        <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <ul className="list-disc pl-4">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}

      <div className="mt-5">
        <label className="label">Email addresses</label>
        <textarea
          className="input min-h-24"
          placeholder="Separate emails with commas, spaces, or new lines"
          value={emailsRaw}
          onChange={(e) => setEmailsRaw(e.target.value)}
        />
      </div>

      <div className="mt-4">
        <label className="label">Administrator access</label>
        <select
          className="input max-w-xs"
          value={adminAccess}
          onChange={(e) => setAdminAccess(e.target.value as AdminAccess)}
        >
          {ADMIN_ACCESS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} disabled={o.value === 'org-admin' && !grantOrg}>
              {o.label}{o.value === 'org-admin' && !grantOrg ? ' (restricted)' : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Apps, plans, and roles</div>
            <div className="text-xs text-slate-500">{selectedApps.length} application{selectedApps.length === 1 ? '' : 's'} selected</div>
          </div>
          <button type="button" className="btn-subtle text-brand-700" onClick={() => setAppRoles({})}>Unselect all</button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">App</th>
                <th className="th">Plan</th>
                <th className="th">Role</th>
              </tr>
            </thead>
            <tbody>
              {orgApps.map((app) => (
                <tr key={app.id} className="border-b border-slate-100">
                  <td className="td font-medium">{app.name}</td>
                  <td className="td text-slate-600">{app.plan}</td>
                  <td className="td">
                    <select
                      className="input"
                      value={appRoles[app.id] ?? ''}
                      onChange={(e) => setAppRoles((prev) => ({ ...prev, [app.id]: e.target.value }))}
                    >
                      <option value="">Don’t give access</option>
                      {app.roles.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6">
        <label className="label">Group membership</label>
        <div className="flex flex-wrap gap-2">
          {groups.map((g) => {
            const on = groupIds.includes(g.id)
            return (
              <label key={g.id} className={`cursor-pointer rounded border px-2 py-1 text-sm ${on ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-200'}`}>
                <input
                  type="checkbox"
                  className="mr-1.5 align-middle"
                  checked={on}
                  onChange={() => setGroupIds((prev) => on ? prev.filter((id) => id !== g.id) : [...prev, g.id])}
                />
                {g.name}
              </label>
            )
          })}
          {groups.length === 0 && <span className="text-sm text-slate-500">No groups defined.</span>}
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 p-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={personalize} onChange={(e) => setPersonalize(e.target.checked)} />
          Personalize invitation
        </label>
        {personalize && (
          <div className="mt-3">
            <textarea
              className="input min-h-24"
              maxLength={500}
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 500))}
              placeholder="Add a note to the invitation email"
            />
            <div className="mt-1 text-right text-xs text-slate-500">{message.length}/500</div>
          </div>
        )}
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
        Send email invite
      </label>
      {sendEmail && (
        <p className="mt-1 text-xs text-slate-500">
          Email is recorded locally. Outbound mail needs POST /admin/invitations/:id/send.
        </p>
      )}

      <div className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4">
        <button className="btn-subtle" type="button" onClick={() => navigate('/settings/users')}>Cancel</button>
        <button className="btn-primary" type="button" disabled={submitting} onClick={() => void submit()}>
          {submitting ? 'Sending…' : 'Send invite'}
        </button>
      </div>
    </div>
  )
}
