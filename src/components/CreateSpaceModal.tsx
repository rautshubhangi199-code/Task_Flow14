import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart3, CalendarDays, Check, ChevronDown, ChevronLeft, ClipboardList, Clock, Columns3, FileText, GanttChart, GitBranch, Globe, GripVertical, Info, LayoutList, List, Lock, MoreHorizontal, Plus,
  RefreshCw, Sparkles, Target, Trash2, TrendingUp, Upload, Users, Wand2, X, Zap,
} from 'lucide-react'
import clsx from 'clsx'
import { useStore } from '../store/useStore'
import { useCurrentUser } from '../store/hooks'
import { useUi } from '../store/uiStore'
import { projectService } from '../services/api'
import { API_ENDPOINTS } from '../Network/apiEndpoints'
import { asList, http } from '../services/http'
import type { IssueType, ProjectType } from '../types'
import { Avatar, TypeIcon } from './ui'

type MetaRow = { id?: number; name: string; description?: string; is_default?: boolean }

const DEFAULT_WORK_TYPES: MetaRow[] = [
  { name: 'Epic', description: 'Epic' },
  { name: 'Story', description: 'Story' },
  { name: 'Bug', description: 'Bug' },
  { name: 'Task', description: 'Task' },
]
const DEFAULT_STATUSES: MetaRow[] = [
  { name: 'To Do', is_default: false },
  { name: 'In Progress', is_default: false },
  { name: 'Done', is_default: true },
]
const VIEW_CHIPS = [
  { name: 'List', locked: true, icon: LayoutList },
  { name: 'Board', locked: true, icon: Columns3 },
  { name: 'Backlog', locked: true, icon: List },
  { name: 'Calendar', locked: false, icon: CalendarDays },
  { name: 'Docs', locked: false, icon: FileText },
  { name: 'Forms', locked: false, icon: ClipboardList },
  { name: 'Development', locked: false, icon: GitBranch },
  { name: 'Summary', locked: false, icon: Globe },
  { name: 'Timeline', locked: false, icon: GanttChart },
  { name: 'Capacity', locked: false, icon: Clock },
  { name: 'Goals', locked: false, icon: Target },
  { name: 'Reports', locked: false, icon: BarChart3 },
] as const
const DEFAULT_VIEWS = VIEW_CHIPS.filter((v) => !['Capacity', 'Goals', 'Reports'].includes(v.name)).map((v) => v.name)

function mapMetaRows(rows: Record<string, unknown>[]): MetaRow[] {
  return rows
    .map((r) => ({
      id: Number.isFinite(Number(r.id)) ? Number(r.id) : undefined,
      name: String(r.name ?? r.title ?? ''),
      description: r.description != null ? String(r.description) : undefined,
      is_default: Boolean(r.is_default ?? r.isDefault),
    }))
    .filter((r) => r.name)
}

function typeGlyph(name: string) {
  const known = ['Epic', 'Story', 'Bug', 'Task', 'Subtask'] as const
  if ((known as readonly string[]).includes(name)) return <TypeIcon type={name as IssueType} size={18} />
  return (
    <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-sm bg-slate-400 text-white">
      <Zap size={12} />
    </span>
  )
}

type TemplateId = 'discovery' | 'prioritization' | 'kanban' | 'scrum' | 'planning' | 'tasks' | 'blank' | 'import' | 'rovo'
type NavId =
  | 'made-for-you'
  | 'custom'
  | 'import'
  | 'rovo'
  | 'software'
  | 'service'
  | 'work'
  | 'product'
  | 'marketing'
  | 'customer'
  | 'hr'
  | 'finance'
  | 'design'
  | 'personal'
  | 'operations'
  | 'legal'

interface PreviewIssue {
  summary: string
  key: string
  type: IssueType
  column: 'To Do' | 'In Progress' | 'Done'
}

interface SpaceTemplate {
  id: TemplateId
  title: string
  description: string
  longDescription: string
  product: 'Jira' | 'Jira Product Discovery'
  badge?: 'Try' | 'Premium'
  type: ProjectType
  icon: string
  art: TemplateId
  categories: NavId[]
  features: { text: string; icon: 'backlog' | 'sprints' | 'velocity' }[]
  sampleName: string
  sampleKey: string
  previewIssues: PreviewIssue[]
}

const WORKFLOW = [
  { label: 'To Do', className: 'bg-slate-100 text-slate-600' },
  { label: 'In Progress', className: 'bg-blue-100 text-blue-700' },
  { label: 'Done', className: 'bg-green-100 text-green-700' },
] as const

const WORK_TYPES: IssueType[] = ['Epic', 'Story', 'Bug', 'Task', 'Subtask']

