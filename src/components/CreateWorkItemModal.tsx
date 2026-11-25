import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Calendar, Check, ChevronDown, Hash, Link2, MessageSquare, MoreHorizontal, PanelTop, PictureInPicture2,
  Plus, Repeat, Shield, Square, Tag, Upload, User, Users, X, Zap,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { useAccessibleProjects, useCurrentUser } from '../store/hooks'
import { useUi } from '../store/uiStore'
import { commentService, workItemService } from '../services/api'
import { ISSUE_TYPES, LINK_TYPES, TEAMS, type IssueType, type LinkType, type Status, type WorkItemInput } from '../types'
import { ALLOWED_PARENTS, isDone } from '../lib/utils'
import { canCreateWorkItems } from '../lib/permissions'
import { Avatar, ProjectIcon, TypeIcon } from './ui'
import { StatusCircleIcon } from './StatusDropdown'

export function CreateWorkItemModal() {
  const open = useUi((s) => s.createItemOpen)
  const defaults = useUi((s) => s.createItemDefaults)
  const close = useUi((s) => s.closeCreateItem)
  const me = useCurrentUser()
  if (!open || !canCreateWorkItems(me)) return null
  return <CreateWorkItemForm defaults={defaults} onClose={close} />
}

type Chip = 'assignee' | 'labels' | 'parent' | 'due' | 'team' | 'project' | 'type' | 'start' | 'sprint' | 'status' | 'points' | 'links' | 'restrict' | null
type CreateView = 'condensed' | 'full' | 'floating'

