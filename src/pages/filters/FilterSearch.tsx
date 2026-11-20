import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, ArrowDown, ArrowUp, Save, Star } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useAccessibleItems, useAccessibleProjects, useCurrentUser } from '../../store/hooks'
import { useUi } from '../../store/uiStore'
import { filterService } from '../../services/api'
import { DEFAULT_FILTERS, JqlError, quoteValue, runJql, sortItems, type SortSpec } from '../../lib/jql'
import { useJqlContext } from '../../lib/useJqlContext'
import { fmtDate, userName } from '../../lib/utils'
import { ISSUE_TYPES, STATUSES } from '../../types'
import { Avatar, Modal, StatusBadge, TypeIcon } from '../../components/ui'

const COLUMNS: { label: string; field: string }[] = [
  { label: 'Type', field: 'type' },
  { label: 'Key', field: 'key' },
  { label: 'Summary', field: 'summary' },
  { label: 'Project', field: 'project' },
  { label: 'Assignee', field: 'assignee' },
  { label: 'Status', field: 'status' },
  { label: 'Priority', field: 'priority' },
  { label: 'Created', field: 'created' },
  { label: 'Updated', field: 'updated' },
]

export default function FilterSearch() {
  const [params] = useSearchParams()
  const loc = useLocation()
  // Remount whenever the URL changes so state is re-initialised from the URL.
  return <FilterSearchInner key={loc.pathname + loc.search} params={params} isAll={loc.pathname === '/filters/all'} />
}

