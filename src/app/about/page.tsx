import type { Metadata } from 'next'
import Link from 'next/link'
import { HeroGeometric } from '@/components/ui/shape-landing-hero'
import { Zap, Scale, TrendingDown, Users, Trophy, Swords } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'

export const metadata: Metadata = {
  title: 'About',
  description:
    'Learn how Elon University Esports tracks Smash Bros. Ultimate power rankings with weighted placement scoring.',
  openGraph: {
    title: 'About | Elon Esports Smash PR',
    description:
      'How power rankings work at Elon University Esports.',
  },
}

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#030303]">
      <SiteHeader />

      {/* Hero */}
      <HeroGeometric
        badge="Elon University Esports"
        title1="About"
        title2="Smash PR"
      >
        <p className="text-base sm:text-lg md:text-xl text-white/30 leading-relaxed font-light tracking-wide max-w-xl mx-auto">
          How we rank Elon&apos;s Smash Bros. competitors
        </p>
      </HeroGeometric>

      {/* Content */}
      <main className="relative z-10 mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        {/* What is this */}
        <section className="mb-16">
          <h2 className="mb-4 text-2xl font-bold text-white/90">What is Smash PR?</h2>
          <p className="text-base leading-relaxed text-white/50">
            Smash PR is the power ranking system for Elon University&apos;s Super Smash Bros. Ultimate scene.
            It tracks every tournament, from Elon-only weeklies to open regionals, and produces a semester-by-semester
            leaderboard based on weighted placement scores. One admin manages imports, player rosters, and Elon student status.
            Everyone else gets a live leaderboard and detailed player profiles.
          </p>
        </section>

        {/* How scoring works */}
        <section className="mb-16">
          <h2 className="mb-6 text-2xl font-bold text-white/90">How Scoring Works</h2>
          <p className="mb-8 text-base leading-relaxed text-white/50">
            The system uses a{' '}<span className="font-medium text-white/70">weighted average placement</span>{' '}formula.
            Tournaments with more non-Elon players carry less weight, so performing well against tougher competition
            is rewarded even if you don&apos;t place first.
          </p>

          {/* Formula */}
          <div className="mb-10 overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02]">
            <div className="border-b border-white/[0.06] px-5 py-3">
              <span className="text-xs font-medium uppercase tracking-wider text-white/40">Formula</span>
            </div>
            <div className="space-y-4 px-5 py-5">
              <div className="flex items-center gap-3">
                <Scale className="h-4 w-4 shrink-0 text-indigo-400/70" />
                <code className="text-sm text-white/70">
                  weight = elon_participants / total_participants
                </code>
              </div>
              <div className="flex items-center gap-3">
                <Zap className="h-4 w-4 shrink-0 text-amber-400/70" />
                <code className="text-sm text-white/70">
                  score = placement &times; weight
                </code>
              </div>
              <div className="flex items-center gap-3">
                <TrendingDown className="h-4 w-4 shrink-0 text-emerald-400/70" />
                <code className="text-sm text-white/70">
                  average = sum(scores) / tournaments_played
                </code>
              </div>
            </div>
          </div>

          {/* Examples */}
          <div className="grid gap-4 sm:grid-cols-3">
            <ExampleCard
              label="Elon Weekly"
              ratio="10 / 11"
              weight="0.91"
              description="Placements count a lot"
              accent="text-rose-400/80"
            />
            <ExampleCard
              label="Mixed Local"
              ratio="5 / 35"
              weight="0.14"
              description="Rewards tougher competition"
              accent="text-indigo-400/80"
            />
            <ExampleCard
              label="Major Regional"
              ratio="5 / 500"
              weight="0.01"
              description="Even mid-pack impresses"
              accent="text-amber-400/80"
            />
          </div>

          <p className="mt-6 text-sm text-white/40">
            Lower average = higher rank. A minimum tournament threshold (default 3) filters out one-time participants.
          </p>
        </section>

        {/* Features */}
        <section className="mb-16">
          <h2 className="mb-6 text-2xl font-bold text-white/90">What You Can See</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FeatureCard
              icon={<Trophy className="h-5 w-5 text-amber-400/70" />}
              title="Power Rankings"
              description="Live leaderboard with podium, semester selector, and min-tournament filter."
            />
            <FeatureCard
              icon={<Users className="h-5 w-5 text-indigo-400/70" />}
              title="Player Directory"
              description="Browse all Elon players with tournament counts, placements, and set records."
            />
            <FeatureCard
              icon={<Swords className="h-5 w-5 text-rose-400/70" />}
              title="Player Profiles"
              description="Performance charts, head-to-head records, career milestones, and full tournament history."
            />
            <FeatureCard
              icon={<Zap className="h-5 w-5 text-emerald-400/70" />}
              title="Auto-Updating"
              description="Scores recalculate automatically when tournaments are imported or player data changes."
            />
          </div>
        </section>

        {/* Socials */}
        <section className="mb-16">
          <h2 className="mb-6 text-2xl font-bold text-white/90">Connect With Us</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <SocialCard href="https://discord.gg/W7BfUNd" label="Discord" accent="text-[#5865F2]">
              <svg viewBox="0 0 127.14 96.36" className="h-5 w-5 fill-current"><path d="M107.7 8.07A105.15 105.15 0 0081.47 0a72.06 72.06 0 00-3.36 6.83 97.68 97.68 0 00-29.11 0A72.37 72.37 0 0045.64 0a105.89 105.89 0 00-26.25 8.09C2.79 32.65-1.71 56.6.54 80.21a105.69 105.69 0 0032.17 16.15 77.7 77.7 0 006.89-11.11 68.42 68.42 0 01-10.85-5.18c.91-.66 1.8-1.34 2.66-2.04a75.57 75.57 0 0064.32 0c.87.71 1.76 1.39 2.66 2.04a68.68 68.68 0 01-10.87 5.19 77 77 0 006.89 11.1 105.25 105.25 0 0032.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15zM42.45 65.69C36.18 65.69 31 60 31 53.05s5-12.68 11.45-12.68S54 46.07 53.89 53.05 48.84 65.69 42.45 65.69zm42.24 0C78.41 65.69 73.25 60 73.25 53.05s5-12.68 11.44-12.68S96.23 46.07 96.12 53.05 91.08 65.69 84.69 65.69z" /></svg>
            </SocialCard>
            <SocialCard href="https://twitch.tv/elonesports_" label="Twitch" accent="text-[#9146FF]">
              <svg viewBox="0 0 16 16" className="h-5 w-5 fill-current"><path d="M3.857 0L1 2.857v10.286h3.429V16l2.857-2.857H9.57L14.714 8V0H3.857zm9.714 7.429l-2.285 2.285H9l-2 2v-2H4.429V1.143h9.142v6.286zM11.857 3.143h-1.143V6.57h1.143V3.143zm-3.143 0H7.571V6.57h1.143V3.143z" /></svg>
            </SocialCard>
            <SocialCard href="https://instagram.com/elonesports" label="Instagram" accent="text-[#E4405F]">
              <svg viewBox="0 0 16 16" className="h-5 w-5 fill-current"><path d="M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a3.917 3.917 0 00-1.417.923A3.927 3.927 0 00.42 2.76C.222 3.268.087 3.85.048 4.7.01 5.555 0 5.827 0 8.001c0 2.172.01 2.444.048 3.297.04.852.174 1.433.372 1.942.205.526.478.972.923 1.417.444.445.89.719 1.416.923.51.198 1.09.333 1.942.372C5.555 15.99 5.827 16 8 16s2.444-.01 3.298-.048c.851-.04 1.434-.174 1.943-.372a3.916 3.916 0 001.416-.923c.445-.445.718-.891.923-1.417.197-.509.332-1.09.372-1.942C15.99 10.445 16 10.173 16 8s-.01-2.445-.048-3.299c-.04-.851-.175-1.433-.372-1.941a3.926 3.926 0 00-.923-1.417A3.911 3.911 0 0013.24.42c-.51-.198-1.092-.333-1.943-.372C10.443.01 10.172 0 7.998 0h.003zm-.717 1.442h.718c2.136 0 2.389.007 3.232.046.78.035 1.204.166 1.486.275.373.145.64.319.92.599.28.28.453.546.598.92.11.281.24.705.275 1.485.039.843.047 1.096.047 3.231s-.008 2.389-.047 3.232c-.035.78-.166 1.203-.275 1.485a2.47 2.47 0 01-.599.919c-.28.28-.546.453-.92.598-.28.11-.704.24-1.485.276-.843.038-1.096.047-3.232.047s-2.39-.009-3.233-.047c-.78-.036-1.203-.166-1.485-.276a2.478 2.478 0 01-.92-.598 2.48 2.48 0 01-.6-.92c-.109-.281-.24-.705-.275-1.485-.038-.843-.046-1.096-.046-3.233 0-2.136.008-2.388.046-3.231.036-.78.166-1.204.276-1.486.145-.373.319-.64.599-.92.28-.28.546-.453.92-.598.282-.11.705-.24 1.485-.276.738-.034 1.024-.044 2.515-.045v.002zm4.988 1.328a.96.96 0 100 1.92.96.96 0 000-1.92zm-4.27 1.122a4.109 4.109 0 100 8.217 4.109 4.109 0 000-8.217zm0 1.441a2.667 2.667 0 110 5.334 2.667 2.667 0 010-5.334z" /></svg>
            </SocialCard>
            <SocialCard href="https://youtube.com/@ElonUniversityEsports" label="YouTube" accent="text-[#FF0000]">
              <svg viewBox="0 0 16 16" className="h-5 w-5 fill-current"><path d="M8.051 1.999h.089c.822.003 4.987.033 6.11.335a2.01 2.01 0 011.415 1.42c.101.38.172.883.22 1.402l.01.104.022.26.008.104c.065.914.073 1.77.074 1.957v.075c-.001.194-.01 1.108-.082 2.06l-.008.105-.009.104c-.05.572-.124 1.14-.235 1.558a2.007 2.007 0 01-1.415 1.42c-1.16.312-5.569.334-6.18.335h-.142c-.309 0-1.587-.006-2.927-.052l-.17-.006-.087-.004-.171-.007-.171-.007c-1.11-.049-2.167-.128-2.654-.26a2.007 2.007 0 01-1.415-1.419c-.111-.417-.185-.986-.235-1.558L.09 9.82l-.008-.104A31.4 31.4 0 010 7.68v-.123c.002-.215.01-.958.064-1.778l.007-.103.003-.052.008-.104.022-.26.01-.104c.048-.519.119-1.023.22-1.402a2.007 2.007 0 011.415-1.42c.487-.13 1.544-.21 2.654-.26l.17-.007.172-.006.086-.003.171-.007A99.788 99.788 0 017.858 2h.193zM6.4 5.209v4.818l4.157-2.408L6.4 5.209z" /></svg>
            </SocialCard>
            <SocialCard href="https://x.com/ElonEsports" label="X" accent="text-white/80">
              <svg viewBox="0 0 16 16" className="h-5 w-5 fill-current"><path d="M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.601.75zm-.86 13.028h1.36L4.323 2.145H2.865l8.875 11.633z" /></svg>
            </SocialCard>
            <SocialCard href="https://tiktok.com/@elonesports" label="TikTok" accent="text-white/80">
              <svg viewBox="0 0 16 16" className="h-5 w-5 fill-current"><path d="M9 0h1.98c.144.715.54 1.617 1.235 2.512C12.895 3.389 13.797 4 15 4v2c-1.753 0-3.07-.814-4-1.829V11a5 5 0 11-5-5v2a3 3 0 103 3V0z" /></svg>
            </SocialCard>
          </div>
        </section>

        {/* Links */}
        <section className="mb-8">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              View Rankings
            </Link>
            <Link
              href="/players"
              className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              Player Directory
            </Link>
            <Link
              href="/faq"
              className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              FAQ
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}

function ExampleCard({
  label,
  ratio,
  weight,
  description,
  accent,
}: {
  label: string
  ratio: string
  weight: string
  description: string
  accent: string
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
      <span className={`text-xs font-semibold uppercase tracking-wider ${accent}`}>{label}</span>
      <div className="mt-2 font-mono text-lg text-white/80">{weight}</div>
      <div className="mt-0.5 text-xs text-white/30">{ratio} Elon ratio</div>
      <p className="mt-2 text-xs text-white/40">{description}</p>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
      <div className="mb-3">{icon}</div>
      <h3 className="mb-1 text-sm font-semibold text-white/80">{title}</h3>
      <p className="text-xs leading-relaxed text-white/40">{description}</p>
    </div>
  )
}

function SocialCard({
  href,
  label,
  accent,
  children,
}: {
  href: string
  label: string
  accent: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 transition-all hover:border-white/[0.14] hover:bg-white/[0.04]"
    >
      <div className={`${accent} transition-transform group-hover:scale-110`}>{children}</div>
      <span className="text-sm font-medium text-white/60 transition-colors group-hover:text-white/80">{label}</span>
    </a>
  )
}
