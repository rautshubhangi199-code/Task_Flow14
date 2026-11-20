import { endOfDay, parseISO, startOfDay, subDays, subHours, subWeeks } from 'date-fns'
import { DONE_STATUSES, ISSUE_TYPES, PRIORITIES, STATUSES, type Project, type Sprint, type User, type WorkItem } from '../types'

export class JqlError extends Error {}

export interface JqlContext {
  currentUserId: string | null
  users: User[]
  projects: Project[]
  sprints: Sprint[]
  viewedIds: string[]
}

type Token = { kind: 'str' | 'op' | 'punc' | 'fn' | 'word'; value: string; pos: number }

const TOKEN_RE = /\s*(?:"([^"]*)"|'([^']*)'|(!=|>=|<=|!~|=|~|>|<)|(\(|\)|,)|([A-Za-z_][\w.-]*\(\))|([\w.:-]+))/y

function tokenize(src: string): Token[] {
  const tokens: Token[] = []
  TOKEN_RE.lastIndex = 0
  let pos = 0
  while (pos < src.length) {
    if (/^\s*$/.test(src.slice(pos))) break
    TOKEN_RE.lastIndex = pos
    const m = TOKEN_RE.exec(src)
    if (!m) throw new JqlError(`Unexpected character "${src.slice(pos).trim()[0]}" at position ${pos + 1}`)
    const at = m.index + m[0].length - m[0].trimStart().length
    if (m[1] !== undefined || m[2] !== undefined) tokens.push({ kind: 'str', value: m[1] ?? m[2], pos: at })
    else if (m[3]) tokens.push({ kind: 'op', value: m[3], pos: at })
    else if (m[4]) tokens.push({ kind: 'punc', value: m[4], pos: at })
    else if (m[5]) tokens.push({ kind: 'fn', value: m[5], pos: at })
    else tokens.push({ kind: 'word', value: m[6], pos: at })
    pos = TOKEN_RE.lastIndex
  }
  return tokens
}

type Value = { kind: 'str' | 'fn'; value: string } | { kind: 'empty' }
type Node =
  | { t: 'and' | 'or'; left: Node; right: Node }
  | { t: 'not'; node: Node }
  | { t: 'clause'; field: string; op: string; values: Value[] }

export interface SortSpec {
  field: string
  dir: 'asc' | 'desc'
}

export interface ParsedQuery {
  node: Node | null
  orderBy: SortSpec[]
}

const FIELDS: Record<string, string> = {
  project: 'project', status: 'status', assignee: 'assignee', reporter: 'reporter', type: 'type', issuetype: 'type',
  priority: 'priority', labels: 'labels', label: 'labels', sprint: 'sprint', text: 'text', summary: 'summary',
  description: 'description', key: 'key', id: 'key', issuekey: 'key', parent: 'parent', created: 'created',
  updated: 'updated', resolved: 'resolved', due: 'due', duedate: 'due', statuscategory: 'statusCategory', team: 'team',
}
const DATE_FIELDS = ['created', 'updated', 'resolved', 'due']

class Parser {
  private i = 0
  private tokens: Token[]
  constructor(tokens: Token[]) {
    this.tokens = tokens
  }
  peek(offset = 0) { return this.tokens[this.i + offset] }
  next() { return this.tokens[this.i++] }
  isWord(t: Token | undefined, w: string) { return !!t && t.kind === 'word' && t.value.toUpperCase() === w }

  parse(): ParsedQuery {
    let node: Node | null = null
    if (this.peek() && !this.isWord(this.peek(), 'ORDER')) node = this.parseOr()
    const orderBy: SortSpec[] = []
    if (this.isWord(this.peek(), 'ORDER')) {
      this.next()
      if (!this.isWord(this.next(), 'BY')) throw new JqlError('Expected BY after ORDER')
      do {
        const f = this.next()
        if (!f || f.kind !== 'word') throw new JqlError('Expected a field name after ORDER BY')
        const field = FIELDS[f.value.toLowerCase()]
        if (!field) throw new JqlError(`Unknown field "${f.value}" in ORDER BY`)
        let dir: 'asc' | 'desc' = 'asc'
        if (this.isWord(this.peek(), 'ASC') || this.isWord(this.peek(), 'DESC')) dir = this.next().value.toLowerCase() as 'asc' | 'desc'
        orderBy.push({ field, dir })
      } while (this.peek()?.value === ',' && this.next())
    }
    const rest = this.peek()
    if (rest) throw new JqlError(`Unexpected "${rest.value}" at position ${rest.pos + 1}`)
    return { node, orderBy }
  }

