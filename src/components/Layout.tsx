import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { CreateWorkItemModal } from './CreateWorkItemModal'
import { CreateSpaceModal } from './CreateSpaceModal'
import { Toasts } from './Toasts'
import { useCurrentUser, usePersonalSettings } from '../store/hooks'
import { useStore } from '../store/useStore'
import { useUi } from '../store/uiStore'
import { ensureAdminSessionUser } from '../pages/Login'
import { canCreateWorkItems } from '../lib/permissions'

export function Layout() {
  ensureAdminSessionUser()
  const user = useCurrentUser()
  const settings = usePersonalSettings()
  const [collapsed, setCollapsed] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const checkDue = useStore((s) => s.checkDueNotifications)
  const openCreateItem = useUi((s) => s.openCreateItem)
  useEffect(() => {
    if (user) checkDue()
  }, [user, checkDue])
  useEffect(() => {
    document.documentElement.lang = settings.language
  }, [settings.language])
  useEffect(() => {
    if (!settings.keyboardShortcuts) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault()
        setShortcutsOpen((o) => !o)
      }
      if (e.key === 'c' && !e.metaKey && !e.ctrlKey && canCreateWorkItems(user)) {
        e.preventDefault()
        openCreateItem()
      }
      if (e.key === 'Escape') setShortcutsOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [settings.keyboardShortcuts, openCreateItem, user])
  if (!user) return <Navigate to="/login" replace />
  const location = useLocation()
  const isSpaceSettings = location.pathname.includes('/settings/work-types')

  return (
    <div className="flex h-full flex-col">
      <TopBar onToggleSidebar={() => setCollapsed((c) => !c)} />
      <div className="flex min-h-0 flex-1">
        {!isSpaceSettings && <Sidebar collapsed={collapsed} />}
        <main className="min-w-0 flex-1 overflow-auto bg-white">
          <Outlet />
        </main>
      </div>
      <CreateWorkItemModal />
      <CreateSpaceModal />
      <Toasts />
      {shortcutsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setShortcutsOpen(false)}>
          <div className="w-full max-w-sm rounded-lg bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-3 text-base font-semibold">Keyboard shortcuts</h2>
            <ul className="space-y-2 text-sm text-slate-700">
              <li className="flex justify-between"><span>Create work item</span><kbd className="rounded bg-slate-100 px-1.5">c</kbd></li>
              <li className="flex justify-between"><span>This dialog</span><kbd className="rounded bg-slate-100 px-1.5">?</kbd></li>
              <li className="flex justify-between"><span>Close</span><kbd className="rounded bg-slate-100 px-1.5">esc</kbd></li>
            </ul>
            <p className="mt-3 text-xs text-slate-500">Turn shortcuts off in General settings.</p>
          </div>
        </div>
      )}
    </div>
  )
}
