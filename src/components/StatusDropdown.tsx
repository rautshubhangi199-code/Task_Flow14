import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { Check, ChevronDown, SquareArrowOutUpRight, Workflow, X } from 'lucide-react'
import { STATUSES, type Status } from '../types'
import { isDone } from '../lib/utils'
import { Modal } from './ui'
import { useUi } from '../store/uiStore'

// Default list of statuses matching Jira standard workflow from the screenshot
const INITIAL_STATUSES = [
  'To Do',
  'In Progress',
  'Dev Done',
  'On-Hold',
  'QA Done',
  'Re-Open',
  'Done',
]

const CHIP_MENU_STATUSES = [
  'block',
  'Cancel',
  'Reject',
  'To Do',
  'Daily Running',
  'Dev Done',
  'On-Hold',
  'QA Done',
]

function canonicalStatus(name: string): Status {
  const n = name.trim().toLowerCase().replace(/[\s-_]/g, '')
  if (n === 'todo') return 'To Do'
  if (n === 'inprogress' || n === 'dailyrunning') return 'In Progress'
  if (n === 'devdone' || n === 'developersdone') return 'Developers Done'
  if (n === 'qadone') return 'QA-Done'
  if (n === 'done') return 'Done'
  if (n === 'reject') return 'Reject'
  if (n === 'onhold' || n === 'block') return 'On Hold'
  if (n === 'drop' || n === 'cancel') return 'Drop'
  if ((STATUSES as readonly string[]).includes(name)) return name as Status
  return 'To Do'
}

function lozengeClass(name: string) {
  const n = name.trim().toLowerCase()
  if (['block', 'cancel', 'reject', 'to do', 'drop'].includes(n)) {
    return 'bg-[#dfe1e6] text-[#42526e]'
  }
  if (n === 'done') return 'bg-[#e3fcef] text-[#006644]'
  return 'bg-[#d2e5fe] text-[#0747a6]'
}

export function StatusCircleIcon({ status, size = 16 }: { status: string; size?: number }) {
  const s = status.toLowerCase()
  if (s === 'done' || isDone(status as Status)) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#22a06b] text-white shadow-2xs"
        style={{ width: size, height: size }}
      >
        <Check size={size * 0.7} strokeWidth={3} />
      </span>
    )
  }
  if (s.includes('reject') || s.includes('drop')) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-red-500 text-white shadow-2xs"
        style={{ width: size, height: size }}
      >
        <X size={size * 0.7} strokeWidth={3} />
      </span>
    )
  }
  if (s.includes('hold')) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full border-2 border-blue-600 bg-white"
        style={{ width: size, height: size }}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
      </span>
    )
  }
  if (s.includes('qa') || s.includes('dev') || s.includes('progress') || s.includes('re-open') || s.includes('reopen')) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full border-2 border-blue-600 bg-white"
        style={{ width: size, height: size }}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
      </span>
    )
  }
  // To Do or default
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full border-2 border-blue-600 bg-white"
      style={{ width: size, height: size }}
    >
      <span className="h-1 w-1 rounded-full bg-blue-600" />
    </span>
  )
}

interface StatusDropdownProps {
  value: Status | string
  onChange: (status: Status) => void
  projectKey?: string
  variant?: 'button' | 'chip' | 'select' | 'compact'
  className?: string
  align?: 'left' | 'right'
}

