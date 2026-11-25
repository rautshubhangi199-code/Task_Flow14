import { create } from 'zustand'
import type { WorkItemInput } from '../types'
import { canCreateWorkItems } from '../lib/permissions'
import { useStore } from './useStore'

export interface Toast {
  id: number
  message: string
  link?: string
}

interface UiState {
  createItemOpen: boolean
  createItemDefaults: Partial<WorkItemInput>
  createSpaceOpen: boolean
  toasts: Toast[]
  openCreateItem: (defaults?: Partial<WorkItemInput>) => void
  closeCreateItem: () => void
  setCreateSpaceOpen: (open: boolean) => void
  showToast: (message: string, link?: string) => void
  dismissToast: (id: number) => void
}

let toastId = 0

export const useUi = create<UiState>()((set, get) => ({
  createItemOpen: false,
  createItemDefaults: {},
  createSpaceOpen: false,
  toasts: [],
  openCreateItem: (defaults = {}) => {
    const s = useStore.getState()
    const user = s.users.find((u) => u.id === s.currentUserId)
    if (!canCreateWorkItems(user)) return
    set({ createItemOpen: true, createItemDefaults: defaults })
  },
  closeCreateItem: () => set({ createItemOpen: false, createItemDefaults: {} }),
  setCreateSpaceOpen: (open) => set({ createSpaceOpen: open }),
  showToast: (message, link) => {
    const id = ++toastId
    set({ toasts: [...get().toasts, { id, message, link }] })
    if (link?.startsWith('/browse/')) return
    setTimeout(() => get().dismissToast(id), 4500)
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}))
