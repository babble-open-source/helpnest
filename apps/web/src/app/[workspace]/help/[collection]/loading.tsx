export default function Loading() {
  return (
    <div className="min-h-screen bg-cream animate-pulse">
      <div className="h-14 bg-white border-b border-border" />
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-6">
        <div className="h-10 w-10 bg-border rounded" />
        <div className="h-9 bg-border rounded w-1/2" />
        <div className="h-4 bg-border rounded w-2/3" />
        <div className="mt-8 bg-white rounded-xl border border-border divide-y divide-border">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="p-5 space-y-2">
              <div className="h-4 bg-cream rounded w-3/4" />
              <div className="h-3 bg-cream rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
