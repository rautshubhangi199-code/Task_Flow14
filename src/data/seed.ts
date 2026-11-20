import { addDays, format, subHours } from 'date-fns'
import type {
  AppNotification,
  AuditLog,
  Comment,
  HistoryEntry,
  Invitation,
  IssueType,
  OrgApp,
  Organization,
  Priority,
  Project,
  SavedFilter,
  Sprint,
  Status,
  User,
  UserGroup,
  ViewEntry,
  WorkItem,
  WorkLog,
} from '../types'
import { defaultGroups, defaultOrgApps, normalizeUser } from '../lib/adminUsers'

export interface SeedData {
  organization: Organization
  users: User[]
  projects: Project[]
  items: WorkItem[]
  sprints: Sprint[]
  comments: Comment[]
  worklogs: WorkLog[]
  history: HistoryEntry[]
  notifications: AppNotification[]
  savedFilters: SavedFilter[]
  views: ViewEntry[]
  groups: UserGroup[]
  orgApps: OrgApp[]
  invitations: Invitation[]
  auditLogs: AuditLog[]
}

const day = (offset: number) => format(addDays(new Date(), offset), 'yyyy-MM-dd')
const hoursAgo = (h: number) => subHours(new Date(), h).toISOString()

type Row = [
  id: string,
  type: IssueType,
  summary: string,
  status: Status,
  priority: Priority,
  assignee: string | null,
  reporter: string,
  parent: string | null,
  sprint: string | null,
  start: number | null,
  due: number | null,
  points: number | null,
  estimateH: number | null,
  labels: string[],
  team: string | null,
  createdHoursAgo: number,
]

