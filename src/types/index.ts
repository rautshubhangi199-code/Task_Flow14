export type Role = 'Admin' | 'Project Manager' | 'Project Coordinator' | 'Developer' | 'QA'

export interface Organization {
  id: string
  name: string
}

export type AccountStatus = 'active' | 'invited' | 'deactivated'
export type AccountType = 'atlassian' | 'customer'
export type AdminAccess = 'none' | 'org-admin' | 'user-access-admin'

export interface AppAccess {
  appId: string
  role: string
}

export interface OrgApp {
  id: string
  name: string
  plan: string
  roles: string[]
}

export interface UserGroup {
  id: string
  name: string
}

export interface User {
  id: string
  name: string
  email: string
  role: Role
  team: string
  color: string
  accountStatus: AccountStatus
  accountType: AccountType
  managed: boolean
  orgAdmin: boolean
  adminAccess: AdminAccess
  lastSeenAt: string | null
  appAccess: AppAccess[]
  groupIds: string[]
  invitedAt: string | null
}

export interface Invitation {
  id: string
  emails: string[]
  userIds: string[]
  adminAccess: AdminAccess
  appAccess: AppAccess[]
  groupIds: string[]
  message: string
  sendEmail: boolean
  emailDelivery: 'not-requested' | 'recorded' | 'backend-required'
  invitedBy: string
  createdAt: string
  errors: string[]
}

export interface AuditLog {
  id: string
  actorId: string
  action: string
  target: string
  details: string
  createdAt: string
}

export interface InviteUsersInput {
  emails: string[]
  adminAccess: AdminAccess
  appAccess: AppAccess[]
  groupIds: string[]
  message: string
  sendEmail: boolean
}

export interface InviteUsersResult {
  invitation: Invitation
  created: User[]
  errors: string[]
}

export type ProjectType = 'Scrum' | 'Kanban'

export interface Project {
  id: string
  key: string
  name: string
  description: string
  icon: string
  type: ProjectType
  leadId: string
  memberIds: string[]
  createdAt: string
  counter: number
}

export const ISSUE_TYPES = ['Epic', 'Story', 'Task', 'Subtask', 'Bug'] as const
export type IssueType = (typeof ISSUE_TYPES)[number]

export const STATUSES = [
  'To Do',
  'In Progress',
  'Developers Done',
  'QA-Done',
  'Done',
  'Reject',
  'On Hold',
  'Drop',
] as const
export type Status = (typeof STATUSES)[number]

export const DONE_STATUSES: Status[] = ['Done', 'Reject', 'Drop']

export const PRIORITIES = ['Highest', 'High', 'Medium', 'Low', 'Lowest'] as const
export type Priority = (typeof PRIORITIES)[number]

export const LINK_TYPES = ['Relates to', 'Blocks', 'Is blocked by', 'Duplicates', 'Is duplicated by'] as const
export type LinkType = (typeof LINK_TYPES)[number]

export interface WorkItemLink {
  type: LinkType
  targetId: string
}

export interface WorkItem {
  id: string // e.g. PROJ-12
  projectId: string
  type: IssueType
  summary: string
  description: string
  status: Status
  priority: Priority
  originalEstimate: number | null // minutes
  assigneeId: string | null
  reporterId: string
  labels: string[]
  parentId: string | null
  dueDate: string | null // yyyy-MM-dd
  startDate: string | null
  team: string | null
  sprintId: string | null
  storyPoints: number | null
  links: WorkItemLink[]
  watcherIds: string[]
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
}

export type SprintState = 'planned' | 'active' | 'completed'

export interface Sprint {
  id: string
  projectId: string
  name: string
  goal: string
  state: SprintState
  startDate: string | null
  endDate: string | null
  completedAt: string | null
}

export interface Comment {
  id: string
  itemId: string
  authorId: string
  body: string
  createdAt: string
  updatedAt: string | null
}

export interface WorkLog {
  id: string
  itemId: string
  userId: string
  date: string // yyyy-MM-dd
  minutes: number
  description: string
  createdAt: string
}

export interface HistoryEntry {
  id: string
  itemId: string
  userId: string
  field: string
  oldValue: string
  newValue: string
  timestamp: string
}

export type NotificationType = 'assigned' | 'status' | 'comment' | 'due' | 'overdue'

export type NotifyChannel = { inProduct: boolean; email: boolean }

export interface SpaceNotificationSettings {
  projectId: string
  assigned: NotifyChannel
  mentioned: NotifyChannel
  workItemChanges: NotifyChannel
  commentChanges: NotifyChannel
  worklog: NotifyChannel
}

export interface PersonalSettings {
  language: string
  timeZone: string
  autoTimeZone: boolean
  dateTimeFormat: 'relative' | 'absolute'
  watchOwnIssues: boolean
  notifyOwnChanges: boolean
  keyboardShortcuts: boolean
  emailEnabled: boolean
  inAppEnabled: boolean
  inApp: Record<NotificationType, boolean>
  email: Record<NotificationType, boolean>
  emailWhenAssignee: boolean
  emailWhenReporter: boolean
  groupEmails: boolean
  groupEmailInterval: '1' | '3' | '10' | '15' | '30' | '60'
  emailFormat: 'html' | 'text'
  mentioned: NotifyChannel
  worklog: NotifyChannel
  spaceNotifications: SpaceNotificationSettings[]
  digestDaily: boolean
  digestWeekly: boolean
}

export interface AppNotification {
  id: string
  userId: string
  type: NotificationType
  message: string
  itemId: string | null
  createdAt: string
  read: boolean
}

export interface SavedFilter {
  id: string
  name: string
  ownerId: string
  jql: string
  starred: boolean
  createdAt: string
}

export interface ViewEntry {
  userId: string
  itemId: string
  at: string
}

export const TEAMS = ['Platform', 'Web', 'Mobile', 'Quality'] as const

export type WorkItemInput = Omit<
  WorkItem,
  'id' | 'createdAt' | 'updatedAt' | 'resolvedAt' | 'links' | 'watcherIds'
>
