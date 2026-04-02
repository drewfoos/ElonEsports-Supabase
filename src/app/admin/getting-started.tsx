'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Upload,
  Users,
  Swords,
  BarChart3,
  ChevronDown,
  X,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const STORAGE_KEY = 'elon-esports-guide-dismissed'

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
  const [dismissed, setDismissed] = useState<boolean | null>(null)
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  useEffect(() => {
    setDismissed(localStorage.getItem(STORAGE_KEY) === 'true')
  }, [])

  if (dismissed === null) return null

  if (dismissed) {
    return (
      <button
        onClick={() => {
          localStorage.removeItem(STORAGE_KEY)
          setDismissed(false)
        }}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Show setup guide
      </button>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base font-semibold">First time here?</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">Click any step to learn more</p>
        </div>
        <button
          onClick={() => {
            localStorage.setItem(STORAGE_KEY, 'true')
            setDismissed(true)
          }}
          className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Dismiss guide"
        >
          <X className="h-4 w-4" />
        </button>
      </CardHeader>

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
                  className="flex w-full items-center gap-3 p-3 text-left hover:bg-accent/50 transition-colors"
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
    </Card>
  )
}
