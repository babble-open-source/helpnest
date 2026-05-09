import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'

export default function ImportsLoading() {
  return (
    <div className="p-4 sm:p-8 space-y-6">
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-4 w-64" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6 flex flex-col items-center gap-3">
              <Skeleton className="h-10 w-10 rounded" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-8 w-20 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
