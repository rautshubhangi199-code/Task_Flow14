import { useMemo } from 'react'
import { useStore } from './useStore'
import { canAccessProject } from '../lib/permissions'
import { mergePersonalSettings } from '../lib/personalSettings'

export const useCurrentUser = () => {
  const users = useStore((s) => s.users)
  const id = useStore((s) => s.currentUserId)
  return useMemo(() => users.find((u) => u.id === id), [users, id])
}

export const usePersonalSettings = () => {
  const id = useStore((s) => s.currentUserId)
  const all = useStore((s) => s.personalSettings)
  return useMemo(() => mergePersonalSettings(id ? all[id] : undefined), [id, all])
}

export const useAccessibleProjects = () => {
  const projects = useStore((s) => s.projects)
  const user = useCurrentUser()
  return useMemo(() => projects.filter((p) => canAccessProject(user, p)), [projects, user])
}

export const useAccessibleItems = () => {
  const items = useStore((s) => s.items)
  const projects = useAccessibleProjects()
  return useMemo(() => {
    const ids = new Set(projects.map((p) => p.id))
    return items.filter((i) => ids.has(i.projectId))
  }, [items, projects])
}

export const useProjectByKey = (key: string | undefined) => {
  const projects = useAccessibleProjects()
  return useMemo(() => projects.find((p) => p.key === key), [projects, key])
}
