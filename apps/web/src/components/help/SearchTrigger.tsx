'use client'

import { SearchModal } from './SearchModal'

interface Props {
  workspace: string
}

export function SearchTrigger({ workspace }: Props) {
  function handleClick() {
    window.dispatchEvent(new CustomEvent('helpnest:search:open'))
  }

  return (
    <>
      <button
        onClick={handleClick}
        className="flex items-center gap-3 bg-white/10 hover:bg-white/20 transition-colors rounded-xl px-5 py-3 max-w-lg mx-auto w-full text-left"
      >
        <svg
          className="w-5 h-5 text-cream/50"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <span className="text-cream/50 flex-1">Search articles...</span>
        <kbd className="hidden sm:block text-xs text-cream/30 bg-white/10 rounded px-1.5 py-0.5">
          ⌘K
        </kbd>
      </button>
      <SearchModal workspace={workspace} />
    </>
  )
}
