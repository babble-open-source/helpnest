'use client'

import { useRouter, usePathname } from '@/i18n/navigation'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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
    <div className={cn('relative', className ?? 'w-full sm:w-auto')}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-8 sm:w-64"
      />
      {value && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setValue('')}
          className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
}

function SearchInputFallback({ placeholder = 'Search...', className }: Pick<Props, 'placeholder' | 'className'>) {
  return (
    <div className={cn('relative', className ?? 'w-full sm:w-auto')}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        disabled
        placeholder={placeholder}
        className="pl-9 sm:w-64"
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