const rows: Row[] = [
  // Customer Portal (CP)
  ['CP-1', 'Epic', 'User authentication & onboarding', 'In Progress', 'High', 'u2', 'u2', null, null, -20, 10, null, null, ['auth'], 'Web', 600],
  ['CP-2', 'Story', 'Login with email and password', 'Done', 'High', 'u4', 'u2', 'CP-1', 's2', -7, -2, 5, 16, ['auth', 'frontend'], 'Web', 500],
  ['CP-3', 'Story', 'Password reset flow', 'In Progress', 'Medium', 'u4', 'u3', 'CP-1', 's2', -5, 4, 3, 12, ['auth'], 'Web', 400],
  ['CP-4', 'Subtask', 'Reset email template', 'Developers Done', 'Low', 'u4', 'u3', 'CP-3', 's2', -4, 1, null, 4, [], 'Web', 380],
  ['CP-5', 'Subtask', 'Reset token API integration', 'To Do', 'Medium', 'u5', 'u3', 'CP-3', 's2', 0, 3, null, 6, ['api'], 'Platform', 370],
  ['CP-6', 'Bug', 'Login button misaligned on Safari', 'QA-Done', 'Medium', 'u6', 'u6', 'CP-1', 's2', -3, 0, 1, 2, ['ui', 'safari'], 'Quality', 200],
  ['CP-7', 'Epic', 'Billing dashboard', 'To Do', 'Medium', 'u2', 'u1', null, null, -2, 30, null, null, ['billing'], 'Web', 300],
  ['CP-8', 'Story', 'Invoice list view', 'To Do', 'Medium', 'u5', 'u2', 'CP-7', 's3', 8, 18, 5, 20, ['billing'], 'Web', 250],
  ['CP-9', 'Task', 'Integrate payment gateway SDK', 'To Do', 'High', 'u4', 'u2', 'CP-7', 's3', 8, 21, 8, 24, ['billing', 'api'], 'Platform', 240],
  ['CP-10', 'Task', 'Set up CI pipeline', 'In Progress', 'High', 'u5', 'u1', null, 's2', -6, -2, 3, 10, ['devops'], 'Platform', 450],
  ['CP-11', 'Bug', 'Session expires too early', 'To Do', 'Highest', null, 'u6', null, null, null, 6, 2, 4, ['auth'], null, 50],
  ['CP-12', 'Story', 'Profile settings page', 'On Hold', 'Low', 'u4', 'u2', 'CP-1', 's2', -2, 6, 3, 8, ['frontend'], 'Web', 150],
  ['CP-13', 'Task', 'Accessibility audit', 'To Do', 'Medium', 'u6', 'u3', null, null, null, 14, 2, 6, ['a11y'], 'Quality', 30],
  ['CP-14', 'Story', 'Legacy theme switcher', 'Drop', 'Lowest', null, 'u2', 'CP-7', null, null, null, 2, null, [], null, 700],
  ['CP-15', 'Task', 'Project scaffolding & repo setup', 'Done', 'Medium', 'u5', 'u1', null, 's1', -28, -20, 2, 6, ['devops'], 'Platform', 720],
  ['CP-16', 'Bug', 'Typo on signup page', 'Done', 'Low', 'u4', 'u6', 'CP-1', 's1', -22, -16, 1, 1, ['ui'], 'Web', 710],
  // Mobile App (MOB)
  ['MOB-1', 'Epic', 'Offline mode', 'In Progress', 'High', 'u2', 'u2', null, null, -10, 25, null, null, ['offline'], 'Mobile', 650],
  ['MOB-2', 'Story', 'Cache recent orders', 'In Progress', 'High', 'u5', 'u2', 'MOB-1', 's4', -3, 5, 5, 16, ['offline'], 'Mobile', 300],
  ['MOB-3', 'Subtask', 'SQLite storage layer', 'In Progress', 'Medium', 'u5', 'u3', 'MOB-2', 's4', -3, 2, null, 8, ['db'], 'Mobile', 290],
  ['MOB-4', 'Bug', 'Crash on Android 14 startup', 'To Do', 'Highest', 'u5', 'u6', null, 's4', 0, 1, 3, 6, ['android', 'crash'], 'Mobile', 20],
  ['MOB-5', 'Story', 'Push notifications', 'Developers Done', 'Medium', 'u5', 'u2', null, 's4', -3, 4, 5, 12, ['notifications'], 'Mobile', 280],
  ['MOB-6', 'Task', 'Regression test suite', 'To Do', 'Medium', 'u6', 'u3', null, 's4', 2, 9, 3, 10, ['qa'], 'Quality', 100],
  ['MOB-7', 'Story', 'Dark mode', 'To Do', 'Low', null, 'u2', null, null, null, null, 3, null, ['ui'], null, 80],
  ['MOB-8', 'Task', 'App store screenshots', 'Done', 'Low', 'u3', 'u2', null, 's4', -3, -1, 1, 3, ['release'], null, 260],
  // Internal Tools (INT)
  ['INT-1', 'Epic', 'HR leave tracker', 'In Progress', 'Medium', 'u3', 'u3', null, null, -15, 20, null, null, ['hr'], 'Platform', 800],
  ['INT-2', 'Task', 'Leave request form', 'In Progress', 'Medium', 'u4', 'u3', 'INT-1', null, -6, 3, 3, 8, ['hr', 'frontend'], 'Web', 400],
  ['INT-3', 'Task', 'Approval workflow', 'To Do', 'High', 'u3', 'u3', 'INT-1', null, 2, 12, 5, 16, ['hr'], 'Platform', 390],
  ['INT-4', 'Bug', 'Export CSV broken', 'Reject', 'Low', 'u4', 'u1', null, null, null, null, 1, 2, ['export'], null, 120],
  ['INT-5', 'Task', 'Admin audit log', 'To Do', 'High', 'u1', 'u1', null, null, 0, 3, 3, 10, ['security'], 'Platform', 60],
  // Vistaar (VIS)
  ['VIS-532', 'Epic', 'SEO-Friendly Landing Page Optimization', 'In Progress', 'High', 'u2', 'u2', null, null, -15, 20, null, null, ['seo'], 'Web', 500],
  ['VIS-533', 'Task', 'SEO-Friendly Landing Page Sections', 'In Progress', 'Medium', 'u4', 'u2', 'VIS-532', 's6', -5, 12, null, 8, ['seo', 'frontend'], 'Web', 300],
  // Ordinet Team (OT)
  ['OT-3', 'Epic', 'jira task assigning', 'In Progress', 'High', null, 'u2', null, 's7', -10, 20, null, null, ['tasks'], 'Web', 600],
  ['OT-4', 'Task', 'assigning tasks in sheet', 'Done', 'Medium', 'u4', 'u2', 'OT-3', 's7', -9, -5, 2, 8, ['tasks'], 'Web', 550],
  ['OT-6', 'Task', 'Server Managment', 'In Progress', 'High', 'u5', 'u2', null, 's7', -8, 5, 5, 16, ['devops'], 'Platform', 500],
  ['OT-8', 'Task', 'assigning tasks to employees', 'Done', 'Medium', 'u4', 'u2', 'OT-3', 's7', -7, -3, 3, 10, ['tasks'], 'Web', 450],
  ['OT-9', 'Task', 'Assigning tasks', 'Done', 'Medium', 'u4', 'u2', 'OT-3', 's7', -6, -2, 2, 6, ['tasks'], 'Web', 400],
  ['OT-11', 'Task', 'preparing excel sheet', 'Done', 'Medium', 'u4', 'u2', 'OT-3', 's7', -5, -1, 3, 8, ['tasks'], 'Web', 350],
  ['OT-12', 'Task', 'Server Managment', 'To Do', 'Medium', null, 'u2', null, 's7', -4, 10, 3, 12, ['devops'], 'Platform', 300],
  ['OT-13', 'Task', 'Monitoring tasks', 'Done', 'Medium', 'u4', 'u2', 'OT-3', 's7', -3, 0, 2, 6, ['tasks'], 'Web', 250],
  ['OT-14', 'Task', 'Daily assigning tasks', 'Done', 'Medium', 'u4', 'u2', 'OT-3', 's7', -2, 2, 2, 6, ['tasks'], 'Web', 200],
  ['OT-15', 'Task', 'Daily work', 'In Progress', 'Low', null, 'u2', null, 's7', -1, 15, 3, 10, [], 'Web', 150],
  ['OT-17', 'Task', 'Server Handling', 'In Progress', 'High', null, 'u2', null, 's7', 0, 14, 5, 18, ['devops'], 'Platform', 100],
  ['OT-19', 'Task', 'Assigning daily tasks', 'Done', 'Medium', 'u4', 'u2', 'OT-3', 's7', -4, -1, 2, 8, ['tasks'], 'Web', 180],
  ['OT-26', 'Task', 'Office meetings', 'In Progress', 'Low', null, 'u2', null, 's7', 1, 20, 1, 4, [], 'Web', 80],
  ['OT-784', 'Task', 'Designing tasks', 'In Progress', 'Medium', null, 'u2', null, 's7', 2, 25, 5, 20, ['design'], 'Web', 50],
  ['OT-801', 'Task', 'AWS and other billing', 'In Progress', 'High', null, 'u2', null, 's7', 3, 30, 8, 30, ['cloud', 'billing'], 'Platform', 20],
]

