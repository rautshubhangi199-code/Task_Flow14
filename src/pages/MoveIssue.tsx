import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ChevronDown, ChevronRight, Info, OctagonAlert } from 'lucide-react'
import { useAccessibleItems, useAccessibleProjects } from '../store/hooks'
import { workItemService } from '../services/api'
import { ISSUE_TYPES, STATUSES, type IssueType, type Status } from '../types'
import { EmptyState, ProjectIcon, StatusBadge, TypeIcon } from '../components/ui'

type Step = 'choose' | 'status' | 'fields' | 'confirm' | 'progress'

export default function MoveIssue() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const from = params.get('from') || '/'
  const items = useAccessibleItems()
  const projects = useAccessibleProjects()
  const item = useMemo(() => items.find((i) => i.id === id), [items, id])

  const [step, setStep] = useState<Step>('choose')
  const [destId, setDestId] = useState('')
  const [destType, setDestType] = useState<IssueType>('Task')
  const [targetStatus, setTargetStatus] = useState<Status>('To Do')
  const [fieldsOpen, setFieldsOpen] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pct, setPct] = useState(0)
  const [started, setStarted] = useState('')
  const [movedId, setMovedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!item) return
    const other = projects.find((p) => p.id !== item.projectId)
    setDestId(other?.id ?? item.projectId)
    setDestType(item.type === 'Subtask' ? 'Subtask' : item.type)
    setTargetStatus(item.status)
  }, [item?.id])

  const dest = projects.find((p) => p.id === destId)
  const typeOptions = item?.type === 'Subtask' ? ISSUE_TYPES.filter((t) => t === 'Subtask') : ISSUE_TYPES.filter((t) => t !== 'Subtask')
  const cancel = () => navigate(from)

  const goStatus = () => {
    if (!dest || !item) return
    if (dest.id === item.projectId && destType === item.type) {
      setError('Choose a different project or issue type.')
      return
    }
    setError(null)
    setStep('status')
  }

  const runMove = async () => {
    if (!item || !dest) return
    const current = items.find((i) => i.id === item.id)
    if (!current) {
      setError(`At least one of the issues you are trying to move has been recently moved by another user (${item.id}). Please cancel and start again.`)
      setStep('confirm')
      return
    }
    setError(null)
    setStep('progress')
    setPct(0)
    setStarted(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))
    setBusy(true)
    const tick = window.setInterval(() => setPct((p) => Math.min(90, p + 18)), 180)
    const moved = await workItemService.move(item.id, dest.id, destType)
    window.clearInterval(tick)
    if (!moved) {
      setBusy(false)
      setError(`At least one of the issues you are trying to move has been recently moved by another user (${item.id}). Please cancel and start again.`)
      setStep('confirm')
      return
    }
    if (moved.status !== targetStatus) {
      await workItemService.update(moved.id, { status: targetStatus })
    }
    setMovedId(moved.id)
    setPct(100)
    setBusy(false)
  }

  if (!item && step !== 'progress') {
    return (
      <div className="p-8">
        <EmptyState title="Work item not found">This issue may have already been moved. Cancel and start again.</EmptyState>
        <button type="button" className="mt-4 text-sm text-[#0c66e4] hover:underline" onClick={cancel}>Cancel</button>
      </div>
    )
  }

  const titleKey = item?.id ?? id
  const destLabel = dest ? `${dest.name} - ${destType}` : destType

  return (
    <div className="min-h-full bg-white px-8 py-6 text-[14px] text-slate-800">
      {step !== 'progress' && (
        <h1 className="text-[22px] font-semibold text-slate-900">
          Move Issue: {titleKey}
          {step === 'status' && (
            <span className="font-semibold"> Step 1 of 2: Map statuses for '{destType}' issues in the '{dest?.name}' project</span>
          )}
          {step === 'fields' && (
            <span className="font-semibold"> Step 1 of 2: Update fields for '{destType}' issues in the '{dest?.name}' project</span>
          )}
          {step === 'confirm' && (
            <span className="font-semibold"> Step 2 of 2: Confirm changes</span>
          )}
        </h1>
      )}
      {step === 'progress' && <h1 className="text-[22px] font-semibold text-slate-900">Bulk Operation</h1>}

      <div className="mt-6 flex gap-10">
        {step !== 'progress' && (
          <aside className="w-52 shrink-0 text-[13px]">
            <NavRow
              active={step === 'choose' || step === 'status' || step === 'fields'}
              label="Operation Details"
              onClick={() => step !== 'progress' && setStep('choose')}
            />
            {dest && step !== 'choose' && (
              <div className="ml-5 mt-1 flex items-center gap-2 text-[#0c66e4]">
                <span className="h-2 w-2 rounded-full bg-[#0c66e4]" />
                <TypeIcon type={destType} size={14} />
                <span>{destLabel}</span>
              </div>
            )}
            <NavRow
              active={step === 'confirm'}
              label="Confirmation"
              onClick={() => dest && setStep('confirm')}
              className="mt-3"
            />
          </aside>
        )}

        <div className="min-w-0 max-w-3xl flex-1">
          {step === 'choose' && item && dest && (
            <>
              <p className="text-sm text-slate-700">
                Select the destination project and issue type. You will map statuses and confirm before the issue is moved.
              </p>
              <div className="mt-6 max-w-md space-y-4">
                <div>
                  <div className="mb-1 text-sm font-medium">Destination project</div>
                  <select className="input" value={destId} onChange={(e) => setDestId(e.target.value)}>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.key})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="mb-1 text-sm font-medium">Destination issue type</div>
                  <select className="input" value={destType} onChange={(e) => setDestType(e.target.value as IssueType)}>
                    {typeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
              <Actions next={goStatus} cancel={cancel} />
            </>
          )}

          {step === 'status' && item && dest && (
            <>
              <p className="text-sm leading-6 text-slate-700">
                The <TypeIcon type={destType} size={14} /> <b>{destType}</b> workflow in your destination project uses different statuses than the{' '}
                <TypeIcon type={item.type} size={14} /> <b>{item.type}</b> workflow in your source project. Select which status your issues should be in following the move.
                The following statuses must be mapped to available statuses associated with the target project and issue type.
              </p>
              <button type="button" className="mt-2 text-sm text-[#0c66e4] hover:underline">Learn more about mapping statuses</button>
              <table className="mt-6 w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-[13px] text-slate-600">
                    <th className="py-2 font-semibold">Issue Status</th>
                    <th className="py-2 font-semibold">Affects 1 issue(s)</th>
                    <th className="w-8 py-2" />
                    <th className="py-2 font-semibold">To</th>
                    <th className="py-2 font-semibold">Target Workflow (Software workflow for project {dest.key})</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="py-3 font-medium">Current Status</td>
                    <td className="py-3"><StatusBadge status={item.status} /></td>
                    <td className="py-3 text-slate-400">→</td>
                    <td className="py-3 font-medium">Target Status</td>
                    <td className="py-3">
                      <select className="input w-48 py-1" value={targetStatus} onChange={(e) => setTargetStatus(e.target.value as Status)}>
                        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                  </tr>
                </tbody>
              </table>
              <Actions next={() => setStep('fields')} cancel={cancel} />
            </>
          )}

          {step === 'fields' && dest && (
            <>
              <p className="text-sm leading-6 text-slate-700">
                Your destination's <TypeIcon type={destType} size={14} /> <b>{destType}</b> issues may have different field settings than your source project.
                Update the values for fields in these issues, or select Retain to keep the field's current value.
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                <b>Component</b> or <b>Version</b> field data is permanently lost, if you move issues between projects. Other incompatible fields will appear empty, even if you choose to retain their values.
              </p>
              <button type="button" className="mt-2 text-sm text-[#0c66e4] hover:underline">Learn more about things to keep in mind when migrating issues</button>
              <div className="mt-6 flex items-start gap-2 text-sm text-slate-700">
                <Info size={16} className="mt-0.5 text-[#0c66e4]" />
                <span>All field values will be retained.</span>
              </div>
              <Actions next={() => setStep('confirm')} cancel={cancel} />
            </>
          )}

          {step === 'confirm' && item && dest && (
            <>
              <p className="text-sm leading-6 text-slate-700">
                Below is a summary of all issues that will be moved. Please confirm that the correct changes have been entered.
                The bullet points below list the different target projects and issue types the issues will be moved to.
                Click on a link below to go to that particular group of issues.
              </p>
              <button type="button" className="mt-2 text-sm text-[#0c66e4] hover:underline">Learn more about bulk move</button>
              <ul className="mt-3 list-disc pl-5 text-sm">
                <li>
                  <button type="button" className="text-[#0c66e4] hover:underline" onClick={() => setFieldsOpen(true)}>
                    {dest.name} - {destType}
                  </button>
                </li>
              </ul>
              {error && (
                <div className="mt-4 flex items-start gap-2 text-sm text-red-700">
                  <OctagonAlert size={18} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              <button type="button" className="mt-6 flex items-center gap-1 text-[15px] font-medium" onClick={() => setFieldsOpen((o) => !o)}>
                {fieldsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <ProjectIcon icon={dest.icon} size={18} />
                <span>{dest.name}</span>
                <span className="text-slate-400">—</span>
                <TypeIcon type={destType} size={14} />
                <span>{destType}</span>
              </button>
              {fieldsOpen && (
                <div className="mt-3 text-sm">
                  <p className="text-slate-700">
                    The change will affect <b>1</b> issue(s) with issue type(s) <TypeIcon type={destType} size={14} /> <b>{destType}</b> in project(s){' '}
                    <b>{dest.name}</b>
                  </p>
                  <Section title="Issue Targets">
                    <Row label="Target Project"><span className="inline-flex items-center gap-1.5"><ProjectIcon icon={dest.icon} size={16} /> {dest.name}</span></Row>
                    <Row label="Target Issue Type"><span className="inline-flex items-center gap-1.5"><TypeIcon type={destType} size={14} /> {destType}</span></Row>
                  </Section>
                  <Section title="Workflow">
                    <Row label="Target Workflow">Software workflow for project {dest.key}</Row>
                    <Row label="Status Mapping">
                      <div>
                        <div className="mb-1 grid grid-cols-2 gap-8 text-[12px] font-semibold text-slate-500">
                          <span>Original Status</span>
                          <span>Target Status</span>
                        </div>
                        <div className="grid grid-cols-2 gap-8">
                          <StatusBadge status={item.status} />
                          <StatusBadge status={targetStatus} />
                        </div>
                      </div>
                    </Row>
                  </Section>
                  <Section title="Removed Fields" />
                  <Section title="Approvals" />
                </div>
              )}
              <div className="mt-6 flex items-center gap-4">
                <button type="button" className="btn-primary" disabled={busy} onClick={() => void runMove()}>Confirm</button>
                <button type="button" className="text-[#0c66e4] hover:underline" onClick={cancel}>Cancel</button>
              </div>
            </>
          )}

          {step === 'progress' && (
            <>
              <h2 className="text-base font-medium text-slate-800">Bulk Operation Progress</h2>
              <div className="mt-4 border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 font-semibold">Migrating 1 issues</div>
                <div className="px-4 py-3">
                  <div className="h-3 w-full overflow-hidden rounded-sm bg-slate-200">
                    <div className="h-full bg-slate-900 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-2 text-sm text-slate-700">Bulk operation is {pct}% complete.</p>
                  <p className="text-sm text-slate-700">{pct}% complete. {pct < 100 ? '0' : '1'} seconds elapsed.</p>
                  <p className="text-sm text-slate-700">Started Today {started}.</p>
                  {pct === 100 && movedId && (
                    <p className="mt-3 text-sm">
                      1 of 1 issue migrated successfully.{' '}
                      <Link className="text-[#0c66e4] hover:underline" to={`/browse/${movedId}`}>{movedId}</Link>
                    </p>
                  )}
                </div>
              </div>
              <button type="button" className="btn-default mt-4" onClick={() => { if (pct === 100 && movedId) navigate(`/browse/${movedId}`) }}>
                Refresh
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function NavRow({ active, label, onClick, className = '' }: { active: boolean; label: string; onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={`flex items-center gap-2 text-left ${active ? 'font-medium text-slate-900' : 'text-slate-500'} ${className}`}>
      <span className={`h-2.5 w-2.5 rounded-full ${active ? 'bg-[#0c66e4]' : 'bg-slate-300'}`} />
      {label}
    </button>
  )
}

function Actions({ next, cancel }: { next: () => void; cancel: () => void }) {
  return (
    <div className="mt-6 flex items-center gap-4">
      <button type="button" className="btn-primary" onClick={next}>Next</button>
      <button type="button" className="text-[#0c66e4] hover:underline" onClick={cancel}>Cancel</button>
    </div>
  )
}

function Section({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mt-4 border-t border-slate-200">
      <div className="py-2 text-[13px] font-semibold text-slate-800">{title}</div>
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_1fr] items-start gap-4 border-t border-slate-100 py-2.5">
      <div className="text-slate-600">{label}</div>
      <div>{children}</div>
    </div>
  )
}
