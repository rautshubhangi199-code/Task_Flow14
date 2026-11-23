import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowDownUp,
  Bot,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  Info,
  Link2,
  Lock,
  MoreHorizontal,
  Plus,
  Share2,
  Sparkles,
  X,
  Zap,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { useAccessibleItems, useAccessibleProjects, useCurrentUser } from '../store/hooks'
import { useUi } from '../store/uiStore'
import { commentService, workItemService, worklogService } from '../services/api'
import { LINK_TYPES, PRIORITIES, STATUSES, type LinkType, type Priority, type Status } from '../types'
import { ALLOWED_PARENTS, findEpicAncestor, formatDuration, isDone, parseDuration, timeAgo, todayStr } from '../lib/utils'
import { Avatar, Dropdown, MenuItem, PriorityIcon, ProgressBar, TypeIcon } from './ui'
import { StatusDropdown } from './StatusDropdown'

interface WorkItemDrawerProps {
  itemId: string | null
  onClose: () => void
}

const COVERS = [
  { id: '', label: 'None', swatch: 'bg-white border-slate-200' },
  { id: 'blue', label: 'Blue', swatch: 'bg-blue-500' },
  { id: 'green', label: 'Green', swatch: 'bg-green-500' },
  { id: 'purple', label: 'Purple', swatch: 'bg-purple-500' },
  { id: 'orange', label: 'Orange', swatch: 'bg-orange-500' },
  { id: 'red', label: 'Red', swatch: 'bg-red-500' },
]

const COVER_BAR: Record<string, string> = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
}

function iconBtn(active?: boolean) {
  return `flex h-7 items-center justify-center gap-1 rounded-md border px-1.5 text-slate-600 hover:bg-slate-50 ${active ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-slate-200'}`
}

