import { Construction } from 'lucide-react'

export default function Placeholder({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-6 text-2xl font-semibold">{title}</h1>
      <div className="flex flex-col items-center rounded-lg border border-dashed border-slate-300 py-16 text-center">
        <Construction size={40} className="mb-3 text-slate-400" />
        <div className="text-lg font-semibold text-slate-700">{title} is coming in a later phase</div>
        <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>
      </div>
    </div>
  )
}
