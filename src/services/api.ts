/**
 * API service layer. UI keeps using these methods; local store stays the source of
 * screen data. Each mutation also calls the matching Django URL from API_ENDPOINTS.
 */
import { API_ENDPOINTS } from '../Network/apiEndpoints'
import { useStore, type ProjectInput, type WorkItemPatch } from '../store/useStore'
import { mergePersonalSettings } from '../lib/personalSettings'
import { asList, asRecord, http } from './http'
import { mapUser } from './mappers'
import { canCreateWorkItems, canManageUsers } from '../lib/permissions'
import type { AccountStatus, AdminAccess, InviteUsersInput, IssueType, LinkType, PersonalSettings, SavedFilter, User, WorkItem, WorkItemInput } from '../types'

const st = () => useStore.getState()
const ok = <T>(value: T) => Promise.resolve(value)

function fire(fn: () => Promise<unknown>) {
  void fn().catch((err) => console.warn('[taskflow-api]', err))
}

function num(id: string | number | null | undefined): number | undefined {
  if (id === null || id === undefined || id === '') return undefined
  const n = Number(id)
  return Number.isFinite(n) ? n : undefined
}

function adminAccessApi(access: AdminAccess): string {
  if (access === 'org-admin') return 'Organization'
  if (access === 'user-access-admin') return 'User access admin'
  return 'None'
}

function accountStatusApi(status: AccountStatus): string {
  if (status === 'deactivated') return 'Deactivated'
  if (status === 'invited') return 'Invited'
  return 'Active'
}

const orgId = () => num(st().organization.id)
const actorId = () => num(st().currentUserId)

async function apiOrgId(): Promise<number | undefined> {
  const local = orgId()
  if (local) return local
  const orgs = asList<Record<string, unknown>>(await http.get(API_ENDPOINTS.GET_all_organizations))
  const id = Number(orgs[0]?.id)
  return Number.isFinite(id) ? id : undefined
}

async function apiProjectId(localProjectId: string): Promise<number | undefined> {
  const direct = num(localProjectId)
  if (direct) return direct
  const local = st().projects.find((p) => p.id === localProjectId)
  const rows = asList<Record<string, unknown>>(
    await http.get(API_ENDPOINTS.GET_all_projects, { organization_id: await apiOrgId() }),
  )
  const match = rows.find((r) => String(r.name ?? '').toLowerCase() === (local?.name ?? '').toLowerCase())
  const id = Number((match ?? rows[0])?.id)
  return Number.isFinite(id) ? id : undefined
}

async function apiUserId(localUserId: string | null | undefined): Promise<number | undefined> {
  if (!localUserId) return undefined
  const direct = num(localUserId)
  if (direct) return direct
  const local = st().users.find((u) => u.id === localUserId)
  const rows = asList<Record<string, unknown>>(
    await http.get(API_ENDPOINTS.GET_all_users, { organization_id: await apiOrgId() }),
  )
  const match = rows.find((r) => {
    const email = String(r.email ?? '').toLowerCase()
    const name = String(r.display_name ?? r.name ?? '').toLowerCase()
    return (local?.email && email === local.email.toLowerCase()) || (local?.name && name === local.name.toLowerCase())
  })
  const id = Number(match?.id ?? match?.user)
  return Number.isFinite(id) ? id : undefined
}

async function apiWorkItemTypeId(name: string): Promise<number | undefined> {
  const rows = asList<Record<string, unknown>>(await http.get(API_ENDPOINTS.GET_all_work_item_types))
  const match = rows.find((r) => String(r.name ?? '').toLowerCase() === name.toLowerCase())
  if (match?.id != null && Number.isFinite(Number(match.id))) return Number(match.id)
  const created = asRecord(await http.post(API_ENDPOINTS.POST_create_work_item_type, { name, description: name }))
  const id = Number(created.id)
  return Number.isFinite(id) ? id : undefined
}

