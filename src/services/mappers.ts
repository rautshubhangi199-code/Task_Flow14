import { USER_COLORS, normalizeUser } from '../lib/adminUsers'
import { nowIso } from '../lib/utils'
import type {
  AccountStatus,
  AdminAccess,
  AppNotification,
  Comment,
  IssueType,
  LinkType,
  Organization,
  Priority,
  Project,
  SavedFilter,
  Sprint,
  SprintState,
  User,
  WorkItem,
  WorkLog,
} from '../types'
import { LINK_TYPES, PRIORITIES } from '../types'
import {
  nestedId,
  nestedName,
  pkOf,
  rawId,
  rawPk,
  rememberPk,
  statusNameForId,
  teamNameForId,
  typeNameForId,
  mapRoleName,
} from './catalog'
import { asRecord } from './http'

export function hoursToMinutes(hours: unknown): number | null {
  if (hours === null || hours === undefined || hours === '') return null
  const n = Number(hours)
  if (!Number.isFinite(n)) return null
  return Math.round(n * 60)
}

export function minutesToHours(minutes: number | null | undefined): number | null {
  if (minutes == null) return null
  return Math.round((minutes / 60) * 100) / 100
}

export function mapAccountStatus(value: unknown): AccountStatus {
  const s = String(value ?? '').toLowerCase().trim()
  if (s.includes('deactiv') || s.includes('inactive') || s === 'disabled') return 'deactivated'
  if (s === 'invited' || s === 'pending' || s.includes('pending invite')) return 'invited'
  return 'active'
}

export function apiAccountStatus(status: AccountStatus): string {
  if (status === 'deactivated') return 'Deactivated'
  if (status === 'invited') return 'Invited'
  return 'Active'
}

export function mapAdminAccess(value: unknown): AdminAccess {
  const s = String(value ?? '').toLowerCase()
  if (s.includes('org') || s.includes('organization')) return 'org-admin'
  if (s.includes('user access') || s.includes('user-access')) return 'user-access-admin'
  return 'none'
}

export function apiAdminAccess(access: AdminAccess): string {
  if (access === 'org-admin') return 'Organization'
  if (access === 'user-access-admin') return 'User access admin'
  return 'None'
}

export function mapOrganization(raw: unknown): Organization {
  const r = asRecord(raw)
  const pk = rawPk(r) ?? 0
  const id = rawId(r, 'id') || String(pk)
  rememberPk('org', id, pk)
  return { id, name: String(r.name ?? 'Organization') }
}

export function mapUser(raw: unknown, index = 0): User {
  const r = asRecord(raw)
  const pk = rawPk(r) ?? 0
  const id = rawId(r, 'id') || String(pk)
  rememberPk('user', id, pk)
  const roleRaw = nestedName(r.role ?? r.role_name ?? r.designation ?? r.app_roles)
  const name = String(r.display_name ?? r.name ?? r.username ?? r.email ?? `User ${id}`)
  return normalizeUser({
    id,
    name,
    email: String(r.email ?? r.email_address ?? (r.display_name ? `${String(r.display_name).replace(/\s+/g, '.').toLowerCase()}@taskflow.local` : '')),
    role: mapRoleName(roleRaw || 'Developer'),
    designation: roleRaw || mapRoleName(roleRaw || 'Developer'),
    team: teamNameForId(r.team ?? r.group_membership) ?? String(r.team ?? r.group_membership ?? ''),
    color: USER_COLORS[index % USER_COLORS.length],
    accountStatus: mapAccountStatus(r.account_status ?? r.status),
    adminAccess: mapAdminAccess(r.admin_access ?? r.administrator_access),
    orgAdmin: mapAdminAccess(r.admin_access ?? r.administrator_access) === 'org-admin',
    lastSeenAt: r.last_seen_at ? String(r.last_seen_at) : r.last_seen ? String(r.last_seen) : null,
    invitedAt: r.invited_at ? String(r.invited_at) : null,
  })
}

