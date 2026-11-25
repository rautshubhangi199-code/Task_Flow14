import { http, asList, asRecord } from './http'
import type { IssueType, Role, Status } from '../types'
import { ISSUE_TYPES, STATUSES } from '../types'

const pks = {
  user: new Map<string, number>(),
  project: new Map<string, number>(),
  item: new Map<string, number>(),
  sprint: new Map<string, number>(),
  comment: new Map<string, number>(),
  worklog: new Map<string, number>(),
  filter: new Map<string, number>(),
  notification: new Map<string, number>(),
  team: new Map<string, number>(),
  label: new Map<string, number>(),
  role: new Map<string, number>(),
  org: new Map<string, number>(),
}

export function rememberPk(kind: keyof typeof pks, key: string, pk: number) {
  if (key && Number.isFinite(pk)) pks[kind].set(String(key), pk)
}

export function pkOf(kind: keyof typeof pks, id: string | number | null | undefined): number | null {
  if (id === null || id === undefined || id === '') return null
  const n = Number(id)
  if (Number.isFinite(n) && String(n) === String(id).trim()) return n
  const cached = pks[kind].get(String(id))
  return cached ?? (Number.isFinite(n) ? n : null)
}

export function requirePk(kind: keyof typeof pks, id: string | number): number {
  const n = pkOf(kind, id)
  if (n == null) throw new Error(`Missing backend id for ${kind} ${id}`)
  return n
}

export function rawId(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k]
    if (v !== undefined && v !== null && v !== '') return String(v)
  }
  return ''
}

export function rawPk(row: Record<string, unknown>): number | null {
  const v = row.id ?? row.pk
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function nestedName(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object') {
    const r = value as Record<string, unknown>
    return String(r.name ?? r.display_name ?? r.codename ?? r.work_item_id ?? r.id ?? '')
  }
  return ''
}

export function nestedId(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object') {
    const r = value as Record<string, unknown>
    return String(r.work_item_id ?? r.id ?? r.pk ?? '')
  }
  return ''
}

let types: { id: number; name: string }[] = []
let statuses: { id: number; name: string; projectId: string | null }[] = []
let roles: { id: number; name: string }[] = []
let teams: { id: number; name: string }[] = []
let loaded = false

export async function refreshCatalog(organizationId?: string | number) {
  const [typeRows, statusRows, roleRows, teamRows] = await Promise.all([
    http.get<unknown>('/get-all-work-item-types/').catch(() => []),
    http.get<unknown>('/get-all-statuses/').catch(() => []),
    http.get<unknown>('/get-all-roles/').catch(() => []),
    http.get<unknown>('/get-all-teams/', organizationId ? { organization_id: organizationId } : undefined).catch(() => []),
  ])
  types = asList<Record<string, unknown>>(typeRows).map((r) => {
    const id = rawPk(r) ?? 0
    const name = String(r.name ?? '')
    return { id, name }
  }).filter((t) => t.id)
  statuses = asList<Record<string, unknown>>(statusRows).map((r) => {
    const id = rawPk(r) ?? 0
    return { id, name: String(r.name ?? ''), projectId: r.project != null ? nestedId(r.project) : null }
  }).filter((s) => s.id)
  roles = asList<Record<string, unknown>>(roleRows).map((r) => ({ id: rawPk(r) ?? 0, name: String(r.name ?? '') })).filter((r) => r.id)
  roles.forEach((r) => rememberPk('role', r.name, r.id))
  teams = asList<Record<string, unknown>>(teamRows).map((r) => {
    const id = rawPk(r) ?? 0
    const name = String(r.name ?? '')
    rememberPk('team', name, id)
    rememberPk('team', String(id), id)
    return { id, name }
  }).filter((t) => t.id)
  loaded = true
}

export async function ensureCatalog(organizationId?: string | number) {
  if (!loaded) await refreshCatalog(organizationId)
}

export function typeIdForName(name: string): number | null {
  const n = name.toLowerCase()
  return types.find((t) => t.name.toLowerCase() === n)?.id ?? null
}

export function typeNameForId(id: unknown): IssueType {
  const n = nestedName(id)
  const byId = types.find((t) => String(t.id) === String(id) || t.name === n)
  const name = byId?.name ?? n
  return (ISSUE_TYPES as readonly string[]).includes(name) ? (name as IssueType) : 'Task'
}

export function statusIdForName(name: string, projectId?: string): number | null {
  const n = name.toLowerCase()
  const inProject = projectId
    ? statuses.find((s) => s.name.toLowerCase() === n && (s.projectId === projectId || s.projectId === String(pkOf('project', projectId) ?? '')))
    : undefined
  if (inProject) return inProject.id
  return statuses.find((s) => s.name.toLowerCase() === n)?.id ?? null
}

export function statusNameForId(id: unknown): Status {
  const n = nestedName(id)
  const byId = statuses.find((s) => String(s.id) === String(id) || s.name === n)
  const name = byId?.name ?? n
  if ((STATUSES as readonly string[]).includes(name)) return name as Status
  const loose = STATUSES.find((s) => s.toLowerCase().replace(/[\s-]/g, '') === name.toLowerCase().replace(/[\s-]/g, ''))
  return loose ?? 'To Do'
}

export function mapRoleName(name: string): Role {
  const n = name.toLowerCase()
  if (n.includes('admin')) return 'Admin'
  if (n.includes('manager')) return 'Project Manager'
  if (n.includes('coord')) return 'Project Coordinator'
  if (n.includes('qa')) return 'QA'
  return 'Developer'
}

export function roleIdForFrontend(role: Role | string): number | null {
  const want = String(role).toLowerCase()
  return roles.find((r) => r.name.toLowerCase() === want || mapRoleName(r.name).toLowerCase() === want)?.id ?? roles[0]?.id ?? null
}

export function teamIdForName(name: string | null | undefined): number | null {
  if (!name) return null
  return pkOf('team', name) ?? teams.find((t) => t.name === name)?.id ?? null
}

export function teamNameForId(id: unknown): string | null {
  if (id == null || id === '') return null
  const n = nestedName(id)
  return teams.find((t) => String(t.id) === String(id) || t.name === n)?.name ?? (n || null)
}

export async function ensureWorkItemType(name: string): Promise<number> {
  await ensureCatalog()
  const existing = typeIdForName(name)
  if (existing) return existing
  const created = asRecord(await http.post('/create-work-item-type/', { name, description: name }))
  const id = rawPk(created)
  if (id) {
    types.push({ id, name: String(created.name ?? name) })
    return id
  }
  throw new Error(`Could not resolve work item type ${name}`)
}

export async function ensureStatus(name: string, projectId: string, isDefault = false): Promise<number> {
  await ensureCatalog()
  const existing = statusIdForName(name, projectId)
  if (existing) return existing
  const project = requirePk('project', projectId)
  const created = asRecord(await http.post('/create-status/', { name, project, is_default: isDefault }))
  const id = rawPk(created)
  if (id) {
    statuses.push({ id, name: String(created.name ?? name), projectId })
    return id
  }
  throw new Error(`Could not resolve status ${name}`)
}

export { asRecord }