async function workItemCreateBody(input: WorkItemInput): Promise<Record<string, unknown>> {
  const project = await apiProjectId(input.projectId)
  const work_item_type = await apiWorkItemTypeId(input.type)
  const body: Record<string, unknown> = {
    project,
    work_item_type,
    summary: input.summary,
    description: input.description || '',
    priority: input.priority || 'Medium',
  }
  const assignee = await apiUserId(input.assigneeId)
  if (assignee) body.assignee = assignee
  const reporter = await apiUserId(input.reporterId)
  if (reporter) body.reporter = reporter
  if (input.dueDate) body.due_date = input.dueDate
  if (input.startDate) body.start_date = input.startDate
  if (input.storyPoints != null) body.story_point_estimate = input.storyPoints
  if (input.originalEstimate != null) body.original_estimate = input.originalEstimate / 60
  const sprint = num(input.sprintId)
  if (sprint) body.sprint = sprint
  const parent = num(input.parentId)
  if (parent) body.parent = parent
  const team = num(input.team)
  if (team) body.team = team
  return body
}

export const authService = {
  login: (userId: string) => ok(st().login(userId)),
  logout: () => {
    try {
      sessionStorage.removeItem('taskflow_admin_session')
    } catch {
      /* ignore */
    }
    return ok(st().logout())
  },
  resetDemo: () => ok(st().resetDemo()),
}

export const orgService = {
  create: (name: string) => {
    fire(() => http.post(API_ENDPOINTS.POST_create_organization, { name }))
    return ok(st().organization)
  },
  list: () => ok([st().organization]),
  get: (_id: string) => ok(st().organization),
  update: (id: string, name: string) => {
    fire(() => http.patch(API_ENDPOINTS.UPDATE_organization, { id: num(id) ?? id, name }))
    return ok(st().organization)
  },
  remove: (id: string) => {
    fire(() => http.delete(API_ENDPOINTS.DELETE_organization, { id: num(id) ?? id }))
    return ok(undefined)
  },
}

export const projectService = {
  list: () => ok(st().projects),
  create: (input: ProjectInput) => {
    const created = st().createProject(input)
    fire(() =>
      http.post(API_ENDPOINTS.POST_create_project, {
        organization: orgId(),
        name: input.name,
        description: input.description,
        icon: input.icon,
        project_type: input.type === 'Kanban' ? 'kanban' : 'software',
        lead: num(input.leadId),
        member_ids: input.memberIds.map((id) => num(id)).filter((n): n is number => n != null),
      }),
    )
    return ok(created)
  },
  toggleStar: (projectId: string) => ok(st().toggleStarProject(projectId)),
  get: (id: string) => ok(st().projects.find((p) => p.id === id)),
  update: (id: string, patch: Partial<ProjectInput>) => {
    st().updateProject(id, patch)
    fire(() => http.patch(API_ENDPOINTS.UPDATE_project, { id: num(id) ?? id, ...patch }))
    return ok(st().projects.find((p) => p.id === id))
  },
  remove: (id: string) => {
    fire(() => http.delete(API_ENDPOINTS.DELETE_project, { id: num(id) ?? id }))
    return ok(undefined)
  },
  summary: (_id: string) => ok(null),
  addMember: (projectId: string, userId: string, roleId?: number) => {
    fire(() =>
      http.post(API_ENDPOINTS.POST_create_project_member, {
        project: num(projectId) ?? projectId,
        user: num(userId) ?? userId,
        role: roleId,
      }),
    )
    return ok(undefined)
  },
  listMembers: (_projectId: string) => ok([]),
  removeMember: (id: string) => {
    fire(() => http.delete(API_ENDPOINTS.DELETE_project_member, { id: num(id) ?? id }))
    return ok(undefined)
  },
}

