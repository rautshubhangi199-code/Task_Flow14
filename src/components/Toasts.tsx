import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, CheckCircle2, X } from 'lucide-react'
import { useUi } from '../store/uiStore'

function copyText(text: string) {
  const fallback = () => {
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.cssText = 'position:fixed;top:0;left:0;opacity:0'
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
  }
  if (!navigator.clipboard?.writeText) {
    fallback()
    return
  }
  void navigator.clipboard.writeText(text).catch(fallback)
}

export function Toasts() {
  const toasts = useUi((s) => s.toasts)
  const dismiss = useUi((s) => s.dismissToast)
  const [copiedId, setCopiedId] = useState<number | null>(null)

  return createPortal(
    <div className="fixed bottom-6 left-6 z-[400] space-y-2">
      {toasts.map((t) => {
        const href = t.link
        const created = href?.startsWith('/browse/')
        const itemType = t.message.match(/^Created (\S+) /)?.[1] ?? 'Task'
        if (created && href) {
          const url = `${window.location.origin}${href}`
          return (
            <div
              key={t.id}
              className="w-[360px] rounded-lg bg-white px-4 py-3.5 shadow-[0_8px_24px_rgba(9,30,66,0.25)]"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#22a06b] text-white">
                  <Check size={14} strokeWidth={3} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[16px] font-semibold leading-snug text-[#172b4d]">{t.message}</div>
                    <button type="button" onClick={() => dismiss(t.id)} className="-mr-1 -mt-0.5 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                      <X size={16} />
                    </button>
                  </div>
                  <div className="mt-1.5 text-[14px] font-medium text-[#0c66e4]">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      View {itemType}
                    </a>
                    <span className="mx-1.5">·</span>
                    <button
                      type="button"
                      className="hover:underline"
                      onClick={() => {
                        copyText(url)
                        setCopiedId(t.id)
                        window.setTimeout(() => setCopiedId((id) => (id === t.id ? null : id)), 1500)
                      }}
                    >
                      {copiedId === t.id ? 'Copied' : 'Copy link'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        }
        return (
          <div key={t.id} className="flex w-80 items-start gap-2 rounded-md border border-slate-200 bg-white p-3 shadow-lg">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-green-600" />
            <div className="flex-1 text-sm">{t.message}</div>
            <button type="button" onClick={() => dismiss(t.id)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
          </div>
        )
      })}
    </div>,
    document.body,
  )
}
