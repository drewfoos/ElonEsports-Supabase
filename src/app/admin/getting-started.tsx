'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  Upload,
  Users,
  Swords,
  BarChart3,
  ChevronDown,
  ArrowRight,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface Step {
  icon: LucideIcon
  title: string
  intro: string
  points: { label: string; detail: string }[]
  tip?: ReactNode
  href: string
  label: string
  external?: boolean
}

const steps: Step[] = [
  {
    icon: Upload,
    title: 'Import a Tournament',
    intro: 'Pull in results directly from start.gg or build them manually.',
    points: [
      {
        label: 'Paste a URL',
        detail: 'The system finds all Smash Ultimate singles events automatically.',
      },
      {
        label: 'Flag Elon players',
        detail:
          'Toggle which players attend Elon on the preview screen. The system remembers their status for future imports.',
      },
      {
        label: 'Confirm',
        detail:
          'Creates the tournament, matches existing players by start.gg account or gamer tag, creates new ones it hasn\'t seen, and recalculates scores.',
      },
      {
        label: 'Semesters',
        detail:
          'Auto-created based on the tournament date if one doesn\'t exist yet.',
      },
    ],
    tip: 'Tournaments not on start.gg? Use the Manual Entry tab with the bracket builder.',
    href: '/admin/tournaments/new',
    label: 'Import Tournament',
  },
  {
    icon: Users,
    title: 'Manage Players',
    intro: 'Players are created automatically on import. Use this page to clean up.',
    points: [
      {
        label: 'Elon status',
        detail:
          'Toggle per semester. Only Elon students affect the rankings.',
      },
      {
        label: 'Merge duplicates',
        detail:
          'When someone shows up under two tags, merge them into one. Keeps the better placement when both appeared in the same tournament.',
      },
      {
        label: 'Link start.gg accounts',
        detail:
          'Attach multiple start.gg IDs to one player so future imports match correctly.',
      },
    ],
    href: '/admin/players',
    label: 'View Players',
  },
  {
    icon: Swords,
    title: 'View Tournaments',
    intro: 'Browse all tournaments organized by semester.',
    points: [
      {
        label: 'Full results',
        detail:
          'Click any tournament to see placements, scores, and which players were flagged as Elon.',
      },
      {
        label: 'Delete mistakes',
        detail:
          'Removing a tournament deletes its results and sets, then recalculates scores.',
      },
      {
        label: 'Recalculate',
        detail:
          'If scores look wrong after a merge or status change, force a full recalculation for that semester.',
      },
    ],
    href: '/admin/tournaments',
    label: 'View Tournaments',
  },
  {
    icon: BarChart3,
    title: 'Public Rankings',
    intro: 'The leaderboard updates automatically when you change data.',
    points: [
      {
        label: 'Weighted scoring',
        detail:
          'Tournaments with more non-Elon players count less. Rewards performing against tougher competition.',
      },
      {
        label: 'Minimum 3 tournaments',
        detail:
          'Players need at least 3 tournaments to appear on the leaderboard.',
      },
      {
        label: 'Player profiles',
        detail:
          'Each player has a public profile with trend charts, head-to-head records, and tournament history.',
      },
    ],
    href: '/',
    label: 'View Rankings',
    external: true,
  },
]

export function GettingStarted() {
  const [expanded, setExpanded] = useState(false)
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full cursor-pointer items-center justify-between p-4 text-left"
      >
        <span className="text-base font-semibold text-foreground">First time here?</span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <CardContent className="pt-0 pb-4">
          <div className="flex flex-col gap-2">
            {steps.map((step, i) => {
              const isOpen = openIndex === i
              return (
                <div
                  key={step.title}
                  className={`rounded-lg border overflow-hidden transition-colors duration-200 ${
                    isOpen
                      ? 'border-primary/30 bg-primary/[0.03]'
                      : 'border-border/50 hover:border-border'
                  }`}
                >
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    className="flex w-full cursor-pointer items-center gap-3 p-3 text-left transition-colors"
                  >
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors duration-200 ${
                        isOpen
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-primary/10 text-primary'
                      }`}
                    >
                      <step.icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-foreground">{step.title}</span>
                      {!isOpen && (
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {step.intro}
                        </p>
                      )}
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  <div
                    className={`grid transition-[grid-template-rows] duration-200 ${
                      isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="px-3 pb-3">
                        {/* Intro */}
                        <p className="text-xs text-muted-foreground mb-3 pl-10">
                          {step.intro}
                        </p>

                        {/* Points */}
                        <div className="flex flex-col gap-2 pl-10">
                          {step.points.map((point) => (
                            <div
                              key={point.label}
                              className="border-l-2 border-primary/20 pl-3 py-0.5"
                            >
                              <span className="text-xs font-medium text-foreground">
                                {point.label}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {' '}&mdash; {point.detail}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Tip */}
                        {step.tip && (
                          <div className="mt-3 ml-10 rounded-md bg-muted/50 px-3 py-2">
                            <p className="text-[11px] text-muted-foreground">
                              <span className="font-medium text-foreground/70">Tip:</span>{' '}
                              {step.tip}
                            </p>
                          </div>
                        )}

                        {/* CTA */}
                        <div className="mt-3 pl-10">
                          <Link
                            href={step.href}
                            {...(step.external ? { target: '_blank' } : {})}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                          >
                            {step.label}
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
