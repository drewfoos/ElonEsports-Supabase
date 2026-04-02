'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Upload,
  Users,
  Swords,
  BarChart3,
  ChevronDown,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const steps = [
  {
    icon: Upload,
    title: 'Import a Tournament',
    description:
      'Paste a start.gg URL, pick the singles event, flag which players attend Elon, and confirm. Scores and semesters are handled automatically.',
    href: '/admin/tournaments/new',
    label: 'Import Tournament',
  },
  {
    icon: Users,
    title: 'Manage Players',
    description:
      'Merge duplicates, link multiple start.gg accounts to one player, and toggle Elon status per semester.',
    href: '/admin/players',
    label: 'View Players',
  },
  {
    icon: Swords,
    title: 'View Tournaments',
    description:
      'See all imported tournaments, check results, or delete mistakes. Use "Recalculate" if scores look off.',
    href: '/admin/tournaments',
    label: 'View Tournaments',
  },
  {
    icon: BarChart3,
    title: 'Public Rankings',
    description:
      'The leaderboard updates automatically. Players need 3+ tournaments to appear. Lower score = higher rank.',
    href: '/',
    label: 'View Rankings',
    external: true,
  },
]

export function GettingStarted() {
  const [expanded, setExpanded] = useState(false)
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <Card>
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
        <CardContent className="pt-0">
          <div className="flex flex-col gap-1.5">
            {steps.map((step, i) => {
              const isOpen = openIndex === i
              return (
                <div
                  key={step.title}
                  className="rounded-lg border border-border/50 overflow-hidden"
                >
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    className="flex w-full cursor-pointer items-center gap-3 p-3 text-left hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <step.icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="flex-1 text-sm font-medium text-foreground">{step.title}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  <div
                    className={`grid transition-[grid-template-rows] duration-200 ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
                  >
                    <div className="overflow-hidden">
                      <div className="px-3 pb-3 pt-0">
                        <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                          {step.description}
                        </p>
                        <Link
                          href={step.href}
                          {...(step.external ? { target: '_blank' } : {})}
                          className="inline-flex items-center text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                        >
                          {step.label} &rarr;
                        </Link>
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