  parseOr(): Node {
    let left = this.parseAnd()
    while (this.isWord(this.peek(), 'OR')) {
      this.next()
      left = { t: 'or', left, right: this.parseAnd() }
    }
    return left
  }
  parseAnd(): Node {
    let left = this.parseUnary()
    while (this.isWord(this.peek(), 'AND')) {
      this.next()
      left = { t: 'and', left, right: this.parseUnary() }
    }
    return left
  }
  parseUnary(): Node {
    const t = this.peek()
    if (!t) throw new JqlError('Query ended unexpectedly – expected a condition')
    if (this.isWord(t, 'NOT')) {
      this.next()
      return { t: 'not', node: this.parseUnary() }
    }
    if (t.value === '(' && t.kind === 'punc') {
      this.next()
      const n = this.parseOr()
      const close = this.next()
      if (!close || close.value !== ')') throw new JqlError('Missing closing parenthesis ")"')
      return n
    }
    return this.parseClause()
  }
  parseValue(): Value {
    const t = this.next()
    if (!t) throw new JqlError('Expected a value')
    if (t.kind === 'str') return { kind: 'str', value: t.value }
    if (t.kind === 'fn') return { kind: 'fn', value: t.value.toLowerCase() }
    if (t.kind === 'word') {
      if (t.value.toUpperCase() === 'EMPTY' || t.value.toUpperCase() === 'NULL') return { kind: 'empty' }
      if (['AND', 'OR', 'ORDER'].includes(t.value.toUpperCase())) throw new JqlError(`Expected a value but found "${t.value}"`)
      return { kind: 'str', value: t.value }
    }
    throw new JqlError(`Expected a value but found "${t.value}" at position ${t.pos + 1}`)
  }
  parseClause(): Node {
    const f = this.next()
    if (f.kind !== 'word') throw new JqlError(`Expected a field name but found "${f.value}" at position ${f.pos + 1}`)
    const field = FIELDS[f.value.toLowerCase()]
    if (!field) throw new JqlError(`Unknown field "${f.value}". Try: project, status, assignee, reporter, type, priority, labels, sprint, text, created, updated, due`)
    const t = this.next()
    if (!t) throw new JqlError(`Expected an operator after "${f.value}"`)
    let op: string
    if (t.kind === 'op') op = t.value
    else if (this.isWord(t, 'IN')) op = 'in'
    else if (this.isWord(t, 'NOT') && this.isWord(this.peek(), 'IN')) { this.next(); op = 'not in' }
    else if (this.isWord(t, 'IS')) {
      if (this.isWord(this.peek(), 'NOT')) { this.next(); op = 'is not' } else op = 'is'
    } else throw new JqlError(`Unknown operator "${t.value}" after "${f.value}"`)

    let values: Value[]
    if (op === 'in' || op === 'not in') {
      const p = this.peek()
      if (p?.kind === 'fn') values = [this.parseValue()]
      else {
        if (this.next()?.value !== '(') throw new JqlError(`Expected "(" after ${op.toUpperCase()}`)
        values = [this.parseValue()]
        while (this.peek()?.value === ',') { this.next(); values.push(this.parseValue()) }
        if (this.next()?.value !== ')') throw new JqlError('Missing ")" to close the list')
      }
    } else values = [this.parseValue()]
    if ((op === 'is' || op === 'is not') && values[0].kind !== 'empty') throw new JqlError('IS / IS NOT must be followed by EMPTY')
    if (['>', '<', '>=', '<='].includes(op) && !DATE_FIELDS.includes(field) && field !== 'priority')
      throw new JqlError(`Operator "${op}" is only supported for date fields (created, updated, resolved, due)`)
    if ((op === '~' || op === '!~') && !['text', 'summary', 'description'].includes(field))
      throw new JqlError(`Operator "~" is only supported for text, summary and description`)
    return { t: 'clause', field, op, values }
  }
}

