'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'

export function SiteHeader() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    // getUser() validates the token server-side (not just local storage)
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user)
    })
  }, [])

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
          <Badge className="border-0 bg-white/[0.06] text-[10px] uppercase tracking-wider text-white/50">
            Smash PR
          </Badge>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <Link href="/players" className="rounded-md px-2.5 py-1.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white">
            Players
          </Link>
          <Link href="/about" className="hidden rounded-md px-2.5 py-1.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white sm:inline-flex">
            About
          </Link>
          <Link href="/faq" className="hidden rounded-md px-2.5 py-1.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white sm:inline-flex">
            FAQ
          </Link>
          <a
            href={isLoggedIn ? '/admin' : '/login'}
            className="inline-flex items-center rounded-md bg-white/[0.1] px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/[0.15]"
          >
            {isLoggedIn ? 'Admin' : 'Login'}
          </a>
        </div>
      </div>
    </header>
  )
}
