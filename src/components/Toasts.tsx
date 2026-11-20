import { Link } from 'react-router-dom'
import { CheckCircle2, X } from 'lucide-react'
import { useUi } from '../store/uiStore'

export function Toasts() {
  const toasts = useUi((s) => s.toasts)
  const dismiss = useUi((s) => s.dismissToast)
  return (
    <div className="fixed bottom-4 left-4 z-[60] space-y-2">
      {toasts.map((t) => (
        <div key={t.id} className="flex w-80 items-start gap-2 rounded-md border border-slate-200 bg-white p-3 shadow-lg">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-green-600" />
          <div className="flex-1 text-sm">
            {t.message}
            {t.link && (
              <div>
                <Link to={t.link} className="text-brand-600 hover:underline" onClick={() => dismiss(t.id)}>View work item</Link>
              </div>
            )}
          </div>
          <button onClick={() => dismiss(t.id)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
        </div>
      ))}
    </div>
  )
}
