import { useEffect, useRef, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import {
  ArrowDown, ArrowUp, Bookmark, Bug, CheckSquare, ChevronsDown, ChevronsUp, Equal, GitBranch, X, Zap,
} from 'lucide-react'
import type { IssueType, Priority, Status, User } from '../types'
import { initials, STATUS_STYLE } from '../lib/utils'

export function Avatar({ user, size = 24, title }: { user?: User | null; size?: number; title?: string }) {
  if (!user)
    return (
      <span
        title={title ?? 'Unassigned'}
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500"
        style={{ width: size, height: size, fontSize: size * 0.42 }}
      >
        ?
      </span>
    )
  return (
    <span
      title={title ?? user.name}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: user.color, fontSize: size * 0.4 }}
    >
      {initials(user.name)}
    </span>
  )
}

const TYPE_META: Record<IssueType, { icon: typeof Bug; bg: string }> = {
  Epic: { icon: Zap, bg: 'bg-purple-600' },
  Story: { icon: Bookmark, bg: 'bg-green-600' },
  Task: { icon: CheckSquare, bg: 'bg-sky-600' },
  Subtask: { icon: GitBranch, bg: 'bg-cyan-600' },
  Bug: { icon: Bug, bg: 'bg-red-600' },
}

export function TypeIcon({ type, size = 16 }: { type: IssueType; size?: number }) {
  const M = TYPE_META[type]
  const Icon = M.icon
  return (
    <span title={type} className={clsx('inline-flex shrink-0 items-center justify-center rounded-sm text-white', M.bg)} style={{ width: size, height: size }}>
      <Icon size={size * 0.7} strokeWidth={2.5} />
    </span>
  )
}

export function PriorityIcon({ priority }: { priority: Priority }) {
  const map: Record<Priority, ReactNode> = {
    Highest: <ChevronsUp size={16} className="text-red-600" />,
    High: <ArrowUp size={16} className="text-red-500" />,
    Medium: <Equal size={16} className="text-amber-500" />,
    Low: <ArrowDown size={16} className="text-sky-500" />,
    Lowest: <ChevronsDown size={16} className="text-sky-600" />,
  }
  return <span title={priority} className="inline-flex">{map[priority]}</span>
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={clsx('inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide', STATUS_STYLE[status])}>
      {status}
    </span>
  )
}

export function Modal({ open, onClose, title, children, footer, width = 640 }: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: number
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-6" onMouseDown={onClose}>
      <div className="mt-8 flex max-h-[calc(100vh-5rem)] w-full flex-col rounded-lg bg-white shadow-2xl" style={{ maxWidth: width }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="btn-subtle p-1!" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

/** Small click-to-open dropdown. */
export function Dropdown({ trigger, children, align = 'left', className, menuClassName }: {
  trigger: (open: boolean) => ReactNode
  children: (close: () => void) => ReactNode
  align?: 'left' | 'right'
  className?: string
  menuClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc, true)
    return () => document.removeEventListener('mousedown', onDoc, true)
  }, [open])
  return (
    <div className={clsx('relative', className)} ref={ref}>
      <div onClick={() => setOpen((o) => !o)}>{trigger(open)}</div>
      {open && (
        <div className={clsx('absolute z-40 mt-1 min-w-48 rounded-md border border-slate-200 bg-white py-1 shadow-lg', align === 'right' ? 'right-0' : 'left-0', menuClassName)}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

export function MenuItem({ onClick, children, active, danger }: { onClick: () => void; children: ReactNode; active?: boolean; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={clsx('flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-100', active && 'bg-brand-50 text-brand-700', danger && 'text-red-600')}
    >
      {children}
    </button>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 px-6 py-12 text-center">
      <div className="text-base font-semibold text-slate-700">{title}</div>
      {children && <div className="mt-1 text-sm text-slate-500">{children}</div>}
    </div>
  )
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 border-b border-slate-200">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={clsx('-mb-px border-b-2 px-3 py-2 text-sm font-medium', value === t.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-600 hover:text-slate-900')}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function ProgressBar({ value, color = 'bg-green-600' }: { value: number; color?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
      <div className={clsx('h-full rounded-full', color)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}

export function ProjectIcon({ icon, size = 24 }: { icon: string; size?: number }) {
  const isImage = icon.startsWith('data:') || icon.startsWith('http://') || icon.startsWith('https://')
  return (
    <span className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded bg-brand-50" style={{ width: size, height: size, fontSize: size * 0.6 }}>
      {isImage ? <img src={icon} alt="" className="h-full w-full object-cover" /> : icon}
    </span>
  )
}