function FilterSearchInner({ params, isAll }: { params: URLSearchParams; isAll: boolean }) {
  const me = useCurrentUser()!
  const navigate = useNavigate()
  const items = useAccessibleItems()
  const projects = useAccessibleProjects()
  const users = useStore((s) => s.users)
  const savedFilters = useStore((s) => s.savedFilters)
  const showToast = useUi((s) => s.showToast)
  const ctx = useJqlContext()

  const saved = savedFilters.find((f) => f.id === params.get('filter'))
  const def = DEFAULT_FILTERS.find((f) => f.id === params.get('default'))
  const initialJql = saved?.jql ?? def?.jql ?? params.get('jql') ?? ''
  const title = isAll ? 'All work items' : saved?.name ?? def?.name ?? 'Search work items'

  const [mode, setMode] = useState<'basic' | 'jql'>(initialJql ? 'jql' : 'basic')
  const [text, setText] = useState(initialJql)
  const [applied, setApplied] = useState(initialJql)
  const [basic, setBasic] = useState({ project: '', assignee: '', type: '', status: '', text: '' })
  const [sort, setSort] = useState<SortSpec | null>(null)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState('')

  const basicJql = useMemo(() => {
    const c: string[] = []
    if (basic.project) c.push(`project = ${quoteValue(basic.project)}`)
    if (basic.assignee) c.push(basic.assignee === 'EMPTY' ? 'assignee IS EMPTY' : basic.assignee === 'me' ? 'assignee = currentUser()' : `assignee = ${quoteValue(basic.assignee)}`)
    if (basic.type) c.push(`type = ${quoteValue(basic.type)}`)
    if (basic.status) c.push(`status = ${quoteValue(basic.status)}`)
    if (basic.text.trim()) c.push(`text ~ "${basic.text.trim().replace(/"/g, '')}"`)
    return c.join(' AND ')
  }, [basic])

  const query = mode === 'basic' ? basicJql : applied
  const result = useMemo(() => {
    try {
      const r = runJql(query, items, ctx)
      return { items: r.items, error: null as string | null }
    } catch (e) {
      return { items: [], error: e instanceof JqlError ? e.message : String(e) }
    }
  }, [query, items, ctx])

  const sorted = useMemo(() => (sort ? sortItems(result.items, [sort], ctx) : result.items), [result.items, sort, ctx])
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const current = Math.min(page, pages - 1)
  const pageItems = sorted.slice(current * pageSize, current * pageSize + pageSize)
  const canUpdateSaved = !!saved && saved.ownerId === me.id && query !== saved.jql
  const setB = (patch: Partial<typeof basic>) => { setBasic({ ...basic, ...patch }); setPage(0) }

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {saved && (
          <button onClick={() => filterService.update(saved.id, { starred: !saved.starred })} title="Star filter">
            <Star size={18} className={saved.starred ? 'fill-amber-400 text-amber-400' : 'text-slate-400'} />
          </button>
        )}
        <div className="ml-auto flex gap-2">
          {canUpdateSaved && <button className="btn-default" onClick={() => { filterService.update(saved.id, { jql: query }); showToast(`Filter "${saved.name}" updated`) }}>Save changes</button>}
          <button className="btn-primary" disabled={!!result.error} onClick={() => { setSaveName(''); setSaveOpen(true) }}><Save size={14} /> Save filter{saved ? ' as…' : ''}</button>
          <Link className="btn-subtle" to="/filters">View all filters</Link>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
        {mode === 'basic' ? (
          <div className="flex flex-wrap items-end gap-2">
            <input className="input w-56" placeholder="Search text" value={basic.text} onChange={(e) => setB({ text: e.target.value })} />
            <select className="input w-44" value={basic.project} onChange={(e) => setB({ project: e.target.value })}>
              <option value="">Project: All</option>
              {projects.map((p) => <option key={p.id} value={p.key}>{p.name}</option>)}
            </select>
            <select className="input w-44" value={basic.assignee} onChange={(e) => setB({ assignee: e.target.value })}>
              <option value="">Assignee: All</option>
              <option value="me">Current user</option>
              <option value="EMPTY">Unassigned</option>
              {users.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
            </select>
            <select className="input w-36" value={basic.type} onChange={(e) => setB({ type: e.target.value })}>
              <option value="">Type: All</option>
              {ISSUE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
            <select className="input w-40" value={basic.status} onChange={(e) => setB({ status: e.target.value })}>
              <option value="">Status: All</option>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
            <button className="btn-subtle" onClick={() => setB({ project: '', assignee: '', type: '', status: '', text: '' })}>Clear</button>
            <button className="btn-subtle ml-auto text-brand-700" onClick={() => { setText(basicJql); setApplied(basicJql); setMode('jql') }}>Switch to JQL</button>
          </div>
        ) : (
          <div>
            <div className="flex gap-2">
              <textarea
                className="input min-h-10 flex-1 font-mono text-[13px]"
                rows={2}
                value={text}
                placeholder='e.g. project = CP AND status = "In Progress" AND assignee = currentUser() ORDER BY created DESC'
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); setApplied(text); setPage(0) } }}
              />
              <div className="flex flex-col gap-1">
                <button className="btn-primary" onClick={() => { setApplied(text); setPage(0) }}>Search</button>
                <button className="btn-subtle text-brand-700" onClick={() => setMode('basic')}>Basic</button>
              </div>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Fields: project, status, statusCategory, assignee, reporter, type, priority, labels, sprint, team, key, parent, text/summary (~), created, updated, resolved, due.
              Operators: = != ~ IN, NOT IN, IS EMPTY, &gt; &gt;= &lt; &lt;=. Functions: currentUser(), openSprints(), issueHistory(), startOfDay(), now(). Dates: -7d, 2026-01-31.
            </div>
          </div>
        )}
        {result.error && (
          <div className="mt-2 flex items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle size={16} /> {result.error}
          </div>
        )}
      </div>

      <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
        <span>{sorted.length === 0 ? 'No results' : `${current * pageSize + 1}–${Math.min(sorted.length, (current + 1) * pageSize)} of ${sorted.length} work items`}</span>
        <label className="flex items-center gap-2">Per page
          <select className="input w-20 py-1" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0) }}>
            {[10, 25, 50].map((n) => <option key={n}>{n}</option>)}
          </select>
        </label>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.field} className="th cursor-pointer hover:text-slate-800" onClick={() => setSort((s) => (s?.field === c.field ? { field: c.field, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { field: c.field, dir: 'asc' }))}>
                  <span className="inline-flex items-center gap-1">{c.label}{sort?.field === c.field && (sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageItems.map((i) => {
              const p = projects.find((x) => x.id === i.projectId)
              return (
                <tr key={i.id} className="cursor-pointer border-b border-slate-100 hover:bg-slate-50" onClick={() => navigate(`/browse/${i.id}`)}>
                  <td className="td"><TypeIcon type={i.type} /></td>
                  <td className="td whitespace-nowrap text-brand-700">{i.id}</td>
                  <td className="td">{i.summary}</td>
                  <td className="td whitespace-nowrap">{p?.icon} {p?.name}</td>
                  <td className="td whitespace-nowrap"><span className="flex items-center gap-1.5"><Avatar user={users.find((u) => u.id === i.assigneeId)} size={20} />{userName(users, i.assigneeId)}</span></td>
                  <td className="td"><StatusBadge status={i.status} /></td>
                  <td className="td">{i.priority}</td>
                  <td className="td whitespace-nowrap">{fmtDate(i.createdAt)}</td>
                  <td className="td whitespace-nowrap">{fmtDate(i.updatedAt)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {pageItems.length === 0 && <div className="p-8 text-center text-sm text-slate-500">{result.error ? 'Fix the query to see results' : 'No work items match this search'}</div>}
      </div>
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1">
          <button className="btn-subtle" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button>
          {Array.from({ length: pages }, (_, n) => (
            <button key={n} onClick={() => setPage(n)} className={`h-8 w-8 rounded text-sm ${n === current ? 'bg-brand-600 text-white' : 'hover:bg-slate-100'}`}>{n + 1}</button>
          ))}
          <button className="btn-subtle" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Next</button>
        </div>
      )}

      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title="Save filter"
        width={480}
        footer={<><button className="btn-subtle" onClick={() => setSaveOpen(false)}>Cancel</button><button className="btn-primary" disabled={!saveName.trim()} onClick={async () => { const f = await filterService.create(saveName.trim(), query); setSaveOpen(false); showToast(`Filter "${f.name}" saved`); navigate(`/filters/search?filter=${f.id}`) }}>Save</button></>}
      >
        <label className="label">Name</label>
        <input className="input" autoFocus value={saveName} onChange={(e) => setSaveName(e.target.value)} />
        <div className="mt-3 text-xs text-slate-500">Query</div>
        <code className="block rounded bg-slate-100 p-2 text-xs">{query || '(all work items)'}</code>
      </Modal>
    </div>
  )
}
