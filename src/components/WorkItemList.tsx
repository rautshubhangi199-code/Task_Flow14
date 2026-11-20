import { Link } from 'react-router-dom'
import { useStore } from '../store/useStore'
import type { WorkItem } from '../types'
import { timeAgo } from '../lib/utils'
import { Avatar, EmptyState, StatusBadge, TypeIcon } from './ui'

export interface ActivityRow {
  item: WorkItem
  at: string
  label?: string
}

/** Jira-style list of work items: title, type, ID, project, last activity, employee. */
export function WorkItemActivityList({ rows, empty }: { rows: ActivityRow[]; empty: string }) {
  const projects = useStore((s) => s.projects)
  const users = useStore((s) => s.users)
  if (!rows.length) return <EmptyState title={empty} />
  return (
    <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
      {rows.map(({ item, at, label }) => {
        const p = projects.find((x) => x.id === item.projectId)
        const assignee = users.find((u) => u.id === item.assigneeId)
        return (
          <Link key={item.id} to={`/browse/${item.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
            <TypeIcon type={item.type} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-slate-800">{item.summary}</div>
              <div className="text-xs text-slate-500">
                {item.id} · {p?.name} · {item.type}
              </div>
            </div>
            <StatusBadge status={item.status} />
            <div className="w-40 text-right text-xs text-slate-500">
              {label ?? 'Updated'} {timeAgo(at)}
            </div>
            <Avatar user={assignee} size={24} />
          </Link>
        )
      })}
    </div>
  )
}
