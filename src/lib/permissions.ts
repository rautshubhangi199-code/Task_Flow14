import type { Project, Role, User } from '../types'

export type NavKey = 'forYou' | 'recent' | 'starred' | 'apps' | 'plans' | 'spaces' | 'filters' | 'dashboards' | 'assets' | 'teams' | 'goals'

/** Which roles can see each sidebar module. */
export const NAV_ACCESS: Record<NavKey, Role[]> = {
  forYou: ['Admin', 'Project Manager', 'Project Coordinator', 'Developer', 'QA'],
  recent: ['Admin', 'Project Manager', 'Project Coordinator', 'Developer', 'QA'],
  starred: ['Admin', 'Project Manager', 'Project Coordinator', 'Developer', 'QA'],
  apps: ['Admin'],
  plans: ['Admin', 'Project Manager', 'Project Coordinator'],
  spaces: ['Admin', 'Project Manager', 'Project Coordinator', 'Developer', 'QA'],
  filters: ['Admin', 'Project Manager', 'Project Coordinator', 'Developer', 'QA'],
  dashboards: ['Admin', 'Project Manager', 'Project Coordinator', 'Developer', 'QA'],
  assets: ['Admin', 'Project Manager'],
  teams: ['Admin', 'Project Manager', 'Project Coordinator', 'Developer', 'QA'],
  goals: ['Admin', 'Project Manager', 'Project Coordinator'],
}

export const canSee = (user: User | undefined, key: NavKey) => !!user && NAV_ACCESS[key].includes(user.role)

export const canAccessProject = (user: User | undefined, _project: Project) => !!user

export const canCreateSpace = (user: User | undefined) => !!user && (user.role === 'Admin' || user.role === 'Project Manager')

export const canManageSprints = (user: User | undefined) =>
  !!user && ['Admin', 'Project Manager', 'Project Coordinator'].includes(user.role)

export const canSeeAllWorklogs = (user: User | undefined) =>
  !!user && ['Admin', 'Project Manager', 'Project Coordinator'].includes(user.role)

export const canAccessSettings = (user: User | undefined) =>
  !!user && (user.role === 'Admin' || user.orgAdmin || user.adminAccess === 'org-admin' || user.adminAccess === 'user-access-admin')

export const canManageUsers = canAccessSettings

/** Invite users, create tasks, and add epics — Admin only. */
export const canCreateWorkItems = canAccessSettings

export const canGrantOrgAdmin = (user: User | undefined) =>
  !!user && (user.role === 'Admin' || user.orgAdmin || user.adminAccess === 'org-admin')
