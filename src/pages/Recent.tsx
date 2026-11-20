import { useMemo } from 'react'
import { useStore } from '../store/useStore'
import { useAccessibleItems, useCurrentUser } from '../store/hooks'
import { WorkItemActivityList } from '../components/WorkItemList'

export default function Recent() {
  const me = useCurrentUser()!
  const items = useAccessibleItems()
  const views = useStore((s) => s.views)
  const rows = useMemo(() => {
    const byId = new Map(items.map((i) => [i.id, i]))
    return views.filter((v) => v.userId === me.id && byId.has(v.itemId)).map((v) => ({ item: byId.get(v.itemId)!, at: v.at, label: 'Viewed' }))
  }, [items, views, me.id])
  const updated = useMemo(() => [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 10).map((i) => ({ item: i, at: i.updatedAt })), [items])
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Recent</h1>
      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">Recently viewed</h2>
        <WorkItemActivityList rows={rows} empty="No recently viewed work items" />
      </section>
      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">Recently updated in your spaces</h2>
        <WorkItemActivityList rows={updated} empty="Nothing updated recently" />
      </section>
    </div>
  )
}
