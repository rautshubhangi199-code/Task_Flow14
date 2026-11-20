import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import {
  AlignLeft,
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Bug,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  FolderKanban,
  GitBranch,
  Info,
  Lock,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Search,
  Server,
  Tag,
  User,
  Workflow,
  X,
  Zap,
} from 'lucide-react'
import { useAccessibleProjects, useCurrentUser } from '../../store/hooks'
import { useUi } from '../../store/uiStore'
import { Modal } from '../../components/ui'
import type { IssueType } from '../../types'

interface FieldItem {
  id: string
  name: string
  iconType: 'type' | 'arrowUpDown' | 'clock' | 'alignLeft' | 'arrowRight' | 'user' | 'tag' | 'folder' | 'hash' | 'server'
  required?: boolean
  tooltip?: string
}

const DEFAULT_CONFIGS: Record<
  IssueType,
  {
    description: string
    descriptionFields: FieldItem[]
    contextFields: FieldItem[]
    otherFields: FieldItem[]
    systemFields: FieldItem[]
  }
> = {
  Task: {
    description: 'Tasks track small, distinct pieces of work.',
    descriptionFields: [
      { id: 'summary', name: 'Summary', iconType: 'type', required: true },
      { id: 'priority', name: 'Priority', iconType: 'arrowUpDown' },
      { id: 'original-estimate', name: 'Original estimate', iconType: 'clock' },
      { id: 'description', name: 'Description', iconType: 'alignLeft' },
    ],
    contextFields: [
      { id: 'status', name: 'Status', iconType: 'arrowRight' },
    ],
    otherFields: [
      { id: 'agent-sessions', name: 'Agent Sessions', iconType: 'folder' },
    ],
    systemFields: [
      { id: 'environment', name: 'Environment', iconType: 'alignLeft' },
    ],
  },
  Epic: {
    description: 'Epics track collections of related bugs, stories, and tasks.',
    descriptionFields: [
      { id: 'summary', name: 'Summary', iconType: 'type', required: true },
      { id: 'description', name: 'Description', iconType: 'alignLeft' },
    ],
    contextFields: [
      { id: 'status', name: 'Status', iconType: 'arrowRight' },
      { id: 'assignee', name: 'Assignee', iconType: 'user' },
      { id: 'labels', name: 'Labels', iconType: 'tag' },
    ],
    otherFields: [
      { id: 'agent-sessions', name: 'Agent Sessions', iconType: 'folder' },
      {
        id: 'story-points',
        name: 'Story point estimate',
        iconType: 'hash',
        tooltip: 'Story point estimate (created automatically)',
      },
    ],
    systemFields: [
      { id: 'environment', name: 'Environment', iconType: 'alignLeft' },
      { id: 'original-estimate', name: 'Original estimate', iconType: 'clock' },
      { id: 'priority', name: 'Priority', iconType: 'arrowUpDown' },
    ],
  },
  Bug: {
    description: 'Bugs track problems or errors.',
    descriptionFields: [
      { id: 'summary', name: 'Summary', iconType: 'type', required: true },
      { id: 'priority', name: 'Priority', iconType: 'arrowUpDown' },
      { id: 'original-estimate', name: 'Original estimate', iconType: 'clock' },
      { id: 'description', name: 'Description', iconType: 'alignLeft' },
      { id: 'environment', name: 'Environment', iconType: 'alignLeft' },
    ],
    contextFields: [
      { id: 'status', name: 'Status', iconType: 'arrowRight' },
      { id: 'assignee', name: 'Assignee', iconType: 'user' },
      { id: 'labels', name: 'Labels', iconType: 'tag' },
    ],
    otherFields: [
      { id: 'agent-sessions', name: 'Agent Sessions', iconType: 'folder' },
      { id: 'story-points', name: 'Story point estimate', iconType: 'hash' },
    ],
    systemFields: [],
  },
  Story: {
    description: 'Stories track user requirements and feature work.',
    descriptionFields: [
      { id: 'summary', name: 'Summary', iconType: 'type', required: true },
      { id: 'description', name: 'Description', iconType: 'alignLeft' },
    ],
    contextFields: [
      { id: 'status', name: 'Status', iconType: 'arrowRight' },
      { id: 'assignee', name: 'Assignee', iconType: 'user' },
      { id: 'priority', name: 'Priority', iconType: 'arrowUpDown' },
      { id: 'labels', name: 'Labels', iconType: 'tag' },
    ],
    otherFields: [
      { id: 'agent-sessions', name: 'Agent Sessions', iconType: 'folder' },
    ],
    systemFields: [
      { id: 'environment', name: 'Environment', iconType: 'alignLeft' },
      { id: 'original-estimate', name: 'Original estimate', iconType: 'clock' },
      { id: 'story-points', name: 'Story point estimate', iconType: 'hash' },
    ],
  },
  Subtask: {
    description: 'Subtasks track small pieces of work that are part of a larger task.',
    descriptionFields: [
      { id: 'summary', name: 'Summary', iconType: 'type', required: true },
      { id: 'priority', name: 'Priority', iconType: 'arrowUpDown' },
      { id: 'description', name: 'Description', iconType: 'alignLeft' },
    ],
    contextFields: [
      { id: 'status', name: 'Status', iconType: 'arrowRight' },
      { id: 'assignee', name: 'Assignee', iconType: 'user' },
    ],
    otherFields: [
      { id: 'agent-sessions', name: 'Agent Sessions', iconType: 'folder' },
    ],
    systemFields: [
      { id: 'environment', name: 'Environment', iconType: 'alignLeft' },
      { id: 'original-estimate', name: 'Original estimate', iconType: 'clock' },
    ],
  },
}

