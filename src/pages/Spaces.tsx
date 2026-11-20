import { Link } from 'react-router-dom'
import { Plus, Star } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useAccessibleItems, useAccessibleProjects, useCurrentUser } from '../store/hooks'
import { useUi } from '../store/uiStore'
import { canCreateSpace } from '../lib/permissions'
import { projectService } from '../services/api'
import { Avatar, ProjectIcon } from '../components/ui'
import { isDone } from '../lib/utils'

export default function Spaces() {
  const me = useCurrentUser()
  const projects = useAccessibleProjects()
  const items = useAccessibleItems()
  const users = useStore((s) => s.users)
  const starred = useStore((s) => s.starredProjects)
  const setOpen = useUi((s) => s.setCreateSpaceOpen)
  const mine = me ? (starred[me.id] ?? []) : []
  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Spaces</h1>
        {canCreateSpace(me) && <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> Create space</button>}
      </div>
      <table className="w-full rounded-lg border border-slate-200">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr><th className="th w-8" /><th className="th">Name</th><th className="th">Key</th><th className="th">Type</th><th className="th">Lead</th><th className="th">Members</th><th className="th">Open items</th></tr>
        </thead>
        <tbody>
          {projects.map((p) => {
            const lead = users.find((u) => u.id === p.leadId)
            return (
              <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="td"><button onClick={() => projectService.toggleStar(p.id)}><Star size={16} className={mine.includes(p.id) ? 'fill-amber-400 text-amber-400' : 'text-slate-400'} /></button></td>
                <td className="td"><Link to={`/projects/${p.key}/summary`} className="flex items-center gap-2 font-medium text-brand-700 hover:underline"><ProjectIcon icon={p.icon} size={22} />{p.name}</Link></td>
                <td className="td">{p.key}</td>
                <td className="td">{p.type}</td>
                <td className="td"><span className="flex items-center gap-2"><Avatar user={lead} size={20} />{lead?.name}</span></td>
                <td className="td"><div className="flex -space-x-1">{p.memberIds.map((id) => <Avatar key={id} user={users.find((u) => u.id === id)} size={22} />)}</div></td>
                <td className="td">{items.filter((i) => i.projectId === p.id && !isDone(i.status)).length}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
