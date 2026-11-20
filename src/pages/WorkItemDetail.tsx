import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import clsx from 'clsx'
import { Bot, ChevronDown, ChevronRight, Eye, EyeOff, GitBranch, Link2, Plus, Settings, Star, Trash2, X } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useAccessibleItems, useAccessibleProjects, useCurrentUser } from '../store/hooks'
import { useUi } from '../store/uiStore'
import { commentService, workItemService, worklogService } from '../services/api'
import { LINK_TYPES, PRIORITIES, TEAMS, type IssueType, type LinkType, type Priority, type WorkItem } from '../types'
import { ALLOWED_PARENTS, findEpicAncestor, fmtDate, formatDuration, isDone, parseDuration, timeAgo, todayStr } from '../lib/utils'
import { Avatar, EmptyState, PriorityIcon, ProgressBar, StatusBadge, Tabs, TypeIcon } from '../components/ui'
import { StatusDropdown } from '../components/StatusDropdown'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-center gap-2 py-1.5">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="min-w-0 text-sm">{children}</div>
    </div>
  )
}

function CommitInput({ value, onCommit, placeholder, validate }: { value: string; onCommit: (v: string) => void; placeholder?: string; validate?: (v: string) => string | null }) {
  const [v, setV] = useState(value)
  const [err, setErr] = useState<string | null>(null)
  const [prev, setPrev] = useState(value)
  if (prev !== value) { setPrev(value); setV(value) }
  const commit = () => {
    if (v === value) return
    const e = validate?.(v) ?? null
    setErr(e)
    if (!e) onCommit(v)
  }
  return (
    <div>
      <input className="input py-1" value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} />
      {err && <div className="text-xs text-red-600">{err}</div>}
    </div>
  )
}