export function parseJql(src: string): ParsedQuery {
  const tokens = tokenize(src)
  if (!tokens.length) return { node: null, orderBy: [] }
  return new Parser(tokens).parse()
}

/* ---------------- evaluation ---------------- */

function resolveUser(v: Value, ctx: JqlContext): string | null {
  if (v.kind === 'empty') return null
  if (v.kind === 'fn') {
    if (v.value === 'currentuser()') return ctx.currentUserId
    throw new JqlError(`Unknown function ${v.value}`)
  }
  const q = v.value.toLowerCase()
  const u = ctx.users.find((x) => x.id === v.value || x.email.toLowerCase() === q || x.name.toLowerCase() === q || x.name.split(' ')[0].toLowerCase() === q)
  if (!u) throw new JqlError(`The user "${v.value}" does not exist`)
  return u.id
}

function resolveDate(v: Value): Date {
  if (v.kind === 'empty') throw new JqlError('Date comparison with EMPTY is not supported – use IS EMPTY')
  if (v.kind === 'fn') {
    switch (v.value) {
      case 'now()': return new Date()
      case 'startofday()': case 'today()': return startOfDay(new Date())
      case 'endofday()': return endOfDay(new Date())
      default: throw new JqlError(`Unknown function ${v.value}`)
    }
  }
  const rel = /^(-?)(\d+)([dwh])$/i.exec(v.value)
  if (rel) {
    const n = parseInt(rel[2], 10)
    const unit = rel[3].toLowerCase()
    return unit === 'd' ? subDays(new Date(), n) : unit === 'w' ? subWeeks(new Date(), n) : subHours(new Date(), n)
  }
  const d = parseISO(v.value)
  if (isNaN(d.getTime())) throw new JqlError(`"${v.value}" is not a valid date. Use yyyy-MM-dd, -7d, startOfDay() …`)
  return d
}

const ci = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

function validateEnum(field: string, v: Value, allowed: readonly string[]) {
  if (v.kind === 'str' && !allowed.some((a) => ci(a, v.value))) throw new JqlError(`The value "${v.value}" does not exist for the field "${field}"`)
}

type Pred = (i: WorkItem) => boolean

