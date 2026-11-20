import { create } from 'zustand'
import type { WorkItemInput } from '../types'

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
  openCreateItem: (defaults = {}) => set({ createItemOpen: true, createItemDefaults: defaults }),
  closeCreateItem: () => set({ createItemOpen: false, createItemDefaults: {} }),
  setCreateSpaceOpen: (open) => set({ createSpaceOpen: open }),
  showToast: (message, link) => {
    const id = ++toastId
    set({ toasts: [...get().toasts, { id, message, link }] })
    setTimeout(() => get().dismissToast(id), 4500)
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}))
