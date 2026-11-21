import { useMemo } from 'react'
import { GitBranch, GitPullRequest } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import { useProject } from './projectContext'
import { TypeIcon } from '../../components/ui'

export default function Development() {
  const project = useProject()
  const items = useStore((s) => s.items)
  const rows = useMemo(
    () => items.filter((i) => i.projectId === project.id && i.type !== 'Epic').slice(0, 20),
    [items, project.id],
  )

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-slate-900">Development</h2>
      <p className="mb-4 text-sm text-slate-500">Branches and pull requests linked to work in {project.name}.</p>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="grid grid-cols-[1fr_160px_140px] border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">
          <div>Work item</div>
          <div>Branch</div>
          <div>Pull request</div>
        </div>
        {rows.map((i) => (
          <div key={i.id} className="grid grid-cols-[1fr_160px_140px] items-center border-b border-slate-100 px-4 py-2.5 text-sm last:border-b-0 hover:bg-slate-50">
            <Link to={`/browse/${i.id}`} className="flex min-w-0 items-center gap-2 text-slate-800 hover:underline">
              <TypeIcon type={i.type} size={14} />
              <span className="shrink-0 text-[#0c66e4]">{i.id}</span>
              <span className="truncate">{i.summary}</span>
            </Link>
            <div className="flex items-center gap-1.5 text-slate-600">
              <GitBranch size={14} />
              <span className="truncate font-mono text-xs">{i.id.toLowerCase()}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600">
              <GitPullRequest size={14} />
              <span>#{i.id.replace(/\D/g, '').slice(-2) || '1'}</span>
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="px-4 py-10 text-center text-sm text-slate-500">No development activity yet.</div>}
      </div>
    </div>
  )
}
