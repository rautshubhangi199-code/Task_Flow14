import { useMemo } from 'react'
import { useStore } from '../store/useStore'
import { useAccessibleProjects } from '../store/hooks'
import type { JqlContext } from './jql'

export function useJqlContext(): JqlContext {
  const users = useStore((s) => s.users)
  const sprints = useStore((s) => s.sprints)
  const views = useStore((s) => s.views)
  const currentUserId = useStore((s) => s.currentUserId)
  const projects = useAccessibleProjects()
  return useMemo(
    () => ({ users, sprints, projects, currentUserId, viewedIds: views.filter((v) => v.userId === currentUserId).map((v) => v.itemId) }),
    [users, sprints, projects, currentUserId, views],
  )
}