const TEMPLATES: SpaceTemplate[] = [
  {
    id: 'discovery',
    title: 'Product discovery',
    description: 'Prioritize ideas then connect them from discovery through to delivery.',
    longDescription: 'Prioritize ideas then connect them from discovery through to delivery.',
    product: 'Jira Product Discovery',
    badge: 'Try',
    type: 'Kanban',
    icon: '💡',
    art: 'discovery',
    categories: ['made-for-you', 'product'],
    features: [
      { text: 'Capture and score product ideas', icon: 'backlog' },
      { text: 'Prioritize with reach, impact, confidence and effort', icon: 'sprints' },
      { text: 'Connect ideas to delivery work', icon: 'velocity' },
    ],
    sampleName: 'Sample discovery space',
    sampleKey: 'DIS',
    previewIssues: [
      { summary: 'Validate checkout drop-off', key: 'DIS-1', type: 'Story', column: 'To Do' },
      { summary: 'Score Q3 idea backlog', key: 'DIS-2', type: 'Task', column: 'In Progress' },
      { summary: 'Share discovery insights', key: 'DIS-3', type: 'Task', column: 'Done' },
    ],
  },
  {
    id: 'prioritization',
    title: 'Prioritization',
    description: 'Evaluate ideas across reach, impact, confidence and effort to quickly decide what to build next.',
    longDescription: 'Evaluate ideas across reach, impact, confidence and effort to quickly decide what to build next.',
    product: 'Jira Product Discovery',
    badge: 'Try',
    type: 'Kanban',
    icon: '📊',
    art: 'prioritization',
    categories: ['made-for-you', 'product'],
    features: [
      { text: 'Compare ideas side by side', icon: 'backlog' },
      { text: 'Score impact versus effort', icon: 'sprints' },
      { text: 'Align stakeholders on what to build', icon: 'velocity' },
    ],
    sampleName: 'Sample prioritization space',
    sampleKey: 'PRIO',
    previewIssues: [
      { summary: 'Rank roadmap bets', key: 'PRIO-1', type: 'Story', column: 'To Do' },
      { summary: 'Review RICE scores', key: 'PRIO-2', type: 'Task', column: 'In Progress' },
      { summary: 'Publish priority board', key: 'PRIO-3', type: 'Task', column: 'Done' },
    ],
  },
  {
    id: 'kanban',
    title: 'Kanban',
    description: 'Work efficiently and visualize work on a board with to do, doing, and done.',
    longDescription: 'Work efficiently and visualize work on a board with to do, doing, and done.',
    product: 'Jira',
    type: 'Kanban',
    icon: '📋',
    art: 'kanban',
    categories: ['made-for-you', 'software', 'work'],
    features: [
      { text: 'Visualize work as it moves across the board', icon: 'backlog' },
      { text: 'Limit work in progress', icon: 'sprints' },
      { text: 'Spot bottlenecks as they happen', icon: 'velocity' },
    ],
    sampleName: 'Sample Kanban project',
    sampleKey: 'KAN',
    previewIssues: [
      { summary: 'Triage incoming requests', key: 'KAN-3', type: 'Task', column: 'To Do' },
      { summary: 'Fix login timeout', key: 'KAN-2', type: 'Bug', column: 'In Progress' },
      { summary: 'Ship notification toggle', key: 'KAN-1', type: 'Story', column: 'Done' },
    ],
  },
  {
    id: 'scrum',
    title: 'Scrum',
    description: 'Plan, track, and execute work using sprints and a backlog.',
    longDescription: 'Break down complex work into sprints, and continuously improve through incrementally delivery.',
    product: 'Jira',
    type: 'Scrum',
    icon: '🚀',
    art: 'scrum',
    categories: ['made-for-you', 'software'],
    features: [
      { text: 'Plan upcoming work in a backlog', icon: 'backlog' },
      { text: 'Organise cycles of work into sprints', icon: 'sprints' },
      { text: "Understand your team's velocity", icon: 'velocity' },
    ],
    sampleName: 'Sample Scrum project',
    sampleKey: 'SCR',
    previewIssues: [
      { summary: 'Fix sprint completion summary totals', key: 'SCR-3', type: 'Bug', column: 'To Do' },
      { summary: 'Break acceptance criteria into subtasks', key: 'SCR-6', type: 'Task', column: 'To Do' },
      { summary: 'Add backlog estimate field', key: 'SCR-2', type: 'Story', column: 'In Progress' },
      { summary: 'Refine team velocity dashboard', key: 'SCR-5', type: 'Story', column: 'In Progress' },
      { summary: 'Prepare sprint review', key: 'SCR-4', type: 'Task', column: 'Done' },
    ],
  },
  {
    id: 'planning',
    title: 'Cross-team planning',
    description: 'Align teams on shared goals and timelines.',
    longDescription: 'Align teams on shared goals and timelines.',
    product: 'Jira',
    badge: 'Premium',
    type: 'Scrum',
    icon: '🎯',
    art: 'planning',
    categories: ['made-for-you', 'work', 'product'],
    features: [
      { text: 'Plan work across multiple teams', icon: 'backlog' },
      { text: 'Track shared milestones on a timeline', icon: 'sprints' },
      { text: 'See capacity and dependencies', icon: 'velocity' },
    ],
    sampleName: 'Sample planning space',
    sampleKey: 'PLAN',
    previewIssues: [
      { summary: 'Align Q4 goals', key: 'PLAN-1', type: 'Epic', column: 'To Do' },
      { summary: 'Map team dependencies', key: 'PLAN-2', type: 'Story', column: 'In Progress' },
      { summary: 'Share timeline with leads', key: 'PLAN-3', type: 'Task', column: 'Done' },
    ],
  },
  {
    id: 'tasks',
    title: 'Task tracking',
    description: 'Organize and track team or personal tasks.',
    longDescription: 'Organize and track team or personal tasks.',
    product: 'Jira',
    type: 'Kanban',
    icon: '✅',
    art: 'tasks',
    categories: ['made-for-you', 'work', 'personal', 'operations'],
    features: [
      { text: 'Capture tasks in one place', icon: 'backlog' },
      { text: 'Track progress from to do to done', icon: 'sprints' },
      { text: 'Stay on top of personal or team work', icon: 'velocity' },
    ],
    sampleName: 'Sample task space',
    sampleKey: 'TASK',
    previewIssues: [
      { summary: 'Write weekly update', key: 'TASK-3', type: 'Task', column: 'To Do' },
      { summary: 'Review open follow-ups', key: 'TASK-2', type: 'Task', column: 'In Progress' },
      { summary: 'Close completed checklist', key: 'TASK-1', type: 'Task', column: 'Done' },
    ],
  },
]

const NAV: { id: NavId; label: string; section?: 'top' | 'categories'; badge?: 'Try'; icon?: ReactNode }[] = [
  { id: 'made-for-you', label: 'Made for you', section: 'top' },
  { id: 'custom', label: 'Custom templates', section: 'top', badge: 'Try' },
  { id: 'import', label: 'Import data', section: 'top', icon: <Upload size={14} /> },
  { id: 'rovo', label: 'Create with Rovo', section: 'top' },
  { id: 'software', label: 'Software development', section: 'categories' },
  { id: 'service', label: 'Service management', section: 'categories' },
  { id: 'work', label: 'Work management', section: 'categories' },
  { id: 'product', label: 'Product management', section: 'categories' },
  { id: 'marketing', label: 'Marketing', section: 'categories' },
  { id: 'customer', label: 'Customer service', section: 'categories' },
  { id: 'hr', label: 'Human resources', section: 'categories' },
  { id: 'finance', label: 'Finance', section: 'categories' },
  { id: 'design', label: 'Design', section: 'categories' },
  { id: 'personal', label: 'Personal', section: 'categories' },
  { id: 'operations', label: 'Operations', section: 'categories' },
  { id: 'legal', label: 'Legal', section: 'categories' },
]

