import { useOutletContext } from 'react-router-dom'
import type { Project } from '../../types'

export const useProject = () => useOutletContext<{ project: Project }>().project
