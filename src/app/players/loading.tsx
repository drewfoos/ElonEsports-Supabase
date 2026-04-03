export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col bg-[#030303]">
      {/* Header skeleton */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#030303]/90 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-28 animate-pulse rounded bg-white/[0.06]" />
            <div className="h-5 w-20 animate-pulse rounded-full bg-white/[0.06]" />
          </div>
          <div className="h-4 w-20 animate-pulse rounded bg-white/[0.06]" />
        </div>
      </header>

      {/* Hero spacer — reserves exact height so content below doesn't jump when HeroGeometric animates in */}
      <div className="relative w-full overflow-hidden bg-[#030303]">
        <div className="container mx-auto px-4 md:px-6 pt-16 pb-20 sm:pt-24 sm:pb-28 md:pt-32 md:pb-32">
          <div className="max-w-3xl mx-auto text-center">
            <div className="mb-10 md:mb-14 h-8" />
            <div className="h-[calc(1em*0.9*2+2rem)] text-5xl sm:text-7xl md:text-8xl mb-8 md:mb-10" />
            <div className="h-6" />
          </div>
        </div>
      </div>

      {/* Search + stats bar skeleton */}
      <div className="relative z-10 border-b border-white/[0.06]">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-4 py-5 sm:flex-row sm:py-4">
          <div className="flex items-center gap-5">
            <div className="h-4 w-20 animate-pulse rounded bg-white/[0.06]" />
            <div className="h-3.5 w-px bg-white/[0.08]" />
            <div className="h-4 w-20 animate-pulse rounded bg-white/[0.06]" />
            <div className="h-3.5 w-px bg-white/[0.08]" />
            <div className="h-4 w-20 animate-pulse rounded bg-white/[0.06]" />
          </div>
          <div className="h-9 w-full max-w-xs animate-pulse rounded-lg bg-white/[0.03] border border-white/[0.08]" />
        </div>
      </div>

      {/* Player list skeleton */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <div className="space-y-1">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg border border-white/[0.06] px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 animate-pulse rounded-full bg-white/[0.06]" />
                <div className="h-4 w-28 animate-pulse rounded bg-white/[0.06]" />
              </div>
              <div className="flex items-center gap-4">
                <div className="h-4 w-12 animate-pulse rounded bg-white/[0.06]" />
                <div className="h-4 w-10 animate-pulse rounded bg-white/[0.06]" />
                <div className="h-4 w-4 animate-pulse rounded bg-white/[0.06]" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
