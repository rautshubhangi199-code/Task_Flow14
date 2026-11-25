import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { addDays, format } from 'date-fns'
import { buildSeed, type SeedData } from '../data/seed'
import type {
  AccountStatus,
  AdminAccess,
  AppNotification,
  AuditLog,
  HistoryEntry,
  Invitation,
  InviteUsersInput,
  InviteUsersResult,
  LinkType,
  PersonalSettings,
  Project,
  SavedFilter,
  Sprint,
  SprintState,
  User,
  WorkItem,
  WorkItemInput,
  IssueType,
} from '../types'
import { formatDuration, isDone, nowIso, todayStr, uid } from '../lib/utils'
import {
  defaultGroups,
  defaultOrgApps,
  EMAIL_RE,
  nameFromEmail,
  normalizeUser,
  roleFromAppAccess,
  USER_COLORS,
} from '../lib/adminUsers'
import { canCreateWorkItems, canGrantOrgAdmin, canManageUsers } from '../lib/permissions'
import { mergePersonalSettings } from '../lib/personalSettings'

export type WorkItemPatch = Partial<Omit<WorkItem, 'id' | 'projectId' | 'createdAt'>>

export interface ProjectInput {
  name: string
  key: string
  description: string
  icon: string
  type: Project['type']
  leadId: string
  memberIds: string[]
}

export interface AppState extends SeedData {
  currentUserId: string | null
  starredItems: Record<string, string[]>
  starredProjects: Record<string, string[]>
  personalSettings: Record<string, PersonalSettings>

  login: (userId: string) => void
  logout: () => void
  resetDemo: () => void

  createProject: (input: ProjectInput) => Project
  toggleStarProject: (projectId: string) => void

  createItem: (input: WorkItemInput) => WorkItem
  updateItem: (id: string, patch: WorkItemPatch) => void
  moveItem: (id: string, destProjectId: string, type?: IssueType) => WorkItem | null
  deleteItem: (id: string) => void
  toggleStarItem: (id: string) => void
  toggleWatch: (id: string) => void
  addLink: (id: string, type: LinkType, targetId: string) => void
  removeLink: (id: string, type: LinkType, targetId: string) => void
  recordView: (id: string) => void

  createSprint: (projectId: string, input?: Partial<Pick<Sprint, 'name' | 'goal' | 'startDate' | 'endDate'>>) => Sprint
  updateSprint: (sprintId: string, patch: Partial<Pick<Sprint, 'name' | 'goal' | 'startDate' | 'endDate'>>) => void
  deleteSprint: (sprintId: string) => void
  startSprint: (sprintId: string, input: { name: string; goal: string; startDate: string; endDate: string }) => void
  setSprintState: (sprintId: string, state: SprintState) => void
  completeSprint: (sprintId: string, moveIncompleteTo: string | null) => void

  addComment: (itemId: string, body: string) => void
  editComment: (id: string, body: string) => void
  deleteComment: (id: string) => void

  addWorklog: (itemId: string, date: string, minutes: number, description: string) => void
  deleteWorklog: (id: string) => void

  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  checkDueNotifications: () => void

  saveFilter: (name: string, jql: string) => SavedFilter
  updateFilter: (id: string, patch: Partial<Pick<SavedFilter, 'name' | 'jql' | 'starred'>>) => void
  deleteFilter: (id: string) => void

  inviteUsers: (input: InviteUsersInput) => InviteUsersResult
  setUserStatus: (userId: string, accountStatus: AccountStatus) => void
  setUserAdminAccess: (userId: string, adminAccess: AdminAccess) => void
  updatePersonalSettings: (patch: Partial<PersonalSettings>) => PersonalSettings
}

const REVERSE_LINK: Record<LinkType, LinkType> = {
  'Relates to': 'Relates to',
  Blocks: 'Is blocked by',
  'Is blocked by': 'Blocks',
  Duplicates: 'Is duplicated by',
  'Is duplicated by': 'Duplicates',
}

const FIELD_LABELS: Partial<Record<keyof WorkItem, string>> = {
  type: 'Type',
  summary: 'Summary',
  description: 'Description',
  status: 'Status',
  priority: 'Priority',
  originalEstimate: 'Original Estimate',
  assigneeId: 'Assignee',
  reporterId: 'Reporter',
  labels: 'Labels',
  parentId: 'Parent',
  dueDate: 'Due Date',
  startDate: 'Start Date',
  team: 'Team',
  sprintId: 'Sprint',
  storyPoints: 'Story Points',
}

