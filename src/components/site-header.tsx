'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { Menu, Trophy, Users, Info, HelpCircle, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet'

const navLinks = [
  { href: '/', label: 'Rankings', icon: Trophy },
  { href: '/players', label: 'Players', icon: Users },
  { href: '/about', label: 'About', icon: Info },
  { href: '/faq', label: 'FAQ', icon: HelpCircle },
] as const

const socials = [
  {
    href: 'https://discord.gg/W7BfUNd',
    label: 'Discord',
    icon: (
      <svg viewBox="0 0 127.14 96.36" className="h-4 w-4 fill-current">
        <path d="M107.7 8.07A105.15 105.15 0 0081.47 0a72.06 72.06 0 00-3.36 6.83 97.68 97.68 0 00-29.11 0A72.37 72.37 0 0045.64 0a105.89 105.89 0 00-26.25 8.09C2.79 32.65-1.71 56.6.54 80.21a105.69 105.69 0 0032.17 16.15 77.7 77.7 0 006.89-11.11 68.42 68.42 0 01-10.85-5.18c.91-.66 1.8-1.34 2.66-2.04a75.57 75.57 0 0064.32 0c.87.71 1.76 1.39 2.66 2.04a68.68 68.68 0 01-10.87 5.19 77 77 0 006.89 11.1 105.25 105.25 0 0032.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15zM42.45 65.69C36.18 65.69 31 60 31 53.05s5-12.68 11.45-12.68S54 46.07 53.89 53.05 48.84 65.69 42.45 65.69zm42.24 0C78.41 65.69 73.25 60 73.25 53.05s5-12.68 11.44-12.68S96.23 46.07 96.12 53.05 91.08 65.69 84.69 65.69z" />
      </svg>
    ),
  },
  {
    href: 'https://twitch.tv/elonesports_',
    label: 'Twitch',
    icon: (
      <svg viewBox="0 0 16 16" className="h-4 w-4 fill-current">
        <path d="M3.857 0L1 2.857v10.286h3.429V16l2.857-2.857H9.57L14.714 8V0H3.857zm9.714 7.429l-2.285 2.285H9l-2 2v-2H4.429V1.143h9.142v6.286zM11.857 3.143h-1.143V6.57h1.143V3.143zm-3.143 0H7.571V6.57h1.143V3.143z" />
      </svg>
    ),
  },
  {
    href: 'https://instagram.com/elonesports',
    label: 'Instagram',
    icon: (
      <svg viewBox="0 0 16 16" className="h-4 w-4 fill-current">
        <path d="M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a3.917 3.917 0 00-1.417.923A3.927 3.927 0 00.42 2.76C.222 3.268.087 3.85.048 4.7.01 5.555 0 5.827 0 8.001c0 2.172.01 2.444.048 3.297.04.852.174 1.433.372 1.942.205.526.478.972.923 1.417.444.445.89.719 1.416.923.51.198 1.09.333 1.942.372C5.555 15.99 5.827 16 8 16s2.444-.01 3.298-.048c.851-.04 1.434-.174 1.943-.372a3.916 3.916 0 001.416-.923c.445-.445.718-.891.923-1.417.197-.509.332-1.09.372-1.942C15.99 10.445 16 10.173 16 8s-.01-2.445-.048-3.299c-.04-.851-.175-1.433-.372-1.941a3.926 3.926 0 00-.923-1.417A3.911 3.911 0 0013.24.42c-.51-.198-1.092-.333-1.943-.372C10.443.01 10.172 0 7.998 0h.003zm-.717 1.442h.718c2.136 0 2.389.007 3.232.046.78.035 1.204.166 1.486.275.373.145.64.319.92.599.28.28.453.546.598.92.11.281.24.705.275 1.485.039.843.047 1.096.047 3.231s-.008 2.389-.047 3.232c-.035.78-.166 1.203-.275 1.485a2.47 2.47 0 01-.599.919c-.28.28-.546.453-.92.598-.28.11-.704.24-1.485.276-.843.038-1.096.047-3.232.047s-2.39-.009-3.233-.047c-.78-.036-1.203-.166-1.485-.276a2.478 2.478 0 01-.92-.598 2.48 2.48 0 01-.6-.92c-.109-.281-.24-.705-.275-1.485-.038-.843-.046-1.096-.046-3.233 0-2.136.008-2.388.046-3.231.036-.78.166-1.204.276-1.486.145-.373.319-.64.599-.92.28-.28.546-.453.92-.598.282-.11.705-.24 1.485-.276.738-.034 1.024-.044 2.515-.045v.002zm4.988 1.328a.96.96 0 100 1.92.96.96 0 000-1.92zm-4.27 1.122a4.109 4.109 0 100 8.217 4.109 4.109 0 000-8.217zm0 1.441a2.667 2.667 0 110 5.334 2.667 2.667 0 010-5.334z" />
      </svg>
    ),
  },
  {
    href: 'https://x.com/ElonEsports',
    label: 'X',
    icon: (
      <svg viewBox="0 0 16 16" className="h-4 w-4 fill-current">
        <path d="M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.601.75zm-.86 13.028h1.36L4.323 2.145H2.865l8.875 11.633z" />
      </svg>
    ),
  },
  {
    href: 'https://tiktok.com/@elonesports',
    label: 'TikTok',
    icon: (
      <svg viewBox="0 0 16 16" className="h-4 w-4 fill-current">
        <path d="M9 0h1.98c.144.715.54 1.617 1.235 2.512C12.895 3.389 13.797 4 15 4v2c-1.753 0-3.07-.814-4-1.829V11a5 5 0 11-5-5v2a3 3 0 103 3V0z" />
      </svg>
    ),
  },
]

