/**
 * API service layer. Every function here maps 1:1 to a future Django REST endpoint
 * (documented in the comment above each one). Today they read/write the local mock
 * store (persisted to localStorage); swap the bodies for `http` calls later without
 * touching the UI components.
 */
import { useStore, type ProjectInput, type WorkItemPatch } from '../store/useStore'
import { mergePersonalSettings } from '../lib/personalSettings'
import type { AccountStatus, AdminAccess, InviteUsersInput, IssueType, LinkType, PersonalSettings, SavedFilter, WorkItem, WorkItemInput } from '../types'

const st = () => useStore.getState()
const ok = <T>(value: T) => Promise.resolve(value)

export const authService = {
  /** POST /auth/login */
  login: (userId: string) => ok(st().login(userId)),
  /** POST /auth/logout */
  logout: () => ok(st().logout()),
  /** POST /demo/reset (mock only) */
  resetDemo: () => ok(st().resetDemo()),
}

export const projectService = {
  /** GET /projects */
  list: () => ok(st().projects),
  /** POST /projects */
  create: (input: ProjectInput) => ok(st().createProject(input)),
  /** POST /projects/:id/star */
  toggleStar: (projectId: string) => ok(st().toggleStarProject(projectId)),
}

export const workItemService = {
  /** GET /work-items */
  list: () => ok(st().items),
  /** GET /work-items/:key */
  get: (id: string) => ok(st().items.find((i) => i.id === id)),
  /** POST /work-items */
  create: (input: WorkItemInput): Promise<WorkItem> => ok(st().createItem(input)),
  /** PATCH /work-items/:key */
  update: (id: string, patch: WorkItemPatch) => ok(st().updateItem(id, patch)),
  /** POST /work-items/:key/move */
  move: (id: string, destProjectId: string, type?: IssueType): Promise<WorkItem | null> => ok(st().moveItem(id, destProjectId, type)),
  /** PATCH /work-items/bulk */
  bulkUpdate: (ids: string[], patch: WorkItemPatch) => ok(ids.forEach((id) => st().updateItem(id, patch))),
  /** DELETE /work-items/:key */
  remove: (id: string) => ok(st().deleteItem(id)),
  /** POST /work-items/:key/links */
  addLink: (id: string, type: LinkType, targetId: string) => ok(st().addLink(id, type, targetId)),
  /** DELETE /work-items/:key/links */
  removeLink: (id: string, type: LinkType, targetId: string) => ok(st().removeLink(id, type, targetId)),
  /** POST /work-items/:key/watch */
  toggleWatch: (id: string) => ok(st().toggleWatch(id)),
  /** POST /work-items/:key/star */
  toggleStar: (id: string) => ok(st().toggleStarItem(id)),
  /** POST /work-items/:key/view */
  recordView: (id: string) => ok(st().recordView(id)),
}

export const sprintService = {
  /** POST /projects/:id/sprints */
  create: (projectId: string, input?: { name?: string; goal?: string; startDate?: string | null; endDate?: string | null }) =>
    ok(st().createSprint(projectId, input)),
  /** PATCH /sprints/:id */
  update: (sprintId: string, patch: { name?: string; goal?: string; startDate?: string | null; endDate?: string | null }) =>
    ok(st().updateSprint(sprintId, patch)),
  /** DELETE /sprints/:id */
  remove: (sprintId: string) => ok(st().deleteSprint(sprintId)),
  /** POST /sprints/:id/start */
  start: (sprintId: string, input?: { name: string; goal: string; startDate: string; endDate: string }) => {
    if (input) return ok(st().startSprint(sprintId, input))
    return ok(st().setSprintState(sprintId, 'active'))
  },
  /** POST /sprints/:id/complete */
  complete: (sprintId: string, moveIncompleteTo: string | null) => ok(st().completeSprint(sprintId, moveIncompleteTo)),
}

export const commentService = {
  /** POST /work-items/:key/comments */
  add: (itemId: string, body: string) => ok(st().addComment(itemId, body)),
  /** PATCH /comments/:id */
  edit: (id: string, body: string) => ok(st().editComment(id, body)),
  /** DELETE /comments/:id */
  remove: (id: string) => ok(st().deleteComment(id)),
}

export const worklogService = {
  /** POST /work-items/:key/worklogs */
  add: (itemId: string, date: string, minutes: number, description: string) => ok(st().addWorklog(itemId, date, minutes, description)),
  /** DELETE /worklogs/:id */
  remove: (id: string) => ok(st().deleteWorklog(id)),
}

export const filterService = {
  /** POST /filters */
  create: (name: string, jql: string): Promise<SavedFilter> => ok(st().saveFilter(name, jql)),
  /** PATCH /filters/:id */
  update: (id: string, patch: Partial<Pick<SavedFilter, 'name' | 'jql' | 'starred'>>) => ok(st().updateFilter(id, patch)),
  /** DELETE /filters/:id */
  remove: (id: string) => ok(st().deleteFilter(id)),
}

export const notificationService = {
  /** POST /notifications/:id/read */
  markRead: (id: string) => ok(st().markNotificationRead(id)),
  /** POST /notifications/read-all */
  markAllRead: () => ok(st().markAllNotificationsRead()),
}

/**
 * Directory & invitations. Swap these bodies for `http` calls when Django is ready:
 * GET    /admin/users
 * GET    /admin/users/summary
 * POST   /admin/users/invite          body: InviteUsersInput  (sends SMTP when sendEmail=true)
 * POST   /admin/invitations/:id/send  outbound email — required for real invites
 * PATCH  /admin/users/:id/status
 * PATCH  /admin/users/:id/admin-access
 * GET    /admin/groups
 * GET    /admin/apps
 * GET    /admin/audit-logs
 */
/**
 * Personal Jira settings. Map to Django when available:
 * GET  /users/me/settings
 * PATCH /users/me/settings
 * POST /users/me/notifications/email  — required to actually send email
 */
export const personalSettingsService = {
  get: () => {
    const id = st().currentUserId
    return ok(id ? mergePersonalSettings(st().personalSettings[id]) : mergePersonalSettings())
  },
  update: (patch: Partial<PersonalSettings>) => ok(st().updatePersonalSettings(patch)),
}

export const userAdminService = {
  list: () => ok(st().users),
  groups: () => ok(st().groups),
  apps: () => ok(st().orgApps),
  auditLogs: () => ok(st().auditLogs),
  invite: (input: InviteUsersInput) => ok(st().inviteUsers(input)),
  setStatus: (userId: string, accountStatus: AccountStatus) => ok(st().setUserStatus(userId, accountStatus)),
  setAdminAccess: (userId: string, adminAccess: AdminAccess) => ok(st().setUserAdminAccess(userId, adminAccess)),
}