function display(state: SeedData, field: keyof WorkItem, value: unknown): string {
  if (value === null || value === undefined || value === '') return 'None'
  switch (field) {
    case 'assigneeId':
    case 'reporterId':
      return state.users.find((u) => u.id === value)?.name ?? String(value)
    case 'sprintId':
      return state.sprints.find((s) => s.id === value)?.name ?? String(value)
    case 'labels':
      return (value as string[]).length ? (value as string[]).join(', ') : 'None'
    case 'originalEstimate':
      return formatDuration(value as number)
    case 'description':
      return String(value).length > 80 ? `${String(value).slice(0, 80)}…` : String(value)
    default:
      return String(value)
  }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

export const useStore = create<AppState>()(
  persist(
    (set, get) => {
      const actor = () => get().currentUserId ?? 'u1'
      const actorName = () => get().users.find((u) => u.id === actor())?.name ?? 'Someone'
      const prefsFor = (userId: string) => mergePersonalSettings(get().personalSettings[userId])
      const notify = (userIds: (string | null | undefined)[], n: Omit<AppNotification, 'id' | 'userId' | 'createdAt' | 'read'>) => {
        const me = actor()
        const targets = [...new Set(userIds.filter((u): u is string => !!u))]
          .filter((userId) => {
            const p = prefsFor(userId)
            if (!p.notifyOwnChanges && userId === me) return false
            if (!p.inAppEnabled) return false
            if (!p.inApp[n.type]) return false
            return true
          })
        if (!targets.length) return [] as AppNotification[]
        return targets.map((userId) => ({ ...n, id: uid('n'), userId, createdAt: nowIso(), read: false }))
      }

      return {
        ...buildSeed(),
        currentUserId: null,
        starredItems: { u1: ['CP-10', 'INT-5'] },
        starredProjects: { u1: ['p1'], u2: ['p1', 'p2'] },
        personalSettings: {},

        login: (userId) => {
          set((s) => ({
            currentUserId: userId,
            users: s.users.map((u) => (u.id === userId ? { ...u, lastSeenAt: nowIso(), accountStatus: u.accountStatus === 'invited' ? 'active' : u.accountStatus } : u)),
          }))
          get().checkDueNotifications()
        },
        logout: () => set({ currentUserId: null }),
        resetDemo: () => set({ ...buildSeed(), starredItems: {}, starredProjects: {}, personalSettings: {} }),

        createProject: (input) => {
          const project: Project = {
            id: uid('p'),
            key: input.key.toUpperCase(),
            name: input.name,
            description: input.description,
            icon: input.icon || '📁',
            type: input.type,
            leadId: input.leadId,
            memberIds: [...new Set([...input.memberIds, input.leadId, actor()])],
            createdAt: nowIso(),
            counter: 0,
          }
          set((s) => ({ projects: [...s.projects, project] }))
          return project
        },
        toggleStarProject: (projectId) =>
          set((s) => {
            const me = actor()
            const list = s.starredProjects[me] ?? []
            return {
              starredProjects: {
                ...s.starredProjects,
                [me]: list.includes(projectId) ? list.filter((x) => x !== projectId) : [...list, projectId],
              },
            }
          }),

        createItem: (input) => {
          const s = get()
          const actorUser = s.users.find((u) => u.id === actor())
          if (!canCreateWorkItems(actorUser)) throw new Error('You do not have permission to create work items.')
          const project = s.projects.find((p) => p.id === input.projectId)
          if (!project) throw new Error('Project not found')
          const counter = project.counter + 1
          const now = nowIso()
          const watch = prefsFor(actor()).watchOwnIssues
          const item: WorkItem = {
            ...input,
            id: `${project.key}-${counter}`,
            links: [],
            watcherIds: watch ? [...new Set([input.reporterId, input.assigneeId, actor()].filter((x): x is string => !!x))] : [],
            createdAt: now,
            updatedAt: now,
            resolvedAt: isDone(input.status) ? now : null,
          }
          const h: HistoryEntry = { id: uid('h'), itemId: item.id, userId: actor(), field: 'Created', oldValue: '', newValue: item.summary, timestamp: now }
          const notes = item.assigneeId
            ? notify([item.assigneeId], { type: 'assigned', message: `${actorName()} assigned ${item.id} "${item.summary}" to you`, itemId: item.id })
            : []
          set({
            items: [...s.items, item],
            projects: s.projects.map((p) => (p.id === project.id ? { ...p, counter } : p)),
            history: [...s.history, h],
            notifications: [...notes, ...s.notifications],
          })
          return item
        },

        updateItem: (id, patch) => {
          const s = get()
          const item = s.items.find((i) => i.id === id)
          if (!item) return
          const now = nowIso()
          const entries: HistoryEntry[] = []
          for (const key of Object.keys(patch) as (keyof WorkItemPatch)[]) {
            const label = FIELD_LABELS[key]
            if (!label) continue
            if (same(item[key], patch[key])) continue
            entries.push({
              id: uid('h'),
              itemId: id,
              userId: actor(),
              field: label,
              oldValue: display(s, key, item[key]),
              newValue: display(s, key, patch[key]),
              timestamp: now,
            })
          }
          if (!entries.length) return
          const next: WorkItem = { ...item, ...patch, updatedAt: now }
          if (patch.status && patch.status !== item.status) {
            next.resolvedAt = isDone(patch.status) ? now : null
          }
          let notes: AppNotification[] = []
          if (patch.assigneeId !== undefined && patch.assigneeId !== item.assigneeId && patch.assigneeId) {
            notes = notes.concat(notify([patch.assigneeId], { type: 'assigned', message: `${actorName()} assigned ${id} "${item.summary}" to you`, itemId: id }))
            if (!next.watcherIds.includes(patch.assigneeId)) next.watcherIds = [...next.watcherIds, patch.assigneeId]
          }
          if (patch.status && patch.status !== item.status) {
            notes = notes.concat(
              notify([next.assigneeId, next.reporterId, ...next.watcherIds], { type: 'status', message: `${actorName()} moved ${id} "${item.summary}" from ${item.status} to ${patch.status}`, itemId: id }),
            )
          }
          set({
            items: s.items.map((i) => (i.id === id ? next : i)),
            history: [...s.history, ...entries],
            notifications: [...notes, ...s.notifications],
          })
        },

        moveItem: (id, destProjectId, type) => {
          const s = get()
          const item = s.items.find((i) => i.id === id)
          const dest = s.projects.find((p) => p.id === destProjectId)
          if (!item || !dest) return null
          if (item.projectId === dest.id) {
            if (type && type !== item.type) get().updateItem(id, { type })
            return get().items.find((i) => i.id === id) ?? item
          }

          const moving = new Set<string>([id])
          let grew = true
          while (grew) {
            grew = false
            for (const i of s.items) {
              if (i.parentId && moving.has(i.parentId) && !moving.has(i.id)) {
                moving.add(i.id)
                grew = true
              }
            }
          }

          let counter = dest.counter
          const idMap: Record<string, string> = {}
          const ordered = [id, ...[...moving].filter((x) => x !== id)]
          for (const oldId of ordered) {
            counter += 1
            idMap[oldId] = `${dest.key}-${counter}`
          }
          const swap = (value: string) => idMap[value] ?? value
          const now = nowIso()
          const destHasSprint = (sprintId: string | null) =>
            !!sprintId && s.sprints.some((sp) => sp.id === sprintId && sp.projectId === dest.id)

          const items = s.items.map((i) => {
            const links = i.links.map((l) => ({ ...l, targetId: swap(l.targetId) }))
            if (!moving.has(i.id)) {
              return { ...i, parentId: i.parentId ? swap(i.parentId) : i.parentId, links }
            }
            const parentStays =
              i.parentId && !moving.has(i.parentId)
                ? s.items.find((p) => p.id === i.parentId)?.projectId === dest.id
                  ? i.parentId
                  : null
                : i.parentId
                  ? swap(i.parentId)
                  : null
            return {
              ...i,
              id: idMap[i.id],
              projectId: dest.id,
              type: i.id === id && type ? type : i.type,
              parentId: parentStays,
              sprintId: destHasSprint(i.sprintId) ? i.sprintId : null,
              links,
              updatedAt: now,
            }
          })

          const comments = s.comments.map((c) => (moving.has(c.itemId) ? { ...c, itemId: swap(c.itemId) } : c))
          const worklogs = s.worklogs.map((w) => (moving.has(w.itemId) ? { ...w, itemId: swap(w.itemId) } : w))
          const history = [
            ...s.history.map((h) => (moving.has(h.itemId) ? { ...h, itemId: swap(h.itemId) } : h)),
            {
              id: uid('h'),
              itemId: idMap[id],
              userId: actor(),
              field: 'Project',
              oldValue: item.id,
              newValue: idMap[id],
              timestamp: now,
            },
          ]
          const notifications = s.notifications.map((n) =>
            n.itemId && moving.has(n.itemId) ? { ...n, itemId: swap(n.itemId) } : n,
          )
          const views = s.views.map((v) => (moving.has(v.itemId) ? { ...v, itemId: swap(v.itemId) } : v))
          const starredItems = Object.fromEntries(
            Object.entries(s.starredItems).map(([uidKey, ids]) => [uidKey, ids.map((x) => swap(x))]),
          )

          set({
            items,
            comments,
            worklogs,
            history,
            notifications,
            views,
            starredItems,
            projects: s.projects.map((p) => (p.id === dest.id ? { ...p, counter } : p)),
          })
          return items.find((i) => i.id === idMap[id]) ?? null
        },

        deleteItem: (id) =>
          set((s) => {
            const toDelete = new Set<string>([id])
            let grew = true
            while (grew) {
              grew = false
              for (const i of s.items) if (i.parentId && toDelete.has(i.parentId) && !toDelete.has(i.id)) { toDelete.add(i.id); grew = true }
            }
            return {
              items: s.items.filter((i) => !toDelete.has(i.id)).map((i) => ({ ...i, links: i.links.filter((l) => !toDelete.has(l.targetId)) })),
              comments: s.comments.filter((c) => !toDelete.has(c.itemId)),
              worklogs: s.worklogs.filter((w) => !toDelete.has(w.itemId)),
            }
          }),

        toggleStarItem: (id) =>
          set((s) => {
            const me = actor()
            const list = s.starredItems[me] ?? []
            return { starredItems: { ...s.starredItems, [me]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] } }
          }),

        toggleWatch: (id) =>
          set((s) => {
            const me = actor()
            return {
              items: s.items.map((i) =>
                i.id === id ? { ...i, watcherIds: i.watcherIds.includes(me) ? i.watcherIds.filter((w) => w !== me) : [...i.watcherIds, me] } : i,
              ),
            }
          }),

        addLink: (id, type, targetId) => {
          if (id === targetId) return
          const s = get()
          const now = nowIso()
          set({
            items: s.items.map((i) => {
              if (i.id === id && !i.links.some((l) => l.type === type && l.targetId === targetId)) return { ...i, links: [...i.links, { type, targetId }], updatedAt: now }
              if (i.id === targetId && !i.links.some((l) => l.type === REVERSE_LINK[type] && l.targetId === id)) return { ...i, links: [...i.links, { type: REVERSE_LINK[type], targetId: id }] }
              return i
            }),
            history: [...s.history, { id: uid('h'), itemId: id, userId: actor(), field: 'Link', oldValue: '', newValue: `${type} ${targetId}`, timestamp: now }],
          })
        },
        removeLink: (id, type, targetId) => {
          const s = get()
          set({
            items: s.items.map((i) => {
              if (i.id === id) return { ...i, links: i.links.filter((l) => !(l.type === type && l.targetId === targetId)) }
              if (i.id === targetId) return { ...i, links: i.links.filter((l) => !(l.type === REVERSE_LINK[type] && l.targetId === id)) }
              return i
            }),
            history: [...s.history, { id: uid('h'), itemId: id, userId: actor(), field: 'Link', oldValue: `${type} ${targetId}`, newValue: '', timestamp: nowIso() }],
          })
        },

        recordView: (id) =>
          set((s) => {
            const me = actor()
            const rest = s.views.filter((v) => !(v.userId === me && v.itemId === id))
            return { views: [{ userId: me, itemId: id, at: nowIso() }, ...rest].slice(0, 200) }
          }),

        createSprint: (projectId, input) => {
          const s = get()
          const project = s.projects.find((p) => p.id === projectId)
          const n = s.sprints.filter((sp) => sp.projectId === projectId).length + 1
          const sprint: Sprint = {
            id: uid('s'),
            projectId,
            name: input?.name?.trim() || `${project?.key ?? 'PRJ'} Sprint ${n}`,
            goal: input?.goal ?? '',
            state: 'planned',
            startDate: input?.startDate ?? null,
            endDate: input?.endDate ?? null,
            completedAt: null,
          }
          set({ sprints: [...s.sprints, sprint] })
          return sprint
        },
        updateSprint: (sprintId, patch) => {
          const sp = get().sprints.find((s) => s.id === sprintId)
          if (!sp) throw new Error('Sprint not found.')
          if (patch.name !== undefined && !patch.name.trim()) throw new Error('Sprint name is required.')
          if (patch.startDate && patch.endDate && patch.startDate > patch.endDate) throw new Error('End date must be on or after the start date.')
          set((s) => ({
            sprints: s.sprints.map((x) => (x.id === sprintId ? { ...x, ...patch, name: patch.name?.trim() ?? x.name } : x)),
          }))
        },
        deleteSprint: (sprintId) => {
          const s = get()
          const sp = s.sprints.find((x) => x.id === sprintId)
          if (!sp) throw new Error('Sprint not found.')
          if (sp.state === 'active') throw new Error('Complete the sprint before deleting it.')
          if (sp.state === 'completed') throw new Error('Completed sprints cannot be deleted.')
          for (const it of s.items.filter((i) => i.sprintId === sprintId)) get().updateItem(it.id, { sprintId: null })
          set((st) => ({ sprints: st.sprints.filter((x) => x.id !== sprintId) }))
        },
        startSprint: (sprintId, input) => {
          const s = get()
          const sp = s.sprints.find((x) => x.id === sprintId)
          if (!sp) throw new Error('Sprint not found.')
          if (sp.state !== 'planned') throw new Error('Only a planned sprint can be started.')
          if (s.sprints.some((x) => x.projectId === sp.projectId && x.state === 'active')) {
            throw new Error('Complete the active sprint before starting another.')
          }
          if (!input.name.trim()) throw new Error('Sprint name is required.')
          if (!input.startDate || !input.endDate) throw new Error('Start and end dates are required.')
          if (input.startDate > input.endDate) throw new Error('End date must be on or after the start date.')
          set({
            sprints: s.sprints.map((x) =>
              x.id === sprintId
                ? { ...x, state: 'active' as const, name: input.name.trim(), goal: input.goal, startDate: input.startDate, endDate: input.endDate }
                : x,
            ),
          })
        },
        setSprintState: (sprintId, state) => {
          if (state === 'active') {
            const sp = get().sprints.find((x) => x.id === sprintId)
            get().startSprint(sprintId, {
              name: sp?.name ?? 'Sprint',
              goal: sp?.goal ?? '',
              startDate: sp?.startDate ?? todayStr(),
              endDate: sp?.endDate ?? format(addDays(new Date(), 14), 'yyyy-MM-dd'),
            })
            return
          }
          set((s) => ({ sprints: s.sprints.map((sp) => (sp.id === sprintId ? { ...sp, state } : sp)) }))
        },
        completeSprint: (sprintId, moveIncompleteTo) => {
          const s = get()
          const sp = s.sprints.find((x) => x.id === sprintId)
          if (!sp) throw new Error('Sprint not found.')
          if (sp.state !== 'active') throw new Error('Only an active sprint can be completed.')
          const incomplete = s.items.filter((i) => i.sprintId === sprintId && !isDone(i.status))
          for (const it of incomplete) get().updateItem(it.id, { sprintId: moveIncompleteTo })
          set((st) => ({ sprints: st.sprints.map((x) => (x.id === sprintId ? { ...x, state: 'completed', completedAt: nowIso(), endDate: x.endDate ?? todayStr() } : x)) }))
        },

        addComment: (itemId, body) => {
          const s = get()
          const item = s.items.find((i) => i.id === itemId)
          const notes = item
            ? notify([item.assigneeId, item.reporterId, ...item.watcherIds], { type: 'comment', message: `${actorName()} commented on ${itemId} "${item.summary}"`, itemId })
            : []
          set({
            comments: [...s.comments, { id: uid('c'), itemId, authorId: actor(), body, createdAt: nowIso(), updatedAt: null }],
            notifications: [...notes, ...s.notifications],
          })
        },
        editComment: (id, body) => set((s) => ({ comments: s.comments.map((c) => (c.id === id ? { ...c, body, updatedAt: nowIso() } : c)) })),
        deleteComment: (id) => set((s) => ({ comments: s.comments.filter((c) => c.id !== id) })),

        addWorklog: (itemId, date, minutes, description) => {
          const s = get()
          set({
            worklogs: [...s.worklogs, { id: uid('w'), itemId, userId: actor(), date, minutes, description, createdAt: nowIso() }],
            history: [...s.history, { id: uid('h'), itemId, userId: actor(), field: 'Time Spent', oldValue: '', newValue: formatDuration(minutes), timestamp: nowIso() }],
          })
        },
        deleteWorklog: (id) => set((s) => ({ worklogs: s.worklogs.filter((w) => w.id !== id) })),

        markNotificationRead: (id) => set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
        markAllNotificationsRead: () =>
          set((s) => ({ notifications: s.notifications.map((n) => (n.userId === s.currentUserId ? { ...n, read: true } : n)) })),
        checkDueNotifications: () => {
          const s = get()
          const me = s.currentUserId
          if (!me) return
          const today = todayStr()
          const soon = format(addDays(new Date(), 2), 'yyyy-MM-dd')
          const fresh: AppNotification[] = []
          for (const i of s.items) {
            if (i.assigneeId !== me || !i.dueDate || isDone(i.status)) continue
            const type = i.dueDate < today ? 'overdue' : i.dueDate <= soon ? 'due' : null
            if (!type) continue
            if (s.notifications.some((n) => n.userId === me && n.itemId === i.id && n.type === type)) continue
            const p = prefsFor(me)
            if (!p.inAppEnabled || !p.inApp[type]) continue
            fresh.push({
              id: uid('n'),
              userId: me,
              type,
              message: type === 'overdue' ? `${i.id} "${i.summary}" is overdue (due ${i.dueDate})` : `${i.id} "${i.summary}" is due soon (${i.dueDate})`,
              itemId: i.id,
              createdAt: nowIso(),
              read: false,
            })
          }
          if (fresh.length) set({ notifications: [...fresh, ...s.notifications] })
        },

        saveFilter: (name, jql) => {
          const f: SavedFilter = { id: uid('f'), name, jql, ownerId: actor(), starred: false, createdAt: nowIso() }
          set((s) => ({ savedFilters: [...s.savedFilters, f] }))
          return f
        },
        updateFilter: (id, patch) => set((s) => ({ savedFilters: s.savedFilters.map((f) => (f.id === id ? { ...f, ...patch } : f)) })),
        deleteFilter: (id) => set((s) => ({ savedFilters: s.savedFilters.filter((f) => f.id !== id) })),

        inviteUsers: (input) => {
          const s = get()
          const actorUser = s.users.find((u) => u.id === actor())
          if (!canManageUsers(actorUser)) {
            throw new Error('You do not have permission to invite users.')
          }
          const errors: string[] = []
          const emails = [...new Set(input.emails.map((e) => e.trim().toLowerCase()).filter(Boolean))]
          if (!emails.length) errors.push('Enter at least one email address.')
          for (const email of emails) {
            if (!EMAIL_RE.test(email)) errors.push(`Invalid email address: ${email}`)
          }
          if (input.message.length > 500) errors.push('Invitation message cannot exceed 500 characters.')
          if (input.adminAccess !== 'none' && input.adminAccess !== 'org-admin' && input.adminAccess !== 'user-access-admin') {
            errors.push('Select a valid administrator access level.')
          }
          if (input.adminAccess === 'org-admin' && !canGrantOrgAdmin(actorUser)) {
            errors.push('You are not allowed to assign organization admin access.')
          }
          const knownGroups = new Set(s.groups.map((g) => g.id))
          for (const gid of input.groupIds) {
            if (!knownGroups.has(gid)) errors.push(`Unknown group: ${gid}`)
          }
          const knownApps = new Set(s.orgApps.map((a) => a.id))
          for (const access of input.appAccess) {
            const app = s.orgApps.find((a) => a.id === access.appId)
            if (!app || !knownApps.has(access.appId)) errors.push(`Unknown application: ${access.appId}`)
            else if (!app.roles.includes(access.role)) errors.push(`Invalid role "${access.role}" for ${app.name}`)
          }
          const existing = new Set(s.users.map((u) => u.email.toLowerCase()))
          const uniqueNew = emails.filter((email) => EMAIL_RE.test(email) && !existing.has(email))
          for (const email of emails) {
            if (EMAIL_RE.test(email) && existing.has(email)) errors.push(`${email} already has an account.`)
          }
          if (!uniqueNew.length && emails.length) {
            const invitation: Invitation = {
              id: uid('inv'),
              emails,
              userIds: [],
              adminAccess: input.adminAccess,
              appAccess: input.appAccess,
              groupIds: input.groupIds,
              message: input.message,
              sendEmail: input.sendEmail,
              emailDelivery: 'not-requested',
              invitedBy: actor(),
              createdAt: nowIso(),
              errors,
            }
            return { invitation, created: [], errors }
          }
          if (errors.some((e) => e.startsWith('You do not') || e.includes('organization admin') || e.includes('500 characters') || e.startsWith('Unknown') || e.startsWith('Invalid role'))) {
            throw new Error(errors[0])
          }
          if (errors.length && !uniqueNew.length) {
            const invitation: Invitation = {
              id: uid('inv'),
              emails,
              userIds: [],
              adminAccess: input.adminAccess,
              appAccess: input.appAccess,
              groupIds: input.groupIds,
              message: input.message,
              sendEmail: input.sendEmail,
              emailDelivery: 'not-requested',
              invitedBy: actor(),
              createdAt: nowIso(),
              errors,
            }
            return { invitation, created: [], errors }
          }

          const created: User[] = uniqueNew.map((email, idx) => {
            const orgAdmin = input.adminAccess === 'org-admin'
            return {
              id: uid('u'),
              name: nameFromEmail(email),
              email,
              role: roleFromAppAccess(input.appAccess, input.adminAccess),
              team: s.groups.find((g) => g.id === input.groupIds[0])?.name ?? '',
              color: USER_COLORS[idx % USER_COLORS.length],
              accountStatus: 'invited',
              accountType: 'atlassian',
              managed: false,
              orgAdmin,
              adminAccess: input.adminAccess,
              lastSeenAt: null,
              appAccess: input.appAccess,
              groupIds: input.groupIds,
              invitedAt: nowIso(),
            }
          })
          const emailDelivery: Invitation['emailDelivery'] = input.sendEmail ? 'backend-required' : 'not-requested'
          const invitation: Invitation = {
            id: uid('inv'),
            emails,
            userIds: created.map((u) => u.id),
            adminAccess: input.adminAccess,
            appAccess: input.appAccess,
            groupIds: input.groupIds,
            message: input.message,
            sendEmail: input.sendEmail,
            emailDelivery,
            invitedBy: actor(),
            createdAt: nowIso(),
            errors,
          }
          const audit: AuditLog = {
            id: uid('aud'),
            actorId: actor(),
            action: 'users.invite',
            target: created.map((u) => u.email).join(', '),
            details: `Invited ${created.length} user(s); adminAccess=${input.adminAccess}; apps=${input.appAccess.map((a) => `${a.appId}:${a.role}`).join(',') || 'none'}; groups=${input.groupIds.join(',') || 'none'}; sendEmail=${input.sendEmail}`,
            createdAt: nowIso(),
          }
          set((st) => ({
            users: [...st.users, ...created],
            invitations: [invitation, ...st.invitations],
            auditLogs: [audit, ...st.auditLogs],
          }))
          return { invitation, created, errors }
        },

        setUserStatus: (userId, accountStatus) => {
          const s = get()
          const actorUser = s.users.find((u) => u.id === actor())
          if (!canManageUsers(actorUser)) throw new Error('You do not have permission to change user status.')
          const target = s.users.find((u) => u.id === userId)
          if (!target) throw new Error('User not found.')
          if (userId === actor() && accountStatus === 'deactivated') throw new Error('You cannot deactivate your own account.')
          const audit: AuditLog = {
            id: uid('aud'),
            actorId: actor(),
            action: 'users.status',
            target: target.email,
            details: `${target.accountStatus} → ${accountStatus}`,
            createdAt: nowIso(),
          }
          set((st) => ({
            users: st.users.map((u) => (u.id === userId ? { ...u, accountStatus } : u)),
            auditLogs: [audit, ...st.auditLogs],
          }))
        },

        setUserAdminAccess: (userId, adminAccess) => {
          const s = get()
          const actorUser = s.users.find((u) => u.id === actor())
          if (!canManageUsers(actorUser)) throw new Error('You do not have permission to change administrator access.')
          if (adminAccess === 'org-admin' && !canGrantOrgAdmin(actorUser)) {
            throw new Error('You are not allowed to assign organization admin access.')
          }
          const target = s.users.find((u) => u.id === userId)
          if (!target) throw new Error('User not found.')
          if (userId === actor() && adminAccess === 'none' && (target.orgAdmin || target.adminAccess === 'org-admin')) {
            throw new Error('You cannot remove your own organization admin access.')
          }
          const orgAdmin = adminAccess === 'org-admin'
          const role = orgAdmin ? 'Admin' : target.role === 'Admin' ? 'Project Manager' : target.role
          const audit: AuditLog = {
            id: uid('aud'),
            actorId: actor(),
            action: 'users.admin-access',
            target: target.email,
            details: `${target.adminAccess} → ${adminAccess}`,
            createdAt: nowIso(),
          }
          set((st) => ({
            users: st.users.map((u) => (u.id === userId ? { ...u, adminAccess, orgAdmin, role } : u)),
            auditLogs: [audit, ...st.auditLogs],
          }))
        },

        updatePersonalSettings: (patch) => {
          const me = actor()
          const current = mergePersonalSettings(get().personalSettings[me])
          const next = mergePersonalSettings({
            ...current,
            ...patch,
            inApp: { ...current.inApp, ...patch.inApp },
            email: { ...current.email, ...patch.email },
            mentioned: { ...current.mentioned, ...patch.mentioned },
            worklog: { ...current.worklog, ...patch.worklog },
          })
          set((s) => ({ personalSettings: { ...s.personalSettings, [me]: next } }))
          return next
        },
      }
    },
    {
      name: 'taskflow-state-v1',
      version: 5,
      migrate: (persisted, version) => {
        const s = persisted as SeedData & { currentUserId: string | null; starredItems: Record<string, string[]>; starredProjects: Record<string, string[]>; personalSettings?: Record<string, PersonalSettings> }
        if (version < 2) {
          s.groups = s.groups?.length ? s.groups : defaultGroups()
          s.orgApps = s.orgApps?.length ? s.orgApps : defaultOrgApps()
          s.invitations = s.invitations ?? []
          s.auditLogs = s.auditLogs ?? []
          s.users = (s.users ?? []).map((u) => normalizeUser(u, s.views))
        }
        if (version < 3) s.personalSettings = s.personalSettings ?? {}
        if (version < 4 || !s.projects?.some((p) => p.key === 'VIS')) {
          const fresh = buildSeed()
          const visProject = fresh.projects.find((p) => p.key === 'VIS')
          if (visProject && !s.projects?.some((p) => p.key === 'VIS')) {
            s.projects = [...(s.projects ?? []), visProject]
          }
          const visItems = fresh.items.filter((i) => i.id.startsWith('VIS-'))
          const existingItemIds = new Set((s.items ?? []).map((i) => i.id))
          const newItems = visItems.filter((i) => !existingItemIds.has(i.id))
          if (newItems.length > 0) {
            s.items = [...(s.items ?? []), ...newItems]
          }
          const visSprints = fresh.sprints.filter((sp) => sp.projectId === 'p4')
          const existingSprintIds = new Set((s.sprints ?? []).map((sp) => sp.id))
          const newSprints = visSprints.filter((sp) => !existingSprintIds.has(sp.id))
          if (newSprints.length > 0) {
            s.sprints = [...(s.sprints ?? []), ...newSprints]
          }
        }
        if (version < 5 || !s.projects?.some((p) => p.key === 'OT')) {
          const fresh = buildSeed()
          const otProject = fresh.projects.find((p) => p.key === 'OT')
          if (otProject && !s.projects?.some((p) => p.key === 'OT')) {
            s.projects = [...(s.projects ?? []), otProject]
          }
          const otItems = fresh.items.filter((i) => i.id.startsWith('OT-'))
          const existingItemIds = new Set((s.items ?? []).map((i) => i.id))
          const newItems = otItems.filter((i) => !existingItemIds.has(i.id))
          if (newItems.length > 0) {
            s.items = [...(s.items ?? []), ...newItems]
          }
          const otSprints = fresh.sprints.filter((sp) => sp.projectId === 'p5')
          const existingSprintIds = new Set((s.sprints ?? []).map((sp) => sp.id))
          const newSprints = otSprints.filter((sp) => !existingSprintIds.has(sp.id))
          if (newSprints.length > 0) {
            s.sprints = [...(s.sprints ?? []), ...newSprints]
          }
        }
        return s
      },
    },
  ),
)