const NAV_COPY: Record<NavId, { title: string; subtitle: string }> = {
  'made-for-you': { title: 'Made for you', subtitle: 'Templates for you based on how similar teams work.' },
  custom: { title: 'Custom templates', subtitle: 'Reuse templates your organization has saved.' },
  import: { title: 'Import data', subtitle: 'Bring work into a new space from a CSV or another tool.' },
  rovo: { title: 'Create with Rovo', subtitle: 'Describe the space you need and we’ll set it up for you.' },
  software: { title: 'Software development', subtitle: 'Build, plan, and ship software with Scrum or Kanban.' },
  service: { title: 'Service management', subtitle: 'Track requests, incidents, and changes.' },
  work: { title: 'Work management', subtitle: 'Plan and track work across teams.' },
  product: { title: 'Product management', subtitle: 'Discover, prioritize, and deliver product work.' },
  marketing: { title: 'Marketing', subtitle: 'Plan campaigns and creative work.' },
  customer: { title: 'Customer service', subtitle: 'Manage customer requests in one place.' },
  hr: { title: 'Human resources', subtitle: 'Track hiring, onboarding, and people work.' },
  finance: { title: 'Finance', subtitle: 'Organize budgeting and finance requests.' },
  design: { title: 'Design', subtitle: 'Track design work from brief to delivery.' },
  personal: { title: 'Personal', subtitle: 'Keep your own tasks organized.' },
  operations: { title: 'Operations', subtitle: 'Run day-to-day operational work.' },
  legal: { title: 'Legal', subtitle: 'Track contracts, reviews, and legal requests.' },
}

export function CreateSpaceModal() {
  const open = useUi((s) => s.createSpaceOpen)
  const setOpen = useUi((s) => s.setCreateSpaceOpen)
  if (!open) return null
  return <CreateSpaceFlow onClose={() => setOpen(false)} />
}

function CreateSpaceFlow({ onClose }: { onClose: () => void }) {
  const [template, setTemplate] = useState<SpaceTemplate | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  return (
    <>
      <SpaceTemplatesGallery
        onClose={onClose}
        onUseTemplate={(t) => {
          setTemplate(t)
          setFormOpen(true)
        }}
      />
      {formOpen && template && (
        <CreateSpaceForm
          template={template}
          onClose={onClose}
          onBack={() => setFormOpen(false)}
        />
      )}
    </>
  )
}

