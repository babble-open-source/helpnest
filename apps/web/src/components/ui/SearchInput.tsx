'use client'

import { useRouter, usePathname } from '@/i18n/navigation'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef, useState } from 'react'

interface Props {
  placeholder?: string
  paramName?: string
  className?: string
}

function SearchInputInner({ placeholder = 'Search...', paramName = 'q', className }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchParamsRef = useRef(searchParams)
  const [value, setValue] = useState(searchParams.get(paramName) ?? '')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    searchParamsRef.current = searchParams
  }, [searchParams])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParamsRef.current.toString())
      if (value) {
        params.set(paramName, value)
      } else {
        params.delete(paramName)
      }
      router.replace(`${pathname}?${params.toString()}`)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [value, paramName, pathname, router])

  return (
    <div className={`flex items-center gap-2 bg-white border border-border rounded-lg px-3 py-2 ${className ?? 'w-full sm:w-auto'}`}>
      <svg className="w-4 h-4 text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="text-sm outline-none text-ink placeholder:text-muted bg-transparent flex-1 sm:w-48"
      />
      {value && (
        <button
          onClick={() => setValue('')}
          className="text-muted hover:text-ink transition-colors text-xs"
          aria-label="Clear search"
        >
          ✕
        </button>
      )}
    </div>
  )
}

function SearchInputFallback({ placeholder = 'Search...', className }: Pick<Props, 'placeholder' | 'className'>) {
  return (
    <div className={`flex items-center gap-2 bg-white border border-border rounded-lg px-3 py-2 ${className ?? 'w-full sm:w-auto'}`}>
      <svg className="w-4 h-4 text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        disabled
        placeholder={placeholder}
        className="text-sm outline-none text-ink placeholder:text-muted bg-transparent flex-1 sm:w-48"
      />
    </div>
  )
}

export function SearchInput(props: Props) {
  return (
    <Suspense fallback={<SearchInputFallback placeholder={props.placeholder} className={props.className} />}>
      <SearchInputInner {...props} />
    </Suspense>
  )
}
