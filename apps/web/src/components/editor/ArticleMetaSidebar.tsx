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
    <aside className="w-72 bg-white border-l border-[#E2DDD5] flex flex-col shrink-0 overflow-y-auto">
      <div className="p-5 border-b border-[#E2DDD5]">
        <p className="text-xs font-medium text-[#7A756C] uppercase tracking-wide">Article settings</p>
      </div>

      <div className="p-5 space-y-5 flex-1">
        {/* Status badge */}
        <div>
          <label className="block text-xs font-medium text-[#7A756C] uppercase tracking-wide mb-1.5">
            Status
          </label>
          <span className={`inline-flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-full ${
            status === 'PUBLISHED'
              ? 'bg-green-50 text-green-700'
              : status === 'ARCHIVED'
              ? 'bg-[#E2DDD5] text-[#7A756C]'
              : 'bg-[#F7F4EE] border border-[#E2DDD5] text-[#7A756C]'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              status === 'PUBLISHED' ? 'bg-green-600' : 'bg-[#7A756C]'
            }`} />
            {status.charAt(0) + status.slice(1).toLowerCase()}
          </span>
        </div>

        {/* Collection */}
        <div>
          <label className="block text-xs font-medium text-[#7A756C] uppercase tracking-wide mb-1.5">
            Collection
          </label>
          <select
            value={collectionId}
            onChange={(e) => onCollectionChange(e.target.value)}
            className="w-full px-3 py-2 border border-[#E2DDD5] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C8622A] bg-white text-[#1A1814]"
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
          <label className="block text-xs font-medium text-[#7A756C] uppercase tracking-wide mb-1.5">
            URL slug
          </label>
          <input
            value={slug}
            onChange={(e) => onSlugChange(e.target.value)}
            className="w-full px-3 py-2 border border-[#E2DDD5] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C8622A] font-mono"
          />
          <p className="text-xs text-[#7A756C] mt-1">
            help/collection/<strong>{slug}</strong>
          </p>
        </div>

        {/* Excerpt */}
        <div>
          <label className="block text-xs font-medium text-[#7A756C] uppercase tracking-wide mb-1.5">
            Excerpt
          </label>
          <textarea
            value={excerpt}
            onChange={(e) => onExcerptChange(e.target.value)}
            placeholder="Brief summary shown in article lists..."
            rows={3}
            className="w-full px-3 py-2 border border-[#E2DDD5] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C8622A] resize-none"
          />
        </div>
      </div>
    </aside>
  )
}