export const workItemService = {
  list: () => ok(st().items),
  get: (id: string) => ok(st().items.find((i) => i.id === id)),
  create: (input: WorkItemInput): Promise<WorkItem> => {
    const user = st().users.find((u) => u.id === st().currentUserId)
    if (!canCreateWorkItems(user)) return Promise.reject(new Error('You do not have permission to create work items.'))
    const created = st().createItem(input)
    fire(async () => {
      const body = await workItemCreateBody(input)
      await http.post(API_ENDPOINTS.POST_create_work_item, body)
    })
    return ok(created)
  },
  update: (id: string, patch: WorkItemPatch) => {
    st().updateItem(id, patch)
    const pk = num(id) ?? id
    if (patch.status && Object.keys(patch).every((k) => k === 'status' || k === 'updatedAt')) {
      fire(() =>
        http.post(API_ENDPOINTS.POST_update_work_item_status, {
          id: pk,
          status: patch.status,
          changed_by: actorId(),
        }),
      )
    } else {
      fire(() =>
        http.patch(API_ENDPOINTS.UPDATE_work_item, {
          id: pk,
          summary: patch.summary,
          description: patch.description,
          priority: patch.priority,
          original_estimate: patch.originalEstimate != null ? patch.originalEstimate / 60 : undefined,
          assignee: patch.assigneeId !== undefined ? num(patch.assigneeId) : undefined,
          reporter: patch.reporterId !== undefined ? num(patch.reporterId) : undefined,
          parent: patch.parentId !== undefined ? num(patch.parentId) : undefined,
          due_date: patch.dueDate,
          start_date: patch.startDate,
          sprint: patch.sprintId !== undefined ? num(patch.sprintId) : undefined,
          story_point_estimate: patch.storyPoints,
          changed_by: actorId(),
        }),
      )
      if (patch.status) {
        fire(() =>
          http.post(API_ENDPOINTS.POST_update_work_item_status, {
            id: pk,
            status: patch.status,
            changed_by: actorId(),
          }),
        )
      }
      if (patch.sprintId) {
        fire(() =>
          http.post(API_ENDPOINTS.POST_add_work_item_to_sprint, {
            sprint: num(patch.sprintId) ?? patch.sprintId,
            work_item: pk,
          }),
        )
      }
    }
    return ok(undefined)
  },
  move: (id: string, destProjectId: string, type?: IssueType): Promise<WorkItem | null> => {
    const moved = st().moveItem(id, destProjectId, type)
    fire(() =>
      http.post(API_ENDPOINTS.POST_move_work_item, {
        id: num(id) ?? id,
        destination_project_id: num(destProjectId) ?? destProjectId,
      }),
    )
    return ok(moved)
  },
  bulkUpdate: (ids: string[], patch: WorkItemPatch) => {
    ids.forEach((id) => {
      st().updateItem(id, patch)
      fire(() => http.patch(API_ENDPOINTS.UPDATE_work_item, { id: num(id) ?? id, ...patch, changed_by: actorId() }))
    })
    return ok(undefined)
  },
  remove: (id: string) => {
    st().deleteItem(id)
    fire(() => http.delete(API_ENDPOINTS.DELETE_work_item, { id: num(id) ?? id }))
    return ok(undefined)
  },
  addLink: (id: string, type: LinkType, targetId: string) => {
    st().addLink(id, type, targetId)
    fire(() =>
      http.post(API_ENDPOINTS.POST_create_work_item_relationship, {
        source_work_item: num(id) ?? id,
        target_work_item: num(targetId) ?? targetId,
        relationship_type: type,
      }),
    )
    return ok(undefined)
  },
  removeLink: (id: string, type: LinkType, targetId: string) => {
    st().removeLink(id, type, targetId)
    fire(() => http.get(API_ENDPOINTS.GET_work_item_relationships, { work_item_id: num(id) ?? id }).then(async (rows) => {
      const list = Array.isArray(rows) ? rows : []
      const match = list.find((r) => {
        const rec = r as Record<string, unknown>
        return String(rec.relationship_type ?? rec.type) === type
      }) as Record<string, unknown> | undefined
      if (match?.id != null) await http.delete(API_ENDPOINTS.DELETE_work_item_relationship, { id: match.id as string | number })
    }))
    return ok(undefined)
  },
  toggleWatch: (id: string) => ok(st().toggleWatch(id)),
  toggleStar: (id: string) => ok(st().toggleStarItem(id)),
  recordView: (id: string) => ok(st().recordView(id)),
  board: (projectId: string) => ok(st().items.filter((i) => i.projectId === projectId)),
  assignedToMe: (userId: string) => ok(st().items.filter((i) => i.assigneeId === userId)),
}

