import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useAccessibleItems, useCurrentUser } from '../../store/hooks'
import { filterService } from '../../services/api'
import { DEFAULT_FILTERS, JqlError, runJql } from '../../lib/jql'
import { useJqlContext } from '../../lib/useJqlContext'
import { fmtDate, userName } from '../../lib/utils'
import type { SavedFilter } from '../../types'
import { Avatar, Modal, Tabs } from '../../components/ui'

type Tab = 'all' | 'starred' | 'mine' | 'default'

export default function FiltersList() {
  const [params, setParams] = useSearchParams()
  const me = useCurrentUser()!
  const filters = useStore((s) => s.savedFilters)
  const users = useStore((s) => s.users)
  const items = useAccessibleItems()
  const ctx = useJqlContext()
  const tab = (params.get('tab') as Tab) || 'all'
  const [editing, setEditing] = useState<SavedFilter | null>(null)
  const [name, setName] = useState('')
  const [jql, setJql] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const count = (q: string) => {
    try { return runJql(q, items, ctx).items.length } catch { return '—' }
  }
  const list = filters.filter((f) => (tab === 'starred' ? f.starred : tab === 'mine' ? f.ownerId === me.id : true))

  const save = () => {
    if (!editing) return
    if (!name.trim()) return setErr('Name is required')
    try { runJql(jql, items, ctx) } catch (e) { return setErr(e instanceof JqlError ? e.message : String(e)) }
    filterService.update(editing.id, { name: name.trim(), jql })
    setEditing(null)
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Filters</h1>
        <Link to="/filters/search" className="btn-primary"><Plus size={16} /> Create filter</Link>
      </div>
      <Tabs
        tabs={[{ id: 'all', label: 'All filters' }, { id: 'starred', label: 'Starred' }, { id: 'mine', label: 'My filters' }, { id: 'default', label: 'Default filters' }]}
        value={tab}
        onChange={(t) => setParams(t === 'all' ? {} : { tab: t })}
      />
      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
        {tab === 'default' ? (
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50"><tr><th className="th">Name</th><th className="th">Query</th><th className="th">Results</th></tr></thead>
            <tbody>
              {DEFAULT_FILTERS.map((f) => (
                <tr key={f.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="td"><Link className="font-medium text-brand-700 hover:underline" to={`/filters/search?default=${f.id}`}>{f.name}</Link></td>
                  <td className="td font-mono text-xs text-slate-600">{f.jql}</td>
                  <td className="td">{count(f.jql)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50"><tr><th className="th w-8" /><th className="th">Name</th><th className="th">Owner</th><th className="th">Query</th><th className="th">Results</th><th className="th">Created</th><th className="th w-20" /></tr></thead>
            <tbody>
              {list.map((f) => {
                const own = f.ownerId === me.id || me.role === 'Admin'
                return (
                  <tr key={f.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="td"><button onClick={() => filterService.update(f.id, { starred: !f.starred })}><Star size={16} className={f.starred ? 'fill-amber-400 text-amber-400' : 'text-slate-400'} /></button></td>
                    <td className="td"><Link className="font-medium text-brand-700 hover:underline" to={`/filters/search?filter=${f.id}`}>{f.name}</Link></td>
                    <td className="td"><span className="flex items-center gap-1.5"><Avatar user={users.find((u) => u.id === f.ownerId)} size={20} />{userName(users, f.ownerId)}</span></td>
                    <td className="td max-w-sm truncate font-mono text-xs text-slate-600">{f.jql}</td>
                    <td className="td">{count(f.jql)}</td>
                    <td className="td">{fmtDate(f.createdAt)}</td>
                    <td className="td">
                      {own && (
                        <div className="flex gap-2 text-slate-500">
                          <button title="Edit" onClick={() => { setEditing(f); setName(f.name); setJql(f.jql); setErr(null) }}><Pencil size={14} /></button>
                          <button title="Delete" className="hover:text-red-600" onClick={() => { if (confirm(`Delete filter "${f.name}"?`)) filterService.remove(f.id) }}><Trash2 size={14} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {tab !== 'default' && list.length === 0 && <div className="p-8 text-center text-sm text-slate-500">No filters here yet. <Link className="text-brand-600 hover:underline" to="/filters/search">Create one</Link>.</div>}
      </div>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit filter" width={560} footer={<><button className="btn-subtle" onClick={() => setEditing(null)}>Cancel</button><button className="btn-primary" onClick={save}>Save</button></>}>
        <label className="label">Name</label>
        <input className="input mb-3" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="label">JQL</label>
        <textarea className="input font-mono text-xs" rows={3} value={jql} onChange={(e) => setJql(e.target.value)} />
        {err && <div className="mt-1 text-xs text-red-600">{err}</div>}
      </Modal>
    </div>
  )
}