function mapProjectIcon(value: unknown): string {
  const raw = String(value ?? '').trim()
  const named: Record<string, string> = {
    rocket: '🚀',
    folder: '📁',
    globe: '🌐',
    mobile: '📱',
    tools: '🛠️',
    chart: '📊',
    target: '🎯',
  }
  if (named[raw.toLowerCase()]) return named[raw.toLowerCase()]
  if (!raw || raw.toLowerCase() === 'string') return '📁'
  return raw
}

export function mapProject(raw: unknown): Project {
  const r = asRecord(raw)
  const pk = rawPk(r) ?? 0
  const id = rawId(r, 'id') || String(pk)
  rememberPk('project', id, pk)
  const name = String(r.name ?? 'Space')
  const keyFromName = name.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase() || `P${pk}`
  const typeRaw = String(r.project_type ?? r.type ?? 'software').toLowerCase()
  const members = Array.isArray(r.member_ids)
    ? (r.member_ids as unknown[]).map(String)
    : Array.isArray(r.members)
      ? (r.members as unknown[]).map((m) => nestedId(m))
      : []
  return {
    id,
    key: String(r.key ?? keyFromName),
    name,
    description: String(r.description ?? ''),
    icon: mapProjectIcon(r.icon),
    type: typeRaw.includes('kanban') ? 'Kanban' : 'Scrum',
    leadId: nestedId(r.lead ?? r.lead_id) || '',
    memberIds: members.filter(Boolean),
    createdAt: String(r.created_at ?? nowIso()),
    counter: Number(r.counter ?? 0) || 0,
  }
}

function mapPriority(value: unknown): Priority {
  const n = nestedName(value)
  return (PRIORITIES as readonly string[]).includes(n) ? (n as Priority) : 'Medium'
}

function mapLabels(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((l) => (typeof l === 'string' ? l : nestedName(l))).filter(Boolean)
  }
  if (typeof raw === 'string') return raw.split(',').map((s) => s.trim()).filter(Boolean)
  return []
}

export function mapWorkItem(raw: unknown): WorkItem {
  const r = asRecord(raw)
  const pk = rawPk(r) ?? 0
  const id = String(r.work_item_id ?? r.key ?? r.id ?? pk)
  rememberPk('item', id, pk)
  if (r.work_item_id) rememberPk('item', String(r.work_item_id), pk)
  const parent = r.parent ?? r.parent_id
  const sprint = r.sprint ?? r.sprint_id
  const project = r.project ?? r.project_id
  const type: IssueType = typeNameForId(r.work_item_type ?? r.type ?? r.work_item_type_name)
  const linksRaw = Array.isArray(r.links) ? r.links : []
  return {
    id,
    projectId: nestedId(project),
    type,
    summary: String(r.summary ?? r.title ?? ''),
    description: String(r.description ?? ''),
    status: statusNameForId(r.status ?? r.status_name),
    priority: mapPriority(r.priority),
    originalEstimate: hoursToMinutes(r.original_estimate),
    assigneeId: nestedId(r.assignee ?? r.assignee_id) || null,
    reporterId: nestedId(r.reporter ?? r.reporter_id) || '',
    labels: mapLabels(r.labels ?? r.label_ids),
    parentId: nestedId(parent) || null,
    dueDate: r.due_date ? String(r.due_date).slice(0, 10) : null,
    startDate: r.start_date ? String(r.start_date).slice(0, 10) : null,
    team: teamNameForId(r.team) ?? (r.team ? String(nestedName(r.team)) : null),
    sprintId: nestedId(sprint) || null,
    storyPoints: r.story_point_estimate != null ? Number(r.story_point_estimate) : r.story_points != null ? Number(r.story_points) : null,
    links: linksRaw.map((l) => {
      const lr = asRecord(l)
      const t = String(lr.relationship_type ?? lr.type ?? 'Relates to')
      return {
        type: (LINK_TYPES as readonly string[]).includes(t) ? (t as LinkType) : 'Relates to',
        targetId: nestedId(lr.target_work_item ?? lr.targetId ?? lr.target),
      }
    }).filter((l) => l.targetId),
    watcherIds: Array.isArray(r.watchers) ? (r.watchers as unknown[]).map((w) => nestedId(w)) : [],
    createdAt: String(r.created_at ?? nowIso()),
    updatedAt: String(r.updated_at ?? r.created_at ?? nowIso()),
    resolvedAt: r.resolved_at ? String(r.resolved_at) : null,
  }
}

