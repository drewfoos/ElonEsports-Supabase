export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        <div className="h-9 w-32 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="rounded-md border">
        <div className="border-b px-4 py-3">
          <div className="flex gap-8">
            {['w-16', 'w-20', 'w-20', 'w-16', 'w-16'].map((w, i) => (
              <div key={i} className={`h-4 ${w} animate-pulse rounded bg-muted`} />
            ))}
          </div>
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-8 border-b px-4 py-3 last:border-b-0">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
            <div className="h-8 w-12 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}
