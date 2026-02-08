export function CardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="skeleton h-4 w-24 mb-3" />
      <div className="skeleton h-8 w-16 mb-2" />
      <div className="skeleton h-3 w-32" />
    </div>
  )
}

export function TableSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="bg-muted/50 p-4"><div className="skeleton h-4 w-full" /></div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 border-t border-border p-4">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="skeleton h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
      <TableSkeleton />
    </div>
  )
}