export function mapSprint(raw: unknown, fallbackProjectId = ''): Sprint {
  const r = asRecord(raw)
  const pk = rawPk(r) ?? 0
  const id = rawId(r, 'id') || String(pk)
  rememberPk('sprint', id, pk)
  const status = String(r.status ?? r.state ?? 'planned').toLowerCase()
  const state: SprintState = status.includes('complete') ? 'completed' : status.includes('active') ? 'active' : 'planned'
  return {
    id,
    projectId: nestedId(r.project ?? r.project_id) || fallbackProjectId,
    name: String(r.name ?? 'Sprint'),
    goal: String(r.goal ?? ''),
    state,
    startDate: r.start_date ? String(r.start_date).slice(0, 10) : null,
    endDate: r.end_date ? String(r.end_date).slice(0, 10) : null,
    completedAt: r.completed_at ? String(r.completed_at) : null,
  }
}

export function mapComment(raw: unknown, fallbackItemId = ''): Comment {
  const r = asRecord(raw)
  const pk = rawPk(r) ?? 0
  const id = rawId(r, 'id') || String(pk)
  rememberPk('comment', id, pk)
  return {
    id,
    itemId: nestedId(r.work_item ?? r.work_item_id ?? r.itemId) || fallbackItemId,
    authorId: nestedId(r.employee ?? r.author ?? r.user) || '',
    body: String(r.comment_text ?? r.body ?? ''),
    createdAt: String(r.created_at ?? nowIso()),
    updatedAt: r.updated_at ? String(r.updated_at) : null,
  }
}

export function mapWorklog(raw: unknown, fallbackItemId = ''): WorkLog {
  const r = asRecord(raw)
  const pk = rawPk(r) ?? 0
  const id = rawId(r, 'id') || String(pk)
  rememberPk('worklog', id, pk)
  const spent = r.time_spent
  const minutes = typeof spent === 'number' && spent < 1000 && !Number.isInteger(spent * 1)
    ? hoursToMinutes(spent) ?? 0
    : hoursToMinutes(spent) ?? Number(r.minutes ?? 0)
  return {
    id,
    itemId: nestedId(r.work_item ?? r.work_item_id) || fallbackItemId,
    userId: nestedId(r.employee ?? r.user) || '',
    date: String(r.work_date ?? r.date ?? '').slice(0, 10),
    minutes: minutes || 0,
    description: String(r.work_description ?? r.description ?? ''),
    createdAt: String(r.created_at ?? nowIso()),
  }
}

export function mapFilter(raw: unknown): SavedFilter {
  const r = asRecord(raw)
  const pk = rawPk(r) ?? 0
  const id = rawId(r, 'id') || String(pk)
  rememberPk('filter', id, pk)
  return {
    id,
    name: String(r.name ?? 'Filter'),
    ownerId: nestedId(r.user ?? r.user_id) || '',
    jql: String(r.search_criteria ?? r.jql ?? ''),
    starred: Boolean(r.is_starred ?? r.starred),
    createdAt: String(r.created_at ?? nowIso()),
  }
}

export function mapNotification(raw: unknown): AppNotification {
  const r = asRecord(raw)
  const pk = rawPk(r) ?? 0
  const id = rawId(r, 'id') || String(pk)
  rememberPk('notification', id, pk)
  const event = String(r.event_type ?? r.type ?? 'assigned')
  let type: AppNotification['type'] = 'assigned'
  if (event.includes('status')) type = 'status'
  else if (event.includes('comment')) type = 'comment'
  else if (event.includes('overdue')) type = 'overdue'
  else if (event.includes('due')) type = 'due'
  return {
    id,
    userId: nestedId(r.user ?? r.user_id),
    type,
    message: String(r.message ?? ''),
    itemId: nestedId(r.work_item ?? r.work_item_id) || null,
    createdAt: String(r.created_at ?? nowIso()),
    read: Boolean(r.is_read ?? r.read),
  }
}

export function numOrNull(id: string | number | null | undefined, kind: Parameters<typeof pkOf>[0]): number | null {
  return pkOf(kind, id)
}
