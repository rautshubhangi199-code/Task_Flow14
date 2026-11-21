import { useState } from 'react'
import { Plus, Target } from 'lucide-react'
import { useProject } from './projectContext'
import { EmptyState } from '../../components/ui'

const STARTER = [
  { id: 'g1', name: 'Ship the next release', status: 'On track', progress: 64 },
  { id: 'g2', name: 'Reduce open bugs', status: 'At risk', progress: 38 },
  { id: 'g3', name: 'Improve sprint predictability', status: 'On track', progress: 72 },
]

export default function Goals() {
  const project = useProject()
  const [goals, setGoals] = useState(STARTER)

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Goals</h2>
          <p className="text-sm text-slate-500">Track outcomes for {project.name} and connect them to work.</p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setGoals((g) => [...g, { id: `g-${Date.now()}`, name: 'New goal', status: 'On track', progress: 0 }])}
        >
          <Plus size={16} /> Create goal
        </button>
      </div>
      {goals.length === 0 ? (
        <EmptyState title="No goals yet">Add a goal to measure progress for this space.</EmptyState>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {goals.map((g) => (
            <div key={g.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-start gap-2">
                <Target size={18} className="mt-0.5 text-[#0c66e4]" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-900">{g.name}</div>
                  <div className={`text-xs ${g.status === 'At risk' ? 'text-amber-700' : 'text-emerald-700'}`}>{g.status}</div>
                </div>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-[#0c66e4]" style={{ width: `${g.progress}%` }} />
              </div>
              <div className="mt-1 text-right text-xs text-slate-500">{g.progress}%</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
