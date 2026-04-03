export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="h-8 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-1 h-4 w-32 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-6">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-8 w-16 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-3 w-28 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
      <div>
        <div className="mb-3 h-6 w-28 animate-pulse rounded bg-muted" />
        <div className="flex gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-9 w-32 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      </div>
    </div>
  )
}
