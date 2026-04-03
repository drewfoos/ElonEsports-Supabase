export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-36 animate-pulse rounded bg-muted" />
        <div className="h-9 w-36 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="flex items-center gap-3">
        <div className="h-4 w-16 animate-pulse rounded bg-muted" />
        <div className="h-9 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-9 w-40 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="rounded-md border">
        <div className="border-b px-4 py-3">
          <div className="flex gap-8">
            {['w-16', 'w-12', 'w-16', 'w-12', 'w-10', 'w-14'].map((w, i) => (
              <div key={i} className={`h-4 ${w} animate-pulse rounded bg-muted`} />
            ))}
          </div>
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-8 border-b px-4 py-3 last:border-b-0">
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
            <div className="h-4 w-8 animate-pulse rounded bg-muted" />
            <div className="h-4 w-8 animate-pulse rounded bg-muted" />
            <div className="h-4 w-14 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}
