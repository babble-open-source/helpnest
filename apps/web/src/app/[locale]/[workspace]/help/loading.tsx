export default function Loading() {
  return (
    <div className="min-h-screen bg-cream animate-pulse">
      <div className="bg-ink py-16 px-4">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="h-10 bg-white/10 rounded-lg w-3/4 mx-auto" />
          <div className="h-5 bg-white/10 rounded w-1/2 mx-auto" />
          <div className="h-12 bg-white/10 rounded-xl max-w-lg mx-auto" />
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-36 bg-white rounded-xl border border-border" />
          ))}
        </div>
      </div>
    </div>
  )
}
