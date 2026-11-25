import { useMemo } from 'react'
import { useStore } from '../../store/useStore'
import FilterSearch from '../filters/FilterSearch'
import { useProject } from './projectContext'
import { BacklogFilterBar, useBacklogFilter } from './BacklogFilter'

export default function List() {
  const project = useProject()
  const allItems = useStore((s) => s.items)
  const users = useStore((s) => s.users)
  const filter = useBacklogFilter()
  const projectItems = useMemo(() => allItems.filter((i) => i.projectId === project.id), [allItems, project.id])
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 px-6 pt-4">
        <BacklogFilterBar users={users} projectItems={projectItems} {...filter.panelProps} />
      </div>
      <div className="min-h-0 flex-1">
        <FilterSearch lockProjectKey={project.key} hidePageHeader extraPredicate={filter.matches} />
      </div>
    </div>
  )
}
