'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ShieldCheck, AlertCircle, Lock, Eye, EyeOff } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [focused, setFocused] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/admin')
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
    <div className="relative flex min-h-dvh flex-col bg-[#030303]">
      <SiteHeader />

      {/* Atmospheric background layers */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Gradient orbs */}
        <div className="absolute -left-1/3 top-0 h-[600px] w-[600px] rounded-full bg-indigo-500/[0.04] blur-[150px]" />
        <div className="absolute -right-1/4 bottom-0 h-[500px] w-[500px] rounded-full bg-rose-500/[0.03] blur-[120px]" />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />

        {/* Radial fade over grid */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_20%,#030303_70%)]" />
      </div>

      {/* Main card — centered in remaining space */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-[380px] login-slide-up" style={{ animationDelay: '0.1s' }}>

        {/* Terminal-style card */}
        <div className="relative rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm">
          {/* Top accent line */}
          <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-indigo-400/30 to-transparent" />

          {/* HUD corners */}
          <div className="absolute left-3 top-3 h-3 w-3 border-l border-t border-white/[0.1]" />
          <div className="absolute right-3 top-3 h-3 w-3 border-r border-t border-white/[0.1]" />
          <div className="absolute bottom-3 left-3 h-3 w-3 border-b border-l border-white/[0.1]" />
          <div className="absolute bottom-3 right-3 h-3 w-3 border-b border-r border-white/[0.1]" />

          <div className="p-7 sm:p-8">
            {/* Header */}
            <div className="mb-7 flex flex-col items-center gap-3">
              <div className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03]">
                <ShieldCheck className="h-5.5 w-5.5 text-white/50" />
                {/* Pulse ring */}
                <div className="absolute inset-0 rounded-xl border border-indigo-400/20 login-pulse" />
              </div>
              <div className="text-center">
                <h1 className="text-[13px] font-semibold uppercase tracking-[0.2em] text-white/60">
                  Admin Access
                </h1>
                <p className="mt-1 text-[11px] text-white/25">
                  Tournament organizers only
                </p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-[11px] font-medium uppercase tracking-wider text-white/35">
                  Email
                </label>
                <div className={`relative rounded-lg border transition-all duration-200 ${
                  focused === 'email'
                    ? 'border-indigo-400/30 bg-white/[0.05] shadow-[0_0_12px_rgba(129,140,248,0.06)]'
                    : 'border-white/[0.08] bg-white/[0.02]'
                }`}>
                  <input
                    id="email"
                    type="email"
                    placeholder="admin@elon.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocused('email')}
                    onBlur={() => setFocused(null)}
                    required
                    autoComplete="email"
                    className="h-11 w-full bg-transparent px-3.5 text-sm text-white placeholder:text-white/15 outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-[11px] font-medium uppercase tracking-wider text-white/35">
                  Password
                </label>
                <div className={`relative flex rounded-lg border transition-all duration-200 ${
                  focused === 'password'
                    ? 'border-indigo-400/30 bg-white/[0.05] shadow-[0_0_12px_rgba(129,140,248,0.06)]'
                    : 'border-white/[0.08] bg-white/[0.02]'
                }`}>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocused('password')}
                    onBlur={() => setFocused(null)}
                    required
                    autoComplete="current-password"
                    className="h-11 w-full bg-transparent px-3.5 text-sm text-white placeholder:text-white/15 outline-none"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword(!showPassword)}
                    className="flex cursor-pointer items-center px-3 text-white/20 transition-colors hover:text-white/50"
                  >
                    {showPassword
                      ? <EyeOff className="h-4 w-4" />
                      : <Eye className="h-4 w-4" />
                    }
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2.5 rounded-lg border border-red-500/15 bg-red-500/[0.05] px-3.5 py-3 login-fade-in" style={{ animationDelay: '0s' }}>
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400/70" />
                  <p className="text-xs leading-relaxed text-red-400/80">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="group relative mt-1 flex h-11 w-full cursor-pointer items-center justify-center rounded-lg bg-white/[0.08] text-sm font-medium text-white transition-all duration-200 hover:bg-white/[0.13] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-30"
              >
                {/* Button glow on hover */}
                <div className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-indigo-400/0 to-transparent transition-all duration-300 group-hover:via-indigo-400/30" />

                {loading ? (
                  <span className="flex items-center gap-2.5">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
                    <span className="text-white/70">Authenticating...</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5 text-white/40 transition-colors group-hover:text-white/60" />
                    Sign In
                  </span>
                )}
              </button>
            </form>
          </div>

          {/* Bottom accent */}
          <div className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-[11px] text-white/15 login-fade-in" style={{ animationDelay: '0.5s' }}>
          Contact the current club captain for access
        </p>
      </div>
      </div>

      <style jsx>{`
        @keyframes loginSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes loginFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes loginPulse {
          0%, 100% { opacity: 0; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }
        .login-slide-up {
          animation: loginSlideUp 0.6s ease-out both;
        }
        .login-fade-in {
          animation: loginFadeIn 0.5s ease-out both;
        }
        .login-pulse {
          animation: loginPulse 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
