import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Calendar, Hash, Link2, Lock, MessageSquare, MoreHorizontal, PanelTop, PictureInPicture2,
  Repeat, Shield, Square, Tag, Upload, Users, X, Zap,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { useAccessibleProjects, useCurrentUser } from '../store/hooks'
import { useUi } from '../store/uiStore'
import { commentService, workItemService } from '../services/api'
import { ISSUE_TYPES, LINK_TYPES, TEAMS, type IssueType, type LinkType, type Status, type WorkItemInput } from '../types'
import { ALLOWED_PARENTS } from '../lib/utils'
import { Avatar, ProjectIcon, TypeIcon } from './ui'
import { StatusCircleIcon, StatusDropdown } from './StatusDropdown'

export function CreateWorkItemModal() {
  const open = useUi((s) => s.createItemOpen)
  const defaults = useUi((s) => s.createItemDefaults)
  const close = useUi((s) => s.closeCreateItem)
  if (!open) return null
  return <CreateWorkItemForm defaults={defaults} onClose={close} />
}

type Chip = 'assignee' | 'labels' | 'parent' | 'due' | 'team' | 'project' | 'type' | 'start' | 'sprint' | 'status' | 'points' | 'links' | 'restrict' | null
type CreateView = 'condensed' | 'full' | 'floating'