function SpaceTemplatesGallery({
  onClose,
  onUseTemplate,
}: {
  onClose: () => void
  onUseTemplate: (template: SpaceTemplate) => void
}) {
  const [nav, setNav] = useState<NavId>('made-for-you')
  const [preview, setPreview] = useState<SpaceTemplate | null>(null)
  const copy = NAV_COPY[nav]
  const cards = TEMPLATES.filter((t) => t.categories.includes(nav))
  const selectNav = (id: NavId) => {
    setNav(id)
    setPreview(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex bg-white">
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
        <button type="button" onClick={onClose} className="m-2 w-fit rounded p-1.5 text-slate-600 hover:bg-slate-100" aria-label="Close">
          <X size={18} />
        </button>
        <h1 className="px-5 pb-3 text-xl font-semibold text-slate-900">Space templates</h1>
        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          {NAV.filter((item) => item.section === 'top').map((item) => (
            <NavButton key={item.id} item={item} active={nav === item.id} onClick={() => selectNav(item.id)} />
          ))}
          <div className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Categories</div>
          {NAV.filter((item) => item.section === 'categories').map((item) => (
            <NavButton key={item.id} item={item} active={nav === item.id} onClick={() => selectNav(item.id)} />
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {preview ? (
          <TemplateDetail
            template={preview}
            categoryLabel={copy.title}
            onBack={() => setPreview(null)}
            onUse={() => onUseTemplate(preview)}
          />
        ) : (
        <div className="flex-1 overflow-y-auto">
        <div className="px-10 pt-6 text-sm text-slate-500">Space templates <span className="text-slate-300">/</span></div>
        <div className="px-10 pb-8 pt-4">
          <h2 className="text-2xl font-semibold text-slate-900">{copy.title}</h2>
          <p className="mt-1 text-sm text-slate-500">{copy.subtitle}</p>

          {nav === 'custom' && (
            <EmptyPanel
              title="No custom templates yet"
              body="When your organization saves a template, it will show up here. Start from a Jira template instead."
              action="Browse made for you"
              onAction={() => selectNav('made-for-you')}
            />
          )}
          {nav === 'import' && (
            <EmptyPanel
              title="Import into a new space"
              body="Create a space from a Kanban or Scrum template, then bring work in from CSV."
              action="Use Kanban template"
              onAction={() => setPreview(TEMPLATES.find((t) => t.id === 'kanban')!)}
            />
          )}
          {nav === 'rovo' && (
            <EmptyPanel
              title="Create with Rovo"
              body="Rovo isn’t connected in this workspace. Pick a template to create a space the usual way."
              action="Use Scrum template"
              onAction={() => setPreview(TEMPLATES.find((t) => t.id === 'scrum')!)}
            />
          )}

          {cards.length > 0 && (
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {cards.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setPreview(t)}
                  className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                >
                  <div className="flex h-36 items-center justify-center bg-slate-50 p-4">
                    <TemplateArt kind={t.art} />
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-900">{t.title}</h3>
                      {t.badge && (
                        <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">{t.badge}</span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-3 text-sm text-slate-600">{t.description}</p>
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                      {t.product === 'Jira' ? (
                        <span className="flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-blue-700 text-white">
                          <Check size={10} strokeWidth={3} />
                        </span>
                      ) : (
                        <span className="flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-violet-600 text-[8px] text-white">◆</span>
                      )}
                      {t.product}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {cards.length === 0 && !['custom', 'import', 'rovo'].includes(nav) && (
            <div className="mt-8 rounded-xl border border-dashed border-slate-200 p-8 text-sm text-slate-500">
              No templates in this category yet. Use <button type="button" className="font-medium text-brand-700 hover:underline" onClick={() => selectNav('made-for-you')}>Made for you</button> to get started.
            </div>
          )}
        </div>
        </div>
        )}
      </div>
    </div>
  )
}

function NavButton({
  item,
  active,
  onClick,
}: {
  item: (typeof NAV)[number]
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'mb-0.5 flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm',
        active ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-700 hover:bg-slate-100',
      )}
    >
      <span className="flex-1 truncate">{item.label}</span>
      {item.icon}
      {item.badge && <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">{item.badge}</span>}
    </button>
  )
}

type PreviewTab = 'list' | 'board' | 'timeline' | 'calendar' | 'backlog' | 'development' | 'more'

const PREVIEW_TABS = [
  ['list', 'List', LayoutList],
  ['board', 'Board', Columns3],
  ['timeline', 'Timeline', GanttChart],
  ['calendar', 'Calendar', CalendarDays],
  ['backlog', 'Backlog', List],
  ['development', 'Development', GitBranch],
  ['more', 'More', MoreHorizontal],
] as const

function liveIssueKey(sourceKey: string, prefix: string) {
  const num = sourceKey.split('-').pop() ?? '1'
  return `${(prefix || 'KEY').toUpperCase()}-${num}`
}

function TemplateDetail({
  template,
  categoryLabel,
  onBack,
  onUse,
}: {
  template: SpaceTemplate
  categoryLabel: string
  onBack: () => void
  onUse: () => void
}) {
  const [tab, setTab] = useState<PreviewTab>('board')
  const FeatureIcon = { backlog: List, sprints: RefreshCw, velocity: TrendingUp }

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className="flex w-full shrink-0 flex-col overflow-y-auto border-r border-slate-100 px-6 py-6 sm:px-8 lg:w-[380px]">
        <div className="text-sm text-slate-500">
          <button type="button" className="hover:underline" onClick={onBack}>Space templates</button>
          <span className="text-slate-300"> / </span>
          <button type="button" className="hover:underline" onClick={onBack}>{categoryLabel}</button>
          <span className="text-slate-300"> / </span>
        </div>
        <div className="mt-8 flex items-center gap-2 text-sm text-slate-600">
          {template.product === 'Jira' ? (
            <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-blue-700 text-white">
              <Check size={12} strokeWidth={3} />
            </span>
          ) : (
            <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-violet-600 text-[10px] text-white">◆</span>
          )}
          {template.product}
        </div>
        <h2 className="mt-3 text-3xl font-semibold text-slate-900">{template.title}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">{template.longDescription}</p>
        <button type="button" className="mt-5 w-full rounded bg-[#0c66e4] py-2.5 text-sm font-semibold text-white hover:bg-[#0055cc]" onClick={onUse}>
          Use template
        </button>
        <h3 className="mt-8 text-sm font-semibold text-slate-800">Features</h3>
        <ul className="mt-3 space-y-2.5">
          {template.features.map((f) => {
            const Icon = FeatureIcon[f.icon]
            return (
              <li key={f.text} className="flex items-start gap-2 text-sm text-slate-600">
                <Icon size={16} className="mt-0.5 shrink-0 text-slate-500" />
                {f.text}
              </li>
            )
          })}
        </ul>
        <h3 className="mt-7 text-sm font-semibold text-slate-800">Workflow</h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {WORKFLOW.map((s) => (
            <span key={s.label} className={clsx('rounded px-1.5 py-0.5 text-[11px] font-semibold', s.className)}>{s.label}</span>
          ))}
        </div>
        <h3 className="mt-7 text-sm font-semibold text-slate-800">Work types</h3>
        <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-700">
          {WORK_TYPES.map((t) => (
            <span key={t} className="inline-flex items-center gap-1">
              <TypeIcon type={t} size={14} /> {t}
            </span>
          ))}
        </div>
      </div>

      <div className="relative min-w-0 flex-1 overflow-hidden bg-[#d6e6fb]">
        <div className="pointer-events-none absolute -left-10 top-8 h-[120%] w-[70%] rounded-full border-[10px] border-[#9dc0f5]/80" />
        <div className="pointer-events-none absolute -right-20 -top-16 h-[80%] w-[55%] rounded-full border-[10px] border-[#b7d2f7]/70" />
        <button
          type="button"
          onClick={onBack}
          className="absolute right-5 top-4 z-10 rounded p-1 text-slate-500 hover:bg-white/70"
          aria-label="Close preview"
        >
          <X size={18} />
        </button>
        <div className="relative mx-6 mt-10 mb-8 overflow-hidden rounded-lg bg-white shadow-xl">
          <div className="border-b border-slate-200 px-5 py-3">
            <div className="text-xs text-slate-500">Space <span className="text-slate-300">/</span></div>
            <h3 className="text-lg font-semibold text-slate-900">{template.sampleName}</h3>
            <PreviewTabBar tab={tab} onTab={setTab} />
          </div>
          <div className="max-h-[calc(100vh-220px)] overflow-auto p-3 sm:p-4">
            <SamplePreview template={template} tab={tab} />
          </div>
        </div>
      </div>
    </div>
  )
}

function PreviewTabBar({ tab, onTab }: { tab: PreviewTab; onTab: (tab: PreviewTab) => void }) {
  return (
    <div className="mt-2 flex gap-0.5 overflow-x-auto pb-1">
      {PREVIEW_TABS.map(([id, label, Icon]) => (
        <button
          key={id}
          type="button"
          onClick={() => onTab(id)}
          className={clsx(
            'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded px-2 py-1 text-sm',
            tab === id ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-600 hover:bg-slate-100',
          )}
        >
          <Icon size={14} /> {label}
        </button>
      ))}
    </div>
  )
}

function SamplePreview({
  template,
  tab,
  liveName,
  liveKey,
}: {
  template: SpaceTemplate
  tab: PreviewTab
  liveName?: string
  liveKey?: string
}) {
  const prefix = liveKey?.trim() || template.sampleKey || 'KEY'
  const spaceName = liveName?.trim() || template.sampleName
  const keyOf = (sourceKey: string) => liveIssueKey(sourceKey, prefix)
  const cols = ['To Do', 'In Progress', 'Done'] as const
  if (tab === 'board') {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cols.map((col) => (
          <div key={col} className="min-h-[200px] rounded-md bg-slate-50 p-2 sm:min-h-[280px]">
            <div className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{col}</div>
            <div className="space-y-2">
              {template.previewIssues.filter((i) => i.column === col).map((i) => (
                <div key={i.key} className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="text-sm text-slate-800">{i.summary}</div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                      <TypeIcon type={i.type} size={14} /> {keyOf(i.key)}
                    </span>
                    <span className="h-5 w-5 rounded-full bg-slate-200" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }
  if (tab === 'list') {
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2 font-medium">Type</th>
              <th className="py-2 font-medium">Key</th>
              <th className="py-2 font-medium">Summary</th>
              <th className="py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {template.previewIssues.map((i) => (
              <tr key={i.key} className="border-b border-slate-100">
                <td className="py-2"><TypeIcon type={i.type} size={14} /></td>
                <td className="py-2 text-slate-500">{keyOf(i.key)}</td>
                <td className="py-2">{i.summary}</td>
                <td className="py-2 text-slate-600">{i.column}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
  if (tab === 'backlog') {
    return (
      <div className="space-y-4 text-sm">
        <div>
          <div className="mb-2 font-semibold text-slate-800">Sprint 1</div>
          <div className="space-y-1">
            {template.previewIssues.filter((i) => i.column !== 'To Do').map((i) => (
              <div key={i.key} className="flex flex-wrap items-center gap-2 rounded border border-slate-200 bg-white px-3 py-2">
                <TypeIcon type={i.type} size={14} />
                <span className="text-slate-500">{keyOf(i.key)}</span>
                <span className="min-w-0 flex-1">{i.summary}</span>
                <span className="text-xs text-slate-500">{i.column}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 font-semibold text-slate-800">Backlog</div>
          <div className="space-y-1">
            {template.previewIssues.filter((i) => i.column === 'To Do').map((i) => (
              <div key={i.key} className="flex flex-wrap items-center gap-2 rounded border border-slate-200 bg-white px-3 py-2">
                <TypeIcon type={i.type} size={14} />
                <span className="text-slate-500">{keyOf(i.key)}</span>
                <span className="min-w-0 flex-1">{i.summary}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }
  if (tab === 'timeline') {
    return (
      <div className="space-y-3 overflow-x-auto p-2">
        {template.previewIssues.map((i, idx) => (
          <div key={i.key} className="flex min-w-[420px] items-center gap-3 text-sm">
            <span className="w-16 shrink-0 text-xs text-slate-500">{keyOf(i.key)}</span>
            <div className="h-7 flex-1 rounded bg-slate-100">
              <div className="h-7 rounded bg-blue-400/80" style={{ marginLeft: `${idx * 8}%`, width: `${40 + (idx % 3) * 12}%` }} />
            </div>
          </div>
        ))}
      </div>
    )
  }
  if (tab === 'calendar') {
    return (
      <div className="grid grid-cols-4 gap-1 text-center text-xs text-slate-500 sm:grid-cols-7">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="hidden py-1 font-semibold sm:block">{d}</div>)}
        {Array.from({ length: 28 }).map((_, i) => (
          <div key={i} className="min-h-12 rounded border border-slate-100 bg-white p-1 text-left sm:min-h-16">
            <div>{i + 1}</div>
            {i === 3 && <div className="mt-1 truncate rounded bg-blue-50 px-1 text-[10px] text-blue-700">{template.previewIssues[0]?.summary}</div>}
            {i === 10 && <div className="mt-1 truncate rounded bg-green-50 px-1 text-[10px] text-green-700">{template.previewIssues.at(-1)?.summary}</div>}
          </div>
        ))}
      </div>
    )
  }
  if (tab === 'more') {
    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {['Forms', 'Goals', 'Reports', 'Worklogs', 'Pages', 'Approvals'].map((item) => (
          <div key={item} className="rounded-lg border border-slate-200 p-4 text-sm text-slate-600">
            <div className="font-medium text-slate-800">{item}</div>
            <p className="mt-1 text-xs text-slate-500">Available in {spaceName} after you create this space.</p>
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="flex h-56 flex-col items-center justify-center px-4 text-center text-sm text-slate-500">
      <GitBranch size={28} className="mb-2 text-slate-400" />
      Connect a repository to see development activity for {spaceName}.
    </div>
  )
}

function ConfigCard({
  title,
  summary,
  hint,
  open,
  onToggle,
  children,
}: {
  title: string
  summary: string
  hint?: boolean
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 text-sm font-semibold text-slate-900">
            {title}
            {hint && <Info size={13} className="text-slate-400" />}
          </span>
          {!open && <span className="mt-0.5 block truncate text-sm text-slate-500">{summary}</span>}
        </span>
        <ChevronDown size={18} className={clsx('shrink-0 text-slate-400 transition', !open && '-rotate-90')} />
      </button>
      {open && <div className="border-t border-slate-100 px-3 py-3">{children}</div>}
    </div>
  )
}

function EmptyPanel({ title, body, action, onAction }: { title: string; body: string; action: string; onAction: () => void }) {
  return (
    <div className="mt-8 max-w-lg rounded-xl border border-slate-200 p-6">
      <div className="mb-2 flex items-center gap-2 text-slate-800">
        <Sparkles size={16} className="text-violet-600" />
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="text-sm text-slate-600">{body}</p>
      <button type="button" className="btn-primary mt-4" onClick={onAction}>{action}</button>
    </div>
  )
}

function TemplateArt({ kind }: { kind: TemplateId }) {
  if (kind === 'discovery') {
    return (
      <div className="relative h-24 w-40">
        <div className="absolute left-6 top-2 h-16 w-1 rounded bg-slate-300" />
        <div className="absolute left-4 top-14 h-3 w-20 rounded-full bg-blue-600" />
        <div className="absolute right-2 top-4 flex gap-1">
          {['bg-blue-400', 'bg-violet-400', 'bg-emerald-400', 'bg-amber-400'].map((c) => (
            <span key={c} className={clsx('h-5 w-5 rounded-full', c)} />
          ))}
        </div>
        <div className="absolute bottom-2 right-4 h-7 w-7 rounded-full border-2 border-slate-400 bg-white" />
      </div>
    )
  }
  if (kind === 'prioritization') {
    return (
      <div className="flex h-24 w-40 items-end gap-1 rounded-lg bg-emerald-50 p-3">
        <div className="h-8 w-8 rounded bg-emerald-400" />
        <div className="h-12 w-10 rounded bg-emerald-500" />
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => <span key={i} className="h-3 w-3 rounded-full bg-emerald-300" />)}
          </div>
          <div className="h-6 rounded bg-emerald-200" />
        </div>
      </div>
    )
  }
  if (kind === 'kanban') {
    return (
      <div className="grid h-24 w-40 grid-cols-3 gap-2 rounded-lg bg-slate-100 p-2">
        {[3, 2, 1].map((n, col) => (
          <div key={col} className="space-y-1.5">
            {Array.from({ length: n }).map((_, i) => <div key={i} className="h-5 rounded bg-white shadow-sm" />)}
          </div>
        ))}
      </div>
    )
  }
  if (kind === 'scrum') {
    return (
      <div className="relative h-24 w-40 rounded-lg bg-slate-100 p-3">
        <div className="h-6 rounded-full bg-blue-500" />
        <div className="mt-3 h-5 w-24 rounded-full bg-white shadow-sm" />
        <div className="mt-2 h-5 w-16 rounded-full bg-white shadow-sm" />
      </div>
    )
  }
  if (kind === 'planning') {
    return (
      <div className="flex h-24 w-40 flex-col justify-center gap-2 rounded-lg bg-slate-50 p-3">
        <div className="h-4 w-full rounded bg-orange-400" />
        <div className="h-4 w-4/5 rounded bg-blue-500" />
        <div className="h-4 w-3/5 rounded bg-teal-400" />
      </div>
    )
  }
  return (
    <div className="relative h-24 w-40 rounded-lg bg-slate-100 p-3">
      <div className="mb-2 h-6 rounded bg-violet-400" />
      <div className="h-3 w-24 rounded bg-white" />
      <div className="mt-1 h-3 w-16 rounded bg-white" />
      <div className="absolute bottom-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-white text-emerald-600 shadow">✓</div>
    </div>
  )
}

function CreateSpaceForm({
  onClose,
  onBack,
  template,
}: {
  onClose: () => void
  onBack: () => void
  template: SpaceTemplate
}) {
  const me = useCurrentUser()
  const users = useStore((s) => s.users)
  const projects = useStore((s) => s.projects)
  const showToast = useUi((s) => s.showToast)
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [key, setKey] = useState('')
  const [keyTouched, setKeyTouched] = useState(false)
  const [managed, setManaged] = useState<'Team-managed' | 'Company-managed'>('Team-managed')
  const [access, setAccess] = useState<'Open' | 'Limited' | 'Private'>('Open')
  const [leadId, setLeadId] = useState(me?.id ?? '')
  const [memberIds, setMemberIds] = useState<string[]>(me ? [me.id] : [])
  const [features, setFeatures] = useState<Record<string, boolean>>({
    board: true,
    backlog: template.type === 'Scrum',
    timeline: true,
    calendar: true,
    list: true,
    development: template.type === 'Scrum' || template.type === 'Kanban',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [tab, setTab] = useState<PreviewTab>('board')
  const [creating, setCreating] = useState(false)
  const [workTypes, setWorkTypes] = useState<MetaRow[]>(DEFAULT_WORK_TYPES)
  const [statuses, setStatuses] = useState<MetaRow[]>(DEFAULT_STATUSES)
  const [selectedViews, setSelectedViews] = useState<string[]>(DEFAULT_VIEWS)
  const [openConfig, setOpenConfig] = useState<'types' | 'statuses' | 'views' | null>(null)

  useEffect(() => {
    if (step !== 2) return
    let cancelled = false
    void (async () => {
      try {
        const typeRows = mapMetaRows(asList<Record<string, unknown>>(await http.get(API_ENDPOINTS.GET_all_work_item_types)))
        if (!cancelled && typeRows.length) setWorkTypes(typeRows)
      } catch {
        /* keep defaults: name, description */
      }
      try {
        const statusRows = mapMetaRows(asList<Record<string, unknown>>(await http.get(API_ENDPOINTS.GET_all_statuses)))
        if (!cancelled && statusRows.length) setStatuses(statusRows)
      } catch {
        /* keep defaults: name, is_default */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [step])

  const autoKey = (n: string) =>
    n.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5) ||
    n.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4)

  const validateStep1 = () => {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Name is required'
    if (!/^[A-Z][A-Z0-9]{1,9}$/.test(key)) e.key = 'Key must be 2–10 uppercase letters/digits, starting with a letter'
    else if (projects.some((p) => p.key === key)) e.key = `A space with key ${key} already exists`
    if (projects.some((p) => p.name.toLowerCase() === name.trim().toLowerCase())) e.name = 'A space with this name already exists'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const next = () => {
    if (step === 1 && !validateStep1()) return
    setStep((s) => Math.min(4, s + 1))
  }

  const submit = async () => {
    if (!validateStep1()) {
      setStep(1)
      return
    }
    setCreating(true)
    try {
      const p = await projectService.create({
        name: name.trim(),
        key,
        description: template.longDescription,
        icon: template.icon,
        type: template.type,
        leadId,
        memberIds,
      })
      const projectPk = Number(p.id)
      await Promise.allSettled([
        ...workTypes.filter((t) => t.name.trim()).map((t) =>
          t.id
            ? http.patch(API_ENDPOINTS.UPDATE_work_item_type, { id: t.id, name: t.name, description: t.description ?? t.name })
            : http.post(API_ENDPOINTS.POST_create_work_item_type, { name: t.name, description: t.description ?? t.name }),
        ),
        ...statuses.filter((s) => s.name.trim()).map((s) =>
          s.id
            ? http.patch(API_ENDPOINTS.UPDATE_status, { id: s.id, name: s.name, is_default: Boolean(s.is_default) })
            : http.post(API_ENDPOINTS.POST_create_status, {
                name: s.name,
                project: Number.isFinite(projectPk) ? projectPk : p.id,
                is_default: Boolean(s.is_default),
              }),
        ),
      ])
    showToast(`Space "${p.name}" created`)
    onClose()
      navigate(selectedViews.includes('Board') ? `/projects/${p.key}/board` : `/projects/${p.key}/summary`)
    } finally {
      setCreating(false)
    }
  }

  const previewName = name.trim() || 'My space'
  const previewKey = key.trim() || 'KEY'

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-white lg:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:max-w-[520px] xl:max-w-[560px]">
        <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-10 sm:py-6">
          <button type="button" onClick={step === 1 ? onBack : () => setStep((s) => s - 1)} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:underline">
            <ChevronLeft size={16} /> {step === 1 ? 'Back to templates' : step === 2 ? 'Back to Name your space' : 'Back'}
          </button>

          {step === 1 && (
            <div className="mx-auto mt-8 max-w-md">
              <h1 className="text-3xl font-semibold text-slate-900">Name your space</h1>
              <p className="mt-2 text-sm text-slate-500">Required fields are marked with an asterisk <span className="text-red-600">*</span></p>

              <label className="mt-6 block text-sm font-medium text-slate-700">Name <span className="text-red-600">*</span></label>
              <input
                className="input mt-1"
                autoFocus
                value={name}
                placeholder="Try a team name, project goal, milestone..."
                onChange={(e) => {
                  setName(e.target.value)
                  if (!keyTouched) setKey(autoKey(e.target.value))
                }}
              />
          {errors.name && <div className="mt-1 text-xs text-red-600">{errors.name}</div>}

              <label className="mt-5 flex items-center gap-1 text-sm font-medium text-slate-700">
                How your space is managed <span className="text-red-600">*</span>
                <span title="Team-managed spaces are simpler to set up. Company-managed spaces use shared schemes."><Info size={14} className="text-slate-400" /></span>
              </label>
              <div className="relative mt-1">
                <Users size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <select className="input pl-9" value={managed} onChange={(e) => setManaged(e.target.value as typeof managed)}>
                  <option>Team-managed</option>
                  <option>Company-managed</option>
                </select>
              </div>

              <label className="mt-5 block text-sm font-medium text-slate-700">Access <span className="text-red-600">*</span></label>
              <div className="relative mt-1">
                <Lock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <select className="input pl-9" value={access} onChange={(e) => setAccess(e.target.value as typeof access)}>
                  <option>Open</option>
                  <option>Limited</option>
                  <option>Private</option>
                </select>
        </div>

              <label className="mt-5 flex items-center gap-1 text-sm font-medium text-slate-700">
                Key <span className="text-red-600">*</span>
                <span title="Used in work item IDs, like KEY-1"><Info size={14} className="text-slate-400" /></span>
              </label>
              <input
                className="input mt-1 w-40 uppercase"
                value={key}
                onChange={(e) => {
                  setKeyTouched(true)
                  setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))
                }}
              />
          {errors.key && <div className="mt-1 text-xs text-red-600">{errors.key}</div>}

              <div className="mt-6 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">Template</span>
                <button type="button" className="text-[#0c66e4] hover:underline" onClick={onBack}>See details</button>
              </div>
              <div className="mt-2 flex gap-3 rounded-lg border border-slate-200 p-3">
                <div className="hidden h-16 w-24 shrink-0 items-center justify-center rounded bg-slate-50 sm:flex">
                  <TemplateArt kind={template.art} />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900">{template.title}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-blue-700 text-white">
                      <Check size={10} strokeWidth={3} />
                    </span>
                    {template.product}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {template.id === 'scrum'
                      ? 'Sprint toward your project goals with a board, backlog, and timeline.'
                      : template.description}
                  </p>
                </div>
        </div>
        </div>
          )}

          {step === 2 && (
            <div className="mx-auto mt-8 max-w-md">
              <h1 className="text-3xl font-semibold text-slate-900">Let’s set up your space</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">These form the building blocks of your space. You can change these settings later.</p>

              <div className="mt-6 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800">Configuration<span className="text-red-600">*</span></span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    title="Recommended setup"
                    className="rounded p-1 text-slate-500 hover:bg-slate-100"
                    onClick={() => {
                      setWorkTypes(DEFAULT_WORK_TYPES)
                      setStatuses(DEFAULT_STATUSES)
                      setSelectedViews(DEFAULT_VIEWS)
                    }}
                  >
                    <Wand2 size={16} />
                  </button>
                  <button
                    type="button"
                    title="Reset"
                    className="rounded p-1 text-slate-500 hover:bg-slate-100"
                    onClick={() => {
                      setWorkTypes(DEFAULT_WORK_TYPES)
                      setStatuses(DEFAULT_STATUSES)
                      setSelectedViews(DEFAULT_VIEWS)
                      setOpenConfig(null)
                    }}
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <ConfigCard
                  title="Work types"
                  hint
                  summary={workTypes.map((t) => t.name).filter(Boolean).join(', ') || 'None'}
                  open={openConfig === 'types'}
                  onToggle={() => setOpenConfig((v) => (v === 'types' ? null : 'types'))}
                >
                  <div className="space-y-2">
                    {workTypes.map((row, i) => (
                      <div key={row.id ?? `type-${i}`} className="flex items-center gap-2">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200">{typeGlyph(row.name)}</span>
                        <input
                          className="input h-9"
                          value={row.name}
                          onChange={(e) => setWorkTypes((rows) => rows.map((r, idx) => (idx === i ? { ...r, name: e.target.value, description: e.target.value } : r)))}
                          onBlur={() => {
                            const t = workTypes[i]
                            if (!t?.name.trim()) return
                            if (t.id) void http.patch(API_ENDPOINTS.UPDATE_work_item_type, { id: t.id, name: t.name, description: t.description ?? t.name }).catch(() => {})
                            else {
                              void http.post(API_ENDPOINTS.POST_create_work_item_type, { name: t.name, description: t.description ?? t.name }).then((data) => {
                                const rec = data as Record<string, unknown>
                                const id = Number(rec?.id)
                                if (Number.isFinite(id)) setWorkTypes((rows) => rows.map((r, idx) => (idx === i ? { ...r, id } : r)))
                              }).catch(() => {})
                            }
                          }}
                        />
                        {i > 0 && (
                          <button
                            type="button"
                            className="rounded p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            onClick={() => {
                              const t = workTypes[i]
                              if (t.id) void http.delete(API_ENDPOINTS.DELETE_work_item_type, { id: t.id }).catch(() => {})
                              setWorkTypes((rows) => rows.filter((_, idx) => idx !== i))
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
                      onClick={() => setWorkTypes((rows) => [...rows, { name: '', description: '' }])}
                    >
                      <Plus size={14} /> Add work type
                    </button>
                  </div>
                </ConfigCard>
                <ConfigCard
                  title="Statuses"
                  summary={statuses.map((s) => s.name).filter(Boolean).join(', ') || 'None'}
                  open={openConfig === 'statuses'}
                  onToggle={() => setOpenConfig((v) => (v === 'statuses' ? null : 'statuses'))}
                >
                  <div className="space-y-2">
                    {statuses.map((row, i) => (
                      <div key={row.id ?? `status-${i}`} className="flex items-center gap-2">
                        <GripVertical size={16} className="shrink-0 text-slate-400" />
                        <input
                          className={clsx('input h-9', row.is_default && 'bg-slate-50')}
                          value={row.name}
                          onChange={(e) => setStatuses((rows) => rows.map((r, idx) => (idx === i ? { ...r, name: e.target.value } : r)))}
                          onBlur={() => {
                            const s = statuses[i]
                            if (!s?.id || !s.name.trim()) return
                            void http.patch(API_ENDPOINTS.UPDATE_status, { id: s.id, name: s.name, is_default: Boolean(s.is_default) }).catch(() => {})
                          }}
                        />
                        <button
                          type="button"
                          className="rounded p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          onClick={() => {
                            const s = statuses[i]
                            if (s.id) void http.delete(API_ENDPOINTS.DELETE_status, { id: s.id }).catch(() => {})
                            setStatuses((rows) => rows.filter((_, idx) => idx !== i))
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
                      onClick={() => setStatuses((rows) => [...rows, { name: '', is_default: false }])}
                    >
                      <Plus size={14} /> Add status
                    </button>
                  </div>
                </ConfigCard>
                <ConfigCard
                  title="Views"
                  hint
                  summary={selectedViews.join(', ') || 'None'}
                  open={openConfig === 'views'}
                  onToggle={() => setOpenConfig((v) => (v === 'views' ? null : 'views'))}
                >
                  <div className="flex flex-wrap gap-2">
                    {VIEW_CHIPS.map((v) => {
                      const on = selectedViews.includes(v.name) || v.locked
                      const Icon = v.icon
                      return (
                        <button
                          key={v.name}
                          type="button"
                          disabled={v.locked}
                          onClick={() => {
                            if (v.locked) return
                            setSelectedViews((s) => (s.includes(v.name) ? s.filter((x) => x !== v.name) : [...s, v.name]))
                            const viewKey = v.name.toLowerCase()
                            if (['board', 'backlog', 'timeline', 'calendar', 'list', 'development'].includes(viewKey)) {
                              setFeatures((f) => ({ ...f, [viewKey]: !on }))
                            }
                          }}
                          className={clsx(
                            'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium',
                            on ? 'border-blue-300 bg-blue-50 text-[#0c66e4]' : 'border-slate-200 bg-white text-slate-600',
                            v.locked && 'cursor-default',
                          )}
                        >
                          <Icon size={12} />
                          {v.name}
                          {v.locked && <Lock size={11} />}
                        </button>
                      )
                    })}
                  </div>
                </ConfigCard>
          </div>
        </div>
          )}

          {step === 3 && (
            <div className="mx-auto mt-8 max-w-md">
              <h1 className="text-3xl font-semibold text-slate-900">Who’s working on this space?</h1>
              <p className="mt-2 text-sm text-slate-500">Add a lead and teammates. Access is {access.toLowerCase()}.</p>
              <label className="mt-6 block text-sm font-medium text-slate-700">Space lead</label>
              <select className="input mt-1" value={leadId} onChange={(e) => setLeadId(e.target.value)}>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
            </select>
              <label className="mt-5 block text-sm font-medium text-slate-700">Members</label>
              <div className="mt-1 max-h-64 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
            {users.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-slate-50">
                <input type="checkbox" checked={memberIds.includes(u.id)} onChange={(e) => setMemberIds((m) => (e.target.checked ? [...m, u.id] : m.filter((x) => x !== u.id)))} />
                    <Avatar user={u} size={22} />
                <span className="text-sm">{u.name}</span>
                <span className="ml-auto text-xs text-slate-500">{u.role}</span>
              </label>
            ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="mx-auto mt-8 max-w-md">
              <h1 className="text-3xl font-semibold text-slate-900">Go to your space</h1>
              <p className="mt-2 text-sm text-slate-500">Review these details, then create the space.</p>
              <dl className="mt-6 space-y-3 rounded-lg border border-slate-200 p-4 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Name</dt><dd className="font-medium">{previewName}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Key</dt><dd className="font-medium">{previewKey}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Template</dt><dd className="font-medium">{template.title}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Managed</dt><dd className="font-medium">{managed}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Access</dt><dd className="font-medium">{access}</dd></div>
              </dl>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 sm:px-10">
          <span className="text-sm text-slate-500">Step {step} of 4</span>
          {step < 4 ? (
            <button type="button" className="rounded bg-[#0c66e4] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#0055cc]" onClick={next}>Next</button>
          ) : (
            <button type="button" className="rounded bg-[#0c66e4] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#0055cc] disabled:opacity-60" disabled={creating} onClick={() => void submit()}>
              {creating ? 'Creating…' : 'Create space'}
            </button>
          )}
        </div>
      </div>

      <div className="relative min-h-[42vh] flex-1 overflow-hidden bg-[#d6e6fb] lg:min-h-0">
        <div className="pointer-events-none absolute -left-10 top-8 hidden h-[120%] w-[70%] rounded-full border-[10px] border-[#9dc0f5]/80 lg:block" />
        <div className="pointer-events-none absolute -right-20 -top-16 hidden h-[80%] w-[55%] rounded-full border-[10px] border-[#b7d2f7]/70 lg:block" />
        <div className="relative m-3 overflow-hidden rounded-lg bg-white shadow-xl sm:m-6 lg:mt-16">
          <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
            <div className="text-xs text-slate-500">{managed} space <span className="text-slate-300">/</span></div>
            <h3 className="truncate text-lg font-semibold text-slate-900">{previewName}</h3>
            <PreviewTabBar tab={tab} onTab={setTab} />
            <div className="mt-2 h-6 w-6 rounded-full bg-slate-200" />
          </div>
          <div className="max-h-[min(520px,calc(100vh-220px))] overflow-auto p-3 sm:p-4">
            <SamplePreview template={template} tab={tab} liveName={previewName} liveKey={previewKey} />
          </div>
        </div>
      </div>
    </div>
  )
}