export const sprintService = {
  create: (projectId: string, input?: { name?: string; goal?: string; startDate?: string | null; endDate?: string | null }) => {
    const created = st().createSprint(projectId, input)
    fire(() =>
      http.post(API_ENDPOINTS.POST_create_sprint, {
        project: num(projectId) ?? projectId,
        name: input?.name ?? created.name,
        goal: input?.goal ?? '',
        start_date: input?.startDate ?? null,
        end_date: input?.endDate ?? null,
        status: 'planned',
      }),
    )
    return ok(created)
  },
  update: (sprintId: string, patch: { name?: string; goal?: string; startDate?: string | null; endDate?: string | null }) => {
    st().updateSprint(sprintId, patch)
    fire(() =>
      http.patch(API_ENDPOINTS.UPDATE_sprint, {
        id: num(sprintId) ?? sprintId,
        name: patch.name,
        goal: patch.goal,
        start_date: patch.startDate,
        end_date: patch.endDate,
      }),
    )
    return ok(undefined)
  },
  remove: (sprintId: string) => {
    st().deleteSprint(sprintId)
    fire(() => http.delete(API_ENDPOINTS.DELETE_sprint, { id: num(sprintId) ?? sprintId }))
    return ok(undefined)
  },
  start: (sprintId: string, input?: { name: string; goal: string; startDate: string; endDate: string }) => {
    if (input) st().startSprint(sprintId, input)
    else st().setSprintState(sprintId, 'active')
    fire(() =>
      http.patch(API_ENDPOINTS.UPDATE_sprint, {
        id: num(sprintId) ?? sprintId,
        status: 'active',
        name: input?.name,
        goal: input?.goal,
        start_date: input?.startDate,
        end_date: input?.endDate,
      }),
    )
    return ok(undefined)
  },
  complete: (sprintId: string, moveIncompleteTo: string | null) => {
    st().completeSprint(sprintId, moveIncompleteTo)
    fire(() =>
      http.post(API_ENDPOINTS.POST_complete_sprint, {
        sprint_id: num(sprintId) ?? sprintId,
        ...(moveIncompleteTo
          ? { move_to_sprint_id: num(moveIncompleteTo) ?? moveIncompleteTo }
          : { move_to_backlog: true }),
      }),
    )
    return ok(undefined)
  },
  list: (projectId: string) => ok(st().sprints.filter((s) => s.projectId === projectId)),
}

export const commentService = {
  add: (itemId: string, body: string) => {
    st().addComment(itemId, body)
    fire(() =>
      http.post(API_ENDPOINTS.POST_create_comment, {
        work_item: num(itemId) ?? itemId,
        employee: actorId(),
        comment_text: body,
      }),
    )
    return ok(undefined)
  },
  edit: (id: string, body: string) => {
    st().editComment(id, body)
    fire(() => http.patch(API_ENDPOINTS.UPDATE_comment, { id: num(id) ?? id, comment_text: body }))
    return ok(undefined)
  },
  remove: (id: string) => {
    st().deleteComment(id)
    fire(() => http.delete(API_ENDPOINTS.DELETE_comment, { id: num(id) ?? id }))
    return ok(undefined)
  },
  list: (itemId: string) => ok(st().comments.filter((c) => c.itemId === itemId)),
}

export const worklogService = {
  add: (itemId: string, date: string, minutes: number, description: string) => {
    st().addWorklog(itemId, date, minutes, description)
    fire(() =>
      http.post(API_ENDPOINTS.POST_create_worklog, {
        work_item: num(itemId) ?? itemId,
        employee: actorId(),
        work_date: date,
        time_spent: minutes / 60,
        work_description: description,
      }),
    )
    return ok(undefined)
  },
  remove: (id: string) => {
    st().deleteWorklog(id)
    fire(() => http.delete(API_ENDPOINTS.DELETE_worklog, { id: num(id) ?? id }))
    return ok(undefined)
  },
  list: (_filters?: { workItemId?: string; employeeId?: string; projectId?: string }) => ok(st().worklogs),
}

