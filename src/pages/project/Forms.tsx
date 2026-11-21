import { useState } from 'react'
import { ClipboardList, Plus } from 'lucide-react'
import { useProject } from './projectContext'
import { EmptyState } from '../../components/ui'

const STARTER = [
  { id: 'intake', name: 'Work request', description: 'Collect new work from the team', responses: 12 },
  { id: 'bug', name: 'Bug report', description: 'Report a problem or error', responses: 4 },
  { id: 'feedback', name: 'Feedback', description: 'Share feedback on a release', responses: 7 },
]

export default function Forms() {
  const project = useProject()
  const [forms, setForms] = useState(STARTER)

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Forms</h2>
          <p className="text-sm text-slate-500">Create forms to collect requests and turn them into work in {project.name}.</p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setForms((f) => [...f, { id: `form-${Date.now()}`, name: `Untitled form ${f.length + 1}`, description: 'New form', responses: 0 }])}
        >
          <Plus size={16} /> Create form
        </button>
      </div>
      {forms.length === 0 ? (
        <EmptyState title="No forms yet">Create a form to start collecting work.</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {forms.map((f) => (
            <div key={f.id} className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-slate-50">
              <ClipboardList size={18} className="text-slate-500" />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-slate-800">{f.name}</div>
                <div className="text-sm text-slate-500">{f.description}</div>
              </div>
              <div className="text-sm text-slate-500">{f.responses} responses</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
