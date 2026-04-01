import { createClient } from '@/lib/supabase/server'
import { AdminNav } from './admin-nav'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const userEmail = user?.email ?? 'Admin'

  return (
    <div className="flex min-h-screen bg-background">
      <AdminNav userEmail={userEmail} />
      <main className="flex-1 overflow-auto">
        {/* Spacer for mobile top bar */}
        <div className="h-14 md:hidden" />
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
