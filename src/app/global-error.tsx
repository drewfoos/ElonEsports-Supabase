'use client'

export default function GlobalError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="min-h-full flex flex-col items-center justify-center gap-4 text-center bg-background text-foreground">
        <h1 className="text-6xl font-bold tracking-tight">500</h1>
        <p className="text-xl text-muted-foreground">Something went wrong</p>
        <p className="text-sm text-muted-foreground">
          A critical error occurred. Please try again.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 inline-flex cursor-pointer items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Try Again
        </button>
      </body>
    </html>
  )
}