function FieldIcon({ iconType }: { iconType: FieldItem['iconType'] }) {
  switch (iconType) {
    case 'type':
      return <span className="text-xs font-semibold text-slate-500">Aa</span>
    case 'arrowUpDown':
      return <ArrowDownUp size={15} className="text-slate-500" />
    case 'clock':
      return <Clock size={15} className="text-slate-500" />
    case 'alignLeft':
      return <AlignLeft size={15} className="text-slate-500" />
    case 'arrowRight':
      return <ArrowRight size={15} className="text-slate-500" />
    case 'user':
      return <User size={15} className="text-slate-500" />
    case 'tag':
      return <Tag size={15} className="text-slate-500" />
    case 'folder':
      return <FolderKanban size={15} className="text-slate-500" />
    case 'hash':
      return <span className="text-xs font-semibold text-slate-500">123</span>
    case 'server':
      return <Server size={15} className="text-slate-500" />
    default:
      return <AlignLeft size={15} className="text-slate-500" />
  }
}

function WorkTypeIcon({ type, size = 18 }: { type: IssueType; size?: number }) {
  switch (type) {
    case 'Epic':
      return <Zap size={size} className="text-purple-600" />
    case 'Bug':
      return <Bug size={size} className="text-red-600" />
    case 'Story':
      return <Bookmark size={size} className="text-green-600" />
    case 'Task':
      return <CheckSquare size={size} className="text-sky-600" />
    case 'Subtask':
      return <GitBranch size={size} className="text-cyan-600" />
  }
}

