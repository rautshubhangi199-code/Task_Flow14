import { Navigate, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { authService } from '../services/api'
import { Avatar } from '../components/ui'

export default function Login() {
  const users = useStore((s) => s.users)
  const org = useStore((s) => s.organization)
  const currentUserId = useStore((s) => s.currentUserId)
  const navigate = useNavigate()
  if (currentUserId) return <Navigate to="/for-you" replace />
  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-brand-50 to-white p-6">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-lg font-bold text-white">TF</span>
          <div>
            <h1 className="text-xl font-semibold">Log in to TaskFlow</h1>
            <p className="text-sm text-slate-500">{org.name} · demo mode (mock login)</p>
          </div>
        </div>
        <p className="mb-3 text-sm text-slate-600">Choose a user to sign in as. Each role sees different modules and spaces.</p>
        <div className="space-y-2">
          {users.filter((u) => (u.accountStatus ?? 'active') === 'active').map((u) => (
            <button
              key={u.id}
              onClick={() => { authService.login(u.id); navigate('/for-you') }}
              className="flex w-full items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 text-left hover:border-brand-500 hover:bg-brand-50"
            >
              <Avatar user={u} size={36} />
              <div className="flex-1">
                <div className="font-medium">{u.name}</div>
                <div className="text-xs text-slate-500">{u.email}</div>
              </div>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{u.role}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