export const filterService = {
  create: (name: string, jql: string): Promise<SavedFilter> => {
    const created = st().saveFilter(name, jql)
    fire(() =>
      http.post(API_ENDPOINTS.POST_create_saved_filter, {
        user: actorId(),
        name,
        search_criteria: jql,
        is_starred: false,
      }),
    )
    return ok(created)
  },
  update: (id: string, patch: Partial<Pick<SavedFilter, 'name' | 'jql' | 'starred'>>) => {
    st().updateFilter(id, patch)
    fire(() =>
      http.patch(API_ENDPOINTS.UPDATE_saved_filter, {
        id: num(id) ?? id,
        name: patch.name,
        search_criteria: patch.jql,
        is_starred: patch.starred,
      }),
    )
    return ok(undefined)
  },
  remove: (id: string) => {
    st().deleteFilter(id)
    fire(() => http.delete(API_ENDPOINTS.DELETE_saved_filter, { id: num(id) ?? id }))
    return ok(undefined)
  },
  list: (_userId?: string) => ok(st().savedFilters),
}

export const notificationService = {
  markRead: (id: string) => {
    st().markNotificationRead(id)
    fire(() => http.post(API_ENDPOINTS.POST_mark_notification_read, { id: num(id) ?? id }))
    return ok(undefined)
  },
  markAllRead: () => {
    const mine = st().notifications.filter((n) => n.userId === st().currentUserId && !n.read)
    st().markAllNotificationsRead()
    mine.forEach((n) => fire(() => http.post(API_ENDPOINTS.POST_mark_notification_read, { id: num(n.id) ?? n.id })))
    return ok(undefined)
  },
  list: (_userId?: string) => ok(st().notifications),
  create: (userId: string, workItemId: string | null, message: string, eventType: string) => {
    fire(() =>
      http.post(API_ENDPOINTS.POST_create_notification, {
        user: num(userId) ?? userId,
        work_item: workItemId ? num(workItemId) ?? workItemId : null,
        message,
        event_type: eventType,
        is_read: false,
      }),
    )
    return ok(undefined)
  },
}

export const personalSettingsService = {
  get: () => {
    const id = st().currentUserId
    return ok(id ? mergePersonalSettings(st().personalSettings[id]) : mergePersonalSettings())
  },
  update: (patch: Partial<PersonalSettings>) => ok(st().updatePersonalSettings(patch)),
}

function unwrapUsersPayload(json: unknown): unknown {
  if (json && typeof json === 'object' && 'success' in json) {
    const env = json as { success?: boolean; data?: unknown; message?: string }
    if (env.success === false) throw new Error(env.message || 'Failed to load users')
    if (env.data !== undefined) return env.data
  }
  return json
}

function extractUserRows(data: unknown): Record<string, unknown>[] {
  const rec = asRecord(data)
  const raw = asList<unknown>(data)
  const rows = raw.length ? raw : asList<unknown>(rec.data)
  return rows.map((row) => {
    const r = asRecord(row)
    const nested = asRecord(r.user ?? r.account ?? r.profile)
    return {
      ...nested,
      ...r,
      display_name: r.display_name ?? r.name ?? r.username ?? nested.display_name ?? nested.username ?? nested.name,
      email: r.email ?? r.email_address ?? nested.email ?? nested.email_address,
      last_seen_at: r.last_seen_at ?? r.last_seen ?? r.last_login ?? nested.last_login ?? nested.last_seen_at,
    }
  })
}

async function fetchDirectoryUsers(params?: Record<string, string | number | boolean | null | undefined>) {
  const payload = await http.get(API_ENDPOINTS.GET_all_users, params)
  return unwrapUsersPayload(payload)
}

