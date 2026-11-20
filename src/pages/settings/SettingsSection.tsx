export default function SettingsSection({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-2 text-2xl font-semibold">{title}</h1>
      <p className="text-sm text-slate-600">{description}</p>
      <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
        This category is listed for administrators. There is no backend for it yet, so settings cannot be saved.
      </div>
    </div>
  )
}
