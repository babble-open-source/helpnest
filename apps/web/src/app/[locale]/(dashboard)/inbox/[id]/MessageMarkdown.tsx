'use client'

import type { AnchorHTMLAttributes, ReactNode } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Hrefs the AI agent emits are not always navigable: it cites search results
 * as pseudo-links like "[editing a live agent](2)". Only render an anchor for
 * absolute http(s)/mailto targets; anything else degrades to plain text so we
 * never ship a broken relative link inside the dashboard.
 */
function isNavigableHref(href: string | undefined): href is string {
  if (!href) return false
  return /^(https?:\/\/|mailto:)/i.test(href)
}

function MessageLink({ href, children }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (!isNavigableHref(href)) return <span className="font-medium">{children}</span>
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium underline underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  )
}

/**
 * Renders AI/agent message bodies as Markdown with bubble-compact styling.
 * Deliberately emits no wrapper element — block elements land directly inside
 * the bubble so the bubble keeps controlling text color and spacing.
 */
export function MessageMarkdown({ content }: { content: string }) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }: { children?: ReactNode }) => (
          <p className="text-sm leading-relaxed [&:not(:first-child)]:mt-2">{children}</p>
        ),
        ul: ({ children }: { children?: ReactNode }) => (
          <ul className="text-sm leading-relaxed list-disc ps-5 my-2 space-y-1">{children}</ul>
        ),
        ol: ({ children }: { children?: ReactNode }) => (
          <ol className="text-sm leading-relaxed list-decimal ps-5 my-2 space-y-1">{children}</ol>
        ),
        h1: ({ children }: { children?: ReactNode }) => (
          <p className="text-sm font-semibold [&:not(:first-child)]:mt-3">{children}</p>
        ),
        h2: ({ children }: { children?: ReactNode }) => (
          <p className="text-sm font-semibold [&:not(:first-child)]:mt-3">{children}</p>
        ),
        h3: ({ children }: { children?: ReactNode }) => (
          <p className="text-sm font-semibold [&:not(:first-child)]:mt-3">{children}</p>
        ),
        a: MessageLink,
        code: ({ children }: { children?: ReactNode }) => (
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.8em]">{children}</code>
        ),
        pre: ({ children }: { children?: ReactNode }) => (
          <pre className="my-2 overflow-x-auto rounded-lg bg-muted p-3 text-xs [&_code]:bg-transparent [&_code]:p-0">
            {children}
          </pre>
        ),
        blockquote: ({ children }: { children?: ReactNode }) => (
          <blockquote className="my-2 border-s-2 border-border ps-3 text-muted-foreground">
            {children}
          </blockquote>
        ),
      }}
    >
      {content}
    </Markdown>
  )
}
