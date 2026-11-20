import type { AdminAccess, OrgApp, Role, User, UserGroup } from '../types'
import { TEAMS } from '../types'

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i

export const ADMIN_ACCESS_OPTIONS: { value: AdminAccess; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'user-access-admin', label: 'User access admin' },
  { value: 'org-admin', label: 'Organization admin' },
]

export const ACCOUNT_TYPES: { value: User['accountType'] | ''; label: string }[] = [
  { value: '', label: 'All account types' },
  { value: 'atlassian', label: 'Atlassian account' },
  { value: 'customer', label: 'Customer' },
]

export const USER_COLORS = ['#0c66e4', '#9f5ee7', '#e56910', '#22a06b', '#c9372c', '#1d7a8c', '#6b5b95', '#44546f']

export function parseInviteEmails(raw: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of raw.split(/[\s,;]+/)) {
    const email = part.trim().toLowerCase()
    if (!email || seen.has(email)) continue
    seen.add(email)
    out.push(email)
  }
  return out
}

export function nameFromEmail(email: string) {
  const local = email.split('@')[0] ?? 'User'
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ') || 'Invited user'
}

export function defaultOrgApps(): OrgApp[] {
  return [
    { id: 'taskflow', name: 'TaskFlow', plan: 'Standard', roles: ['User', 'Administrator'] },
    { id: 'plans', name: 'Plans', plan: 'Free', roles: ['User', 'Administrator'] },
    { id: 'assets', name: 'Assets', plan: 'Free', roles: ['User', 'Administrator'] },
  ]
}

export function defaultGroups(): UserGroup[] {
  return TEAMS.map((name) => ({ id: `g-${name.toLowerCase()}`, name }))
}

export function groupIdForTeam(team: string) {
  return `g-${team.toLowerCase()}`
}

type UserSeed = Pick<User, 'id' | 'name' | 'email' | 'role' | 'team' | 'color'> & Partial<User>

export function normalizeUser(user: UserSeed, views?: { userId: string; at: string }[]): User {
  const lastFromViews = views
    ?.filter((v) => v.userId === user.id)
    .sort((a, b) => b.at.localeCompare(a.at))[0]?.at
  const orgAdmin = user.orgAdmin ?? user.role === 'Admin'
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    team: user.team,
    color: user.color,
    accountStatus: user.accountStatus ?? 'active',
    accountType: user.accountType ?? 'atlassian',
    managed: user.managed ?? true,
    orgAdmin,
    adminAccess: user.adminAccess ?? (orgAdmin ? 'org-admin' : 'none'),
    lastSeenAt: user.lastSeenAt ?? lastFromViews ?? null,
    appAccess: user.appAccess?.length
      ? user.appAccess
      : [{ appId: 'taskflow', role: user.role === 'Admin' ? 'Administrator' : 'User' }],
    groupIds: user.groupIds?.length ? user.groupIds : user.team ? [groupIdForTeam(user.team)] : [],
    invitedAt: user.invitedAt ?? null,
  }
}

export function roleFromAppAccess(appAccess: { appId: string; role: string }[], adminAccess: AdminAccess): Role {
  if (adminAccess === 'org-admin') return 'Admin'
  const tf = appAccess.find((a) => a.appId === 'taskflow')
  if (tf?.role === 'Administrator') return 'Project Manager'
  return 'Developer'
}
