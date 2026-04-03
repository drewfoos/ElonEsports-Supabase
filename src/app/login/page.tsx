'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { ShieldCheck, Lock, ArrowLeft, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Redirect to admin if already logged in
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/admin')
      }
    })
  }, [router])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError(authError.message)
        return
      }

      router.refresh()
      router.push('/admin')
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#030303] px-4">
      {/* Atmospheric background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-1/4 -top-1/4 h-[600px] w-[600px] rounded-full bg-indigo-500/[0.03] blur-[120px]" />
        <div className="absolute -bottom-1/4 -right-1/4 h-[500px] w-[500px] rounded-full bg-rose-500/[0.02] blur-[100px]" />
      </div>

      {/* Back to home */}
      <div
        className="absolute left-4 top-4 sm:left-8 sm:top-8"
        style={{ animation: 'fadeIn 0.6s ease-out 0.1s both' }}
      >
        <Link
          href="/"
          className="group flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-white/40 transition-colors hover:bg-white/[0.04] hover:text-white/70"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          Back to rankings
        </Link>
      </div>

      {/* Card */}
      <div
        className="relative w-full max-w-[360px]"
        style={{ animation: 'fadeSlideUp 0.5s ease-out 0.15s both' }}
      >
        {/* Logo + title */}
        <div className="mb-8 flex flex-col items-center gap-4">
          <div className="flex items-center gap-2.5">
            <Image src="/icon.svg" alt="" width={28} height={28} className="h-7 w-7" />
            <span className="text-lg font-bold tracking-tight text-white">Elon Esports</span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04]">
              <ShieldCheck className="h-5 w-5 text-white/50" />
            </div>
            <h1 className="text-sm font-semibold uppercase tracking-widest text-white/60">
              Admin Sign In
            </h1>
          </div>
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-sm">
          {/* Admin notice */}
          <div className="mb-6 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <div className="flex items-start gap-2.5">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/30" />
              <p className="text-xs leading-relaxed text-white/35">
                This login is for tournament organizers only. Player accounts are not required to view rankings or profiles.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-xs font-medium text-white/50">
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="admin@elon.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-10 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 text-sm text-white placeholder:text-white/20 outline-none transition-all focus:border-white/[0.15] focus:bg-white/[0.05] focus:ring-1 focus:ring-white/[0.08]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-xs font-medium text-white/50">
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="h-10 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 text-sm text-white placeholder:text-white/20 outline-none transition-all focus:border-white/[0.15] focus:bg-white/[0.05] focus:ring-1 focus:ring-white/[0.08]"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3.5 py-2.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-400/80" />
                <p className="text-xs text-red-400/90">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 flex h-10 w-full items-center justify-center rounded-lg bg-white/[0.1] text-sm font-medium text-white transition-all hover:bg-white/[0.15] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        {/* Footer note */}
        <p className="mt-5 text-center text-[11px] text-white/20">
          Contact the current club captain for admin access
        </p>
      </div>

      <style jsx>{`
        @keyframes fadeSlideUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