function CreateWorkItemForm({ defaults, onClose }: { defaults: Partial<WorkItemInput>; onClose: () => void }) {
  const me = useCurrentUser()
  const projects = useAccessibleProjects()
  const users = useStore((s) => s.users)
  const items = useStore((s) => s.items)
  const sprints = useStore((s) => s.sprints)
  const showToast = useUi((s) => s.showToast)

  const [projectId, setProjectId] = useState(defaults.projectId ?? projects[0]?.id ?? '')
  const [type, setType] = useState<IssueType>(defaults.type ?? 'Story')
  const [status, setStatus] = useState<Status>(defaults.status ?? 'To Do')
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
  const [slash, setSlash] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<string[]>([])
  const box = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const project = projects.find((p) => p.id === projectId)
  const members = useMemo(() => users.filter((u) => project && (project.memberIds.includes(u.id) || project.leadId === u.id)), [users, project])
  const assignee = users.find((u) => u.id === assigneeId)
  const parent = items.find((i) => i.id === parentId)
  const labelList = labels.split(',').map((l) => l.trim()).filter(Boolean)
  const parentOptions = useMemo(
    () => items.filter((i) => i.projectId === projectId && ALLOWED_PARENTS[type].includes(i.type)),
    [items, projectId, type],
  )
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
    const onDoc = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) {
        setChip(null)
        setViewMenu(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
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
    if (type === 'Subtask' && !parentId) { setError('A subtask needs a parent'); setChip('parent'); return }
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
      showToast(`Created ${item.id} "${item.summary}"`, `/browse/${item.id}`)
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
    setChip(which)
  }

  const ViewIcon = view === 'full' ? Square : view === 'floating' ? PictureInPicture2 : PanelTop

  const header = (
    <div className="flex shrink-0 items-center justify-between px-4 pt-3">
      <div className="flex items-center gap-2 text-sm">
        <button type="button" className="flex items-center gap-1.5 rounded px-1.5 py-1 hover:bg-slate-100" onClick={() => setChip(chip === 'project' ? null : 'project')}>
          <ProjectIcon icon={project?.icon ?? '📁'} size={18} />
          <span className="font-semibold text-slate-800">{project?.key ?? 'Space'}</span>
        </button>
        <span className="text-slate-300">|</span>
        <button type="button" className="flex items-center gap-1.5 rounded px-1.5 py-1 hover:bg-slate-100" onClick={() => setChip(chip === 'type' ? null : 'type')}>
          <TypeIcon type={type} size={16} />
          <span className="text-slate-700">{type}</span>
        </button>
      </div>
      <div className="flex items-center gap-1">
        <div className="relative">
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
          {ISSUE_TYPES.map((t) => (
            <MenuBtn key={t} active={t === type} onClick={() => { setType(t); setParentId(''); setChip(null) }}>
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
          <div className="absolute left-0 top-8 z-10 w-56 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
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

  const fieldPopovers = (
    <>
      {chip === 'assignee' && (
        <Popover>
          <MenuBtn active={!assigneeId} onClick={() => { setAssigneeId(''); setChip(null) }}><Lock size={14} /> Automatic</MenuBtn>
          {me && <MenuBtn onClick={() => { setAssigneeId(me.id); setChip(null) }}>Assign to me</MenuBtn>}
          {members.map((u) => (
            <MenuBtn key={u.id} active={u.id === assigneeId} onClick={() => { setAssigneeId(u.id); setChip(null) }}>
              <Avatar user={u} size={18} /> {u.name}
            </MenuBtn>
          ))}
        </Popover>
      )}
      {chip === 'labels' && (
        <Popover>
          <input autoFocus className="input" placeholder="frontend, api" value={labels} onChange={(e) => setLabels(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setChip(null)} />
          <p className="mt-1 text-xs text-slate-500">Comma-separated. Press Enter to apply.</p>
        </Popover>
      )}
      {chip === 'parent' && (
        <Popover>
          <MenuBtn active={!parentId} onClick={() => { setParentId(''); setChip(null) }}>None</MenuBtn>
          {parentOptions.map((p) => (
            <MenuBtn key={p.id} active={p.id === parentId} onClick={() => { setParentId(p.id); setChip(null) }}>
              <TypeIcon type={p.type} size={14} /> {p.id} · {p.summary}
            </MenuBtn>
          ))}
          {type === 'Epic' && <div className="px-2 py-1 text-xs text-slate-500">Epics cannot have a parent</div>}
          {type === 'Subtask' && parentOptions.length === 0 && <div className="px-2 py-1 text-xs text-slate-500">No valid parents in this space</div>}
        </Popover>
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
      {chip === 'status' && (
        <Popover>
          <StatusDropdown value={status} onChange={(s) => { setStatus(s); setChip(null) }} projectKey={project?.key} variant="select" />
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
    </>
  )

  const coreRows = (
    <>
      <FieldRow caption="Status" onClick={() => setChip(chip === 'status' ? null : 'status')}>
        <StatusCircleIcon status={status} size={16} /> {status}
      </FieldRow>
      <FieldRow caption="Assignee" onClick={() => setChip(chip === 'assignee' ? null : 'assignee')}>
        {assignee ? <Avatar user={assignee} size={18} /> : <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-slate-200 text-[10px] text-slate-500">A</span>}
        {assignee ? assignee.name : 'Automatic'}
      </FieldRow>
      <FieldRow icon={<Tag size={16} />} onClick={() => setChip(chip === 'labels' ? null : 'labels')}>
        {labelList.length ? labelList.join(', ') : 'Labels'}
      </FieldRow>
      <FieldRow icon={<Zap size={16} />} onClick={() => setChip(chip === 'parent' ? null : 'parent')}>
        {parent ? `${parent.id} ${parent.summary}` : 'Parent'}
      </FieldRow>
      <FieldRow icon={<Calendar size={16} />} onClick={() => setChip(chip === 'due' ? null : 'due')}>
        {dueDate || 'Due date'}
      </FieldRow>
      <FieldRow icon={<Users size={16} />} onClick={() => setChip(chip === 'team' ? null : 'team')}>
        {team || 'Team'}
      </FieldRow>
    </>
  )

  const condensedFields = (
    <div className="relative flex flex-wrap gap-2 px-5 pb-3">
      <ChipBtn active={!!assignee} onClick={() => setChip(chip === 'assignee' ? null : 'assignee')}>
        {assignee ? <Avatar user={assignee} size={16} /> : <Lock size={14} />}
        {assignee ? assignee.name : 'Automatic'}
      </ChipBtn>
      <ChipBtn active={labelList.length > 0} onClick={() => setChip(chip === 'labels' ? null : 'labels')}>
        <Tag size={14} /> Labels{labelList.length ? ` · ${labelList.length}` : ''}
      </ChipBtn>
      <ChipBtn active={!!parent} onClick={() => setChip(chip === 'parent' ? null : 'parent')}>
        <Zap size={14} /> {parent ? parent.id : 'Parent'}
      </ChipBtn>
      <ChipBtn active={!!dueDate} onClick={() => setChip(chip === 'due' ? null : 'due')}>
        <Calendar size={14} /> {dueDate || 'Due date'}
      </ChipBtn>
      <ChipBtn active={!!team} onClick={() => setChip(chip === 'team' ? null : 'team')}>
        <Users size={14} /> {team || 'Team'}
      </ChipBtn>
      {fieldPopovers}
    </div>
  )

  const extraRows = (
    <>
      <FieldRow icon={<Calendar size={16} />} onClick={() => setChip(chip === 'start' ? null : 'start')}>
        {startDate || 'Start date'}
      </FieldRow>
      <FieldRow icon={<Repeat size={16} />} onClick={() => setChip(chip === 'sprint' ? null : 'sprint')}>
        {sprint?.name || 'Sprint'}
      </FieldRow>
      <FieldRow icon={<Hash size={16} />} onClick={() => setChip(chip === 'points' ? null : 'points')}>
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
      <FieldRow icon={<Link2 size={16} />} onClick={() => setChip(chip === 'links' ? null : 'links')}>
        {linkIds.length ? `${linkIds.length} linked` : 'Linked work items'}
      </FieldRow>
    </>
  )

  const floatingFields = (
    <div className="relative space-y-0.5 px-5 pb-3 pt-2">
      {coreRows}
      {extraRows}
      {fieldPopovers}
    </div>
  )

  const fullFields = (
    <div className="relative space-y-0.5 px-5 pb-3 pt-2">
      {coreRows}
      {extraRows}
      <FieldRow icon={<Shield size={16} />} onClick={() => setChip(chip === 'restrict' ? null : 'restrict')}>
        {restrictUser ? restrictUser.name : 'Restrict to'}
      </FieldRow>
      <div className="px-3 py-2">
        <div className="mb-1.5 text-sm text-slate-600">Flagged</div>
        <label className="flex items-center gap-2 text-sm text-slate-800">
          <input type="checkbox" checked={impediment} onChange={(e) => setImpediment(e.target.checked)} />
          Impediment
        </label>
      </div>
      {fieldPopovers}
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-[5vh] pb-8" onMouseDown={onClose}>
      <div
        ref={box}
        className={`flex flex-col overflow-hidden rounded-xl bg-white shadow-2xl ${view === 'full' ? 'max-h-[90vh] w-full max-w-[760px]' : 'w-full max-w-[720px]'}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {header}
        {spaceTypeMenus}
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
  onClick: () => void
  trailing?: React.ReactNode
}) {
  return (
    <button
      type="button"
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

function ChipBtn({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm ${active ? 'border-slate-400 bg-slate-50 text-slate-800' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
    >
      {children}
    </button>
  )
}

function Menu({ children }: { children: React.ReactNode }) {
  return <div className="mx-4 mt-1 max-h-56 overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">{children}</div>
}

function Popover({ children }: { children: React.ReactNode }) {
  return <div className="absolute left-5 top-10 z-20 max-h-64 w-72 overflow-auto rounded-md border border-slate-200 bg-white p-2 shadow-lg">{children}</div>
}

function MenuBtn({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-slate-100 ${active ? 'bg-brand-50 text-brand-800' : 'text-slate-700'}`}>
      {children}
    </button>
  )
}
