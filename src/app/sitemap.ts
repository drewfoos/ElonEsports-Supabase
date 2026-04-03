import type { MetadataRoute } from 'next'
import { createStaticClient } from '@/lib/supabase/static'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://elon-esports.vercel.app'

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/players`,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/about`,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/faq`,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ]

  // Dynamic player profile pages — only Elon students
  const supabase = createStaticClient()
  const { data: players } = await supabase
    .from('player_semester_status')
    .select('player_id')
    .eq('is_elon_student', true)

  const playerIds = [...new Set((players ?? []).map((p) => p.player_id))]

  const playerPages: MetadataRoute.Sitemap = playerIds.map((id) => ({
    url: `${baseUrl}/players/${id}`,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  return [...staticPages, ...playerPages]
}
