import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'
import { ChevronRight, Folder, PanelTopOpen, BookOpen } from 'lucide-react'
import type { ReactNode } from 'react'

type KnowledgeCollectionNode = {
  id: string
  title: string
  emoji: string | null
  articleCount: number
  href: string
  active?: boolean
  children?: KnowledgeCollectionNode[]
}

interface KnowledgeWorkspaceShellProps {
  sectionLabel: string
  title: string
  sidebarTitle: string
  sidebarContent: ReactNode
  actions?: ReactNode
  toolbar?: ReactNode
  children: ReactNode
}

export function KnowledgeWorkspaceShell({
  sectionLabel,
  title,
  sidebarTitle,
  sidebarContent,
  actions,
  toolbar,
  children,
}: KnowledgeWorkspaceShellProps) {
  return (
    <div className="flex min-h-full flex-col gap-4 p-4 lg:p-5">
      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="flex min-h-[280px] flex-col rounded-[28px] border bg-card shadow-sm xl:min-h-0">
          <div className="border-b px-6 py-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              {sectionLabel}
            </p>
            <h2 className="mt-2 text-[2rem] font-semibold tracking-tight text-foreground">
              {sidebarTitle}
            </h2>
          </div>
          <div className="min-h-0 flex-1 px-4 py-4">{sidebarContent}</div>
        </aside>

        <section className="flex min-h-[560px] min-w-0 flex-col overflow-hidden rounded-[32px] border bg-card shadow-sm">
          <div className="flex flex-col gap-5 border-b px-6 py-5 lg:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-muted-foreground">
                  <BookOpen className="h-4 w-4" />
                  <span>{sectionLabel}</span>
                  <ChevronRight className="h-4 w-4" />
                  <span>Content</span>
                  <ChevronRight className="h-4 w-4" />
                  <span className="text-foreground">{title}</span>
                </div>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  {title}
                </h1>
              </div>
              {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
            </div>
            {toolbar ? <div>{toolbar}</div> : null}
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
        </section>
      </div>
    </div>
  )
}

interface KnowledgeCollectionRailProps {
  collections: KnowledgeCollectionNode[]
  allHref: string
  allLabel: string
  helpCenterHref: string
  helpCenterLabel: string
}

export function KnowledgeCollectionRail({
  collections,
  allHref,
  allLabel,
  helpCenterHref,
  helpCenterLabel,
}: KnowledgeCollectionRailProps) {
  return (
    <div className="flex h-full flex-col gap-3">
      <nav className="space-y-1">
        <KnowledgeCollectionLink
          href={allHref}
          label={allLabel}
          icon={<PanelTopOpen className="h-4 w-4" />}
          active={!collections.some(hasActiveCollection)}
        />
        <div className="space-y-1">
          {collections.map((collection) => (
            <KnowledgeCollectionTreeItem key={collection.id} node={collection} depth={0} />
          ))}
        </div>
      </nav>

      <div className="mt-auto border-t pt-4">
        <KnowledgeCollectionLink
          href={helpCenterHref}
          label={helpCenterLabel}
          icon={<Folder className="h-4 w-4" />}
        />
      </div>
    </div>
  )
}

function hasActiveCollection(node: KnowledgeCollectionNode): boolean {
  if (node.active) return true
  return node.children?.some(hasActiveCollection) ?? false
}

function KnowledgeCollectionTreeItem({
  node,
  depth,
}: {
  node: KnowledgeCollectionNode
  depth: number
}) {
  const branchActive = node.active || (node.children?.some(hasActiveCollection) ?? false)

  return (
    <div className="space-y-1">
      <KnowledgeCollectionLink
        href={node.href}
        label={node.title}
        icon={<span className="text-base leading-none">{node.emoji ?? '📁'}</span>}
        count={node.articleCount}
        active={branchActive}
        inset={depth > 0}
      />
      {node.children?.length ? (
        <div className={cn('space-y-1', depth === 0 ? 'pl-4' : 'pl-5')}>
          {node.children.map((child) => (
            <KnowledgeCollectionTreeItem key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function KnowledgeCollectionLink({
  href,
  label,
  icon,
  count,
  active = false,
  inset = false,
}: {
  href: string
  label: string
  icon: ReactNode
  count?: number
  active?: boolean
  inset?: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors',
        inset && 'py-2',
        active
          ? 'bg-accent text-accent-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted/80 text-foreground">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      {typeof count === 'number' ? (
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {count}
        </span>
      ) : null}
    </Link>
  )
}
