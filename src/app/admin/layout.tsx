import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminNav } from './admin-nav'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  // Server-side auth guard — defense in depth alongside the proxy
  if (error || !user || user.email?.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase()) {
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AdminNav userEmail={user.email!} />
      <main className="flex-1 overflow-auto">
        {/* Spacer for mobile top bar */}
        <div className="h-14 md:hidden" />
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