function CreateWorkItemForm({ defaults, onClose }: { defaults: Partial<WorkItemInput>; onClose: () => void }) {
  const me = useCurrentUser()
  const navigate = useNavigate()
  const location = useLocation()
  const projects = useAccessibleProjects()
  const users = useStore((s) => s.users)
  const items = useStore((s) => s.items)
  const sprints = useStore((s) => s.sprints)
  const showToast = useUi((s) => s.showToast)
  const spaceFromRoute = useMemo(() => {
    const key = location.pathname.match(/^\/projects\/([^/]+)/)?.[1]
    return key ? projects.find((p) => p.key === key) : undefined
  }, [location.pathname, projects])

  const [projectId, setProjectId] = useState(defaults.projectId ?? spaceFromRoute?.id ?? projects[0]?.id ?? '')
  const [type, setType] = useState<IssueType>(defaults.type ?? 'Story')
  const [status, setStatus] = useState<Status>(defaults.status ?? 'To Do')
  const [extraStatuses, setExtraStatuses] = useState<string[]>([])
  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')
  const [assigneeId, setAssigneeId] = useState<string>(defaults.assigneeId ?? '')
  const [labels, setLabels] = useState('')
  const [parentId, setParentId] = useState<string>(defaults.parentId ?? '')
  const [dueDate, setDueDate] = useState(defaults.dueDate ?? '')
  const [startDate, setStartDate] = useState(defaults.startDate ?? '')
  const [team, setTeam] = useState('')
  const [sprintId, setSprintId] = useState(defaults.sprintId ?? '')
  const [storyPoints, setStoryPoints] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [linkIds, setLinkIds] = useState<string[]>([])
  const [linkType, setLinkType] = useState<LinkType>('Relates to')
  const [restrictTo, setRestrictTo] = useState('')
  const [impediment, setImpediment] = useState(false)
  const [comment, setComment] = useState('')
  const [showComment, setShowComment] = useState(false)
  const [createAnother, setCreateAnother] = useState(false)
  const [view, setView] = useState<CreateView>('condensed')
  const [viewMenu, setViewMenu] = useState(false)
  const [chip, setChip] = useState<Chip>(null)
  const [assigneeQ, setAssigneeQ] = useState('Automatic')
  const [labelQ, setLabelQ] = useState('')
  const [customLabels, setCustomLabels] = useState<string[]>([])
  const [createLabelName, setCreateLabelName] = useState('')
  const [createLabelOpen, setCreateLabelOpen] = useState(false)
  const [parentQ, setParentQ] = useState('')
  const [showDoneParents, setShowDoneParents] = useState(false)
  const [slash, setSlash] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<string[]>([])
  const box = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const menuAnchorRef = useRef<HTMLElement | null>(null)
  const [menuRect, setMenuRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const [menuMinWidth, setMenuMinWidth] = useState(320)

  const project = projects.find((p) => p.id === projectId)
  const members = useMemo(() => users.filter((u) => project && (project.memberIds.includes(u.id) || project.leadId === u.id)), [users, project])
  const assignee = users.find((u) => u.id === assigneeId)
  const parent = items.find((i) => i.id === parentId)
  const labelList = labels.split(',').map((l) => l.trim()).filter(Boolean)
  const allLabels = useMemo(() => {
    const set = new Set<string>(SUGGESTED_LABELS)
    items.filter((i) => i.projectId === projectId).forEach((i) => i.labels.forEach((l) => set.add(l)))
    labelList.forEach((l) => set.add(l))
    customLabels.forEach((l) => set.add(l))
    const extras = [...set].filter((l) => !SUGGESTED_LABELS.includes(l)).sort((a, b) => a.localeCompare(b))
    return [...SUGGESTED_LABELS.filter((l) => set.has(l)), ...extras]
  }, [items, projectId, labelList, customLabels])
  const visibleLabels = allLabels.filter((l) => !labelQ.trim() || l.toLowerCase().includes(labelQ.trim().toLowerCase()))
  const toggleLabel = (name: string) => {
    const next = labelList.includes(name) ? labelList.filter((x) => x !== name) : [...labelList, name]
    setLabels(next.join(', '))
  }
  const addTypedLabel = () => {
    const name = labelQ.trim()
    if (!name) return
    if (!customLabels.some((l) => l.toLowerCase() === name.toLowerCase()) && !allLabels.some((l) => l.toLowerCase() === name.toLowerCase())) {
      setCustomLabels((prev) => [...prev, name])
    }
    if (!labelList.includes(name)) setLabels([...labelList, name].join(', '))
    setLabelQ('')
  }
  const createLabel = () => {
    const name = createLabelName.trim()
    if (!name) return
    if (!customLabels.some((l) => l.toLowerCase() === name.toLowerCase()) && !SUGGESTED_LABELS.some((l) => l.toLowerCase() === name.toLowerCase())) {
      setCustomLabels((prev) => [...prev, name])
    }
    if (!labelList.includes(name)) setLabels([...labelList, name].join(', '))
    setCreateLabelName('')
    setCreateLabelOpen(false)
  }
  const parentItem = items.find((i) => i.id === (parentId || defaults.parentId))
  const lockedParent = Boolean(defaults.parentId)
  const allowedCreateTypes = useMemo((): IssueType[] => {
    if (!parentItem) return [...ISSUE_TYPES]
    if (parentItem.type === 'Epic') return ['Task', 'Story', 'Bug']
    return ['Subtask']
  }, [parentItem])
  const parentOptions = useMemo(() => {
    if (type === 'Subtask') {
      return items.filter((i) => i.projectId === projectId && ALLOWED_PARENTS.Subtask.includes(i.type))
    }
    return items.filter((i) => i.projectId === projectId && i.type === 'Epic')
  }, [items, projectId, type])
  const visibleParents = useMemo(() => {
    const q = parentQ.trim().toLowerCase()
    return parentOptions.filter((i) => {
      if (!showDoneParents && isDone(i.status)) return false
      if (q && !i.id.toLowerCase().includes(q) && !i.summary.toLowerCase().includes(q)) return false
      return true
    })
  }, [parentOptions, parentQ, showDoneParents])
  const linkOptions = useMemo(
    () => items.filter((i) => i.projectId === projectId),
    [items, projectId],
  )
  const activeSprint = useMemo(() => sprints.find((s) => s.projectId === projectId && s.state === 'active'), [sprints, projectId])
  const projectSprints = useMemo(
    () => sprints.filter((s) => s.projectId === projectId && s.state !== 'completed'),
    [sprints, projectId],
  )
  const sprint = projectSprints.find((s) => s.id === sprintId) ?? (sprintId ? sprints.find((s) => s.id === sprintId) : undefined)
  const restrictUser = users.find((u) => u.id === restrictTo)

  useEffect(() => {
    if (chip !== 'labels') {
      setCreateLabelOpen(false)
      setCreateLabelName('')
    }
  }, [chip])

  useEffect(() => {
    if (!allowedCreateTypes.includes(type)) setType(allowedCreateTypes[0] ?? 'Task')
  }, [allowedCreateTypes, type])

  const placeMenu = (el: HTMLElement | null, minWidth = 320) => {
    if (!el) return
    menuAnchorRef.current = el
    setMenuMinWidth(minWidth)
    const r = el.getBoundingClientRect()
    const width = Math.max(minWidth, Math.min(r.width, 420))
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8)
    const estimated = 420
    const top = Math.max(8, Math.min(r.bottom + 4, window.innerHeight - estimated - 8))
    setMenuRect({ top, left, width })
  }

  const openChip = (next: Chip, e: ReactMouseEvent<HTMLElement>, minWidth = 320) => {
    if (chip === next) {
      setChip(null)
      return
    }
    placeMenu(e.currentTarget, minWidth)
    setChip(next)
  }

  useEffect(() => {
    if (!chip) {
      setMenuRect(null)
      return
    }
    const onResize = () => placeMenu(menuAnchorRef.current, menuMinWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [chip, menuMinWidth])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null
      if (t?.closest('[data-keep-dropdown]')) return
      setChip(null)
      setViewMenu(false)
      setSlash(false)
    }
    document.addEventListener('mousedown', onDoc, true)
    return () => document.removeEventListener('mousedown', onDoc, true)
  }, [])

  const submitRef = useRef<() => void>(() => {})

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (viewMenu) { setViewMenu(false); return }
        setChip((c) => {
          if (c) return null
          onClose()
          return c
        })
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        submitRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, viewMenu])

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return
    setFiles((prev) => [...prev, ...Array.from(list)])
  }

  const submit = async () => {
    if (busy) return
    if (!projectId) { setError('Select a space'); return }
    if (!summary.trim()) { setError('Add a summary'); return }
    if (type === 'Subtask' && !parentId) { setError('A subtask needs a parent work item'); setChip('parent'); return }
    if (parentId) {
      const p = items.find((i) => i.id === parentId)
      if (!p || !ALLOWED_PARENTS[type].includes(p.type)) {
        setError(type === 'Subtask' ? 'Pick a Task, Story, or Bug as the parent' : 'Pick an epic as the parent')
        setChip('parent')
        return
      }
    }
    setError(null)
    setBusy(true)
    try {
      const extraLabels = impediment && !labelList.includes('impediment') ? ['impediment'] : []
      const fileNote = files.length ? `\n\nAttachments: ${files.map((f) => f.name).join(', ')}` : ''
      const input: WorkItemInput = {
        projectId,
        type,
        summary: summary.trim(),
        description: description + fileNote,
        status: status || defaults.status || 'To Do',
        priority: 'Medium',
        originalEstimate: null,
        assigneeId: assigneeId || null,
        reporterId: me!.id,
        labels: [...labelList, ...extraLabels],
        parentId: parentId || null,
        dueDate: dueDate || null,
        startDate: startDate || defaults.startDate || null,
        team: team || null,
        sprintId: sprintId || defaults.sprintId || activeSprint?.id || null,
        storyPoints: storyPoints.trim() && !Number.isNaN(Number(storyPoints)) ? Number(storyPoints) : null,
      }
      const item = await workItemService.create(input)
      if (comment.trim()) await commentService.add(item.id, comment.trim())
      for (const id of linkIds) await workItemService.addLink(item.id, linkType, id)
      showToast(`Created ${item.type} ${item.id}`, `/browse/${item.id}`)
      if (createAnother) {
        setCreated((c) => [...c, item.id])
        setSummary('')
        setDescription('')
        setComment('')
        setShowComment(false)
        setFiles([])
        setLinkIds([])
        setStoryPoints('')
        setImpediment(false)
      } else onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create work item')
    } finally {
      setBusy(false)
    }
  }
  submitRef.current = () => { void submit() }

  const onDescription = (value: string) => {
    setDescription(value)
    const last = value.split('\n').pop() ?? ''
    setSlash(last === '/')
  }

  const applySlash = (which: Chip) => {
    setDescription((d) => d.replace(/\/$/, ''))
    setSlash(false)
    placeMenu(box.current, 360)
    setChip(which)
  }

  const ViewIcon = view === 'full' ? Square : view === 'floating' ? PictureInPicture2 : PanelTop

  const header = (
    <div className="flex shrink-0 items-center justify-between px-4 pt-3">
      <div className="flex items-center gap-2 text-sm">
        <button type="button" data-keep-dropdown className="flex items-center gap-1.5 rounded px-1.5 py-1 hover:bg-slate-100" onClick={() => setChip(chip === 'project' ? null : 'project')}>
          <ProjectIcon icon={project?.icon ?? '📁'} size={18} />
          <span className="font-semibold text-slate-800">{project?.key ?? 'Space'}</span>
        </button>
        <span className="text-slate-300">|</span>
        <button type="button" data-keep-dropdown className="flex items-center gap-1.5 rounded px-1.5 py-1 hover:bg-slate-100" onClick={() => setChip(chip === 'type' ? null : 'type')}>
          <TypeIcon type={type} size={16} />
          <span className="text-slate-700">{type}</span>
        </button>
      </div>
      <div className="flex items-center gap-1">
        <div className="relative" data-keep-dropdown>
          <button
            type="button"
            title="View options"
            className={`rounded-md border p-1.5 ${viewMenu ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            onClick={() => { setViewMenu((o) => !o); setChip(null) }}
          >
            <ViewIcon size={16} />
          </button>
          {viewMenu && (
            <div className="absolute right-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
              <div className="px-3 py-1.5 text-xs text-slate-500">Switch view</div>
              {([
                ['condensed', 'Condensed', PanelTop],
                ['full', 'Full view', Square],
                ['floating', 'Floating', PictureInPicture2],
              ] as const).map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  className={`flex w-full items-center gap-2 border-l-2 px-3 py-2 text-left text-sm ${view === id ? 'border-brand-600 bg-brand-50 font-medium text-brand-700' : 'border-transparent text-slate-700 hover:bg-slate-50'}`}
                  onClick={() => { setView(id); setViewMenu(false) }}
                >
                  <Icon size={16} /> {label}
                </button>
              ))}
            </div>
          )}
        </div>
        {view === 'full' && (
          <button type="button" className="rounded p-1.5 text-slate-500 hover:bg-slate-100" title="More" onClick={() => setChip(null)}>
            <MoreHorizontal size={18} />
          </button>
        )}
        <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100" title="Close" onClick={onClose}><X size={18} /></button>
      </div>
    </div>
  )

  const spaceTypeMenus = (
    <>
      {chip === 'project' && (
        <Menu>
          {projects.map((p) => (
            <MenuBtn key={p.id} active={p.id === projectId} onClick={() => { setProjectId(p.id); setParentId(''); setChip(null) }}>
              <ProjectIcon icon={p.icon} size={18} /> {p.name} <span className="text-slate-400">({p.key})</span>
            </MenuBtn>
          ))}
        </Menu>
      )}
      {chip === 'type' && (
        <Menu>
          {allowedCreateTypes.map((t) => (
            <MenuBtn
              key={t}
              active={t === type}
              onClick={() => {
                setType(t)
                const p = items.find((i) => i.id === parentId)
                if (!lockedParent && p && !ALLOWED_PARENTS[t].includes(p.type)) setParentId('')
                setChip(null)
              }}
            >
              <TypeIcon type={t} size={16} /> {t}
            </MenuBtn>
          ))}
        </Menu>
      )}
    </>
  )

  const summaryBlock = (
    <div className="px-5 pt-2">
      <input
        autoFocus
        className="w-full border-0 text-xl font-semibold text-slate-900 outline-none placeholder:font-medium placeholder:text-slate-400"
        placeholder="Summary"
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
      />
      <div className="relative mt-1">
        <textarea
          className="min-h-[72px] w-full resize-none border-0 text-sm text-slate-700 outline-none placeholder:text-slate-400"
          placeholder="Add a description or type / for actions and Rovo"
          value={description}
          onChange={(e) => onDescription(e.target.value)}
        />
        {slash && (
          <div data-keep-dropdown className="absolute left-0 top-8 z-10 w-56 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
            <MenuBtn onClick={() => applySlash('assignee')}>Assignee</MenuBtn>
            <MenuBtn onClick={() => applySlash('labels')}>Labels</MenuBtn>
            <MenuBtn onClick={() => applySlash('parent')}>Parent</MenuBtn>
            <MenuBtn onClick={() => applySlash('due')}>Due date</MenuBtn>
            <MenuBtn onClick={() => applySlash('team')}>Team</MenuBtn>
          </div>
        )}
      </div>
    </div>
  )

  const assigneeQuery = assigneeQ.trim().toLowerCase()
  const assigneeMatches = users.filter((u) => {
    if (!assigneeQuery || assigneeQuery === 'automatic') return true
    return u.name.toLowerCase().includes(assigneeQuery) || u.email.toLowerCase().includes(assigneeQuery)
  })

  const openAssignee = (e: ReactMouseEvent<HTMLElement>) => {
    setAssigneeQ(assignee?.name ?? 'Automatic')
    openChip('assignee', e, 360)
  }

  const fieldMenuChips: Chip[] = ['assignee', 'labels', 'parent', 'due', 'start', 'team', 'sprint', 'points', 'links', 'restrict']
  const fieldPopovers = fieldMenuChips.includes(chip) && createPortal(
    <div
      data-keep-dropdown
      className="fixed z-[80] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
      style={{
        top: menuRect?.top ?? 160,
        left: menuRect?.left ?? 80,
        width: menuRect?.width ?? 360,
      }}
    >
      {chip === 'assignee' && (
        <>
          <div className="p-2">
            <div className="flex items-center gap-2 rounded-md border-2 border-[#0c66e4] bg-white px-2 py-1.5">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500">
                {assignee ? <Avatar user={assignee} size={24} /> : <User size={14} />}
              </span>
              <input
                autoFocus
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none"
                value={assigneeQ}
                onChange={(e) => setAssigneeQ(e.target.value)}
                onFocus={(e) => e.target.select()}
              />
            </div>
          </div>
          <div className="max-h-72 overflow-auto py-1">
            {(!assigneeQuery || assigneeQuery === 'automatic') && (
              <button
                type="button"
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50"
                onClick={() => { setAssigneeId(''); setChip(null) }}
              >
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500">
                  <User size={16} />
                </span>
                <span className="text-sm font-medium text-slate-800">Automatic</span>
              </button>
            )}
            {assigneeMatches.map((u) => (
              <button
                key={u.id}
                type="button"
                className={`flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 ${u.id === assigneeId ? 'bg-[#e9f2ff]' : ''}`}
                onClick={() => { setAssigneeId(u.id); setChip(null) }}
              >
                <Avatar user={u} size={32} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-900">{u.name}</span>
                  <span className="block truncate text-[13px] text-slate-500">{u.email}</span>
                </span>
              </button>
            ))}
            {assigneeMatches.length === 0 && assigneeQuery && assigneeQuery !== 'automatic' && (
              <div className="px-3 py-2 text-sm text-slate-500">No people found</div>
            )}
          </div>
        </>
      )}
      {chip === 'labels' && (
        <>
          <div className="p-2">
            <div className="flex items-center gap-2 rounded-md border-2 border-[#0c66e4] bg-white px-2 py-1.5">
              <Tag size={15} className="shrink-0 text-slate-500" />
              <input
                autoFocus
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-500"
                placeholder="Labels"
                value={labelQ}
                onChange={(e) => setLabelQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTypedLabel()
                  }
                }}
              />
              <ChevronDown size={16} className="shrink-0 text-slate-400" />
            </div>
          </div>
          <div className="max-h-72 overflow-auto px-1 pb-2">
            <div className="px-3 py-1.5 text-[13px] font-semibold text-slate-800">All labels</div>
            <div className="mb-1 border-b border-slate-100 px-2 pb-2">
              {!createLabelOpen ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium text-[#0c66e4] hover:bg-blue-50"
                  onClick={() => setCreateLabelOpen(true)}
                >
                  <Plus size={15} />
                  Create label
                </button>
              ) : (
                <div className="px-1">
                  <div className="mb-1.5 text-[13px] font-semibold text-slate-800">Create label</div>
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none placeholder:text-slate-400 focus:border-[#0c66e4]"
                      placeholder="New label name"
                      value={createLabelName}
                      onChange={(e) => setCreateLabelName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          createLabel()
                        }
                        if (e.key === 'Escape') {
                          setCreateLabelOpen(false)
                          setCreateLabelName('')
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      type="button"
                      className="shrink-0 rounded-md bg-[#0c66e4] px-2.5 py-1.5 text-[13px] font-medium text-white hover:bg-[#0055cc] disabled:opacity-50"
                      disabled={!createLabelName.trim()}
                      onClick={createLabel}
                    >
                      Create
                    </button>
                  </div>
                </div>
              )}
            </div>
            {visibleLabels.map((l) => (
              <button
                key={l}
                type="button"
                className={`flex w-full items-center px-3 py-2 text-left hover:bg-slate-100 ${labelList.includes(l) ? 'bg-slate-100' : ''}`}
                onClick={() => toggleLabel(l)}
              >
                <span className={`rounded-sm border bg-white px-2 py-0.5 text-[13px] ${labelChipClass(l)}`}>{l}</span>
              </button>
            ))}
            {visibleLabels.length === 0 && !labelQ.trim() && (
              <div className="px-3 py-2 text-sm text-slate-500">No labels yet</div>
            )}
            {labelQ.trim() && !allLabels.some((l) => l.toLowerCase() === labelQ.trim().toLowerCase()) && (
              <button
                type="button"
                className="flex w-full items-center px-3 py-2 text-left hover:bg-slate-50"
                onClick={addTypedLabel}
              >
                <span className={`rounded-sm border bg-white px-2 py-0.5 text-[13px] ${labelChipClass(labelQ.trim())}`}>{labelQ.trim()}</span>
                <span className="ml-2 text-xs text-slate-500">Create new</span>
              </button>
            )}
          </div>
        </>
      )}
      {chip === 'parent' && (
        <>
          <div className="p-2">
            <div className="flex items-center gap-2 rounded-md border-2 border-[#0c66e4] bg-white px-2 py-1.5">
              <Zap size={15} className="shrink-0 text-purple-600" />
              <input
                autoFocus
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-500"
                placeholder="Parent"
                value={parentQ}
                onChange={(e) => setParentQ(e.target.value)}
              />
              <ChevronDown size={16} className="shrink-0 text-slate-400" />
            </div>
          </div>
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <label className="flex items-center gap-2 text-[13px] text-slate-700">
              <input type="checkbox" checked={showDoneParents} onChange={(e) => setShowDoneParents(e.target.checked)} />
              Show everything marked as done
            </label>
          </div>
          <div className="max-h-72 overflow-auto py-1">
            {type === 'Epic' && (
              <div className="px-3 py-2 text-sm text-slate-500">Epics cannot have a parent</div>
            )}
            {type !== 'Epic' && visibleParents.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-slate-100 ${p.id === parentId ? 'bg-slate-100' : ''}`}
                onClick={() => { setParentId(p.id); setChip(null) }}
              >
                <span className={`mt-1 h-3.5 w-3.5 shrink-0 rounded-sm ${epicSwatch(p.id)}`} />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-[13px] font-medium text-slate-800">
                    <TypeIcon type={p.type} size={14} />
                    {p.id}
                  </span>
                  <span className="mt-0.5 block truncate text-[13px] text-slate-800">{p.summary}</span>
                </span>
              </button>
            ))}
            {type !== 'Epic' && visibleParents.length === 0 && (
              <div className="px-3 py-2 text-sm text-slate-500">{type === 'Subtask' ? 'No parent work items match' : 'No epics in this space'}</div>
            )}
          </div>
        </>
      )}
      {chip === 'due' && (
        <Popover>
          <input type="date" className="input" value={dueDate} onChange={(e) => { setDueDate(e.target.value); setChip(null) }} />
          {dueDate && <button className="mt-2 text-xs text-brand-700 hover:underline" onClick={() => { setDueDate(''); setChip(null) }}>Clear</button>}
        </Popover>
      )}
      {chip === 'start' && (
        <Popover>
          <input type="date" className="input" value={startDate} onChange={(e) => { setStartDate(e.target.value); setChip(null) }} />
          {startDate && <button className="mt-2 text-xs text-brand-700 hover:underline" onClick={() => { setStartDate(''); setChip(null) }}>Clear</button>}
        </Popover>
      )}
      {chip === 'team' && (
        <Popover>
          <MenuBtn active={!team} onClick={() => { setTeam(''); setChip(null) }}>None</MenuBtn>
          {TEAMS.map((t) => (
            <MenuBtn key={t} active={t === team} onClick={() => { setTeam(t); setChip(null) }}>{t}</MenuBtn>
          ))}
        </Popover>
      )}
      {chip === 'sprint' && (
        <Popover>
          <MenuBtn active={!sprintId} onClick={() => { setSprintId(''); setChip(null) }}>None</MenuBtn>
          {projectSprints.map((s) => (
            <MenuBtn key={s.id} active={s.id === sprintId} onClick={() => { setSprintId(s.id); setChip(null) }}>
              {s.name}{s.state === 'active' ? ' (active)' : ''}
            </MenuBtn>
          ))}
        </Popover>
      )}
      {chip === 'points' && (
        <Popover>
          <input autoFocus type="number" min={0} className="input" placeholder="Story points" value={storyPoints} onChange={(e) => setStoryPoints(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setChip(null)} />
        </Popover>
      )}
      {chip === 'links' && (
        <Popover>
          <select className="input mb-2" value={linkType} onChange={(e) => setLinkType(e.target.value as LinkType)}>
            {LINK_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
          {linkOptions.map((p) => (
            <MenuBtn
              key={p.id}
              active={linkIds.includes(p.id)}
              onClick={() => setLinkIds((ids) => ids.includes(p.id) ? ids.filter((x) => x !== p.id) : [...ids, p.id])}
            >
              <TypeIcon type={p.type} size={14} /> {p.id} · {p.summary}
            </MenuBtn>
          ))}
        </Popover>
      )}
      {chip === 'restrict' && (
        <Popover>
          <MenuBtn active={!restrictTo} onClick={() => { setRestrictTo(''); setChip(null) }}>Anyone</MenuBtn>
          {members.map((u) => (
            <MenuBtn key={u.id} active={u.id === restrictTo} onClick={() => { setRestrictTo(u.id); setChip(null) }}>
              <Avatar user={u} size={18} /> {u.name}
            </MenuBtn>
          ))}
        </Popover>
      )}
    </div>,
    document.body,
  )

  const coreRows = (
    <>
      <div className="relative" data-keep-dropdown>
        <FieldRow caption="Status" onClick={(e) => openChip('status', e, 320)}>
          <StatusCircleIcon status={status} size={16} /> {status}
        </FieldRow>
        {chip === 'status' && createPortal(
          <div
            data-keep-dropdown
            className="fixed z-[80] overflow-hidden rounded-lg border border-slate-200 bg-white py-1.5 shadow-xl"
            style={{
              top: menuRect?.top ?? 160,
              left: menuRect?.left ?? 80,
              width: menuRect?.width ?? 320,
            }}
          >
            <div className="max-h-72 overflow-y-auto">
              {[...CREATE_STATUSES, ...extraStatuses].map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm ${s === status ? 'bg-blue-50 font-medium text-slate-900' : 'text-slate-800 hover:bg-slate-50'}`}
                  onClick={() => { setStatus(s as Status); setChip(null) }}
                >
                  <StatusCircleIcon status={s} size={16} />
                  <span className="flex-1">{s}</span>
                  {s === status && <Check size={16} className="shrink-0 text-[#0c66e4]" />}
                </button>
              ))}
            </div>
            <div className="my-1 border-t border-slate-200" />
            <button
              type="button"
              className="flex w-full px-3.5 py-2 text-left text-sm text-slate-800 hover:bg-slate-100"
              onClick={() => {
                const name = window.prompt('Status name')
                if (!name?.trim()) return
                const next = name.trim()
                if (![...CREATE_STATUSES, ...extraStatuses].includes(next)) setExtraStatuses((p) => [...p, next])
                setStatus(next as Status)
                setChip(null)
              }}
            >
              Add status
            </button>
            <button
              type="button"
              className="flex w-full px-3.5 py-2 text-left text-sm text-slate-800 hover:bg-slate-100"
              onClick={() => {
                const name = window.prompt('Rename status', status)
                if (!name?.trim()) return
                const next = name.trim()
                setExtraStatuses((p) => p.map((s) => (s === status ? next : s)).concat(CREATE_STATUSES.includes(status) && next !== status ? [next] : []))
                setStatus(next as Status)
                setChip(null)
              }}
            >
              Edit status
            </button>
            <button
              type="button"
              className="flex w-full px-3.5 py-2 text-left text-sm text-slate-800 hover:bg-slate-100"
              onClick={() => {
                setChip(null)
                if (project?.key) navigate(`/projects/${project.key}/settings/work-types`)
              }}
            >
              Manage workflow
            </button>
          </div>,
          document.body,
        )}
      </div>
      <FieldRow caption="Assignee" onClick={openAssignee}>
        {assignee ? <Avatar user={assignee} size={18} /> : <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-slate-200 text-[10px] text-slate-500">A</span>}
        {assignee ? assignee.name : 'Automatic'}
      </FieldRow>
      <FieldRow icon={<Tag size={16} />} onClick={(e) => openChip('labels', e, 300)}>
        {labelList.length ? labelList.join(', ') : 'Labels'}
      </FieldRow>
      {type !== 'Epic' && (
        <FieldRow icon={<Zap size={16} />} onClick={(e) => openChip('parent', e, 320)}>
          {parent ? `${parent.id} ${parent.summary}` : 'Parent'}
        </FieldRow>
      )}
      <FieldRow icon={<Calendar size={16} />} onClick={(e) => openChip('due', e, 280)}>
        {dueDate || 'Due date'}
      </FieldRow>
      <FieldRow icon={<Users size={16} />} onClick={(e) => openChip('team', e, 280)}>
        {team || 'Team'}
      </FieldRow>
    </>
  )

  const condensedFields = (
    <div className="relative px-5 pb-3">
      <div className="flex flex-wrap gap-2">
        <ChipBtn active={chip === 'assignee' || !!assignee} onClick={openAssignee}>
          {assignee ? <Avatar user={assignee} size={16} /> : <User size={14} />}
          {assignee ? assignee.name : 'Automatic'}
        </ChipBtn>
        <ChipBtn active={chip === 'labels' || labelList.length > 0} onClick={(e) => openChip('labels', e, 300)}>
          <Tag size={14} /> Labels{labelList.length ? ` · ${labelList.length}` : ''}
        </ChipBtn>
        {type !== 'Epic' && (
          <ChipBtn active={chip === 'parent' || !!parent} onClick={(e) => openChip('parent', e, 320)}>
            <Zap size={14} /> {parent ? parent.id : 'Parent'}
          </ChipBtn>
        )}
        <ChipBtn active={chip === 'due' || !!dueDate} onClick={(e) => openChip('due', e, 280)}>
          <Calendar size={14} /> {dueDate || 'Due date'}
        </ChipBtn>
        <ChipBtn active={chip === 'team' || !!team} onClick={(e) => openChip('team', e, 280)}>
          <Users size={14} /> {team || 'Team'}
        </ChipBtn>
      </div>
    </div>
  )

  const extraRows = (
    <>
      <FieldRow icon={<Calendar size={16} />} onClick={(e) => openChip('start', e, 280)}>
        {startDate || 'Start date'}
      </FieldRow>
      <FieldRow icon={<Repeat size={16} />} onClick={(e) => openChip('sprint', e, 280)}>
        {sprint?.name || 'Sprint'}
      </FieldRow>
      <FieldRow icon={<Hash size={16} />} onClick={(e) => openChip('points', e, 280)}>
        {storyPoints.trim() ? storyPoints : 'Story point estimate'}
      </FieldRow>
      <div className="px-3 py-2">
        <div className="mb-1.5 text-sm text-slate-600">Attachment</div>
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-6 text-sm text-slate-600 hover:bg-slate-50"
          onDragOver={(e) => { e.preventDefault() }}
          onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files) }}
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={16} />
          <span>Drop files to attach or <span className="text-brand-700">browse</span></span>
        </button>
        <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
        {files.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center justify-between">
                <span className="truncate">{f.name}</span>
                <button type="button" className="text-slate-400 hover:text-red-600" onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}><X size={14} /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <FieldRow icon={<Link2 size={16} />} onClick={(e) => openChip('links', e, 360)}>
        {linkIds.length ? `${linkIds.length} linked` : 'Linked work items'}
      </FieldRow>
    </>
  )

  const floatingFields = (
    <div className="relative space-y-0.5 px-5 pb-3 pt-2">
      {coreRows}
      {extraRows}
    </div>
  )

  const fullFields = (
    <div className="relative space-y-0.5 px-5 pb-3 pt-2">
      {coreRows}
      {extraRows}
      <FieldRow icon={<Shield size={16} />} onClick={(e) => openChip('restrict', e, 300)}>
        {restrictUser ? restrictUser.name : 'Restrict to'}
      </FieldRow>
      <div className="px-3 py-2">
        <div className="mb-1.5 text-sm text-slate-600">Flagged</div>
        <label className="flex items-center gap-2 text-sm text-slate-800">
          <input type="checkbox" checked={impediment} onChange={(e) => setImpediment(e.target.checked)} />
          Impediment
        </label>
      </div>
    </div>
  )

  const footer = (
    <div className="shrink-0">
      {showComment && (
        <div className="px-5 pb-2">
          <textarea className="input min-h-16" placeholder="Add a comment…" value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>
      )}
      {error && <div className="px-5 pb-2 text-sm text-red-600">{error}</div>}
      {created.length > 0 && <div className="px-5 pb-1 text-xs text-green-700">Created: {created.join(', ')}</div>}
      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
        <button
          type="button"
          className={`rounded p-1.5 ${showComment ? 'bg-slate-100 text-brand-700' : 'text-slate-500 hover:bg-slate-100'}`}
          title="Add a comment"
          onClick={() => setShowComment((s) => !s)}
        >
          <MessageSquare size={18} />
        </button>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={createAnother} onChange={(e) => setCreateAnother(e.target.checked)} />
            Create another
          </label>
          <button className="btn-primary" disabled={busy} onClick={() => void submit()}>{busy ? 'Creating…' : 'Create'}</button>
        </div>
      </div>
    </div>
  )

  const fields = view === 'full' ? fullFields : view === 'floating' ? floatingFields : condensedFields

  if (view === 'floating') {
    return (
      <div className="pointer-events-none fixed inset-0 z-50">
        <div
          ref={box}
          className="pointer-events-auto absolute bottom-3 right-3 top-3 flex w-[min(100%-1.5rem,440px)] flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {header}
          {spaceTypeMenus}
          {fieldPopovers}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {summaryBlock}
            {fields}
          </div>
          {footer}
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-[5vh] pb-8"
      onMouseDown={() => {
        setChip(null)
        setViewMenu(false)
        setSlash(false)
      }}
    >
      <div
        ref={box}
        className={`flex flex-col rounded-xl bg-white shadow-2xl ${view === 'full' ? 'max-h-[90vh] w-full max-w-[760px] overflow-hidden' : 'w-full max-w-[720px] overflow-visible'}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {header}
        {spaceTypeMenus}
        {fieldPopovers}
        <div className={view === 'full' ? 'min-h-0 flex-1 overflow-y-auto' : ''}>
          {summaryBlock}
          {fields}
        </div>
        {footer}
      </div>
    </div>
  )
}

function FieldRow({
  caption,
  icon,
  children,
  onClick,
  trailing,
}: {
  caption?: string
  icon?: React.ReactNode
  children: React.ReactNode
  onClick: (e: ReactMouseEvent<HTMLButtonElement>) => void
  trailing?: React.ReactNode
}) {
  return (
    <button
      type="button"
      data-keep-dropdown
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-slate-50"
    >
      {icon && <span className="shrink-0 text-slate-500">{icon}</span>}
      <span className="min-w-0 flex-1">
        {caption && <div className="mb-0.5 text-xs text-slate-500">{caption}</div>}
        <span className="flex items-center gap-2 text-sm text-slate-700">{children}</span>
      </span>
      {trailing}
    </button>
  )
}

const CREATE_STATUSES = [
  'To Do',
  'In Progress',
  'Dev Done',
  'On-Hold',
  'QA Done',
  'Re-Open',
  'Done',
  'Developers Done',
  'QA-Done',
  'Reject',
  'On Hold',
  'Drop',
]

const SUGGESTED_LABELS = [
  'Backend',
  'App',
  'Testing',
  'Optimization',
  'Gitconf.',
  'Meetings',
  'server',
  'Documentation',
  'production-issue',
  'Frontend',
  'Review',
  'Research',
  'uat',
]

const LABEL_CHIP_COLORS = [
  'border-pink-400 text-pink-700',
  'border-slate-400 text-slate-700',
  'border-fuchsia-400 text-fuchsia-700',
  'border-violet-400 text-violet-700',
  'border-zinc-400 text-zinc-700',
  'border-emerald-500 text-emerald-700',
  'border-purple-400 text-purple-700',
  'border-sky-400 text-sky-700',
  'border-amber-400 text-amber-700',
]

const EPIC_SWATCHES = ['bg-[#c0b6f2]', 'bg-[#7ee2b8]', 'bg-[#b8acf6]', 'bg-[#6b5b95]', 'bg-[#e774bb]', 'bg-[#8f7ee7]']

function epicSwatch(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h += id.charCodeAt(i)
  return EPIC_SWATCHES[h % EPIC_SWATCHES.length]
}

function labelChipClass(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i) * (i + 1)) % LABEL_CHIP_COLORS.length
  return LABEL_CHIP_COLORS[h]
}

function ChipBtn({ children, onClick, active }: { children: React.ReactNode; onClick: (e: ReactMouseEvent<HTMLButtonElement>) => void; active?: boolean }) {
  return (
    <button
      type="button"
      data-keep-dropdown
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm ${active ? 'border-slate-400 bg-slate-50 text-slate-800' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
    >
      {children}
    </button>
  )
}

function Menu({ children }: { children: React.ReactNode }) {
  return <div data-keep-dropdown className="mx-4 mt-1 max-h-56 overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">{children}</div>
}

function Popover({ children }: { children: React.ReactNode }) {
  return <div className="max-h-72 overflow-auto px-2 py-2">{children}</div>
}

function MenuBtn({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm ${active ? 'bg-[#e9f2ff] text-slate-800' : 'text-slate-700 hover:bg-slate-50'}`}
    >
      {children}
    </button>
  )
}
