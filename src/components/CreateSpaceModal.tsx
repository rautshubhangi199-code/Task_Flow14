import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { useCurrentUser } from '../store/hooks'
import { useUi } from '../store/uiStore'
import { projectService } from '../services/api'
import type { ProjectType } from '../types'
import { Avatar, Modal } from './ui'

const ICONS = ['📁', '🚀', '🌐', '📱', '🛠️', '💳', '📊', '🧪', '🎯', '🔒', '🧩', '⚙️']

export function CreateSpaceModal() {
  const open = useUi((s) => s.createSpaceOpen)
  const setOpen = useUi((s) => s.setCreateSpaceOpen)
  if (!open) return null
  return <CreateSpaceForm onClose={() => setOpen(false)} />
}

function CreateSpaceForm({ onClose }: { onClose: () => void }) {
  const me = useCurrentUser()
  const users = useStore((s) => s.users)
  const projects = useStore((s) => s.projects)
  const showToast = useUi((s) => s.showToast)
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [key, setKey] = useState('')
  const [keyTouched, setKeyTouched] = useState(false)
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('🚀')
  const [type, setType] = useState<ProjectType>('Scrum')
  const [leadId, setLeadId] = useState(me?.id ?? '')
  const [memberIds, setMemberIds] = useState<string[]>(me ? [me.id] : [])
  const [errors, setErrors] = useState<Record<string, string>>({})

  const autoKey = (n: string) =>
    n.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5) ||
    n.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4)

  const submit = async () => {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Name is required'
    if (!/^[A-Z][A-Z0-9]{1,9}$/.test(key)) e.key = 'Key must be 2–10 uppercase letters/digits, starting with a letter'
    else if (projects.some((p) => p.key === key)) e.key = `A space with key ${key} already exists`
    if (projects.some((p) => p.name.toLowerCase() === name.trim().toLowerCase())) e.name = 'A space with this name already exists'
    setErrors(e)
    if (Object.keys(e).length) return
    const p = await projectService.create({ name: name.trim(), key, description, icon, type, leadId, memberIds })
    showToast(`Space "${p.name}" created`)
    onClose()
    navigate(`/projects/${p.key}/summary`)
  }

  return (
    <Modal open onClose={onClose} title="Create space" width={600} footer={<><button className="btn-subtle" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={submit}>Create space</button></>}>
      <div className="space-y-4">
        <div>
          <label className="label">Name <span className="text-red-600">*</span></label>
          <input className="input" autoFocus value={name} onChange={(e) => { setName(e.target.value); if (!keyTouched) setKey(autoKey(e.target.value)) }} placeholder="e.g. Payments Platform" />
          {errors.name && <div className="mt-1 text-xs text-red-600">{errors.name}</div>}
        </div>
        <div>
          <label className="label">Key <span className="text-red-600">*</span></label>
          <input className="input w-40 uppercase" value={key} onChange={(e) => { setKeyTouched(true); setKey(e.target.value.toUpperCase()) }} />
          <div className="mt-1 text-xs text-slate-500">Work item IDs will look like {key || 'KEY'}-1</div>
          {errors.key && <div className="mt-1 text-xs text-red-600">{errors.key}</div>}
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="input min-h-16" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className="label">Icon</label>
          <div className="flex flex-wrap gap-1">
            {ICONS.map((i) => (
              <button key={i} onClick={() => setIcon(i)} className={`h-9 w-9 rounded text-lg ${icon === i ? 'bg-brand-100 ring-2 ring-brand-500' : 'bg-slate-100 hover:bg-slate-200'}`}>{i}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Type</label>
            <select className="input" value={type} onChange={(e) => setType(e.target.value as ProjectType)}>
              <option value="Scrum">Scrum (sprints & backlog)</option>
              <option value="Kanban">Kanban (continuous flow)</option>
            </select>
          </div>
          <div>
            <label className="label">Space lead</label>
            <select className="input" value={leadId} onChange={(e) => setLeadId(e.target.value)}>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Members</label>
          <div className="grid grid-cols-2 gap-1">
            {users.map((u) => (
              <label key={u.id} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-slate-50">
                <input type="checkbox" checked={memberIds.includes(u.id)} onChange={(e) => setMemberIds((m) => (e.target.checked ? [...m, u.id] : m.filter((x) => x !== u.id)))} />
                <Avatar user={u} size={20} />
                <span className="text-sm">{u.name}</span>
                <span className="ml-auto text-xs text-slate-500">{u.role}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