const projectOf = (id: string) => (id.startsWith('CP') ? 'p1' : id.startsWith('MOB') ? 'p2' : id.startsWith('VIS') ? 'p4' : id.startsWith('OT') ? 'p5' : 'p3')

export function buildSeed(): SeedData {
  const views: ViewEntry[] = [
    { userId: 'u1', itemId: 'CP-10', at: hoursAgo(1) },
    { userId: 'u1', itemId: 'CP-3', at: hoursAgo(3) },
    { userId: 'u1', itemId: 'INT-5', at: hoursAgo(5) },
    { userId: 'u4', itemId: 'CP-3', at: hoursAgo(2) },
    { userId: 'u5', itemId: 'MOB-4', at: hoursAgo(1) },
  ]

  const users: User[] = (
    [
      { id: 'u1', name: 'Akshay Kumar', email: 'akshay@acme.dev', role: 'Admin', team: 'Platform', color: '#0c66e4' },
      { id: 'u2', name: 'Priya Sharma', email: 'priya@acme.dev', role: 'Project Manager', team: 'Web', color: '#9f5ee7' },
      { id: 'u3', name: 'Rahul Verma', email: 'rahul@acme.dev', role: 'Project Coordinator', team: 'Platform', color: '#e56910' },
      { id: 'u4', name: 'Neha Gupta', email: 'neha@acme.dev', role: 'Developer', team: 'Web', color: '#22a06b' },
      { id: 'u5', name: 'Arjun Patel', email: 'arjun@acme.dev', role: 'Developer', team: 'Mobile', color: '#c9372c' },
      { id: 'u6', name: 'Sneha Iyer', email: 'sneha@acme.dev', role: 'QA', team: 'Quality', color: '#1d7a8c' },
    ] as const
  ).map((u) => normalizeUser(u, views))

  const projects: Project[] = [
    { id: 'p1', key: 'CP', name: 'Customer Portal', description: 'Self-service web portal for customers.', icon: '🌐', type: 'Scrum', leadId: 'u2', memberIds: ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'], createdAt: hoursAgo(900), counter: 16 },
    { id: 'p2', key: 'MOB', name: 'Mobile App', description: 'iOS and Android companion app.', icon: '📱', type: 'Scrum', leadId: 'u2', memberIds: ['u2', 'u3', 'u5', 'u6'], createdAt: hoursAgo(880), counter: 8 },
    { id: 'p3', key: 'INT', name: 'Internal Tools', description: 'Back-office tools for HR and admin.', icon: '🛠️', type: 'Kanban', leadId: 'u3', memberIds: ['u1', 'u3', 'u4'], createdAt: hoursAgo(860), counter: 5 },
    { id: 'p4', key: 'VIS', name: 'Vistaar', description: 'Software space for Vistaar development.', icon: '🚀', type: 'Scrum', leadId: 'u2', memberIds: ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'], createdAt: hoursAgo(920), counter: 534 },
    { id: 'p5', key: 'OT', name: 'Ordinet Team', description: 'Software project for Ordinet Team.', icon: '🏢', type: 'Scrum', leadId: 'u2', memberIds: ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'], createdAt: hoursAgo(1000), counter: 802 },
  ]

  const sprints: Sprint[] = [
    { id: 's1', projectId: 'p1', name: 'CP Sprint 1', goal: 'Foundation', state: 'completed', startDate: day(-28), endDate: day(-14), completedAt: hoursAgo(14 * 24) },
    { id: 's2', projectId: 'p1', name: 'CP Sprint 2', goal: 'Authentication MVP', state: 'active', startDate: day(-7), endDate: day(7), completedAt: null },
    { id: 's3', projectId: 'p1', name: 'CP Sprint 3', goal: 'Billing kickoff', state: 'planned', startDate: null, endDate: null, completedAt: null },
    { id: 's4', projectId: 'p2', name: 'MOB Sprint 4', goal: 'Offline beta', state: 'active', startDate: day(-3), endDate: day(11), completedAt: null },
    { id: 's5', projectId: 'p2', name: 'MOB Sprint 5', goal: '', state: 'planned', startDate: null, endDate: null, completedAt: null },
    { id: 's6', projectId: 'p4', name: 'VIS Sprint week 3 June', goal: 'SEO Landing Pages', state: 'active', startDate: day(-7), endDate: day(7), completedAt: null },
    { id: 's7', projectId: 'p5', name: 'OT Sprint 1', goal: 'Task assigning & server handling', state: 'active', startDate: day(-10), endDate: day(14), completedAt: null },
  ]

  const items: WorkItem[] = rows.map((r) => {
    const [id, type, summary, status, priority, assignee, reporter, parent, sprint, start, due, points, est, labels, team, created] = r
    const done = status === 'Done' || status === 'Reject' || status === 'Drop'
    return {
      id,
      projectId: projectOf(id),
      type,
      summary,
      description:
        id === 'VIS-533'
          ? 'Review all landing page anchor sections (#features, #about, #contact, etc.) and evaluate whether they should be converted into dedicated SEO-friendly pages.\n\nRequirements:\n• Identify important sections currently accessible via anchor links.\n• Create dedicated pages for SEO-critical sections where applicable.\n• Add new pages to XML sitemap.'
          : `${summary}. This work item was created as part of the seed data so the demo has something to show.`,
      status,
      priority,
      originalEstimate: est ? est * 60 : null,
      assigneeId: assignee,
      reporterId: reporter,
      labels,
      parentId: parent,
      dueDate: due === null ? null : day(due),
      startDate: start === null ? null : day(start),
      team,
      sprintId: sprint,
      storyPoints: points,
      links: [],
      watcherIds: [reporter],
      createdAt: hoursAgo(created),
      updatedAt: hoursAgo(Math.max(1, Math.floor(created / 6))),
      resolvedAt: done ? hoursAgo(Math.max(1, Math.floor(created / 8))) : null,
    }
  })

  const link = (a: string, type: WorkItem['links'][number]['type'], b: string, reverse: WorkItem['links'][number]['type']) => {
    items.find((i) => i.id === a)?.links.push({ type, targetId: b })
    items.find((i) => i.id === b)?.links.push({ type: reverse, targetId: a })
  }
  link('CP-10', 'Blocks', 'CP-9', 'Is blocked by')
  link('CP-11', 'Relates to', 'CP-3', 'Relates to')
  link('MOB-4', 'Relates to', 'MOB-2', 'Relates to')

  const comments: Comment[] = [
    { id: 'c1', itemId: 'CP-3', authorId: 'u3', body: 'Please make sure the reset link expires after 30 minutes.', createdAt: hoursAgo(30), updatedAt: null },
    { id: 'c2', itemId: 'CP-3', authorId: 'u4', body: 'Noted, using a signed token with a 30 min TTL.', createdAt: hoursAgo(26), updatedAt: null },
    { id: 'c3', itemId: 'MOB-4', authorId: 'u6', body: 'Reproducible on Pixel 8 with a fresh install.', createdAt: hoursAgo(10), updatedAt: null },
    { id: 'c4', itemId: 'CP-10', authorId: 'u1', body: 'This is blocking the payment SDK work, please prioritise.', createdAt: hoursAgo(6), updatedAt: null },
    { id: 'c5', itemId: 'INT-2', authorId: 'u3', body: 'Design approved by HR.', createdAt: hoursAgo(48), updatedAt: null },
  ]

  const wl = (id: string, itemId: string, userId: string, dOff: number, hours: number, description: string): WorkLog => ({
    id, itemId, userId, date: day(dOff), minutes: Math.round(hours * 60), description, createdAt: hoursAgo(-dOff * 24 + 2),
  })
  const worklogs: WorkLog[] = [
    wl('w1', 'CP-2', 'u4', -5, 6, 'Implemented login form'),
    wl('w2', 'CP-2', 'u4', -4, 5, 'API integration and tests'),
    wl('w3', 'CP-3', 'u4', -2, 4, 'Reset request screen'),
    wl('w4', 'CP-4', 'u4', -1, 2.5, 'Email template'),
    wl('w5', 'CP-10', 'u5', -3, 5, 'GitHub Actions workflow'),
    wl('w6', 'CP-6', 'u6', -1, 1.5, 'Cross-browser testing'),
    wl('w7', 'MOB-2', 'u5', -2, 6, 'Cache design'),
    wl('w8', 'MOB-3', 'u5', -1, 4, 'SQLite schema'),
    wl('w9', 'MOB-5', 'u5', -2, 7, 'FCM / APNs setup'),
    wl('w10', 'MOB-8', 'u3', -1, 2, 'Screenshots for store'),
    wl('w11', 'INT-2', 'u4', 0, 3, 'Form validation'),
    wl('w12', 'CP-15', 'u5', -21, 6, 'Initial setup'),
  ]

  let h = 0
  const history: HistoryEntry[] = []
  for (const it of items) {
    history.push({ id: `h${++h}`, itemId: it.id, userId: it.reporterId, field: 'Created', oldValue: '', newValue: it.summary, timestamp: it.createdAt })
  }
  const change = (itemId: string, userId: string, field: string, oldValue: string, newValue: string, ago: number) =>
    history.push({ id: `h${++h}`, itemId, userId, field, oldValue, newValue, timestamp: hoursAgo(ago) })
  change('CP-2', 'u4', 'Status', 'In Progress', 'Done', 40)
  change('CP-3', 'u4', 'Status', 'To Do', 'In Progress', 28)
  change('CP-6', 'u6', 'Status', 'Developers Done', 'QA-Done', 12)
  change('MOB-5', 'u5', 'Status', 'In Progress', 'Developers Done', 8)
  change('CP-12', 'u2', 'Status', 'In Progress', 'On Hold', 5)
  change('MOB-4', 'u2', 'Assignee', 'Unassigned', 'Arjun Patel', 4)
  change('INT-4', 'u1', 'Status', 'To Do', 'Reject', 3)
  change('CP-10', 'u1', 'Priority', 'Medium', 'High', 2)

  const notifications: AppNotification[] = [
    { id: 'n1', userId: 'u5', type: 'assigned', message: 'Priya Sharma assigned MOB-4 "Crash on Android 14 startup" to you', itemId: 'MOB-4', createdAt: hoursAgo(4), read: false },
    { id: 'n2', userId: 'u4', type: 'comment', message: 'Rahul Verma commented on CP-3 "Password reset flow"', itemId: 'CP-3', createdAt: hoursAgo(30), read: false },
    { id: 'n3', userId: 'u5', type: 'comment', message: 'Akshay Kumar commented on CP-10 "Set up CI pipeline"', itemId: 'CP-10', createdAt: hoursAgo(6), read: false },
    { id: 'n4', userId: 'u2', type: 'status', message: 'Sneha Iyer moved CP-6 to QA-Done', itemId: 'CP-6', createdAt: hoursAgo(12), read: false },
    { id: 'n5', userId: 'u1', type: 'status', message: 'Neha Gupta moved CP-2 to Done', itemId: 'CP-2', createdAt: hoursAgo(40), read: true },
  ]

  const savedFilters: SavedFilter[] = [
    { id: 'f1', name: 'High priority bugs', ownerId: 'u1', jql: 'type = Bug AND priority in (Highest, High)', starred: true, createdAt: hoursAgo(200) },
    { id: 'f2', name: 'Customer Portal – in progress', ownerId: 'u2', jql: 'project = CP AND status = "In Progress"', starred: false, createdAt: hoursAgo(100) },
  ]

  return {
    organization: { id: 'org1', name: 'Acme Technologies' },
    users,
    projects,
    items,
    sprints,
    comments,
    worklogs,
    history,
    notifications,
    savedFilters,
    views,
    groups: defaultGroups(),
    orgApps: defaultOrgApps(),
    invitations: [],
    auditLogs: [],
  }
}
