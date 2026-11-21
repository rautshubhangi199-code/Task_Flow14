import { useMemo, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import {
  ArrowLeft, Bookmark, Bug, CheckSquare, ChevronDown, CircleHelp, FileText, Flag, Mail,
  MoreHorizontal, Plus, Search, Zap,
} from 'lucide-react'
import { useCurrentUser } from '../../store/hooks'
import { canAccessSettings } from '../../lib/permissions'
import { Dropdown, Modal } from '../../components/ui'

type Hierarchy = 1 | 0 | -1

interface WorkType {
  id: string
  name: string
  description: string
  level: Hierarchy
  icon: 'epic' | 'question' | 'bug' | 'email' | 'feature' | 'story' | 'request' | 'task' | 'subtask'
  schemes: string[]
}

const SCHEMES = {
  default: 'Default Issue Type Scheme',
  op: 'OP: Scrum Issue Type Scheme',
  tcmp: 'TCMP: Scrum Issue Type Scheme',
  ut: 'UT: Scrum Issue Type Scheme',
  sup: 'SUP: Jira Service Management Issue Type Scheme',
}

const DEFAULT_TYPES: WorkType[] = [
  {
    id: 'epic',
    name: 'Epic',
    description: 'A big user story that needs to be broken down. Created by Jira Software - do not edit or delete.',
    level: 1,
    icon: 'epic',
    schemes: [SCHEMES.default, SCHEMES.op, SCHEMES.tcmp, SCHEMES.ut],
  },
  {
    id: 'ask',
    name: 'Ask a question',
    description: 'Have a question? Submit it here.',
    level: 0,
    icon: 'question',
    schemes: [SCHEMES.default, SCHEMES.sup],
  },
  {
    id: 'bug',
    name: 'Bug',
    description: 'A problem or error.',
    level: 0,
    icon: 'bug',
    schemes: [SCHEMES.default, SCHEMES.op, SCHEMES.tcmp, SCHEMES.ut],
  },
  {
    id: 'email',
    name: 'Emailed request',
    description: 'Request received from your email support channel.',
    level: 0,
    icon: 'email',
    schemes: [SCHEMES.default, SCHEMES.sup],
  },
  {
    id: 'feature',
    name: 'Feature',
    description: 'Feature',
    level: 0,
    icon: 'feature',
    schemes: [SCHEMES.default, SCHEMES.op, SCHEMES.tcmp, SCHEMES.ut],
  },
  {
    id: 'story',
    name: 'Story',
    description: 'Stories track functionality or features expressed as user goals.',
    level: 0,
    icon: 'story',
    schemes: [SCHEMES.default, SCHEMES.op, SCHEMES.tcmp, SCHEMES.ut],
  },
  {
    id: 'request',
    name: 'Submit a request or incident',
    description: 'Submit a request or report a problem.',
    level: 0,
    icon: 'request',
    schemes: [SCHEMES.default, SCHEMES.sup],
  },
  {
    id: 'task',
    name: 'Task',
    description: 'A task that needs to be done.',
    level: 0,
    icon: 'task',
    schemes: [SCHEMES.default, SCHEMES.op, SCHEMES.tcmp, SCHEMES.ut, SCHEMES.sup],
  },
  {
    id: 'subtask',
    name: 'Sub-task',
    description: 'The sub-task of the issue',
    level: -1,
    icon: 'subtask',
    schemes: [SCHEMES.default, SCHEMES.op, SCHEMES.tcmp, SCHEMES.ut, SCHEMES.sup],
  },
]

const SWITCH_SETTINGS = [
  { to: '/settings/system', label: 'System' },
  { to: '/settings/jira-apps', label: 'Jira apps' },
  { to: '/settings/spaces', label: 'Spaces' },
  { to: '/settings/work-items', label: 'Work items' },
  { to: '/settings/marketplace', label: 'Marketplace apps' },
]

const NAV = [
  { group: 'Work types', items: [
    { id: 'hierarchy', label: 'Work type hierarchy' },
    { id: 'types', label: 'Work types' },
    { id: 'type-schemes', label: 'Work type schemes' },
  ]},
  { group: 'Sub-tasks', items: [] },
  { group: 'Workflows', items: [
    { id: 'workflows', label: 'Workflows' },
    { id: 'workflow-schemes', label: 'Workflow schemes' },
  ]},
  { group: 'Screens', items: [
    { id: 'screens', label: 'Screens' },
    { id: 'screen-schemes', label: 'Screen schemes' },
    { id: 'wt-screen-schemes', label: 'Work type screen schemes' },
  ]},
  { group: 'Fields', items: [
    { id: 'fields', label: 'Fields' },
    { id: 'field-schemes', label: 'Field schemes' },
  ]},
]

function WorkTypeGlyph({ icon, size = 18 }: { icon: WorkType['icon']; size?: number }) {
  const wrap = (bg: string, child: ReactNode) => (
    <span className={clsx('inline-flex shrink-0 items-center justify-center rounded-sm text-white', bg)} style={{ width: size, height: size }}>
      {child}
    </span>
  )
  const s = size * 0.68
  if (icon === 'epic') return wrap('bg-[#8f7ee7]', <Zap size={s} strokeWidth={2.5} />)
  if (icon === 'question') return wrap('bg-[#f15b50]', <CircleHelp size={s} strokeWidth={2.5} />)
  if (icon === 'bug') return wrap('bg-[#e34935]', <Bug size={s} strokeWidth={2.5} />)
  if (icon === 'email') return wrap('bg-[#f15b50]', <Mail size={s} strokeWidth={2.5} />)
  if (icon === 'feature') return wrap('bg-[#0c66e4]', <FileText size={s} strokeWidth={2.5} />)
  if (icon === 'story') return wrap('bg-[#22a06b]', <Bookmark size={s} strokeWidth={2.5} />)
  if (icon === 'request') return wrap('bg-[#6e5dc6]', <Flag size={s} strokeWidth={2.5} />)
  if (icon === 'subtask') return wrap('bg-[#4bade8]', <CheckSquare size={s} strokeWidth={2.5} />)
  return wrap('bg-[#4bade8]', <CheckSquare size={s} strokeWidth={2.5} />)
}

export default function WorkItemsSettings() {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const [section, setSection] = useState('types')
  const [query, setQuery] = useState('')
  const [types, setTypes] = useState<WorkType[]>(DEFAULT_TYPES)
  const [addOpen, setAddOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [scheme, setScheme] = useState(SCHEMES.default)
  const [kind, setKind] = useState<'standard' | 'subtask'>('standard')
  const [error, setError] = useState('')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return types.filter((t) => !q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))
  }, [types, query])

  if (!canAccessSettings(user)) return <Navigate to="/for-you" replace />

  const addType = () => {
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    const next: WorkType = {
      id: `custom-${Date.now()}`,
      name: name.trim(),
      description: description.trim() || name.trim(),
      level: kind === 'subtask' ? -1 : 0,
      icon: kind === 'subtask' ? 'subtask' : 'task',
      schemes: [scheme],
    }
    setTypes((prev) => [...prev, next])
    setAddOpen(false)
    setName('')
    setDescription('')
    setScheme(SCHEMES.default)
    setKind('standard')
    setError('')
    setSection('types')
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] bg-white">
      <aside className="flex w-[260px] shrink-0 flex-col border-r border-slate-200 bg-white">
        <Link to="/settings/system" className="flex items-center gap-2 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50">
          <ArrowLeft size={16} /> Jira admin settings
        </Link>
        <div className="px-4 pb-1 text-xs text-slate-500">Switch settings</div>
        <div className="px-3 pb-3">
          <Dropdown
            menuClassName="!w-[228px]"
            trigger={(open) => (
              <button type="button" className={clsx('flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm', open ? 'border-[#0c66e4] ring-1 ring-[#0c66e4]' : 'border-slate-300')}>
                <span className="flex items-center gap-2 text-slate-800">
                  <FileText size={16} className="text-slate-600" /> Work items
                </span>
                <ChevronDown size={16} className="text-slate-500" />
              </button>
            )}
          >
            {(close) => (
              <div className="py-1">
                {SWITCH_SETTINGS.map((s) => (
                  <button
                    key={s.to}
                    type="button"
                    className={clsx('flex w-full px-3 py-2 text-left text-sm hover:bg-slate-50', s.to === '/settings/work-items' && 'bg-blue-50 font-medium text-slate-900')}
                    onClick={() => { navigate(s.to); close() }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </Dropdown>
        </div>
        <nav className="flex-1 overflow-y-auto pb-6">
          {NAV.map((g) => (
            <div key={g.group} className="mt-2">
              <div className="px-4 py-1.5 text-[13px] font-semibold text-slate-800">{g.group}</div>
              {g.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={clsx(
                    'flex w-full border-l-[3px] px-4 py-1.5 text-left text-[13px]',
                    section === item.id ? 'border-[#0c66e4] bg-[#e9f2ff] font-medium text-slate-900' : 'border-transparent text-slate-700 hover:bg-slate-50',
                  )}
                  onClick={() => setSection(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1 overflow-auto px-8 py-6">
        {section === 'types' ? (
          <>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h1 className="text-[24px] font-semibold text-slate-900">Work types</h1>
                <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-slate-600">
                  Work types allow you to structure your work within your teams. You can assign these work types to a new hierarchy level on the{' '}
                  <button type="button" className="text-[#0c66e4] hover:underline" onClick={() => setSection('hierarchy')}>Work type hierarchy</button>
                  {' '}page.{' '}
                  <a className="text-[#0c66e4] hover:underline" href="https://support.atlassian.com/jira-cloud-administration/docs/what-are-issue-types/" target="_blank" rel="noreferrer">
                    Find out about work types in Jira.
                  </a>
                </p>
              </div>
              <button type="button" className="btn-primary shrink-0" onClick={() => { setError(''); setAddOpen(true) }}>
                <Plus size={16} /> Add work type
              </button>
            </div>

            <div className="relative mb-3 max-w-md">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full rounded-md border border-slate-300 py-1.5 pl-9 pr-3 text-sm outline-none placeholder:text-slate-400 focus:border-[#0c66e4]"
                placeholder="Filter work types by name or description"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <table className="w-full border-t border-slate-200 text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[12px] font-semibold text-slate-600">
                  <th className="py-2.5 pr-4 font-semibold">Name</th>
                  <th className="w-36 py-2.5 pr-4 font-semibold">Hierarchy Level</th>
                  <th className="py-2.5 pr-4 font-semibold">Related schemes</th>
                  <th className="w-20 py-2.5 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((t) => (
                  <tr key={t.id} className="border-b border-slate-200 align-top hover:bg-slate-50">
                    <td className="py-3 pr-4">
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5"><WorkTypeGlyph icon={t.icon} /></span>
                        <span>
                          <span className="block font-medium text-slate-900">{t.name}</span>
                          <span className="mt-0.5 block text-[13px] text-slate-500">{t.description}</span>
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-slate-800">{t.level}</td>
                    <td className="py-3 pr-4">
                      <ul className="space-y-0.5 text-[13px]">
                        {t.schemes.map((s) => (
                          <li key={s} className="flex gap-1.5 text-[#0c66e4]">
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-500" />
                            <button type="button" className="text-left hover:underline" onClick={() => setSection('type-schemes')}>{s}</button>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="py-3">
                      <button type="button" className="rounded p-1 text-slate-500 hover:bg-slate-100" title="Actions">
                        <MoreHorizontal size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visible.length === 0 && <div className="py-10 text-center text-sm text-slate-500">No work types match your filter.</div>}
          </>
        ) : (
          <div>
            <h1 className="text-[24px] font-semibold text-slate-900">{NAV.flatMap((g) => g.items).find((i) => i.id === section)?.label ?? 'Work items'}</h1>
            <p className="mt-2 text-sm text-slate-600">Configure this area from Work items settings. The Work types list is the primary view.</p>
            <button type="button" className="mt-4 text-sm text-[#0c66e4] hover:underline" onClick={() => setSection('types')}>
              Back to work types
            </button>
          </div>
        )}
      </div>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add work type"
        width={520}
        footer={(
          <>
            <button type="button" className="btn-primary" onClick={addType}>Add</button>
            <button type="button" className="btn-subtle" onClick={() => setAddOpen(false)}>Cancel</button>
          </>
        )}
      >
        <label className="mb-1 block text-sm font-medium text-slate-800">
          Name <span className="text-red-600">*</span>
        </label>
        <input
          autoFocus
          className="mb-4 w-full rounded-md border-2 border-[#0c66e4] px-3 py-2 text-sm outline-none"
          value={name}
          onChange={(e) => { setName(e.target.value); setError('') }}
        />
        <label className="mb-1 block text-sm font-medium text-slate-800">Description</label>
        <textarea
          className="mb-4 min-h-[72px] w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0c66e4]"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <label className="mb-1 block text-sm font-medium text-slate-800">Work type scheme</label>
        <select
          className="mb-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0c66e4]"
          value={scheme}
          onChange={(e) => setScheme(e.target.value)}
        >
          {Object.values(SCHEMES).map((s) => <option key={s}>{s}</option>)}
        </select>
        <p className="mb-4 text-[13px] text-slate-500">An optional work type scheme to associate the work type to</p>
        <div className="mb-1 text-sm font-medium text-slate-800">Type <span className="text-red-600">*</span></div>
        <label className="mb-2 flex items-center gap-2 text-sm text-slate-800">
          <input type="radio" name="wt-kind" checked={kind === 'standard'} onChange={() => setKind('standard')} />
          Standard work type (Level 0)
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-800">
          <input type="radio" name="wt-kind" checked={kind === 'subtask'} onChange={() => setKind('subtask')} />
          Subtask work type (Level -1)
        </label>
        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
      </Modal>
    </div>
  )
}
