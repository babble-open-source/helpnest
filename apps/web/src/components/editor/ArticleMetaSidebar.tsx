'use client'

interface Collection {
  id: string
  title: string
  emoji: string | null
}

interface Props {
  slug: string
  onSlugChange: (v: string) => void
  excerpt: string
  onExcerptChange: (v: string) => void
  collectionId: string
  onCollectionChange: (v: string) => void
  status: string
  collections: Collection[]
}

export function ArticleMetaSidebar({
  slug,
  onSlugChange,
  excerpt,
  onExcerptChange,
  collectionId,
  onCollectionChange,
  status,
  collections,
}: Props) {
  return (
    <aside className="w-72 bg-white border-l border-border flex flex-col shrink-0 overflow-y-auto">
      <div className="p-5 border-b border-border">
        <p className="text-xs font-medium text-muted uppercase tracking-wide">Article settings</p>
      </div>

      <div className="p-5 space-y-5 flex-1">
        {/* Status badge */}
        <div>
          <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-1.5">
            Status
          </label>
          <span className={`inline-flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-full ${
            status === 'PUBLISHED'
              ? 'bg-green-50 text-green-700'
              : status === 'ARCHIVED'
              ? 'bg-border text-muted'
              : 'bg-cream border border-border text-muted'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              status === 'PUBLISHED' ? 'bg-green-600' : 'bg-muted'
            }`} />
            {status.charAt(0) + status.slice(1).toLowerCase()}
          </span>
        </div>

        {/* Collection */}
        <div>
          <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-1.5">
            Collection
          </label>
          <select
            value={collectionId}
            onChange={(e) => onCollectionChange(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-white text-ink"
          >
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.title}
              </option>
            ))}
          </select>
        </div>

        {/* Slug */}
        <div>
          <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-1.5">
            URL slug
          </label>
          <input
            value={slug}
            onChange={(e) => onSlugChange(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent font-mono"
          />
          <p className="text-xs text-muted mt-1">
            help/collection/<strong>{slug}</strong>
          </p>
        </div>

        {/* Excerpt */}
        <div>
          <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-1.5">
            Excerpt
          </label>
          <textarea
            value={excerpt}
            onChange={(e) => onExcerptChange(e.target.value)}
            placeholder="Brief summary shown in article lists..."
            rows={3}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
          />
        </div>
      </div>
    </aside>
  )
}