function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export function WorkItemDrawer({ itemId, onClose }: WorkItemDrawerProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [, setSearchParams] = useSearchParams()
  const allItems = useAccessibleItems()
  const projects = useAccessibleProjects()
  const users = useStore((s) => s.users)
  const allWorklogs = useStore((s) => s.worklogs)
  const allComments = useStore((s) => s.comments)
  const allHistory = useStore((s) => s.history)
  const me = useCurrentUser()
  const showToast = useUi((s) => s.showToast)

  const item = useMemo(() => allItems.find((i) => i.id === itemId), [allItems, itemId])
  const project = useMemo(() => projects.find((p) => p.id === item?.projectId), [projects, item])
  const parent = useMemo(() => allItems.find((i) => i.id === item?.parentId), [allItems, item])
  const epic = useMemo(() => findEpicAncestor(allItems, item), [allItems, item])
  const crumbParent = item && item.type !== 'Epic' ? (epic ?? parent) : undefined
  const children = useMemo(() => allItems.filter((i) => i.parentId === item?.id), [allItems, item])
  const parentOptions = useMemo(
    () => (item ? allItems.filter((i) => i.projectId === item.projectId && i.id !== item.id && ALLOWED_PARENTS[item.type].includes(i.type)) : []),
    [allItems, item],
  )

  const [editingSummary, setEditingSummary] = useState(false)
  const [summaryText, setSummaryText] = useState('')
  const [editingDesc, setEditingDesc] = useState(false)
  const [descText, setDescText] = useState('')
  const [childrenCollapsed, setChildrenCollapsed] = useState(false)
  const [addingChild, setAddingChild] = useState(false)
  const [newChildSummary, setNewChildSummary] = useState('')
  const [keyOpen, setKeyOpen] = useState(true)
  const [estimateEdit, setEstimateEdit] = useState(false)
  const [estimateText, setEstimateText] = useState('')
  const [addingLink, setAddingLink] = useState(false)
  const [linkType, setLinkType] = useState<LinkType>('Relates to')
  const [linkTarget, setLinkTarget] = useState('')
  const [logOpen, setLogOpen] = useState(false)
  const [logTime, setLogTime] = useState('')
  const [logDate, setLogDate] = useState(todayStr())
  const [logDesc, setLogDesc] = useState('')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteQ, setPaletteQ] = useState('')
  const [voted, setVoted] = useState(false)
  const [cover, setCover] = useState('')
  const [morePanel, setMorePanel] = useState<'cover' | 'parent' | null>(null)
  const [parentQ, setParentQ] = useState('')
  const [shareOpen, setShareOpen] = useState(false)
  const [copyHover, setCopyHover] = useState(false)
  const [copyLabel, setCopyLabel] = useState('Copy link')
  const [copyTip, setCopyTip] = useState({ top: 0, left: 0 })
  const copyBtnRef = useRef<HTMLButtonElement>(null)
  const [activePriorityMenu, setActivePriorityMenu] = useState<string | null>(null)
  const [activeAssigneeMenu, setActiveAssigneeMenu] = useState<string | null>(null)
  const drawerRef = useRef<HTMLDivElement>(null)
  const commentRef = useRef<HTMLTextAreaElement>(null)
  const [activityView, setActivityView] = useState<'comments' | 'all' | 'history' | 'worklog'>('comments')
  const [commentDraft, setCommentDraft] = useState('')
  const [commentFocus, setCommentFocus] = useState(false)
  const [activityNewest, setActivityNewest] = useState(true)

  useEffect(() => {
    if (item) {
      setSummaryText(item.summary)
      setDescText(item.description || '')
      setEstimateText(item.originalEstimate ? formatDuration(item.originalEstimate) : '')
      setEditingSummary(false)
      setEditingDesc(false)
      setAddingChild(false)
      setLogOpen(false)
      setMorePanel(null)
      setCommentDraft('')
      setCommentFocus(false)
      setActivityView('comments')
    }
  }, [item?.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(true)
        setPaletteQ('')
      }
      if (e.key.toLowerCase() === 'q' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return
        e.preventDefault()
        setLogOpen(true)
      }
      if (e.key.toLowerCase() === 'm' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return
        e.preventDefault()
        setActivityView('comments')
        setCommentFocus(true)
        requestAnimationFrame(() => commentRef.current?.focus())
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!item) return null

  const flagged = item.labels.includes('impediment')
  const doneCount = children.filter((c) => isDone(c.status)).length
  const totalCount = children.length
  const percentDone = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0
  const isEpic = item.type === 'Epic'
  const childLabel = isEpic ? 'Child work items' : 'Subtasks'
  const addChildLabel = isEpic ? 'Add child' : 'Add subtask'
  const groupedLinks = LINK_TYPES.map((t) => ({ type: t, links: item.links.filter((l) => l.type === t) })).filter((g) => g.links.length)
  const logs = allWorklogs.filter((w) => w.itemId === item.id)
  const comments = allComments.filter((c) => c.itemId === item.id).sort((a, b) => (
    activityNewest ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt)
  ))
  const history = allHistory.filter((h) => h.itemId === item.id).sort((a, b) => (
    activityNewest ? b.timestamp.localeCompare(a.timestamp) : a.timestamp.localeCompare(b.timestamp)
  ))
  const sortedLogs = [...logs].sort((a, b) => (
    activityNewest ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt)
  ))

  const saveComment = () => {
    if (!commentDraft.trim()) return
    commentService.add(item.id, commentDraft.trim())
    setCommentDraft('')
    setCommentFocus(false)
    showToast('Comment added')
  }

  const insertComment = (text: string) => {
    setActivityView('comments')
    setCommentDraft(text)
    setCommentFocus(true)
    requestAnimationFrame(() => commentRef.current?.focus())
  }

  const openIssue = (id: string) => {
    const next = new URLSearchParams(window.location.search)
    next.set('selectedIssue', id)
    setSearchParams(next)
  }

  const handleSaveSummary = () => {
    const trimmed = summaryText.trim()
    if (trimmed && trimmed !== item.summary) {
      workItemService.update(item.id, { summary: trimmed })
      showToast('Summary updated')
    }
    setEditingSummary(false)
  }

  const handleSaveDesc = () => {
    workItemService.update(item.id, { description: descText })
    setEditingDesc(false)
    showToast('Description updated')
  }

  const saveEstimate = () => {
    const trimmed = estimateText.trim()
    if (!trimmed) {
      workItemService.update(item.id, { originalEstimate: null })
    } else {
      const mins = parseDuration(trimmed)
      if (mins === null) {
        showToast('Use a format like 2d 4h 30m')
        return
      }
      workItemService.update(item.id, { originalEstimate: mins })
    }
    setEstimateEdit(false)
  }

  const handleAddChild = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newChildSummary.trim()) return
    const childType = item.type === 'Epic' ? 'Task' : 'Subtask'
    await workItemService.create({
      projectId: item.projectId,
      type: childType,
      summary: newChildSummary.trim(),
      description: '',
      status: 'To Do',
      priority: 'Medium',
      originalEstimate: null,
      assigneeId: null,
      reporterId: me?.id || 'u2',
      labels: [],
      parentId: item.id,
      dueDate: null,
      startDate: null,
      team: item.team || null,
      sprintId: item.sprintId || null,
      storyPoints: null,
    })
    setNewChildSummary('')
    setAddingChild(false)
    showToast(`Created ${childType.toLowerCase()} under ${item.id}`)
  }

  const shareUrl = `${window.location.origin}/browse/${item.id}`

  const copyShare = async () => {
    await navigator.clipboard.writeText(shareUrl)
    showToast('Link copied')
  }

  const openMove = () => {
    navigate(`/move/${item.id}?from=${encodeURIComponent(location.pathname + location.search)}`)
  }

  const toggleFlag = () => {
    workItemService.update(item.id, {
      labels: flagged ? item.labels.filter((l) => l !== 'impediment') : [...item.labels, 'impediment'],
    })
    showToast(flagged ? 'Flag removed' : 'Flag added')
  }

  const cloneItem = async () => {
    const copy = await workItemService.create({
      projectId: item.projectId,
      type: item.type,
      summary: `CLONE - ${item.summary}`,
      description: item.description,
      status: 'To Do',
      priority: item.priority,
      originalEstimate: item.originalEstimate,
      assigneeId: item.assigneeId,
      reporterId: me?.id || item.reporterId,
      labels: item.labels,
      parentId: item.parentId,
      dueDate: item.dueDate,
      startDate: item.startDate,
      team: item.team,
      sprintId: item.sprintId,
      storyPoints: item.storyPoints,
    })
    showToast(`Cloned as ${copy.id}`)
    openIssue(copy.id)
  }

  const exportBody = () =>
    [
      `${item.id}: ${item.summary}`,
      `Type: ${item.type}`,
      `Status: ${item.status}`,
      `Priority: ${item.priority}`,
      `Parent: ${item.parentId ?? 'None'}`,
      `Estimate: ${item.originalEstimate ? formatDuration(item.originalEstimate) : '—'}`,
      '',
      item.description || '',
    ].join('\n')

  const printItem = () => {
    const w = window.open('', '_blank', 'width=720,height=900')
    if (!w) return
    w.document.write(`<pre style="font:14px sans-serif;padding:24px;white-space:pre-wrap">${exportBody().replace(/</g, '&lt;')}</pre>`)
    w.document.close()
    w.print()
  }

  const submitLog = () => {
    const mins = parseDuration(logTime)
    if (mins === null) {
      showToast('Enter time like 1h 30m')
      return
    }
    worklogService.add(item.id, logDate, mins, logDesc.trim())
    setLogOpen(false)
    setLogTime('')
    setLogDesc('')
    showToast('Work logged')
  }

  const commands = [
    { id: 'log', label: 'Log work', run: () => setLogOpen(true) },
    { id: 'flag', label: flagged ? 'Remove flag' : 'Add flag', run: toggleFlag },
    { id: 'vote', label: voted ? 'Remove vote' : 'Add vote', run: () => { setVoted((v) => !v); showToast(voted ? 'Vote removed' : 'Vote added') } },
    { id: 'parent', label: 'Change parent', run: () => setMorePanel('parent') },
    { id: 'clone', label: 'Clone', run: () => { void cloneItem() } },
    { id: 'share', label: 'Share', run: () => setShareOpen(true) },
    { id: 'move', label: 'Move', run: openMove },
    { id: 'print', label: 'Print', run: printItem },
    { id: 'xlsx', label: 'Export Excel', run: () => downloadFile(`${item.id}.csv`, exportBody(), 'text/csv') },
    { id: 'doc', label: 'Export Word', run: () => downloadFile(`${item.id}.doc`, exportBody(), 'application/msword') },
    { id: 'xml', label: 'Export XML', run: () => downloadFile(`${item.id}.xml`, `<item id="${item.id}"><summary>${item.summary}</summary><status>${item.status}</status><description>${item.description}</description></item>`, 'application/xml') },
  ]
  const paletteItems = commands.filter((c) => c.label.toLowerCase().includes(paletteQ.toLowerCase()))

  const runAndClose = (fn: () => void, close: () => void) => {
    fn()
    close()
    setMorePanel(null)
  }

  return (
    <div
      ref={drawerRef}
      className="relative flex h-full w-[440px] shrink-0 flex-col border-l border-slate-200 bg-white shadow-xl animate-in slide-in-from-right duration-200"
    >
      <div className="flex h-12 items-center justify-between border-b border-slate-100 px-4">
        <div className="flex items-center gap-2">
          <CheckSquare size={16} className="text-blue-600" />
          <span className="text-sm font-semibold text-slate-800">Jira work item</span>
        </div>
        <div className="flex items-center gap-1 text-slate-500">
          <Link
            to={`/browse/${item.id}`}
            className="rounded-md border border-slate-200 p-1.5 hover:bg-slate-50 hover:text-slate-800"
            title="Open in full view"
          >
            <ExternalLink size={15} />
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 p-1.5 hover:bg-slate-50 hover:text-slate-800"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {cover && <div className={`-mx-5 -mt-4 mb-3 h-16 ${COVER_BAR[cover] ?? 'bg-slate-200'}`} />}

        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1 gap-y-1 text-xs text-slate-500">
            <Link to="/spaces" className="hover:underline">Spaces</Link>
            <span>/</span>
            {project && (
              <Link to={`/projects/${project.key}/summary`} className="flex items-center gap-1 hover:underline">
                <span>{project.icon}</span>
                <span className="truncate">{project.name}</span>
              </Link>
            )}
            {crumbParent && (
              <>
                <span>/</span>
                <button type="button" className="flex items-center gap-1 font-medium text-slate-600 hover:underline" onClick={() => openIssue(crumbParent.id)}>
                  <TypeIcon type={crumbParent.type} size={14} />
                  {crumbParent.id}
                </button>
              </>
            )}
            <span>/</span>
            <span className="flex items-center gap-1 font-semibold text-slate-700">
              <TypeIcon type={item.type} size={14} />
              {item.id}
            </span>
            <button
              ref={copyBtnRef}
              type="button"
              className="ml-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200"
              onMouseEnter={() => {
                const r = copyBtnRef.current?.getBoundingClientRect()
                if (r) setCopyTip({ top: r.top - 6, left: r.left + r.width / 2 })
                setCopyHover(true)
              }}
              onMouseLeave={() => {
                setCopyHover(false)
                setCopyLabel('Copy link')
              }}
              onClick={() => {
                void copyShare()
                setCopyLabel('Copied')
              }}
            >
              <Link2 size={14} />
            </button>
            {copyHover &&
              createPortal(
                <span
                  className="pointer-events-none fixed z-[200] -translate-x-1/2 -translate-y-full rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white shadow-md"
                  style={{ top: copyTip.top, left: copyTip.left }}
                >
                  {copyLabel}
                </span>,
                document.body,
              )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" className={iconBtn()} title="Locked">
              <Lock size={14} />
            </button>
            <button
              type="button"
              className={iconBtn(!!me && item.watcherIds.includes(me.id))}
              title="Watchers"
              onClick={() => workItemService.toggleWatch(item.id)}
            >
              <Eye size={14} />
              <span className="text-xs">{item.watcherIds?.length || 1}</span>
            </button>
            <div className="relative">
              <button type="button" className={iconBtn(shareOpen)} title="Share" onClick={() => setShareOpen((o) => !o)}>
                <Share2 size={14} />
              </button>
              {shareOpen && (
                <div className="absolute right-0 top-8 z-30 w-72 rounded-lg border border-slate-200 bg-white p-3 shadow-xl">
                  <div className="mb-2 text-sm font-semibold text-slate-900">Share {item.id}</div>
                  <div className="flex gap-1">
                    <input readOnly className="input py-1 text-xs" value={shareUrl} onFocus={(e) => e.target.select()} />
                    <button type="button" className="btn-default shrink-0 px-2" title="Copy link" onClick={() => void copyShare()}>
                      <Copy size={14} />
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">Anyone with access to this space can open the work item from this link.</p>
                </div>
              )}
            </div>
            <Dropdown
              align="right"
              menuClassName="w-64 py-1"
              trigger={(open) => (
                <button type="button" className={iconBtn(open)} title="More">
                  <MoreHorizontal size={14} />
                </button>
              )}
            >
              {(close) => (
                <div>
                  {morePanel === 'cover' && (
                    <div className="py-1">
                      <button type="button" className="px-3 py-1 text-xs text-slate-500 hover:underline" onClick={() => setMorePanel(null)}>
                        Back
                      </button>
                      {COVERS.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-100"
                          onClick={() => {
                            setCover(c.id)
                            close()
                            setMorePanel(null)
                            showToast(c.id ? `${c.label} cover applied` : 'Cover removed')
                          }}
                        >
                          <span className={`h-3.5 w-3.5 rounded-sm border ${c.swatch}`} />
                          {c.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {morePanel === 'parent' && (
                    <div className="p-2">
                      <button type="button" className="mb-1 text-xs text-slate-500 hover:underline" onClick={() => setMorePanel(null)}>
                        Back
                      </button>
                      <input
                        className="input mb-1 py-1 text-xs"
                        placeholder="Search parent"
                        value={parentQ}
                        onChange={(e) => setParentQ(e.target.value)}
                      />
                      <button
                        type="button"
                        className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-slate-100"
                        onClick={() => {
                          workItemService.update(item.id, { parentId: null })
                          close()
                          setMorePanel(null)
                          showToast('Parent removed')
                        }}
                      >
                        None
                      </button>
                      <div className="max-h-48 overflow-auto">
                        {parentOptions
                          .filter((p) => `${p.id} ${p.summary}`.toLowerCase().includes(parentQ.toLowerCase()))
                          .map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-slate-100"
                              onClick={() => {
                                workItemService.update(item.id, { parentId: p.id })
                                close()
                                setMorePanel(null)
                                showToast(`Parent set to ${p.id}`)
                              }}
                            >
                              <TypeIcon type={p.type} size={14} />
                              <span className="truncate">{p.id} {p.summary}</span>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                  {!morePanel && (
                    <>
                      <MoreRow label="Log work" hint="Q" onClick={() => runAndClose(() => setLogOpen(true), close)} />
                      <MoreRow
                        label="Open command palette"
                        hint="⌘ K"
                        onClick={() => runAndClose(() => { setPaletteOpen(true); setPaletteQ('') }, close)}
                      />
                      <div className="my-1 border-t border-slate-200" />
                      <MoreRow label={flagged ? 'Remove flag' : 'Add flag'} onClick={() => runAndClose(toggleFlag, close)} />
                      <MoreRow
                        label={voted ? 'Remove vote' : 'Add vote'}
                        onClick={() => runAndClose(() => { setVoted((v) => !v); showToast(voted ? 'Vote removed' : 'Vote added') }, close)}
                      />
                      <div className="my-1 border-t border-slate-200" />
                      <button
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-100"
                        onClick={() => setMorePanel('cover')}
                      >
                        Select cover
                        <ChevronRight size={14} className="text-slate-400" />
                      </button>
                      <MoreRow label="Change parent" onClick={() => setMorePanel('parent')} />
                      <MoreRow label="Clone" onClick={() => runAndClose(() => { void cloneItem() }, close)} />
                      <MoreRow label="Share" onClick={() => runAndClose(() => setShareOpen(true), close)} />
                      <MoreRow label="Move" onClick={() => runAndClose(openMove, close)} />
                      <div className="my-1 border-t border-slate-200" />
                      <MoreRow label="Print" onClick={() => runAndClose(printItem, close)} />
                      <MoreRow label="Export Excel" onClick={() => runAndClose(() => downloadFile(`${item.id}.csv`, exportBody(), 'text/csv'), close)} />
                      <MoreRow label="Export Word" onClick={() => runAndClose(() => downloadFile(`${item.id}.doc`, exportBody(), 'application/msword'), close)} />
                      <MoreRow label="Export XML" onClick={() => runAndClose(() => downloadFile(`${item.id}.xml`, `<item id="${item.id}"><summary>${item.summary}</summary><status>${item.status}</status></item>`, 'application/xml'), close)} />
                    </>
                  )}
                </div>
              )}
            </Dropdown>
          </div>
        </div>

        <div className="mt-3">
          {editingSummary ? (
            <input
              autoFocus
              className="w-full rounded border border-blue-500 px-1 py-0.5 text-[22px] font-bold leading-tight text-slate-900 outline-none"
              value={summaryText}
              onChange={(e) => setSummaryText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveSummary()
                if (e.key === 'Escape') {
                  setSummaryText(item.summary)
                  setEditingSummary(false)
                }
              }}
              onBlur={handleSaveSummary}
            />
          ) : (
            <h2
              onClick={() => setEditingSummary(true)}
              className="cursor-pointer rounded text-[22px] font-bold leading-tight text-slate-900 hover:bg-slate-50"
            >
              {item.summary}
            </h2>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusDropdown
            value={item.status}
            onChange={(s) => workItemService.update(item.id, { status: s })}
            projectKey={project?.key}
            variant="button"
          />
          <button
            type="button"
            className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => showToast('Agents')}
          >
            <Bot size={13} className="text-slate-500" />
            Agents
          </button>
          <button type="button" className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50" title="Development" onClick={() => showToast('Development details')}>
            <Code2 size={14} />
          </button>
          <button type="button" className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50" title="Automation" onClick={() => showToast('Automation rules')}>
            <Zap size={14} />
          </button>
        </div>

        <div className="mt-2">
          <button
            type="button"
            className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => showToast(`Improve ${item.type}`)}
          >
            <Sparkles size={13} className="text-purple-600" />
            Improve {item.type}
          </button>
        </div>

        <div className="mt-2">
          <button
            type="button"
            className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
            title="Add"
            onClick={() => setAddingChild(true)}
          >
            <Plus size={14} />
          </button>
        </div>

        <section className="mt-5">
          <button type="button" onClick={() => setKeyOpen((o) => !o)} className="flex items-center gap-1 text-[15px] font-semibold text-slate-900">
            {keyOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            Key details
          </button>
          {keyOpen && (
            <div className="mt-3 space-y-3 pl-1">
              <div>
                <div className="text-[13px] font-medium text-slate-800">Original estimate</div>
                {estimateEdit ? (
                  <input
                    autoFocus
                    className="mt-0.5 w-full rounded border border-blue-400 px-1 py-0.5 text-sm outline-none"
                    placeholder="e.g. 1d 4h"
                    value={estimateText}
                    onChange={(e) => setEstimateText(e.target.value)}
                    onBlur={saveEstimate}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEstimate()
                      if (e.key === 'Escape') setEstimateEdit(false)
                    }}
                  />
                ) : (
                  <button type="button" className="mt-0.5 text-left text-sm text-slate-400 hover:underline" onClick={() => setEstimateEdit(true)}>
                    {item.originalEstimate ? formatDuration(item.originalEstimate) : 'Add estimate'}
                  </button>
                )}
              </div>
              {logs.length > 0 && (
                <div className="text-xs text-slate-500">{formatDuration(logs.reduce((a, w) => a + w.minutes, 0))} logged</div>
              )}
            </div>
          )}
        </section>

        <section className="mt-5">
          <div className="text-[15px] font-semibold text-slate-900">Description</div>
          {editingDesc ? (
            <div className="mt-1 space-y-2">
              <textarea autoFocus className="input min-h-20 text-sm" value={descText} onChange={(e) => setDescText(e.target.value)} placeholder="Add a description..." />
              <div className="flex gap-2">
                <button type="button" className="btn-primary py-1 text-xs" onClick={handleSaveDesc}>Save</button>
                <button type="button" className="btn-subtle py-1 text-xs" onClick={() => { setDescText(item.description || ''); setEditingDesc(false) }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setEditingDesc(true)} className="mt-0.5 block text-left text-sm text-slate-400 hover:underline">
              {item.description || 'Add a description...'}
            </button>
          )}
        </section>

        <section className="mt-5">
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setChildrenCollapsed((c) => !c)} className="flex items-center gap-1 text-[15px] font-semibold text-slate-900">
              {children.length > 0 && (childrenCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />)}
              {childLabel}
            </button>
            {totalCount > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-16"><ProgressBar value={percentDone} color="bg-green-600" /></div>
                <span className="text-xs text-slate-500">{percentDone}%</span>
              </div>
            )}
          </div>
          {!childrenCollapsed && (
            <div className="mt-1">
              {children.length === 0 && !addingChild && (
                <button type="button" className="text-sm text-slate-400 hover:underline" onClick={() => setAddingChild(true)}>
                  {addChildLabel}
                </button>
              )}
              {children.length > 0 && (
                <div className="mt-1 divide-y divide-slate-100 rounded border border-slate-200">
                  {children.map((c) => {
                    const assignee = users.find((u) => u.id === c.assigneeId)
                    return (
                      <div key={c.id} className="grid grid-cols-[1fr_28px_28px_88px] items-center gap-1 px-2 py-1.5 text-xs hover:bg-slate-50">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <TypeIcon type={c.type} size={14} />
                          <button type="button" className="shrink-0 font-medium text-slate-500 hover:underline" onClick={() => openIssue(c.id)}>{c.id}</button>
                          <span className="truncate">{c.summary}</span>
                        </div>
                        <div className="relative">
                          <button type="button" onClick={() => setActivePriorityMenu(activePriorityMenu === c.id ? null : c.id)} className="rounded p-0.5 hover:bg-slate-200">
                            <PriorityIcon priority={c.priority} />
                          </button>
                          {activePriorityMenu === c.id && (
                            <div className="absolute right-0 top-6 z-20 w-28 rounded border border-slate-200 bg-white py-1 shadow-lg">
                              {PRIORITIES.map((p) => (
                                <button key={p} type="button" className="flex w-full items-center gap-1.5 px-2 py-1 text-left text-xs hover:bg-slate-100" onClick={() => { workItemService.update(c.id, { priority: p as Priority }); setActivePriorityMenu(null) }}>
                                  <PriorityIcon priority={p} /> {p}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="relative">
                          <button type="button" onClick={() => setActiveAssigneeMenu(activeAssigneeMenu === c.id ? null : c.id)}>
                            <Avatar user={assignee} size={18} />
                          </button>
                          {activeAssigneeMenu === c.id && (
                            <div className="absolute right-0 top-6 z-20 max-h-44 w-40 overflow-y-auto rounded border border-slate-200 bg-white py-1 shadow-lg">
                              <button type="button" className="w-full px-2 py-1 text-left text-xs text-slate-500 hover:bg-slate-100" onClick={() => { workItemService.update(c.id, { assigneeId: null }); setActiveAssigneeMenu(null) }}>Unassigned</button>
                              {users.map((u) => (
                                <button key={u.id} type="button" className="flex w-full items-center gap-2 px-2 py-1 text-left text-xs hover:bg-slate-100" onClick={() => { workItemService.update(c.id, { assigneeId: u.id }); setActiveAssigneeMenu(null) }}>
                                  <Avatar user={u} size={16} /> {u.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <StatusDropdown value={c.status} onChange={(s) => workItemService.update(c.id, { status: s as Status })} projectKey={project?.key} variant="compact" align="right" />
                      </div>
                    )
                  })}
                </div>
              )}
              {addingChild && (
                <form onSubmit={handleAddChild} className="mt-2 flex gap-1.5">
                  <input autoFocus className="input flex-1 py-1 text-xs" placeholder="What needs to be done?" value={newChildSummary} onChange={(e) => setNewChildSummary(e.target.value)} />
                  <button type="submit" className="btn-primary px-2.5 py-1 text-xs" disabled={!newChildSummary.trim()}>Add</button>
                  <button type="button" className="btn-subtle px-2 py-1 text-xs" onClick={() => setAddingChild(false)}>Cancel</button>
                </form>
              )}
            </div>
          )}
        </section>

        <section className="mt-5">
          <div className="text-[15px] font-semibold text-slate-900">Linked work items</div>
          {groupedLinks.map((g) => (
            <div key={g.type} className="mt-1">
              <div className="text-[11px] font-semibold text-slate-500">{g.type}</div>
              {g.links.map((l) => {
                const t = allItems.find((i) => i.id === l.targetId)
                return (
                  <div key={l.targetId} className="flex items-center gap-2 py-1 text-sm">
                    {t && <TypeIcon type={t.type} size={14} />}
                    <button type="button" className="text-xs text-slate-500 hover:underline" onClick={() => t && openIssue(t.id)}>{l.targetId}</button>
                    <span className="truncate text-slate-700">{t?.summary ?? '(no access)'}</span>
                  </div>
                )
              })}
            </div>
          ))}
          {addingLink ? (
            <div className="mt-2 space-y-1.5 rounded border border-slate-200 bg-slate-50 p-2">
              <select className="input py-1 text-xs" value={linkType} onChange={(e) => setLinkType(e.target.value as LinkType)}>
                {LINK_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
              <select className="input py-1 text-xs" value={linkTarget} onChange={(e) => setLinkTarget(e.target.value)}>
                <option value="">Select a work item…</option>
                {allItems.filter((i) => i.id !== item.id).map((i) => (
                  <option key={i.id} value={i.id}>{i.id} – {i.summary}</option>
                ))}
              </select>
              <div className="flex gap-1">
                <button type="button" className="btn-primary py-1 text-xs" disabled={!linkTarget} onClick={() => { workItemService.addLink(item.id, linkType, linkTarget); setLinkTarget(''); setAddingLink(false) }}>Link</button>
                <button type="button" className="btn-subtle py-1 text-xs" onClick={() => setAddingLink(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <button type="button" className="mt-0.5 text-sm text-slate-400 hover:underline" onClick={() => setAddingLink(true)}>
              Add linked work item
            </button>
          )}
        </section>

        <section className="mt-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-[15px] font-semibold text-slate-900">
              Confluence content
              <Info size={14} className="text-slate-400" />
            </div>
            <button type="button" className="rounded p-1 text-slate-400 hover:bg-slate-100"><MoreHorizontal size={14} /></button>
          </div>
          <div className="mt-2 flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
            <div className="flex items-center gap-2 text-sm text-slate-800">
              <FileText size={16} className="text-blue-600" />
              Project plan
            </div>
            <button type="button" className="rounded bg-purple-100 px-2 py-0.5 text-[11px] font-semibold text-purple-700 hover:bg-purple-200" onClick={() => showToast('Confluence trial')}>
              Request to try
            </button>
          </div>
        </section>

        <section className="mt-5">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
            Agent sessions
            <span className="text-xs font-normal text-slate-400">Uses AI. Verify results.</span>
          </div>
        </section>

        <section className="mt-6 pb-6">
          <h3 className="text-[15px] font-semibold text-slate-900">Activity</h3>
          <div className="mt-2 flex items-center gap-1">
            <button
              type="button"
              className={`rounded-full px-3 py-1 text-[13px] font-medium ${
                activityView === 'comments' ? 'bg-[#0c66e4] text-white' : 'text-slate-700 hover:bg-slate-100'
              }`}
              onClick={() => setActivityView('comments')}
            >
              Comments
            </button>
            <Dropdown
              trigger={(open) => (
                <button
                  type="button"
                  className={`inline-flex items-center gap-0.5 rounded-full px-3 py-1 text-[13px] font-medium ${
                    activityView !== 'comments' || open ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  More
                  <ChevronDown size={14} />
                </button>
              )}
            >
              {(close) => (
                <>
                  <MenuItem active={activityView === 'all'} onClick={() => { setActivityView('all'); close() }}>All</MenuItem>
                  <MenuItem active={activityView === 'history'} onClick={() => { setActivityView('history'); close() }}>History</MenuItem>
                  <MenuItem active={activityView === 'worklog'} onClick={() => { setActivityView('worklog'); close() }}>Work log</MenuItem>
                </>
              )}
            </Dropdown>
            <div className="ml-auto">
              <Dropdown
                align="right"
                trigger={() => (
                  <button type="button" className="rounded p-1 text-slate-500 hover:bg-slate-100" title={activityNewest ? 'Newest first' : 'Oldest first'}>
                    <ArrowDownUp size={16} />
                  </button>
                )}
              >
                {(close) => (
                  <>
                    <MenuItem active={activityNewest} onClick={() => { setActivityNewest(true); close() }}>Newest first</MenuItem>
                    <MenuItem active={!activityNewest} onClick={() => { setActivityNewest(false); close() }}>Oldest first</MenuItem>
                  </>
                )}
              </Dropdown>
            </div>
          </div>

          {(activityView === 'comments' || activityView === 'all') && (
            <div className="mt-3 flex items-start gap-2">
              <Avatar user={me} size={32} />
              <div className="min-w-0 flex-1">
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-[0_0_0_1px_rgba(9,30,66,0.02)]">
                  <textarea
                    ref={commentRef}
                    rows={commentFocus || commentDraft ? 3 : 1}
                    className="w-full resize-none bg-transparent text-[14px] text-slate-800 outline-none placeholder:text-slate-400"
                    placeholder="Add a comment..."
                    value={commentDraft}
                    onFocus={() => setCommentFocus(true)}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault()
                        saveComment()
                      }
                      if (e.key === 'Escape') {
                        setCommentFocus(false)
                        commentRef.current?.blur()
                      }
                    }}
                  />
                  {!commentDraft && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px] text-slate-700 hover:bg-slate-50"
                        onClick={() => insertComment('Can I get more info?')}
                      >
                        Can I get more info...?
                      </button>
                      <Dropdown
                        trigger={() => (
                          <button type="button" className="inline-flex items-center gap-0.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px] text-slate-700 hover:bg-slate-50">
                            Status
                            <ChevronRight size={12} />
                          </button>
                        )}
                      >
                        {(close) => (
                          <>
                            {STATUSES.map((s) => (
                              <MenuItem key={s} onClick={() => { insertComment(`Status: ${s}`); close() }}>{s}</MenuItem>
                            ))}
                          </>
                        )}
                      </Dropdown>
                    </div>
                  )}
                  {(commentFocus || commentDraft) && (
                    <div className="mt-2 flex gap-2">
                      <button type="button" className="btn-primary py-1 text-xs" disabled={!commentDraft.trim()} onClick={saveComment}>Save</button>
                      <button type="button" className="btn-subtle py-1 text-xs" onClick={() => { setCommentDraft(''); setCommentFocus(false) }}>Cancel</button>
                    </div>
                  )}
                </div>
                <p className="mt-1.5 text-[12px] text-slate-500">
                  Pro tip: press <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 font-sans text-[11px] text-slate-700">M</kbd> to comment
                </p>
              </div>
            </div>
          )}

          <div className="mt-4 space-y-3">
            {(activityView === 'comments' || activityView === 'all') && comments.map((c) => {
              const author = users.find((u) => u.id === c.authorId)
              return (
                <div key={c.id} className="flex items-start gap-2">
                  <Avatar user={author} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] text-slate-800">
                      <span className="font-semibold">{author?.name ?? 'Unknown'}</span>
                      <span className="ml-1.5 text-[12px] font-normal text-slate-500">{timeAgo(c.createdAt)}{c.updatedAt ? ' (edited)' : ''}</span>
                    </div>
                    <div className="mt-0.5 whitespace-pre-wrap text-[14px] text-slate-800">{c.body}</div>
                  </div>
                </div>
              )
            })}
            {activityView === 'comments' && comments.length === 0 && !commentFocus && (
              <div className="pl-10 text-[13px] text-slate-400">No comments yet</div>
            )}
            {(activityView === 'history' || activityView === 'all') && history.map((h) => {
              const u = users.find((x) => x.id === h.userId)
              return (
                <div key={h.id} className="flex items-start gap-2 text-[13px] text-slate-700">
                  <Avatar user={u} size={28} />
                  <div>
                    <span className="font-semibold">{u?.name}</span>{' '}
                    {h.field === 'Created' ? 'created the work item' : <>changed <span className="font-semibold">{h.field}</span></>}
                    <span className="ml-1 text-[12px] text-slate-500">{timeAgo(h.timestamp)}</span>
                    {h.field !== 'Created' && (
                      <div className="mt-0.5 text-[12px] text-slate-500">
                        {h.oldValue || 'None'} → {h.newValue || 'None'}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            {activityView === 'worklog' && (sortedLogs.length ? sortedLogs.map((w) => {
              const u = users.find((x) => x.id === w.userId)
              return (
                <div key={w.id} className="flex items-start gap-2 text-[13px] text-slate-700">
                  <Avatar user={u} size={28} />
                  <div>
                    <span className="font-semibold">{u?.name}</span> logged <span className="font-semibold">{formatDuration(w.minutes)}</span>
                    <span className="ml-1 text-[12px] text-slate-500">{timeAgo(w.createdAt)}</span>
                    {w.description && <div className="text-slate-600">{w.description}</div>}
                  </div>
                </div>
              )
            }) : <div className="text-[13px] text-slate-400">No work logged yet</div>)}
          </div>
        </section>
      </div>

      {logOpen && (
        <div className="absolute inset-0 z-30 flex items-end bg-black/20 p-3">
          <div className="w-full rounded-lg border border-slate-200 bg-white p-3 shadow-xl">
            <div className="mb-2 text-sm font-semibold">Log work</div>
            <label className="label">Time spent</label>
            <input className="input mb-2" placeholder="e.g. 1h 30m" value={logTime} onChange={(e) => setLogTime(e.target.value)} />
            <label className="label">Date</label>
            <input type="date" className="input mb-2" value={logDate} onChange={(e) => setLogDate(e.target.value)} />
            <label className="label">Description</label>
            <textarea className="input mb-3 min-h-16" value={logDesc} onChange={(e) => setLogDesc(e.target.value)} />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-subtle" onClick={() => setLogOpen(false)}>Cancel</button>
              <button type="button" className="btn-primary" onClick={submitLog}>Save</button>
            </div>
          </div>
        </div>
      )}

      {paletteOpen && (
        <div className="absolute inset-0 z-30 flex items-start justify-center bg-black/20 p-6" onClick={() => setPaletteOpen(false)}>
          <div className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              className="w-full border-b border-slate-200 px-3 py-2 text-sm outline-none"
              placeholder="Search commands"
              value={paletteQ}
              onChange={(e) => setPaletteQ(e.target.value)}
            />
            <div className="max-h-64 overflow-auto py-1">
              {paletteItems.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100"
                  onClick={() => { c.run(); setPaletteOpen(false) }}
                >
                  {c.label}
                </button>
              ))}
              {paletteItems.length === 0 && <div className="px-3 py-4 text-sm text-slate-400">No commands</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MoreRow({ label, hint, onClick }: { label: string; hint?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-100"
    >
      <span>{label}</span>
      {hint && <span className="font-mono text-[11px] text-slate-400">{hint}</span>}
    </button>
  )
}
