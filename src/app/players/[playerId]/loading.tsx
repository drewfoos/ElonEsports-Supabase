export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col bg-[#030303]">
      {/* Header skeleton */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#030303]/80 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="h-4 w-16 animate-pulse rounded bg-white/[0.06]" />
            <div className="h-3 w-1 rounded bg-white/[0.06]" />
            <div className="h-4 w-14 animate-pulse rounded bg-white/[0.06]" />
            <div className="h-3 w-1 rounded bg-white/[0.06]" />
            <div className="h-4 w-20 animate-pulse rounded bg-white/[0.06]" />
          </div>
          <div className="h-5 w-24 animate-pulse rounded-full bg-white/[0.06]" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {/* Hero card */}
        <div className="relative mb-10 overflow-hidden rounded-2xl border border-white/[0.06] p-6 sm:p-8">
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className="h-[72px] w-[72px] animate-pulse rounded-full bg-white/[0.06] sm:h-20 sm:w-20" />
            <div className="flex-1 space-y-3">
              <div className="h-7 w-40 animate-pulse rounded bg-white/[0.06]" />
              <div className="flex gap-2">
                <div className="h-5 w-20 animate-pulse rounded-full bg-white/[0.06]" />
                <div className="h-5 w-16 animate-pulse rounded-full bg-white/[0.06]" />
              </div>
            </div>
          </div>
          {/* Stat cards */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-white/[0.06] p-3">
                <div className="h-3 w-16 animate-pulse rounded bg-white/[0.06]" />
                <div className="mt-2 h-6 w-10 animate-pulse rounded bg-white/[0.06]" />
              </div>
            ))}
          </div>
        </div>

        {/* Visualizations placeholder */}
        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          <div className="h-64 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02]" />
          <div className="h-64 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02]" />
        </div>

        {/* Sections */}
        <div className="space-y-8">
          {/* Tournament history */}
          <div>
            <div className="mb-4 h-6 w-40 animate-pulse rounded bg-white/[0.06]" />
            <div className="rounded-xl border border-white/[0.06] overflow-hidden">
              <div className="border-b border-white/[0.06] px-4 py-3">
                <div className="flex gap-8">
                  {['w-28', 'w-16', 'w-12', 'w-14', 'w-12'].map((w, i) => (
                    <div key={i} className={`h-3 ${w} animate-pulse rounded bg-white/[0.06]`} />
                  ))}
                </div>
              </div>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-8 border-b border-white/[0.06] px-4 py-3 last:border-b-0">
                  <div className="h-4 w-32 animate-pulse rounded bg-white/[0.06]" />
                  <div className="h-4 w-16 animate-pulse rounded bg-white/[0.06]" />
                  <div className="h-4 w-10 animate-pulse rounded bg-white/[0.06]" />
                  <div className="h-4 w-14 animate-pulse rounded bg-white/[0.06]" />
                  <div className="h-4 w-12 animate-pulse rounded bg-white/[0.06]" />
                </div>
              ))}
            </div>
          </div>

          {/* Head to head */}
          <div>
            <div className="mb-4 h-6 w-32 animate-pulse rounded bg-white/[0.06]" />
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-white/[0.06] px-4 py-3">
                  <div className="h-4 w-24 animate-pulse rounded bg-white/[0.06]" />
                  <div className="h-4 w-16 animate-pulse rounded bg-white/[0.06]" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