export const userAdminService = {
  list: async () => {
    let organization_id = orgId()
    if (!organization_id) {
      try {
        organization_id = await apiOrgId()
      } catch {
        organization_id = undefined
      }
    }
    const load = async (params?: Record<string, string | number | boolean | null | undefined>) => {
      return await fetchDirectoryUsers(params)
    }
    let payload = await load(organization_id ? { organization_id } : undefined)
    let rec = asRecord(payload)
    let rows = extractUserRows(payload)
    if (!rows.length && organization_id) {
      payload = await load(undefined)
      rec = asRecord(payload)
      rows = extractUserRows(payload)
    }
    const count = Number(rec.count ?? rec.total ?? rec.total_users ?? 0)
    const pageSize = rows.length
    if (count > rows.length && pageSize > 0) {
      const pages = Math.ceil(count / pageSize)
      for (let page = 2; page <= pages && page <= 100; page += 1) {
        const more = await load(organization_id ? { organization_id, page } : { page })
        rows = rows.concat(extractUserRows(more))
      }
    }
    return rows.map((r, i) => mapUser(r, i))
  },
  groups: () => ok(st().groups),
  apps: () => ok(st().orgApps),
  auditLogs: () => ok(st().auditLogs),
  invite: async (input: InviteUsersInput) => {
    const user = st().users.find((u) => u.id === st().currentUserId)
    if (!canManageUsers(user)) throw new Error('You do not have permission to invite users.')
    await http.post(API_ENDPOINTS.POST_invite_users, {
      email: input.emails[0] ?? '',
      email_addresses: input.emails.join(','),
      username: input.username,
      password: input.password,
      role: input.role,
      administrator_access: adminAccessApi(input.adminAccess),
      app_selection: input.appAccess[0]?.appId ?? 'Taskflow',
      app_roles: input.appAccess[0]?.role ?? 'User',
      group_membership: st().groups.filter((g) => input.groupIds.includes(g.id)).map((g) => g.name).join(',') || undefined,
      personalize_invitation: input.message,
      send_email_invite: input.sendEmail,
      organization_id: orgId(),
      administrator_id: actorId(),
    })
    try {
      return st().inviteUsers(input)
    } catch {
      return {
        invitation: {
          id: 'api-invite',
          emails: input.emails,
          userIds: [],
          adminAccess: input.adminAccess,
          appAccess: input.appAccess,
          groupIds: input.groupIds,
          message: input.message,
          sendEmail: input.sendEmail,
          emailDelivery: 'not-requested',
          invitedBy: String(st().currentUserId ?? ''),
          createdAt: new Date().toISOString(),
          errors: [],
        },
        created: input.emails.map((email) => ({ id: email, email }) as User),
        errors: [],
      }
    }
  },
  acceptInvite: async (userId: string) => {
    await http.post(API_ENDPOINTS.POST_activate_user, { user_id: num(userId) ?? userId })
    st().setUserStatus(userId, 'active')
  },
  setStatus: (userId: string, accountStatus: AccountStatus) => {
    st().setUserStatus(userId, accountStatus)
    if (accountStatus === 'active') {
      fire(() => http.post(API_ENDPOINTS.POST_activate_user, { user_id: num(userId) ?? userId }))
    } else {
      fire(() =>
        http.patch(API_ENDPOINTS.UPDATE_user, {
          id: num(userId) ?? userId,
          account_status: accountStatusApi(accountStatus),
        }),
      )
    }
    return ok(undefined)
  },
  setAdminAccess: (userId: string, adminAccess: AdminAccess) => {
    st().setUserAdminAccess(userId, adminAccess)
    fire(() =>
      http.patch(API_ENDPOINTS.UPDATE_user, {
        id: num(userId) ?? userId,
        admin_access: adminAccessApi(adminAccess),
      }),
    )
    return ok(undefined)
  },
  get: (id: string) => ok(st().users.find((u) => u.id === id)),
  summary: (_organizationId?: string) => ok(null),
}

export const roleService = {
  create: (name: string, description = '') => {
    fire(() => http.post(API_ENDPOINTS.POST_create_role, { name, description }))
    return ok(undefined)
  },
  list: () => ok([]),
  get: (_id: string | number) => ok(null),
  update: (id: string | number, patch: Record<string, unknown>) => {
    fire(() => http.patch(API_ENDPOINTS.UPDATE_role, { id, ...patch }))
    return ok(undefined)
  },
  remove: (id: string | number) => {
    fire(() => http.delete(API_ENDPOINTS.DELETE_role, { id }))
    return ok(undefined)
  },
  createPermission: (name: string, codename: string, description = '') => {
    fire(() => http.post(API_ENDPOINTS.POST_create_permission, { name, codename, description }))
    return ok(undefined)
  },
  listPermissions: () => ok([]),
  getPermission: (_id: string | number) => ok(null),
  updatePermission: (id: string | number, patch: Record<string, unknown>) => {
    fire(() => http.patch(API_ENDPOINTS.UPDATE_permission, { id, ...patch }))
    return ok(undefined)
  },
  removePermission: (id: string | number) => {
    fire(() => http.delete(API_ENDPOINTS.DELETE_permission, { id }))
    return ok(undefined)
  },
  assign: (role: number, permission: number) => {
    fire(() => http.post(API_ENDPOINTS.POST_create_role_permission, { role, permission }))
    return ok(undefined)
  },
  listRolePermissions: () => ok([]),
  removeRolePermission: (id: string | number) => {
    fire(() => http.delete(API_ENDPOINTS.DELETE_role_permission, { id }))
    return ok(undefined)
  },
}

