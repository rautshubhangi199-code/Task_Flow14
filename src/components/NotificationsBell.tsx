import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { AlarmClock, Bell, MessageSquare, RefreshCw, UserPlus } from 'lucide-react'
import { useStore } from '../store/useStore'
import { usePersonalSettings } from '../store/hooks'
import { notificationService } from '../services/api'
import { Dropdown } from './ui'
import { formatInTimeZone } from '../lib/personalSettings'
import type { NotificationType } from '../types'

const ICON: Record<NotificationType, typeof Bell> = {
  assigned: UserPlus,
  status: RefreshCw,
  comment: MessageSquare,
  due: AlarmClock,
  overdue: AlarmClock,
}

export function NotificationsBell() {
  const all = useStore((s) => s.notifications)
  const me = useStore((s) => s.currentUserId)
  const settings = usePersonalSettings()
  const navigate = useNavigate()
  const mine = useMemo(() => {
    if (!settings.inAppEnabled) return []
    return all.filter((n) => n.userId === me && settings.inApp[n.type]).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [all, me, settings])
  const unread = mine.filter((n) => !n.read).length

  return (
    <Dropdown
      align="right"
      trigger={() => (
        <button className="relative rounded-full p-2 text-slate-600 hover:bg-slate-100" title="Notifications">
          <Bell size={18} />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] font-bold leading-4 text-white">{unread}</span>
          )}
        </button>
      )}
    >
      {(close) => (
        <div className="w-96">
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
            <span className="font-semibold">Notifications</span>
            <button className="text-xs text-brand-600 hover:underline" onClick={() => notificationService.markAllRead()}>Mark all as read</button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {mine.length === 0 && <div className="px-3 py-6 text-center text-sm text-slate-500">You're all caught up</div>}
            {mine.map((n) => {
              const Icon = ICON[n.type]
              return (
                <button
                  key={n.id}
                  className={clsx('flex w-full gap-3 border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50', !n.read && 'bg-brand-50/60')}
                  onClick={() => {
                    notificationService.markRead(n.id)
                    close()
                    if (n.itemId) navigate(`/browse/${n.itemId}`)
                  }}
                >
                  <Icon size={16} className={clsx('mt-0.5 shrink-0', n.type === 'overdue' ? 'text-red-600' : 'text-brand-600')} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-slate-800">{n.message}</div>
                    <div className="text-xs text-slate-500">{formatInTimeZone(n.createdAt, settings)}</div>
                  </div>
                  {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </Dropdown>
  )
}
