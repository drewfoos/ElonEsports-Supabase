import type { Metadata } from 'next'
import Link from 'next/link'
import { HeroGeometric } from '@/components/ui/shape-landing-hero'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'

export const metadata: Metadata = {
  alternates: { canonical: '/faq' },
  title: 'FAQ',
  description:
    'Frequently asked questions about Elon Esports Smash PR: rankings, scoring, imports, and more.',
  openGraph: {
    title: 'FAQ | Elon Esports Smash PR',
    description:
      'Common questions about how Smash PR works at Elon University Esports.',
  },
}

const faqs: { question: string; answer: string }[] = [
  {
    question: 'How do I get on the leaderboard?',
    answer:
      'You need to be flagged as an Elon student and compete in at least 3 tournaments during a semester (the default minimum). The admin flags Elon players during tournament imports.',
  },
  {
    question: 'How are rankings calculated?',
    answer:
      'Each tournament placement is multiplied by a weight (Elon participants / total participants), producing a score. Your average score across all tournaments in a semester is your ranking. Lower is better. Tournaments with tougher competition carry less weight, so even mid-pack finishes at big events help your rank.',
  },
  {
    question: 'Why is a lower score better?',
    answer:
      'Because it\'s based on placement. 1st place = 1, 2nd = 2, etc. The weight just scales it down. So a score of 1.0 means you averaged 1st place. You can\'t do better than that.',
  },
  {
    question: 'What counts as a tournament?',
    answer:
      'Any bracket imported from start.gg or entered manually by the admin. This includes Elon-only weeklies, local monthlies, and open regionals. Only Smash Ultimate singles events are tracked.',
  },
  {
    question: 'How does the minimum tournament filter work?',
    answer:
      'The leaderboard has a slider (default 3) that filters out players who haven\'t competed in enough tournaments. This prevents someone from placing 1st in one event and sitting at #1 all semester. You can adjust this on the leaderboard page.',
  },
  {
    question: 'What are semesters?',
    answer:
      'Rankings reset each semester. Spring runs January through July, Fall runs August through December. Your rank, average score, and tournament count are all per-semester. You can view any past semester from the dropdown on the leaderboard.',
  },
  {
    question: 'Can I see my head-to-head record against someone?',
    answer:
      'Yes! Every player profile shows a head-to-head table with wins, losses, and win rate against each opponent. This comes from set data imported from start.gg brackets.',
  },
  {
    question: 'What\'s the "weight" on tournaments?',
    answer:
      'Weight = Elon players / total players. An Elon-only weekly with 10/11 Elon players has a weight of 0.91, so your placement matters a lot. A regional with 5/500 Elon players has a weight of 0.01, so even placing 50th barely affects your score.',
  },
  {
    question: 'How often do rankings update?',
    answer:
      'Instantly. Whenever the admin imports a tournament, changes Elon status, or merges players, all affected semester scores recalculate automatically. The public leaderboard caches for 60 seconds. Hit "Refresh" to get the latest.',
  },
  {
    question: 'Why is my set record different on the directory vs my profile?',
    answer:
      'They should match. Both pull from the same set data. If you notice a discrepancy, let the admin know. It may be a data issue from a recent merge or import.',
  },
  {
    question: 'What happens when two players get merged?',
    answer:
      'All tournament results, set records, and start.gg IDs transfer to the kept player. If both played in the same tournament, the better placement is kept. Sets where the two played each other are removed (they\'re now the same person).',
  },
  {
    question: 'Can players be deleted?',
    answer:
      'No. Players can only be merged, never deleted. This preserves tournament history. Removing a player would change participant counts and invalidate past scores.',
  },
  {
    question: 'How do start.gg imports work?',
    answer:
      'The admin pastes a start.gg tournament URL, selects the singles event, reviews standings, flags Elon students, and confirms. Placements and bracket set data are imported automatically. The whole process takes a few seconds.',
  },
  {
    question: 'I\'m not showing up as an Elon student. What do I do?',
    answer:
      'Talk to the admin (current club captain). They can flag you as an Elon student during the next tournament import or from the admin players page.',
  },
]

export default function FAQPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#030303]">
      <SiteHeader />

      {/* Hero */}
      <HeroGeometric
        badge="Elon University Esports"
        title1="Frequently"
        title2="Asked"
      >
        <p className="text-base sm:text-lg md:text-xl text-white/30 leading-relaxed font-light tracking-wide max-w-xl mx-auto">
          Everything you need to know about Smash PR
        </p>
      </HeroGeometric>

      {/* Content */}
      <main className="relative z-10 mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <details
              key={i}
              className="group rounded-xl border border-white/[0.08] bg-white/[0.02] transition-colors open:bg-white/[0.03]"
            >
              <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-medium text-white/80 transition-colors hover:text-white [&::-webkit-details-marker]:hidden list-none">
                <span>{faq.question}</span>
                <span className="ml-4 shrink-0 text-white/20 transition-transform group-open:rotate-45">+</span>
              </summary>
              <div className="border-t border-white/[0.06] px-5 py-4">
                <p className="text-sm leading-relaxed text-white/50">{faq.answer}</p>
              </div>
            </details>
          ))}
        </div>

        {/* Links */}
        <div className="mt-12 flex flex-wrap items-center gap-3">
          <Link
            href="/"
            className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            View Rankings
          </Link>
          <Link
            href="/about"
            className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            About
          </Link>
          <Link
            href="/players"
            className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            Player Directory
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