export default function SpaceWorkTypes() {
  const { key } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const projects = useAccessibleProjects()
  const showToast = useUi((s) => s.showToast)
  const me = useCurrentUser()

  const project = useMemo(() => {
    const found = projects.find((p) => p.key === key || p.id === key)
    if (found) return found
    if (key?.toUpperCase() === 'VIS' || key === 'Vistaar') {
      return {
        id: 'p-vis',
        key: 'VIS',
        name: 'Vistaar',
        description: 'Software space for Vistaar development.',
        icon: '🚀',
        type: 'Scrum' as const,
        leadId: me?.id || 'u2',
        memberIds: [],
        createdAt: '',
        counter: 534,
      }
    }
    return (
      projects[0] || {
        id: 'p1',
        key: 'VIS',
        name: 'Vistaar',
        description: 'Software space',
        icon: '🚀',
        type: 'Scrum' as const,
        leadId: 'u2',
        memberIds: [],
        createdAt: '',
        counter: 1,
      }
    )
  }, [projects, key, me])

  const initialType = (searchParams.get('type') as IssueType) || 'Task'
  const [activeType, setActiveType] = useState<IssueType>(
    DEFAULT_CONFIGS[initialType] ? initialType : 'Task',
  )

  // Store layout configurations per work type
  const [configs, setConfigs] = useState(() => JSON.parse(JSON.stringify(DEFAULT_CONFIGS)))
  const [hasChanges, setHasChanges] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Modals state
  const [workflowModalOpen, setWorkflowModalOpen] = useState(false)
  const [lockModalOpen, setLockModalOpen] = useState(false)
  const [createFieldModalOpen, setCreateFieldModalOpen] = useState(false)
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldType, setNewFieldType] = useState('Text (single line)')
  const [newFieldDesc, setNewFieldDesc] = useState('')
  const [addWorkTypeModalOpen, setAddWorkTypeModalOpen] = useState(false)
  const [newTypeName, setNewTypeName] = useState('')
  const [feedbackToast, setFeedbackToast] = useState(false)

  const currentConfig = configs[activeType] || DEFAULT_CONFIGS.Task

  const handleSelectType = (t: IssueType) => {
    setActiveType(t)
    setSearchParams({ type: t }, { replace: true })
  }

  const handleMoveField = (
    fieldId: string,
    fromSection: 'descriptionFields' | 'contextFields' | 'otherFields' | 'systemFields',
    toSection: 'descriptionFields' | 'contextFields' | 'otherFields' | 'systemFields',
  ) => {
    setConfigs((prev: typeof DEFAULT_CONFIGS) => {
      const typeCfg = { ...prev[activeType] }
      const item = typeCfg[fromSection].find((f) => f.id === fieldId)
      if (!item) return prev
      typeCfg[fromSection] = typeCfg[fromSection].filter((f) => f.id !== fieldId)
      typeCfg[toSection] = [...typeCfg[toSection], item]
      return { ...prev, [activeType]: typeCfg }
    })
    setHasChanges(true)
  }

  const handleDiscard = () => {
    setConfigs((prev: typeof DEFAULT_CONFIGS) => ({
      ...prev,
      [activeType]: JSON.parse(JSON.stringify(DEFAULT_CONFIGS[activeType])),
    }))
    setHasChanges(false)
    showToast('Changes discarded')
  }

  const handleSaveChanges = () => {
    setHasChanges(false)
    showToast(`Configuration saved for ${activeType}`)
  }

  const handleCreateField = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFieldName.trim()) return
    const newField: FieldItem = {
      id: `custom-${Date.now()}`,
      name: newFieldName.trim(),
      iconType: 'alignLeft',
    }
    setConfigs((prev: typeof DEFAULT_CONFIGS) => {
      const typeCfg = { ...prev[activeType] }
      typeCfg.otherFields = [...typeCfg.otherFields, newField]
      return { ...prev, [activeType]: typeCfg }
    })
    setNewFieldName('')
    setNewFieldDesc('')
    setCreateFieldModalOpen(false)
    setHasChanges(true)
    showToast(`Created field "${newField.name}"`)
  }

  // Filter right sidebar fields by search
  const filteredOtherFields = currentConfig.otherFields.filter((f: FieldItem) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase()),
  )
  const filteredSystemFields = currentConfig.systemFields.filter((f: FieldItem) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const SIDEBAR_ITEMS = [
    { label: 'Details', hasArrow: false },
    { label: 'Access', hasArrow: false },
    { label: 'Agents', hasArrow: false },
    { label: 'Notifications', hasArrow: true },
    { label: 'Automation', hasArrow: false },
    { label: 'Policies', hasArrow: false },
    { label: 'Fields', hasArrow: false },
  ]

  const WORK_TYPES: IssueType[] = ['Epic', 'Bug', 'Story', 'Task', 'Subtask']

  return (
    <div className="flex h-full min-h-[calc(100vh-3.5rem)] bg-white text-slate-800">
      {/* 1. LEFT SPACE SETTINGS SIDEBAR */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white select-none">
        <div className="flex flex-col border-b border-slate-100 p-3">
          <button
            onClick={() => navigate(`/projects/${project.key}/summary`)}
            className="flex items-center gap-2 rounded px-2 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-100"
          >
            <ArrowLeft size={16} />
            <span>Space settings</span>
          </button>
          <div className="mt-2 flex items-center gap-2.5 px-2 py-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 text-white shadow-sm font-bold text-sm">
              {project.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900">{project.name}</div>
              <div className="text-xs text-slate-500">Software space</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3 text-sm">
          {SIDEBAR_ITEMS.map((item) => (
            <button
              key={item.label}
              className="flex w-full items-center justify-between rounded px-3 py-1.5 text-left text-slate-700 hover:bg-slate-100"
              onClick={() => showToast(`${item.label} settings are managed here`)}
            >
              <span>{item.label}</span>
              {item.hasArrow && <ChevronRight size={14} className="text-slate-400" />}
            </button>
          ))}

          <div className="pt-2">
            <div className="flex items-center justify-between px-3 py-1 text-sm font-semibold text-slate-800">
              <span className="flex items-center gap-1.5">
                <ChevronDown size={14} className="text-slate-500" />
                Work types
              </span>
            </div>

            <div className="mt-0.5 space-y-0.5">
              {WORK_TYPES.map((t) => {
                const isSelected = activeType === t
                return (
                  <button
                    key={t}
                    onClick={() => handleSelectType(t)}
                    className={clsx(
                      'relative flex w-full items-center gap-2.5 rounded px-3 py-1.5 text-left text-sm transition-colors',
                      isSelected
                        ? 'bg-[#e9f2ff] font-medium text-[#0c66e4] before:absolute before:bottom-0 before:left-0 before:top-0 before:w-1 before:rounded-r before:bg-[#0c66e4]'
                        : 'text-slate-700 hover:bg-slate-100',
                    )}
                  >
                    <WorkTypeIcon type={t} size={16} />
                    <span>{t}</span>
                  </button>
                )
              })}

              <button
                onClick={() => setAddWorkTypeModalOpen(true)}
                className="flex w-full items-center gap-2.5 rounded px-3 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                <Plus size={16} className="text-slate-500" />
                <span>Add work type</span>
              </button>
            </div>
          </div>
        </nav>

        <div className="border-t border-slate-100 p-2 text-slate-400">
          <button
            className="flex items-center gap-1 rounded p-1 hover:bg-slate-100 hover:text-slate-600 text-xs"
            onClick={() => navigate(`/projects/${project.key}/summary`)}
            title="Back to space"
          >
            ‹
          </button>
        </div>
      </aside>

      {/* 2. CENTER CONTENT AREA */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Main scrollable body */}
        <div className="flex-1 overflow-y-auto px-8 py-5">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Link to="/spaces" className="hover:underline">
              Spaces
            </Link>
            <span>/</span>
            <Link to={`/projects/${project.key}/summary`} className="hover:underline">
              {project.name}
            </Link>
            <span>/</span>
            <span className="text-slate-600">Space settings</span>
            <span>/</span>
            <span className="text-slate-800">Work types</span>
          </div>

          {/* Title Header */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <WorkTypeIcon type={activeType} size={26} />
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{activeType}</h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setWorkflowModalOpen(true)}
                className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
              >
                <Workflow size={14} className="text-slate-500" />
                Edit workflow
              </button>
              <button
                type="button"
                onClick={() => setLockModalOpen(true)}
                className="rounded border border-slate-300 bg-white p-1.5 text-slate-600 shadow-xs hover:bg-slate-50"
                title="Permissions locked"
              >
                <Lock size={15} />
              </button>
              <button
                type="button"
                onClick={() => showToast('Work type options')}
                className="rounded border border-slate-300 bg-white p-1.5 text-slate-600 shadow-xs hover:bg-slate-50"
                title="More options"
              >
                <MoreHorizontal size={15} />
              </button>
            </div>
          </div>

          <p className="mt-1 text-sm text-slate-600">{currentConfig.description}</p>

          {/* Description fields section */}
          <div className="mt-6">
            <div className="mb-2 flex items-center gap-1.5">
              <h2 className="text-sm font-semibold text-slate-800">Description fields</h2>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600"
                title="Fields shown in the primary description area of the work item"
              >
                <Info size={14} />
              </button>
            </div>

            <div className="space-y-2">
              {currentConfig.descriptionFields.map((f: FieldItem) => (
                <div
                  key={f.id}
                  className="group flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 shadow-xs transition-all hover:border-slate-300 hover:shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-5 w-5 items-center justify-center">
                      <FieldIcon iconType={f.iconType} />
                    </div>
                    <span className="text-sm font-medium text-slate-800">{f.name}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {f.required ? (
                      <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
                        Required
                      </span>
                    ) : (
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => handleMoveField(f.id, 'descriptionFields', 'contextFields')}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          title="Move to Context fields"
                        >
                          <MoreHorizontal size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveField(f.id, 'descriptionFields', 'otherFields')}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          title="Remove field"
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {currentConfig.descriptionFields.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                  No description fields
                </div>
              )}
            </div>
          </div>

          {/* Context fields section */}
          <div className="mt-8">
            <div className="mb-2 flex items-center gap-1.5">
              <h2 className="text-sm font-semibold text-slate-800">Context fields</h2>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600"
                title="Fields shown in the right details panel"
              >
                <Info size={14} />
              </button>
            </div>

            <div className="space-y-2">
              {currentConfig.contextFields.map((f: FieldItem) => (
                <div
                  key={f.id}
                  className="group flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 shadow-xs transition-all hover:border-slate-300 hover:shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-5 w-5 items-center justify-center">
                      <FieldIcon iconType={f.iconType} />
                    </div>
                    <span className="text-sm font-medium text-slate-800">{f.name}</span>
                  </div>

                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => handleMoveField(f.id, 'contextFields', 'descriptionFields')}
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      title="Move to Description fields"
                    >
                      <MoreHorizontal size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveField(f.id, 'contextFields', 'otherFields')}
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      title="Remove field"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {currentConfig.contextFields.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                  No context fields
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sticky Bottom Actions Bar */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-8 py-3">
          <button
            type="button"
            onClick={() => setFeedbackToast(true)}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900"
          >
            <MessageSquare size={14} />
            Give feedback
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={!hasChanges}
              onClick={handleDiscard}
              className={clsx(
                'rounded px-3 py-1.5 text-sm font-medium transition-colors',
                hasChanges ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-400 cursor-not-allowed',
              )}
            >
              Discard
            </button>
            <button
              type="button"
              disabled={!hasChanges}
              onClick={handleSaveChanges}
              className={clsx(
                'rounded px-3.5 py-1.5 text-sm font-semibold transition-all',
                hasChanges
                  ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed',
              )}
            >
              Save changes
            </button>
          </div>
        </div>
      </div>

      {/* 3. RIGHT SIDEBAR: FIELDS */}
      <aside className="flex w-72 shrink-0 flex-col border-l border-slate-200 bg-white p-4 overflow-y-auto">
        <div className="flex items-center gap-1.5">
          <h2 className="text-base font-semibold text-slate-800">Fields</h2>
          <button
            type="button"
            className="text-slate-400 hover:text-slate-600"
            title="Available fields you can add to this work type"
          >
            <Info size={14} />
          </button>
        </div>

        <div className="mt-3">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Search fields in this space
          </label>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Type to search"
              className="w-full rounded-md border border-slate-300 py-1.5 pl-3 pr-8 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <Search size={15} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Other fields */}
        <div className="mt-4">
          <div className="text-xs font-semibold text-slate-600 mb-2">Other fields</div>
          <div className="space-y-2">
            {filteredOtherFields.map((f: FieldItem) => (
              <div key={f.id} className="relative group">
                <div
                  onClick={() => handleMoveField(f.id, 'otherFields', 'contextFields')}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-700 shadow-2xs hover:border-slate-300 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <FieldIcon iconType={f.iconType} />
                    <span>{f.name}</span>
                  </div>
                  <Plus size={14} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                {/* Tooltip for Story point estimate in Epic */}
                {f.tooltip && (
                  <div className="mt-1 rounded bg-[#172b4d] px-2.5 py-1 text-xs text-white shadow-lg">
                    {f.tooltip}
                  </div>
                )}
              </div>
            ))}
            {filteredOtherFields.length === 0 && (
              <div className="text-xs text-slate-400 py-1">No other fields</div>
            )}
          </div>
        </div>

        {/* System fields */}
        <div className="mt-4">
          <div className="text-xs font-semibold text-slate-600 mb-2">System fields</div>
          <div className="space-y-2">
            {filteredSystemFields.map((f: FieldItem) => (
              <div
                key={f.id}
                onClick={() => handleMoveField(f.id, 'systemFields', 'contextFields')}
                className="group flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-700 shadow-2xs hover:border-slate-300 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <FieldIcon iconType={f.iconType} />
                  <span>{f.name}</span>
                </div>
                <Plus size={14} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
            {filteredSystemFields.length === 0 && (
              <div className="text-xs text-slate-400 py-1">No system fields</div>
            )}
          </div>
        </div>

        {/* Bottom links */}
        <div className="mt-6 border-t border-slate-200 pt-3">
          <button
            type="button"
            onClick={() => setCreateFieldModalOpen(true)}
            className="flex w-full items-center justify-between py-1 text-xs font-medium text-slate-700 hover:text-blue-600"
          >
            <span>Create a field</span>
            <ChevronRight size={14} />
          </button>

          <div className="mt-3 text-xs text-slate-500">
            <div>Need to add a global field?</div>
            <Link
              to="/settings/work-items"
              className="mt-0.5 inline-flex items-center gap-1 text-blue-600 hover:underline font-medium"
            >
              Go to the Fields page
              <ExternalLink size={12} />
            </Link>
          </div>
        </div>
      </aside>

      {/* MODALS */}
      {/* 1. Workflow Modal */}
      <Modal
        open={workflowModalOpen}
        onClose={() => setWorkflowModalOpen(false)}
        title={`Workflow: ${activeType}`}
        width={560}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Work items of type <b>{activeType}</b> follow this lifecycle workflow in {project.name}:
          </p>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <span className="rounded bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-800">
              To Do
            </span>
            <ArrowRight size={14} className="text-slate-400" />
            <span className="rounded bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white">
              In Progress
            </span>
            <ArrowRight size={14} className="text-slate-400" />
            <span className="rounded bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white">
              Developers Done
            </span>
            <ArrowRight size={14} className="text-slate-400" />
            <span className="rounded bg-purple-600 px-2.5 py-1 text-xs font-semibold text-white">
              QA-Done
            </span>
            <ArrowRight size={14} className="text-slate-400" />
            <span className="rounded bg-green-600 px-2.5 py-1 text-xs font-semibold text-white">
              Done
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Any status can transition to any other status within the space permissions.
          </p>
        </div>
      </Modal>

      {/* 2. Permissions Locked Modal */}
      <Modal
        open={lockModalOpen}
        onClose={() => setLockModalOpen(false)}
        title="Field Permissions"
        width={480}
      >
        <div className="space-y-3 text-sm text-slate-600">
          <p>
            Field scheme for <b>{activeType}</b> in space <b>{project.name}</b> is active.
          </p>
          <p className="text-xs text-slate-500">
            Changes to description and context fields apply to all work items of this type in this space.
          </p>
        </div>
      </Modal>

      {/* 3. Create Field Modal */}
      <Modal
        open={createFieldModalOpen}
        onClose={() => setCreateFieldModalOpen(false)}
        title="Create a field"
        width={480}
      >
        <form onSubmit={handleCreateField} className="space-y-4">
          <div>
            <label className="label">Field name</label>
            <input
              type="text"
              required
              className="input"
              placeholder="e.g. Impact, Target Release"
              value={newFieldName}
              onChange={(e) => setNewFieldName(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Field type</label>
            <select
              className="input"
              value={newFieldType}
              onChange={(e) => setNewFieldType(e.target.value)}
            >
              <option>Text (single line)</option>
              <option>Paragraph (multi-line)</option>
              <option>Number</option>
              <option>Date picker</option>
              <option>Select list (single choice)</option>
              <option>User picker</option>
              <option>Checkboxes</option>
            </select>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              className="input min-h-20"
              placeholder="Explain how this field is used..."
              value={newFieldDesc}
              onChange={(e) => setNewFieldDesc(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn-subtle"
              onClick={() => setCreateFieldModalOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={!newFieldName.trim()}>
              Create
            </button>
          </div>
        </form>
      </Modal>

      {/* 4. Add Work Type Modal */}
      <Modal
        open={addWorkTypeModalOpen}
        onClose={() => setAddWorkTypeModalOpen(false)}
        title="Add work type"
        width={480}
      >
        <div className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Improvement, Spike"
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
            />
          </div>
          <p className="text-xs text-slate-500">
            Custom work types inherit standard Jira Agile workflows and permissions.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn-subtle"
              onClick={() => setAddWorkTypeModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!newTypeName.trim()}
              onClick={() => {
                showToast(`Work type "${newTypeName}" added`)
                setAddWorkTypeModalOpen(false)
                setNewTypeName('')
              }}
            >
              Add
            </button>
          </div>
        </div>
      </Modal>

      {/* Feedback Toast */}
      {feedbackToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-white shadow-xl">
          <Check size={16} className="text-green-400" />
          <span>Thank you for your feedback!</span>
          <button
            onClick={() => setFeedbackToast(false)}
            className="ml-2 text-slate-400 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
