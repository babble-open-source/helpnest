export default function Loading() {
  return (
    <div className="min-h-screen bg-cream animate-pulse">
      <div className="h-14 bg-white border-b border-border" />
      <div className="max-w-6xl mx-auto px-4 py-12 flex gap-12">
        <div className="flex-1 max-w-2xl space-y-4">
          <div className="h-3 bg-border rounded w-1/3" />
          <div className="h-10 bg-border rounded w-4/5" />
          <div className="h-4 bg-border rounded w-1/2" />
          <div className="mt-8 space-y-3">
            {[90, 75, 85, 70, 80, 72].map((w, i) => (
              <div key={i} className="h-4 bg-border rounded" style={{ width: `${w}%` }} />
            ))}
          </div>
        </div>
        <div className="hidden lg:block w-56 space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-3 bg-border rounded w-3/4" />
          ))}
        </div>
      </div>
    </div>
  )
}