export function StatusDropdown({
  value,
  onChange,
  projectKey = 'VIS',
  variant = 'button',
  className,
  align = 'left',
}: StatusDropdownProps) {
  const [open, setOpen] = useState(false)
  const [statuses, setStatuses] = useState<string[]>(() => {
    // Merge initial Jira statuses with any existing STATUSES from types
    const set = new Set([...INITIAL_STATUSES, ...STATUSES])
    if (value && !set.has(value)) set.add(value)
    return Array.from(set)
  })

  const [addModalOpen, setAddModalOpen] = useState(false)
  const [newStatusName, setNewStatusName] = useState('')
  const [newStatusCategory, setNewStatusCategory] = useState<'To Do' | 'In Progress' | 'Done'>('In Progress')

  const [editModalOpen, setEditModalOpen] = useState(false)
  const [statusToEdit, setStatusToEdit] = useState(value)
  const [editedStatusName, setEditedStatusName] = useState(value)

  const [workflowModalOpen, setWorkflowModalOpen] = useState(false)
  const [explainOpen, setExplainOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })

  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const navigate = useNavigate()
  const showToast = useUi((s) => s.showToast)

  const toggleOpen = () => {
    setOpen((o) => {
      const next = !o
      if (next && triggerRef.current) {
        const r = triggerRef.current.getBoundingClientRect()
        setMenuPos({ top: r.bottom + 4, left: r.left })
      }
      return next
    })
  }

  // Keep selected status in list if changed externally
  useEffect(() => {
    if (value && !statuses.includes(value)) {
      setStatuses((prev) => [...prev, value])
    }
  }, [value, statuses])

  // Click outside to close
  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('[data-status-dropdown]')) return
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside, true)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const handleSelectStatus = (s: string) => {
    onChange(variant === 'chip' ? canonicalStatus(s) : (s as Status))
    setOpen(false)
  }

  const handleViewWorkflow = () => {
    setOpen(false)
    if (projectKey) navigate(`/projects/${projectKey}/settings/work-types`)
    else setWorkflowModalOpen(true)
  }

  const handleExplainWorkflow = () => {
    setOpen(false)
    setExplainOpen(true)
  }

  const handleAddStatus = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newStatusName.trim()
    if (!trimmed) return
    if (!statuses.includes(trimmed)) {
      setStatuses((prev) => [...prev, trimmed])
    }
    onChange(trimmed as Status)
    setNewStatusName('')
    setAddModalOpen(false)
    showToast(`Status "${trimmed}" added`)
  }

  const handleEditStatus = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = editedStatusName.trim()
    if (!trimmed) return
    setStatuses((prev) => prev.map((s) => (s === statusToEdit ? trimmed : s)))
    if (value === statusToEdit) {
      onChange(trimmed as Status)
    }
    setEditModalOpen(false)
    showToast(`Status updated to "${trimmed}"`)
  }

  const handleManageWorkflow = () => {
    setOpen(false)
    if (projectKey) {
      navigate(`/projects/${projectKey}/settings/work-types`)
    } else {
      setWorkflowModalOpen(true)
    }
  }

  // Trigger button render by variant
  const renderTrigger = () => {
    switch (variant) {
      case 'chip':
        return (
          <button
            ref={triggerRef}
            type="button"
            data-status-dropdown
            onClick={toggleOpen}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-sm font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors',
              open && 'ring-2 ring-blue-500 border-blue-500',
              className,
            )}
          >
            <StatusCircleIcon status={value} size={14} />
            <span>{value}</span>
            <ChevronDown size={12} className="text-slate-400" />
          </button>
        )
      case 'select':
        return (
          <button
            type="button"
            onClick={toggleOpen}
            className={clsx(
              'flex w-full items-center justify-between rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-2xs hover:border-slate-300 transition-colors',
              open && 'ring-2 ring-blue-500 border-blue-500',
              className,
            )}
          >
            <div className="flex items-center gap-1.5 truncate">
              <StatusCircleIcon status={value} size={13} />
              <span className="truncate">{value}</span>
            </div>
            <ChevronDown size={12} className="text-slate-400 shrink-0 ml-1" />
          </button>
        )
      case 'compact':
        return (
          <button
            type="button"
            onClick={toggleOpen}
            className={clsx(
              'flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700 shadow-2xs hover:bg-slate-50',
              className,
            )}
          >
            <StatusCircleIcon status={value} size={12} />
            <span>{value}</span>
            <ChevronDown size={11} className="text-slate-400" />
          </button>
        )
      case 'button':
      default:
        return (
          <button
            type="button"
            onClick={toggleOpen}
            className={clsx(
              'flex items-center gap-2 rounded px-3 py-1.5 text-sm font-semibold transition-colors shadow-2xs',
              isDone(value as Status)
                ? 'bg-[#22a06b] text-white hover:bg-green-700'
                : value === 'To Do'
                ? 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                : 'bg-[#0c66e4] text-white hover:bg-blue-700',
              className,
            )}
          >
            <span>{value}</span>
            <ChevronDown size={14} className="opacity-90" />
          </button>
        )
    }
  }

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      {renderTrigger()}

      {open && variant === 'chip' && createPortal(
        <div
          data-status-dropdown
          className="fixed z-[80] min-w-[220px] overflow-hidden rounded-[8px] border border-[#dfe1e6] bg-white py-1 shadow-[0_8px_16px_rgba(9,30,66,0.25)]"
          style={{ top: menuPos.top, left: menuPos.left }}
        >
          <div className="py-0.5">
            {CHIP_MENU_STATUSES.map((s) => {
              const isCurrent = canonicalStatus(s) === canonicalStatus(value)
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSelectStatus(s)}
                  className={clsx(
                    'flex w-full items-center px-3 py-[7px] text-left hover:bg-[#f4f5f7]',
                    isCurrent && 'border-l-[3px] border-l-[#0C66E4] bg-[#f4f5f7] pl-[9px]',
                  )}
                >
                  <span className={clsx('inline-flex rounded-[3px] px-2 py-0.5 text-[13px] font-medium', lozengeClass(s))}>
                    {s}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="mt-0.5 border-t border-[#dfe1e6] py-1">
            <button
              type="button"
              onClick={handleViewWorkflow}
              className="flex w-full items-center px-4 py-2.5 text-left text-[15px] text-[#172b4d] hover:bg-[#f4f5f7]"
            >
              View workflow
            </button>
            <button
              type="button"
              onClick={handleExplainWorkflow}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[15px] text-[#172b4d] hover:bg-[#f4f5f7]"
            >
              <SquareArrowOutUpRight size={16} className="text-[#44546f]" />
              Explain workflow
            </button>
          </div>
        </div>,
        document.body,
      )}

      {/* DROPDOWN MENU - Matches uploaded image */}
      {open && variant !== 'chip' && (
        <div
          className={clsx(
            'absolute z-50 mt-1 min-w-[240px] max-w-[320px] rounded-lg border border-slate-200 bg-white py-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-100',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {/* Status list */}
          <div className="max-h-60 overflow-y-auto py-0.5">
            {statuses.map((s) => {
              const isCurrent = s === value
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSelectStatus(s)}
                  className={clsx(
                    'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors',
                    isCurrent ? 'bg-blue-50/70 font-medium text-slate-900' : 'text-slate-800 hover:bg-slate-50',
                  )}
                >
                  <StatusCircleIcon status={s} size={16} />
                  <span className="flex-1 truncate">{s}</span>
                  {isCurrent && <Check size={14} className="text-blue-600 shrink-0" />}
                </button>
              )
            })}
          </div>

          {/* Divider */}
          <div className="my-1 border-t border-slate-200" />

          {/* 3 Action Items from Image */}
          <div className="py-0.5">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setAddModalOpen(true)
              }}
              className="flex w-full items-center px-3.5 py-2 text-left text-sm text-slate-800 hover:bg-slate-100 transition-colors"
            >
              Add status
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setStatusToEdit(value)
                setEditedStatusName(value)
                setEditModalOpen(true)
              }}
              className="flex w-full items-center px-3.5 py-2 text-left text-sm text-slate-800 hover:bg-slate-100 transition-colors"
            >
              Edit status
            </button>
            <button
              type="button"
              onClick={handleManageWorkflow}
              className="flex w-full items-center px-3.5 py-2 text-left text-sm text-slate-800 hover:bg-slate-100 transition-colors"
            >
              Manage workflow
            </button>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD STATUS */}
      <Modal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add status"
        width={460}
      >
        <form onSubmit={handleAddStatus} className="space-y-4">
          <div>
            <label className="label">Status name</label>
            <input
              type="text"
              required
              autoFocus
              className="input"
              placeholder="e.g. In Code Review, Testing, Blocked"
              value={newStatusName}
              onChange={(e) => setNewStatusName(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Category</label>
            <div className="mt-1 space-y-2 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="category"
                  value="To Do"
                  checked={newStatusCategory === 'To Do'}
                  onChange={() => setNewStatusCategory('To Do')}
                />
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  To Do
                </span>
                <span className="text-xs text-slate-500">(Work that hasn't started)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="category"
                  value="In Progress"
                  checked={newStatusCategory === 'In Progress'}
                  onChange={() => setNewStatusCategory('In Progress')}
                />
                <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                  In Progress
                </span>
                <span className="text-xs text-slate-500">(Work being actively worked on)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="category"
                  value="Done"
                  checked={newStatusCategory === 'Done'}
                  onChange={() => setNewStatusCategory('Done')}
                />
                <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                  Done
                </span>
                <span className="text-xs text-slate-500">(Work completed)</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              className="btn-subtle"
              onClick={() => setAddModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={!newStatusName.trim()}
            >
              Add status
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: EDIT STATUS */}
      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit status"
        width={460}
      >
        <form onSubmit={handleEditStatus} className="space-y-4">
          <div>
            <label className="label">Status to edit</label>
            <select
              className="input"
              value={statusToEdit}
              onChange={(e) => {
                setStatusToEdit(e.target.value)
                setEditedStatusName(e.target.value)
              }}
            >
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Status name</label>
            <input
              type="text"
              required
              className="input"
              value={editedStatusName}
              onChange={(e) => setEditedStatusName(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              className="btn-subtle"
              onClick={() => setEditModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={!editedStatusName.trim()}
            >
              Save changes
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={explainOpen}
        onClose={() => setExplainOpen(false)}
        title="Explain workflow"
        width={480}
      >
        <p className="text-sm text-[#44546f]">
          This work item follows the space workflow. Move it between statuses as work progresses.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {CHIP_MENU_STATUSES.map((s) => (
            <span key={s} className={clsx('rounded-[3px] px-2 py-0.5 text-[13px] font-medium', lozengeClass(s))}>
              {s}
            </span>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" className="btn-primary" onClick={() => setExplainOpen(false)}>Close</button>
        </div>
      </Modal>

      {/* MODAL 3: MANAGE WORKFLOW */}
      <Modal
        open={workflowModalOpen}
        onClose={() => setWorkflowModalOpen(false)}
        title="Manage Workflow"
        width={540}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Workflow statuses and transition rules for space <b>{projectKey}</b>:
          </p>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
            {statuses.map((s, idx) => (
              <span key={s} className="flex items-center gap-1.5 text-xs font-semibold">
                <StatusCircleIcon status={s} size={14} />
                <span className="rounded bg-white border border-slate-200 px-2 py-0.5 text-slate-800 shadow-2xs">
                  {s}
                </span>
                {idx < statuses.length - 1 && <span className="text-slate-300">→</span>}
              </span>
            ))}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <button
              type="button"
              className="btn-default flex items-center gap-1.5"
              onClick={() => {
                setWorkflowModalOpen(false)
                navigate(`/projects/${projectKey}/settings/work-types`)
              }}
            >
              <Workflow size={14} /> Open Space Settings
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setWorkflowModalOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