function compile(node: Node, ctx: JqlContext): Pred {
  if (node.t === 'and' || node.t === 'or') {
    const l = compile(node.left, ctx), r = compile(node.right, ctx)
    return node.t === 'and' ? (i) => l(i) && r(i) : (i) => l(i) || r(i)
  }
  if (node.t === 'not') { const n = compile(node.node, ctx); return (i) => !n(i) }

  const { field, op, values } = node as Extract<Node, { t: 'clause' }>
  const negate = op === '!=' || op === 'not in' || op === 'is not' || op === '!~'

  // text search
  if (op === '~' || op === '!~') {
    const v = values[0]
    if (v.kind !== 'str') throw new JqlError('Text search needs a quoted string')
    const q = v.value.toLowerCase()
    const p: Pred = (i) =>
      field === 'summary' ? i.summary.toLowerCase().includes(q)
        : field === 'description' ? i.description.toLowerCase().includes(q)
          : `${i.id} ${i.summary} ${i.description} ${i.labels.join(' ')}`.toLowerCase().includes(q)
    return negate ? (i) => !p(i) : p
  }

  // dates
  if (DATE_FIELDS.includes(field)) {
    const get = (i: WorkItem) => {
      const raw = field === 'created' ? i.createdAt : field === 'updated' ? i.updatedAt : field === 'resolved' ? i.resolvedAt : i.dueDate
      return raw ? parseISO(raw) : null
    }
    if (op === 'is' || op === 'is not') return (i) => (get(i) === null) !== negate
    const target = resolveDate(values[0])
    const t = target.getTime()
    return (i) => {
      const d = get(i)
      if (!d) return false
      const x = d.getTime()
      switch (op) {
        case '>': return x > t
        case '>=': return x >= t
        case '<': return x < t
        case '<=': return x <= t
        case '=': return startOfDay(d).getTime() === startOfDay(target).getTime()
        case '!=': return startOfDay(d).getTime() !== startOfDay(target).getTime()
        default: throw new JqlError(`Operator ${op} not supported for dates`)
      }
    }
  }

  // build a matcher per value
  let matchers: Pred[]
  switch (field) {
    case 'project':
      matchers = values.map((v) => {
        if (v.kind === 'empty') return () => false
        if (v.kind === 'fn') throw new JqlError(`Function ${v.value} is not supported for project`)
        const p = ctx.projects.find((x) => ci(x.key, v.value) || ci(x.name, v.value) || x.id === v.value)
        if (!p) throw new JqlError(`The value "${v.value}" does not exist for the field "project"`)
        return (i: WorkItem) => i.projectId === p.id
      })
      break
    case 'status':
      matchers = values.map((v) => { validateEnum('status', v, STATUSES); return (i: WorkItem) => v.kind === 'str' && ci(i.status, v.value) })
      break
    case 'statusCategory':
      matchers = values.map((v) => {
        validateEnum('statusCategory', v, ['To Do', 'In Progress', 'Done'])
        return (i: WorkItem) => {
          if (v.kind !== 'str') return false
          const cat = DONE_STATUSES.includes(i.status) ? 'done' : i.status === 'To Do' ? 'to do' : 'in progress'
          return cat === v.value.toLowerCase()
        }
      })
      break
    case 'type':
      matchers = values.map((v) => { validateEnum('type', v, [...ISSUE_TYPES, 'Sub-task']); return (i: WorkItem) => v.kind === 'str' && (ci(i.type, v.value) || (i.type === 'Subtask' && ci(v.value, 'sub-task'))) })
      break
    case 'priority':
      matchers = values.map((v) => { validateEnum('priority', v, PRIORITIES); return (i: WorkItem) => v.kind === 'str' && ci(i.priority, v.value) })
      break
    case 'assignee':
    case 'reporter':
      matchers = values.map((v) => {
        const uidv = resolveUser(v, ctx)
        return (i: WorkItem) => (field === 'assignee' ? i.assigneeId : i.reporterId) === uidv
      })
      break
    case 'labels':
      matchers = values.map((v) => (i: WorkItem) => (v.kind === 'empty' ? i.labels.length === 0 : v.kind === 'str' && i.labels.some((l) => ci(l, v.value))))
      break
    case 'team':
      matchers = values.map((v) => (i: WorkItem) => (v.kind === 'empty' ? !i.team : v.kind === 'str' && !!i.team && ci(i.team, v.value)))
      break
    case 'sprint':
      matchers = values.map((v) => {
        if (v.kind === 'empty') return (i: WorkItem) => !i.sprintId
        if (v.kind === 'fn') {
          if (v.value === 'opensprints()') return (i: WorkItem) => ctx.sprints.some((s) => s.id === i.sprintId && s.state === 'active')
          if (v.value === 'closedsprints()') return (i: WorkItem) => ctx.sprints.some((s) => s.id === i.sprintId && s.state === 'completed')
          throw new JqlError(`Unknown function ${v.value}`)
        }
        const sp = ctx.sprints.find((s) => ci(s.name, v.value) || s.id === v.value)
        if (!sp) throw new JqlError(`The sprint "${v.value}" does not exist`)
        return (i: WorkItem) => i.sprintId === sp.id
      })
      break
    case 'key':
    case 'parent':
      matchers = values.map((v) => {
        if (v.kind === 'fn') {
          if (v.value === 'issuehistory()') return (i: WorkItem) => ctx.viewedIds.includes(i.id)
          throw new JqlError(`Unknown function ${v.value}`)
        }
        if (v.kind === 'empty') return (i: WorkItem) => (field === 'parent' ? !i.parentId : false)
        return (i: WorkItem) => ci(field === 'key' ? i.id : (i.parentId ?? ''), v.value)
      })
      break
    case 'summary':
    case 'description':
    case 'text':
      throw new JqlError(`Use "~" to search ${field}, e.g. ${field} ~ "login"`)
    default:
      throw new JqlError(`Field "${field}" is not supported`)
  }
  if ((op === 'is' || op === 'is not') && values[0].kind === 'empty') {
    const emptyCheck: Pred = (i) => {
      switch (field) {
        case 'assignee': return !i.assigneeId
        case 'labels': return i.labels.length === 0
        case 'sprint': return !i.sprintId
        case 'parent': return !i.parentId
        case 'team': return !i.team
        default: return false
      }
    }
    return negate ? (i) => !emptyCheck(i) : emptyCheck
  }
  const any: Pred = (i) => matchers.some((m) => m(i))
  return negate ? (i) => !any(i) : any
}