export function SiteHeader() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user)
    })
  }, [])

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#030303]/90 backdrop-blur-lg">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/icon.svg" alt="" width={32} height={32} className="h-8 w-8" />
            <span className="text-lg font-bold tracking-tight text-white transition-colors hover:text-white/80">
              Elon Esports
            </span>
          </Link>
          <Badge className="hidden border-0 bg-white/[0.06] text-[10px] uppercase tracking-wider text-white/50 sm:inline-flex">
            Smash PR
          </Badge>
        </div>

        {/* Desktop nav */}
        <div className="hidden items-center gap-2 sm:flex">
          <Link href="/players" className="rounded-md px-2.5 py-1.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white">
            Players
          </Link>
          <Link href="/about" className="rounded-md px-2.5 py-1.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white">
            About
          </Link>
          <Link href="/faq" className="rounded-md px-2.5 py-1.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white">
            FAQ
          </Link>
          <a
            href={isLoggedIn ? '/admin' : '/login'}
            className="inline-flex items-center rounded-md bg-white/[0.1] px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/[0.15]"
          >
            {isLoggedIn ? 'Admin' : 'Login'}
          </a>
        </div>

        {/* Mobile: Login + Hamburger */}
        <div className="flex items-center gap-2 sm:hidden">
          <a
            href={isLoggedIn ? '/admin' : '/login'}
            className="inline-flex items-center rounded-md bg-white/[0.1] px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/[0.15]"
          >
            {isLoggedIn ? 'Admin' : 'Login'}
          </a>
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger className="inline-flex cursor-pointer items-center justify-center rounded-md p-2 text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </SheetTrigger>
            <SheetContent
              side="right"
              showCloseButton={false}
              className="w-72 border-white/[0.06] bg-[#050505] p-0"
            >
              <SheetTitle className="sr-only">Navigation</SheetTitle>

              {/* Header */}
              <div className="relative flex items-center gap-3 border-b border-white/[0.06] px-5 py-5">
                {/* Subtle accent line at top */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                <Image src="/icon.svg" alt="" width={28} height={28} className="h-7 w-7" />
                <div>
                  <p className="text-sm font-semibold tracking-tight text-white">Elon Esports</p>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/30">Smash PR</p>
                </div>
              </div>

              {/* Nav links */}
              <nav className="flex flex-col gap-0.5 px-3 py-3">
                {navLinks.map((link, i) => {
                  const Icon = link.icon
                  const active = isActive(link.href)
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMenuOpen(false)}
                      className="group relative flex items-center gap-3 rounded-lg px-3 py-3 transition-all duration-200"
                      style={{ animationDelay: `${i * 50}ms` }}
                    >
                      {/* Active indicator bar */}
                      {active && (
                        <div className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-white/70" />
                      )}

                      {/* Icon container */}
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors duration-200 ${
                          active
                            ? 'bg-white/[0.12] text-white'
                            : 'bg-white/[0.04] text-white/40 group-hover:bg-white/[0.08] group-hover:text-white/70'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>

                      {/* Label */}
                      <span
                        className={`text-sm font-medium transition-colors duration-200 ${
                          active
                            ? 'text-white'
                            : 'text-white/50 group-hover:text-white/80'
                        }`}
                      >
                        {link.label}
                      </span>

                      {/* Chevron on hover / active */}
                      <ChevronRight
                        className={`ml-auto h-3.5 w-3.5 transition-all duration-200 ${
                          active
                            ? 'text-white/40'
                            : 'translate-x-0 text-white/0 group-hover:translate-x-0.5 group-hover:text-white/30'
                        }`}
                      />
                    </Link>
                  )
                })}
              </nav>

              {/* Divider */}
              <div className="mx-5 h-px bg-gradient-to-r from-white/[0.08] via-white/[0.04] to-transparent" />

              {/* Socials */}
              <div className="px-5 py-4">
                <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.2em] text-white/20">
                  Connect
                </p>
                <div className="flex items-center gap-3">
                  {socials.map((s) => (
                    <a
                      key={s.label}
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={s.label}
                      className="flex h-8 w-8 items-center justify-center rounded-md bg-white/[0.04] text-white/30 transition-all duration-200 hover:bg-white/[0.1] hover:text-white/70"
                    >
                      {s.icon}
                    </a>
                  ))}
                </div>
              </div>

              {/* Footer accent */}
              <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