export const teamService = {
  create: (name: string, description = '') => {
    fire(() => http.post(API_ENDPOINTS.POST_create_team, { organization: orgId(), name, description }))
    return ok(undefined)
  },
  list: () => ok([]),
  get: (_id: string | number) => ok(null),
  update: (id: string | number, patch: Record<string, unknown>) => {
    fire(() => http.patch(API_ENDPOINTS.UPDATE_team, { id, ...patch }))
    return ok(undefined)
  },
  remove: (id: string | number) => {
    fire(() => http.delete(API_ENDPOINTS.DELETE_team, { id }))
    return ok(undefined)
  },
}

export const workMetaService = {
  createWorkItemType: (name: string, description = '') => {
    fire(() => http.post(API_ENDPOINTS.POST_create_work_item_type, { name, description }))
    return ok(undefined)
  },
  listWorkItemTypes: () => ok([]),
  updateWorkItemType: (id: string | number, patch: Record<string, unknown>) => {
    fire(() => http.patch(API_ENDPOINTS.UPDATE_work_item_type, { id, ...patch }))
    return ok(undefined)
  },
  removeWorkItemType: (id: string | number) => {
    fire(() => http.delete(API_ENDPOINTS.DELETE_work_item_type, { id }))
    return ok(undefined)
  },
  createStatus: (name: string, projectId: string, isDefault = false) => {
    fire(() => http.post(API_ENDPOINTS.POST_create_status, { name, project: num(projectId) ?? projectId, is_default: isDefault }))
    return ok(undefined)
  },
  listStatuses: (_projectId?: string) => ok([]),
  getStatus: (_id: string | number) => ok(null),
  updateStatus: (id: string | number, patch: Record<string, unknown>) => {
    fire(() => http.patch(API_ENDPOINTS.UPDATE_status, { id, ...patch }))
    return ok(undefined)
  },
  removeStatus: (id: string | number) => {
    fire(() => http.delete(API_ENDPOINTS.DELETE_status, { id }))
    return ok(undefined)
  },
  createWorkflow: (projectId: string, name: string) => {
    fire(() => http.post(API_ENDPOINTS.POST_create_workflow, { project: num(projectId) ?? projectId, name }))
    return ok(undefined)
  },
  listWorkflows: (_projectId: string) => ok([]),
  updateWorkflow: (id: string | number, patch: Record<string, unknown>) => {
    fire(() => http.patch(API_ENDPOINTS.UPDATE_workflow, { id, ...patch }))
    return ok(undefined)
  },
  removeWorkflow: (id: string | number) => {
    fire(() => http.delete(API_ENDPOINTS.DELETE_workflow, { id }))
    return ok(undefined)
  },
  createTransition: (workflow: number, fromStatus: number, toStatus: number) => {
    fire(() => http.post(API_ENDPOINTS.POST_create_workflow_transition, { workflow, from_status: fromStatus, to_status: toStatus }))
    return ok(undefined)
  },
  listTransitions: (_workflowId: string | number) => ok([]),
  removeTransition: (id: string | number) => {
    fire(() => http.delete(API_ENDPOINTS.DELETE_workflow_transition, { id }))
    return ok(undefined)
  },
  listLabels: (_projectId: string) => ok([]),
  createLabel: (projectId: string, name: string) => {
    fire(() => http.post(API_ENDPOINTS.POST_create_label, { project: num(projectId) ?? projectId, name }))
    return ok(undefined)
  },
  removeLabel: (id: string | number) => {
    fire(() => http.delete(API_ENDPOINTS.DELETE_label, { id }))
    return ok(undefined)
  },
  createVersion: (projectId: string, name: string, description = '') => {
    fire(() => http.post(API_ENDPOINTS.POST_create_project_version, { project: num(projectId) ?? projectId, name, description }))
    return ok(undefined)
  },
  listVersions: (_projectId: string) => ok([]),
  updateVersion: (id: string | number, patch: Record<string, unknown>) => {
    fire(() => http.patch(API_ENDPOINTS.UPDATE_project_version, { id, ...patch }))
    return ok(undefined)
  },
  removeVersion: (id: string | number) => {
    fire(() => http.delete(API_ENDPOINTS.DELETE_project_version, { id }))
    return ok(undefined)
  },
  createComponent: (projectId: string, name: string, description = '') => {
    fire(() => http.post(API_ENDPOINTS.POST_create_component, { project: num(projectId) ?? projectId, name, description }))
    return ok(undefined)
  },
  listComponents: (_projectId: string) => ok([]),
  updateComponent: (id: string | number, patch: Record<string, unknown>) => {
    fire(() => http.patch(API_ENDPOINTS.UPDATE_component, { id, ...patch }))
    return ok(undefined)
  },
  removeComponent: (id: string | number) => {
    fire(() => http.delete(API_ENDPOINTS.DELETE_component, { id }))
    return ok(undefined)
  },
  activity: (_workItemId: string) => ok([]),
  createAttachment: (workItemId: string, fileName: string, filePath: string) => {
    fire(() =>
      http.post(API_ENDPOINTS.POST_create_attachment, {
        work_item: num(workItemId) ?? workItemId,
        file_name: fileName,
        file_path: filePath,
        uploaded_by: actorId(),
      }),
    )
    return ok(undefined)
  },
  listAttachments: (_workItemId: string) => ok([]),
  removeAttachment: (id: string | number) => {
    fire(() => http.delete(API_ENDPOINTS.DELETE_attachment, { id }))
    return ok(undefined)
  },
}