const PRIORITY_RANK: Record<string, number> = { Highest: 5, High: 4, Medium: 3, Low: 2, Lowest: 1 }

export function sortValue(i: WorkItem, field: string, ctx: Pick<JqlContext, 'users' | 'projects'>): string | number {
  switch (field) {
    case 'key': { const [k, n] = i.id.split('-'); return `${k}-${n.padStart(6, '0')}` }
    case 'priority': return PRIORITY_RANK[i.priority]
    case 'status': return STATUSES.indexOf(i.status)
    case 'assignee': return ctx.users.find((u) => u.id === i.assigneeId)?.name ?? '~'
    case 'reporter': return ctx.users.find((u) => u.id === i.reporterId)?.name ?? '~'
    case 'project': return ctx.projects.find((p) => p.id === i.projectId)?.key ?? ''
    case 'created': return i.createdAt
    case 'updated': return i.updatedAt
    case 'resolved': return i.resolvedAt ?? ''
    case 'due': return i.dueDate ?? '9999'
    case 'summary': return i.summary.toLowerCase()
    case 'type': return i.type
    default: return i.id
  }
}

export function sortItems(items: WorkItem[], specs: SortSpec[], ctx: Pick<JqlContext, 'users' | 'projects'>) {
  if (!specs.length) return items
  return [...items].sort((a, b) => {
    for (const s of specs) {
      const x = sortValue(a, s.field, ctx)
      const y = sortValue(b, s.field, ctx)
      if (x < y) return s.dir === 'asc' ? -1 : 1
      if (x > y) return s.dir === 'asc' ? 1 : -1
    }
    return 0
  })
}

export function runJql(src: string, items: WorkItem[], ctx: JqlContext): { items: WorkItem[]; orderBy: SortSpec[] } {
  const { node, orderBy } = parseJql(src)
  const pred = node ? compile(node, ctx) : () => true
  return { items: sortItems(items.filter(pred), orderBy, ctx), orderBy }
}

export const quoteValue = (v: string) => (/^[\w.-]+$/.test(v) ? v : `"${v}"`)

export interface DefaultFilter {
  id: string
  name: string
  jql: string
}

export const DEFAULT_FILTERS: DefaultFilter[] = [
  { id: 'my-open', name: 'My open work items', jql: 'assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC' },
  { id: 'reported', name: 'Reported by me', jql: 'reporter = currentUser() ORDER BY created DESC' },
  { id: 'open', name: 'All open work items', jql: 'statusCategory != Done ORDER BY priority DESC' },
  { id: 'done', name: 'Done work items', jql: 'statusCategory = Done ORDER BY resolved DESC' },
  { id: 'viewed', name: 'Viewed recently', jql: 'key in issueHistory() ORDER BY updated DESC' },
  { id: 'created', name: 'Created recently', jql: 'created >= -7d ORDER BY created DESC' },
  { id: 'resolved', name: 'Resolved recently', jql: 'resolved >= -7d ORDER BY resolved DESC' },
  { id: 'updated', name: 'Updated recently', jql: 'updated >= -7d ORDER BY updated DESC' },
  { id: 'today', name: "Today's work items", jql: 'assignee = currentUser() AND (due <= endOfDay() OR updated >= startOfDay()) AND statusCategory != Done ORDER BY due ASC' },
]