function Collapsible({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-lg border border-slate-200">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold">
        {icon} {title} <span className="ml-auto">{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
      </button>
      {open && <div className="border-t border-slate-200 px-3 py-3 text-sm text-slate-600">{children}</div>}
    </div>
  )
}

export default function WorkItemDetail() {
  const { id } = useParams()
  const items = useAccessibleItems()
  const item = items.find((i) => i.id === id)
  const recordView = useStore((s) => s.recordView)
  const itemId = item?.id
  useEffect(() => {
    if (itemId) recordView(itemId)
  }, [itemId, recordView])
  if (!item) return <div className="p-6"><EmptyState title="Work item not found">"{id}" doesn't exist or you don't have access to it.</EmptyState></div>
  return <Detail key={item.id} item={item} />
}

function Detail({ item }: { item: WorkItem }) {
  const me = useCurrentUser()!
  const navigate = useNavigate()
  const projects = useAccessibleProjects()
  const allItems = useAccessibleItems()
  const users = useStore((s) => s.users)
  const sprints = useStore((s) => s.sprints)
  const allComments = useStore((s) => s.comments)
  const allLogs = useStore((s) => s.worklogs)
  const allHistory = useStore((s) => s.history)
  const starred = useStore((s) => s.starredItems)
  const openCreate = useUi((s) => s.openCreateItem)
  const showToast = useUi((s) => s.showToast)

  const project = projects.find((p) => p.id === item.projectId)!
  const parent = allItems.find((i) => i.id === item.parentId)
  const epic = findEpicAncestor(allItems, item)
  const crumbParent = item.type === 'Epic' ? undefined : (epic ?? parent)
  const children = allItems.filter((i) => i.parentId === item.id)
  const members = users.filter((u) => project.memberIds.includes(u.id) || project.leadId === u.id)
  const update = (patch: Partial<WorkItem>) => workItemService.update(item.id, patch)

  const [title, setTitle] = useState(item.summary)
  const [editingTitle, setEditingTitle] = useState(false)
  const [desc, setDesc] = useState(item.description)
  const [editingDesc, setEditingDesc] = useState(false)
  const [tab, setTab] = useState<'all' | 'comments' | 'history' | 'worklog'>('comments')
  const [comment, setComment] = useState('')
  const [editingComment, setEditingComment] = useState<{ id: string; body: string } | null>(null)
  const [linkType, setLinkType] = useState<LinkType>('Relates to')
  const [linkTarget, setLinkTarget] = useState('')
  const [showLinkForm, setShowLinkForm] = useState(false)
  const [logDate, setLogDate] = useState(todayStr())
  const [logTime, setLogTime] = useState('')
  const [logDesc, setLogDesc] = useState('')
  const [logErr, setLogErr] = useState('')

  const descendants = useMemo(() => {
    const out: string[] = []
    const walk = (pid: string) => allItems.filter((i) => i.parentId === pid).forEach((c) => { out.push(c.id); walk(c.id) })
    walk(item.id)
    return out
  }, [allItems, item.id])

  const comments = allComments.filter((c) => c.itemId === item.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const history = allHistory.filter((h) => h.itemId === item.id).sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  const logs = allLogs.filter((w) => w.itemId === item.id).sort((a, b) => b.date.localeCompare(a.date))
  const ownLogged = logs.reduce((a, w) => a + w.minutes, 0)
  const childLogged = allLogs.filter((w) => descendants.includes(w.itemId)).reduce((a, w) => a + w.minutes, 0)
  const totalLogged = ownLogged + childLogged
  const isStarred = (starred[me.id] ?? []).includes(item.id)
  const watching = item.watcherIds.includes(me.id)
  const parentOptions = allItems.filter((i) => i.projectId === item.projectId && i.id !== item.id && !descendants.includes(i.id) && ALLOWED_PARENTS[item.type].includes(i.type))
  const childType: IssueType = item.type === 'Epic' ? 'Story' : 'Subtask'
  const canHaveChildren = item.type !== 'Subtask'

  const userBy = (uid: string | null) => users.find((u) => u.id === uid)

  const commentNode = (c: (typeof comments)[number]) => {
    const author = userBy(c.authorId)
    const canEdit = c.authorId === me.id
    const canDelete = canEdit || me.role === 'Admin'
    return (
      <div key={c.id} className="flex gap-3">
        <Avatar user={author} size={30} />
        <div className="flex-1">
          <div className="text-sm"><b>{author?.name}</b> <span className="text-xs text-slate-500">{timeAgo(c.createdAt)}{c.updatedAt && ' (edited)'}</span></div>
          {editingComment?.id === c.id ? (
            <div className="mt-1">
              <textarea className="input min-h-16" value={editingComment.body} onChange={(e) => setEditingComment({ id: c.id, body: e.target.value })} />
              <div className="mt-1 flex gap-2">
                <button className="btn-primary" disabled={!editingComment.body.trim()} onClick={() => { commentService.edit(c.id, editingComment.body.trim()); setEditingComment(null) }}>Save</button>
                <button className="btn-subtle" onClick={() => setEditingComment(null)}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-0.5 whitespace-pre-wrap text-sm">{c.body}</div>
              <div className="mt-1 flex gap-3 text-xs text-slate-500">
                {canEdit && <button className="hover:underline" onClick={() => setEditingComment({ id: c.id, body: c.body })}>Edit</button>}
                {canDelete && <button className="hover:underline" onClick={() => confirm('Delete this comment?') && commentService.remove(c.id)}>Delete</button>}
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  const historyNode = (h: (typeof history)[number]) => {
    const u = userBy(h.userId)
    return (
      <div key={h.id} className="flex gap-3 text-sm">
        <Avatar user={u} size={26} />
        <div>
          <b>{u?.name}</b>{' '}
          {h.field === 'Created' ? <>created the work item</> : <>changed the <b>{h.field}</b></>}
          <span className="ml-1 text-xs text-slate-500">{fmtDate(h.timestamp, 'dd MMM yyyy, HH:mm')}</span>
          {h.field !== 'Created' && (
            <div className="mt-0.5 flex items-center gap-2 text-xs">
              <span className="rounded bg-slate-100 px-1.5 py-0.5 line-through decoration-slate-400">{h.oldValue || 'None'}</span> →
              <span className="rounded bg-brand-50 px-1.5 py-0.5">{h.newValue || 'None'}</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  const logNode = (w: (typeof logs)[number]) => {
    const u = userBy(w.userId)
    return (
      <div key={w.id} className="flex gap-3 text-sm">
        <Avatar user={u} size={26} />
        <div className="flex-1">
          <b>{u?.name}</b> logged <b>{formatDuration(w.minutes)}</b> <span className="text-xs text-slate-500">on {fmtDate(w.date)}</span>
          {w.description && <div className="text-slate-600">{w.description}</div>}
        </div>
        {(w.userId === me.id || me.role === 'Admin') && <button className="text-slate-400 hover:text-red-600" title="Delete" onClick={() => worklogService.remove(w.id)}><Trash2 size={14} /></button>}
      </div>
    )
  }

  const submitLog = () => {
    const m = parseDuration(logTime)
    if (!m) return setLogErr('Enter time like 2h 30m, 1d or 45m')
    if (!logDate) return setLogErr('Pick a date')
    worklogService.add(item.id, logDate, m, logDesc.trim())
    setLogTime(''); setLogDesc(''); setLogErr('')
  }

  const allFeed = [
    ...comments.map((c) => ({ at: c.createdAt, node: commentNode(c) })),
    ...history.map((h) => ({ at: h.timestamp, node: historyNode(h) })),
    ...logs.map((w) => ({ at: w.createdAt, node: logNode(w) })),
  ].sort((a, b) => b.at.localeCompare(a.at))

  const groupedLinks = LINK_TYPES.map((t) => ({ type: t, links: item.links.filter((l) => l.type === t) })).filter((g) => g.links.length)

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <Link to="/spaces" className="hover:underline">Spaces</Link>
        <span>/</span>
        <Link to={`/projects/${project.key}/summary`} className="flex items-center gap-1 hover:underline">{project.icon} {project.name}</Link>
        {crumbParent && (
          <>
            <span>/</span>
            <Link to={`/browse/${crumbParent.id}`} className="flex items-center gap-1 hover:underline">
              <TypeIcon type={crumbParent.type} size={14} /> {crumbParent.id}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="flex items-center gap-1 font-medium text-slate-700"><TypeIcon type={item.type} size={14} /> {item.id}</span>
        <div className="ml-auto flex items-center gap-1">
          <button className="btn-subtle" title={watching ? 'Stop watching' : 'Watch'} onClick={() => workItemService.toggleWatch(item.id)}>
            {watching ? <Eye size={16} className="text-brand-600" /> : <EyeOff size={16} />} {item.watcherIds.length}
          </button>
          <button className="btn-subtle" title="Star" onClick={() => workItemService.toggleStar(item.id)}>
            <Star size={16} className={isStarred ? 'fill-amber-400 text-amber-400' : ''} />
          </button>
          <button className="btn-subtle" title="Copy link" onClick={() => { void navigator.clipboard?.writeText(window.location.href); showToast('Link copied to clipboard') }}>
            <Link2 size={16} /> Copy link
          </button>
          {(me.role === 'Admin' || me.role === 'Project Manager') && (
            <button className="btn-subtle text-red-600" title="Delete" onClick={() => { if (confirm(`Delete ${item.id}${children.length ? ' and its child items' : ''}?`)) { workItemService.remove(item.id); navigate(`/projects/${project.key}/list`) } }}>
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          {editingTitle ? (
            <div className="flex gap-2">
              <input className="input text-xl font-semibold" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && title.trim()) { update({ summary: title.trim() }); setEditingTitle(false) } }} />
              <button className="btn-primary" disabled={!title.trim()} onClick={() => { update({ summary: title.trim() }); setEditingTitle(false) }}>Save</button>
              <button className="btn-subtle" onClick={() => { setTitle(item.summary); setEditingTitle(false) }}>Cancel</button>
            </div>
          ) : (
            <h1 className="cursor-text rounded px-1 text-2xl font-semibold hover:bg-slate-100" onClick={() => setEditingTitle(true)}>{item.summary}</h1>
          )}

          <div className="flex gap-2">
            {canHaveChildren && <button className="btn-default" onClick={() => openCreate({ projectId: item.projectId, parentId: item.id, type: childType, sprintId: item.sprintId })}><Plus size={14} /> Add {item.type === 'Epic' ? 'child' : 'subtask'}</button>}
            <button className="btn-default" onClick={() => setShowLinkForm(true)}><Link2 size={14} /> Link work item</button>
          </div>

          <section>
            <h3 className="mb-1 font-semibold">Description</h3>
            {editingDesc ? (
              <div>
                <textarea className="input min-h-32" autoFocus value={desc} onChange={(e) => setDesc(e.target.value)} />
                <div className="mt-2 flex gap-2">
                  <button className="btn-primary" onClick={() => { update({ description: desc }); setEditingDesc(false) }}>Save</button>
                  <button className="btn-subtle" onClick={() => { setDesc(item.description); setEditingDesc(false) }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="min-h-12 cursor-text whitespace-pre-wrap rounded px-1 py-1 text-sm hover:bg-slate-50" onClick={() => setEditingDesc(true)}>
                {item.description || <span className="text-slate-400">Add a description…</span>}
              </div>
            )}
          </section>

          {canHaveChildren && (
            <section>
              <div className="mb-1 flex items-center justify-between">
                <h3 className="font-semibold">{item.type === 'Epic' ? 'Child work items' : 'Subtasks'}</h3>
                {children.length > 0 && <span className="text-xs text-slate-500">{children.filter((c) => isDone(c.status)).length} of {children.length} done</span>}
              </div>
              {children.length > 0 && <div className="mb-2"><ProgressBar value={(children.filter((c) => isDone(c.status)).length / children.length) * 100} /></div>}
              <div className="divide-y divide-slate-100 rounded border border-slate-200">
                {children.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                    <TypeIcon type={c.type} />
                    <Link to={`/browse/${c.id}`} className="text-xs text-slate-500 hover:underline">{c.id}</Link>
                    <Link to={`/browse/${c.id}`} className="flex-1 truncate hover:underline">{c.summary}</Link>
                    <PriorityIcon priority={c.priority} />
                    <Avatar user={userBy(c.assigneeId)} size={20} />
                    <StatusDropdown
                      value={c.status}
                      onChange={(s) => workItemService.update(c.id, { status: s })}
                      projectKey={project.key}
                      variant="compact"
                    />
                  </div>
                ))}
                {children.length === 0 && <div className="px-3 py-2 text-sm text-slate-400">No {item.type === 'Epic' ? 'child items' : 'subtasks'} yet</div>}
              </div>
            </section>
          )}

          <section>
            <h3 className="mb-1 font-semibold">Linked work items</h3>
            {showLinkForm && (
              <div className="mb-2 flex gap-2 rounded border border-slate-200 bg-slate-50 p-2">
                <select className="input w-40" value={linkType} onChange={(e) => setLinkType(e.target.value as LinkType)}>
                  {LINK_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
                <select className="input flex-1" value={linkTarget} onChange={(e) => setLinkTarget(e.target.value)}>
                  <option value="">Select a work item…</option>
                  {allItems.filter((i) => i.id !== item.id).map((i) => <option key={i.id} value={i.id}>{i.id} – {i.summary}</option>)}
                </select>
                <button className="btn-primary" disabled={!linkTarget} onClick={() => { workItemService.addLink(item.id, linkType, linkTarget); setLinkTarget(''); setShowLinkForm(false) }}>Link</button>
                <button className="btn-subtle" onClick={() => setShowLinkForm(false)}>Cancel</button>
              </div>
            )}
            {groupedLinks.length === 0 && !showLinkForm && <div className="text-sm text-slate-400">No linked work items</div>}
            {groupedLinks.map((g) => (
              <div key={g.type} className="mb-2">
                <div className="text-xs font-semibold text-slate-500">{g.type}</div>
                <div className="divide-y divide-slate-100 rounded border border-slate-200">
                  {g.links.map((l) => {
                    const t = allItems.find((i) => i.id === l.targetId)
                    return (
                      <div key={l.targetId} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                        {t ? <TypeIcon type={t.type} /> : null}
                        <Link to={`/browse/${l.targetId}`} className="text-xs text-slate-500 hover:underline">{l.targetId}</Link>
                        <span className="flex-1 truncate">{t?.summary ?? '(no access)'}</span>
                        {t && <StatusBadge status={t.status} />}
                        <button className="text-slate-400 hover:text-red-600" title="Remove link" onClick={() => workItemService.removeLink(item.id, l.type, l.targetId)}><X size={14} /></button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </section>

          <section>
            <h3 className="mb-2 font-semibold">Activity</h3>
            <Tabs
              tabs={[
                { id: 'all', label: 'All' },
                { id: 'comments', label: `Comments (${comments.length})` },
                { id: 'history', label: 'History' },
                { id: 'worklog', label: 'Work log' },
              ]}
              value={tab}
              onChange={setTab}
            />
            <div className="mt-4 space-y-4">
              {(tab === 'comments' || tab === 'all') && (
                <div className="flex gap-3">
                  <Avatar user={me} size={30} />
                  <div className="flex-1">
                    <textarea className="input min-h-16" placeholder="Add a comment…" value={comment} onChange={(e) => setComment(e.target.value)} />
                    {comment && (
                      <div className="mt-1 flex gap-2">
                        <button className="btn-primary" disabled={!comment.trim()} onClick={() => { commentService.add(item.id, comment.trim()); setComment('') }}>Save</button>
                        <button className="btn-subtle" onClick={() => setComment('')}>Cancel</button>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {tab === 'worklog' && (
                <div className="rounded border border-slate-200 bg-slate-50 p-3">
                  <div className="grid grid-cols-[150px_150px_1fr_auto] items-end gap-2">
                    <div><label className="label">Date</label><input type="date" className="input" value={logDate} onChange={(e) => setLogDate(e.target.value)} /></div>
                    <div><label className="label">Time spent</label><input className="input" placeholder="2h 30m" value={logTime} onChange={(e) => setLogTime(e.target.value)} /></div>
                    <div><label className="label">Work description</label><input className="input" value={logDesc} onChange={(e) => setLogDesc(e.target.value)} /></div>
                    <button className="btn-primary" onClick={submitLog}>Log time</button>
                  </div>
                  {logErr && <div className="mt-1 text-xs text-red-600">{logErr}</div>}
                  <div className="mt-3 flex gap-6 text-sm">
                    <span>This item: <b>{formatDuration(ownLogged)}</b></span>
                    <span>Child items: <b>{formatDuration(childLogged)}</b></span>
                    <span>Total: <b>{formatDuration(totalLogged)}</b></span>
                  </div>
                </div>
              )}
              {tab === 'all' && allFeed.map((f, idx) => <div key={idx}>{f.node}</div>)}
              {tab === 'comments' && (comments.length ? [...comments].reverse().map(commentNode) : <div className="text-sm text-slate-400">No comments yet</div>)}
              {tab === 'history' && history.map(historyNode)}
              {tab === 'worklog' && (logs.length ? logs.map(logNode) : <div className="text-sm text-slate-400">No work logged yet</div>)}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="flex items-center gap-2">
            <StatusDropdown
              value={item.status}
              onChange={(s) => update({ status: s })}
              projectKey={project.key}
              variant="button"
            />
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Details</h3>
              <button
                type="button"
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                title="Configure fields"
                onClick={() => navigate(`/projects/${project.key}/settings/work-types?type=${item.type}`)}
              >
                <Settings size={15} />
              </button>
            </div>
            <Field label="Assignee">
              <div className="flex items-center gap-2">
                <Avatar user={userBy(item.assigneeId)} size={22} />
                <select className="input py-1" value={item.assigneeId ?? ''} onChange={(e) => update({ assigneeId: e.target.value || null })}>
                  <option value="">Unassigned</option>
                  {members.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              {item.assigneeId !== me.id && <button className="mt-0.5 text-xs text-brand-600 hover:underline" onClick={() => update({ assigneeId: me.id })}>Assign to me</button>}
            </Field>
            <Field label="Reporter">
              <select className="input py-1" value={item.reporterId} onChange={(e) => update({ reporterId: e.target.value })}>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Field>
            <Field label="Priority">
              <div className="flex items-center gap-1">
                <PriorityIcon priority={item.priority} />
                <select className="input py-1" value={item.priority} onChange={(e) => update({ priority: e.target.value as Priority })}>
                  {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
            </Field>
            <Field label="Labels">
              <CommitInput value={item.labels.join(', ')} placeholder="None" onCommit={(v) => update({ labels: v.split(',').map((l) => l.trim()).filter(Boolean) })} />
            </Field>
            <Field label="Parent">
              {item.type === 'Epic' ? <span className="text-slate-400">Epics have no parent</span> : (
                <select className="input py-1" value={item.parentId ?? ''} onChange={(e) => update({ parentId: e.target.value || null })}>
                  {item.type !== 'Subtask' && <option value="">None</option>}
                  {parentOptions.map((p) => <option key={p.id} value={p.id}>{p.id} {p.summary}</option>)}
                </select>
              )}
            </Field>
            <Field label="Start date">
              <input type="date" className="input py-1" value={item.startDate ?? ''} onChange={(e) => update({ startDate: e.target.value || null })} />
            </Field>
            <Field label="Due date">
              <input type="date" className={clsx('input py-1', item.dueDate && item.dueDate < todayStr() && !isDone(item.status) && 'border-red-400 text-red-600')} value={item.dueDate ?? ''} onChange={(e) => update({ dueDate: e.target.value || null })} />
            </Field>
            <Field label="Team">
              <select className="input py-1" value={item.team ?? ''} onChange={(e) => update({ team: e.target.value || null })}>
                <option value="">None</option>
                {TEAMS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Sprint">
              <select className="input py-1" value={item.sprintId ?? ''} onChange={(e) => update({ sprintId: e.target.value || null })}>
                <option value="">None (backlog)</option>
                {sprints.filter((s) => s.projectId === item.projectId && (s.state !== 'completed' || s.id === item.sprintId)).map((s) => <option key={s.id} value={s.id}>{s.name}{s.state === 'active' ? ' (active)' : s.state === 'completed' ? ' (completed)' : ''}</option>)}
              </select>
            </Field>
            <Field label="Story points">
              <CommitInput value={item.storyPoints?.toString() ?? ''} placeholder="None" validate={(v) => (v && (isNaN(Number(v)) || Number(v) < 0) ? 'Enter a positive number' : null)} onCommit={(v) => update({ storyPoints: v ? Number(v) : null })} />
            </Field>
            <Field label="Original estimate">
              <CommitInput value={item.originalEstimate ? formatDuration(item.originalEstimate) : ''} placeholder="e.g. 1d 4h" validate={(v) => (v && parseDuration(v) === null ? 'Use a format like 2d 4h 30m' : null)} onCommit={(v) => update({ originalEstimate: v ? parseDuration(v) : null })} />
            </Field>
            <Field label="Time tracking">
              <ProgressBar value={item.originalEstimate ? (totalLogged / item.originalEstimate) * 100 : totalLogged ? 100 : 0} color={item.originalEstimate && totalLogged > item.originalEstimate ? 'bg-amber-500' : 'bg-brand-600'} />
              <div className="mt-0.5 text-xs text-slate-500">{formatDuration(totalLogged)} logged{item.originalEstimate ? ` of ${formatDuration(item.originalEstimate)}` : ''}{childLogged ? ' (incl. children)' : ''}</div>
            </Field>
          </div>
          <Collapsible title="Development" icon={<GitBranch size={16} />}>
            <p>Link branches, commits and pull requests to this work item.</p>
            <button className="btn-default mt-2" disabled>Connect source control (coming soon)</button>
          </Collapsible>
          <Collapsible title="Automation" icon={<Bot size={16} />}>
            <p>No automation rules have run on this work item yet.</p>
            <p className="mt-1 text-xs text-slate-500">Automation rules will be available in a later phase.</p>
          </Collapsible>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <div>
              <div>Created {fmtDate(item.createdAt, 'dd MMM yyyy, HH:mm')}</div>
              <div>Updated {timeAgo(item.updatedAt)}</div>
              {item.resolvedAt && <div>Resolved {fmtDate(item.resolvedAt, 'dd MMM yyyy, HH:mm')}</div>}
            </div>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              onClick={() => navigate(`/projects/${project.key}/settings/work-types?type=${item.type}`)}
            >
              <Settings size={13} /> Configure
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