/** GET list APIs — once per page load (StrictMode-safe). Does not replace UI seed data. */
let pageLoadOnce: Promise<void> | null = null

export function fetchOnPageLoad() {
  if (pageLoadOnce) return pageLoadOnce
  pageLoadOnce = runPageLoadGets()
  return pageLoadOnce
}

async function runPageLoadGets() {
  const uid = actorId()
  let orgPk = orgId()
  try {
    const orgs = asList<Record<string, unknown>>(await http.get(API_ENDPOINTS.GET_all_organizations))
    const first = Number(orgs[0]?.id)
    if (Number.isFinite(first)) orgPk = first
  } catch (err) {
    console.warn('[taskflow-api]', err)
  }
  const projects = asList<Record<string, unknown>>(
    await http.get(API_ENDPOINTS.GET_all_projects, { organization_id: orgPk, user_id: uid }).catch(() => []),
  )
  await Promise.all([
    http.get(API_ENDPOINTS.GET_all_users, { organization_id: orgPk }).catch(() => []),
    http.get(API_ENDPOINTS.GET_all_roles).catch(() => []),
    http.get(API_ENDPOINTS.GET_all_work_item_types).catch(() => []),
    http.get(API_ENDPOINTS.GET_all_teams, { organization_id: orgPk }).catch(() => []),
    http.get(API_ENDPOINTS.GET_all_statuses).catch(() => []),
    uid ? http.get(API_ENDPOINTS.GET_all_notifications, { user_id: uid }).catch(() => []) : Promise.resolve([]),
    uid ? http.get(API_ENDPOINTS.GET_all_saved_filters, { user_id: uid }).catch(() => []) : Promise.resolve([]),
  ])
  const projectIds = projects.map((p) => Number(p.id)).filter((id) => Number.isFinite(id))
  await Promise.all(
    projectIds.map((pid) =>
      Promise.all([
        http.get(API_ENDPOINTS.GET_all_work_items, { project_id: pid }).catch(() => []),
        http.get(API_ENDPOINTS.GET_all_sprints, { project_id: pid }).catch(() => []),
      ]),
    ),
  )
}
