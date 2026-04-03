'use client'

import { useMemo } from 'react'
import type { PlayerProfile } from '@/lib/actions/player-profile'

/**
 * Placement timeline — HUD chart showing placement percentile over time
 * with field-size context bars along the bottom strip.
 * Top = best (1st), bottom = worst. Dot color reflects percentile tier.
 */

const W = 720
const H = 360
const PAD = { top: 24, right: 24, bottom: 64, left: 58 }
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom
const BAR_H = 36 // field-size strip height
const GAP = 14

export function PlacementTimeline({
  results,
}: {
  results: PlayerProfile['tournamentResults']
}) {
  // Results arrive newest-first — reverse to chronological
  const chrono = useMemo(() => [...results].reverse(), [results])

  const chartH = PLOT_H - BAR_H - GAP

  const points = useMemo(() => {
    if (chrono.length < 2) return []
    const maxField = Math.max(...chrono.map((r) => r.total_participants), 1)

    return chrono.map((r, i) => {
      const pct =
        r.total_participants > 1
          ? (r.placement - 1) / (r.total_participants - 1)
          : 0
      const clampedPct = Math.max(0, Math.min(1, pct))
      const x = PAD.left + (i / (chrono.length - 1)) * PLOT_W
      const y = PAD.top + clampedPct * chartH
      // Field-size bar
      const barHeight = (r.total_participants / maxField) * BAR_H
      const barY = PAD.top + chartH + GAP + (BAR_H - barHeight)
      return { ...r, pct: clampedPct, x, y, barHeight, barY }
    })
  }, [chrono, chartH])

  if (points.length < 2) return null

  const linePath = smoothPath(points)
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${PAD.top + chartH} L ${points[0].x} ${PAD.top + chartH} Z`
  const xLabels = spacedIndices(points.length, 5)
  const pctTicks = [0, 0.25, 0.5, 0.75, 1.0]
  const pctLabels = ['1st', 'Top 25%', 'Top 50%', 'Top 75%', 'Last']

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
          <h3 className="text-xs font-medium uppercase tracking-[0.2em] text-white/30">
            Tournament Progression
          </h3>
        </div>
        <span className="font-mono text-[10px] text-white/20">
          {chrono.length} events
        </span>
      </div>

      <div className="relative px-2 pb-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ maxHeight: 360 }}
        >
          <defs>
            <filter id="ptl-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="ptl-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
            </linearGradient>
            <pattern
              id="ptl-scan"
              width="4"
              height="4"
              patternUnits="userSpaceOnUse"
            >
              <rect width="4" height="1" fill="white" opacity="0.012" />
            </pattern>
          </defs>

          {/* Scan-line background */}
          <rect
            x={PAD.left}
            y={PAD.top}
            width={PLOT_W}
            height={PLOT_H}
            fill="url(#ptl-scan)"
          />

          {/* Percentile grid lines */}
          {pctTicks.map((pct, i) => {
            const y = PAD.top + pct * chartH
            return (
              <g key={`g-${i}`}>
                <line
                  x1={PAD.left}
                  y1={y}
                  x2={PAD.left + PLOT_W}
                  y2={y}
                  stroke="white"
                  strokeOpacity={pct === 0.5 ? 0.06 : 0.03}
                  strokeDasharray={pct === 0.5 ? '6 4' : '3 8'}
                />
                <text
                  x={PAD.left - 8}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fill="white"
                  fillOpacity={0.18}
                  className="text-[9px]"
                >
                  {pctLabels[i]}
                </text>
              </g>
            )
          })}

          {/* "Field" label for bottom strip */}
          <text
            x={PAD.left - 8}
            y={PAD.top + chartH + GAP + BAR_H / 2}
            textAnchor="end"
            dominantBaseline="middle"
            fill="white"
            fillOpacity={0.12}
            className="text-[8px] uppercase tracking-wider"
          >
            Field
          </text>

          {/* Area gradient under the line */}
          <path d={areaPath} fill="url(#ptl-area)" />

          {/* Glow line */}
          <path
            d={linePath}
            fill="none"
            stroke="#22d3ee"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#ptl-glow)"
            opacity={0.35}
          />
          {/* Crisp line */}
          <path
            d={linePath}
            fill="none"
            stroke="#22d3ee"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points + field-size bars */}
          {points.map((p, i) => {
            const color = pctColor(p.pct)
            return (
              <g key={i}>
                {/* Field-size bar */}
                <rect
                  x={p.x - 3}
                  y={p.barY}
                  width={6}
                  height={p.barHeight}
                  rx={2}
                  fill="white"
                  fillOpacity={0.04}
                />
                {/* Field-size number */}
                <text
                  x={p.x}
                  y={PAD.top + chartH + GAP + BAR_H + 12}
                  textAnchor="middle"
                  fill="white"
                  fillOpacity={0.13}
                  className="text-[7px] font-mono"
                >
                  {p.total_participants}
                </text>

                {/* Dot glow */}
                <circle cx={p.x} cy={p.y} r={8} fill={color} opacity={0.08} />
                {/* Dot */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={4}
                  fill={color}
                  stroke={color}
                  strokeOpacity={0.4}
                  strokeWidth={1.5}
                  filter="url(#ptl-glow)"
                />

                {/* Placement annotation */}
                <text
                  x={p.x}
                  y={p.y - 10}
                  textAnchor="middle"
                  fill="white"
                  fillOpacity={0.3}
                  className="text-[8px] font-mono"
                >
                  {ordinal(p.placement)}
                </text>

                <title>{`${p.tournament_name} (${fmtDate(p.tournament_date)})\n${ordinal(p.placement)} / ${p.total_participants}, ${((1 - p.pct) * 100).toFixed(0)}th percentile`}</title>
              </g>
            )
          })}

          {/* X-axis date labels */}
          {xLabels.map((idx) => {
            const p = points[idx]
            return (
              <text
                key={idx}
                x={p.x}
                y={H - 6}
                textAnchor="middle"
                fill="white"
                fillOpacity={0.15}
                className="text-[9px]"
              >
                {fmtDate(p.tournament_date)}
              </text>
            )
          })}

          {/* Y-axis label */}
          <text
            x={10}
            y={PAD.top + chartH / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            transform={`rotate(-90, 10, ${PAD.top + chartH / 2})`}
            fill="white"
            fillOpacity={0.1}
            className="text-[9px] uppercase tracking-[0.15em]"
          >
            Placement Percentile
          </text>

          {/* HUD corner brackets */}
          <Bracket x={PAD.left + 4} y={PAD.top + 4} />
          <Bracket x={PAD.left + PLOT_W - 4} y={PAD.top + 4} flipX />
          <Bracket x={PAD.left + 4} y={PAD.top + PLOT_H - 4} flipY />
          <Bracket x={PAD.left + PLOT_W - 4} y={PAD.top + PLOT_H - 4} flipX flipY />
        </svg>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────

function Bracket({
  x,
  y,
  flipX,
  flipY,
}: {
  x: number
  y: number
  flipX?: boolean
  flipY?: boolean
}) {
  const sx = flipX ? -1 : 1
  const sy = flipY ? -1 : 1
  return (
    <g>
      <line
        x1={x}
        y1={y}
        x2={x + 12 * sx}
        y2={y}
        stroke="white"
        strokeOpacity={0.06}
      />
      <line
        x1={x}
        y1={y}
        x2={x}
        y2={y + 12 * sy}
        stroke="white"
        strokeOpacity={0.06}
      />
    </g>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function pctColor(pct: number): string {
  if (pct <= 0.1) return '#34d399' // top 10% — emerald
  if (pct <= 0.25) return '#22d3ee' // top 25% — cyan
  if (pct <= 0.5) return '#60a5fa' // top 50% — blue
  return '#f87171' // bottom half — red
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function fmtDate(d: string): string {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function spacedIndices(total: number, max: number): number[] {
  if (total <= max) return Array.from({ length: total }, (_, i) => i)
  const out = [0]
  const step = (total - 1) / (max - 1)
  for (let i = 1; i < max - 1; i++) out.push(Math.round(step * i))
  out.push(total - 1)
  return out
}

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return ''
  if (pts.length === 2)
    return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    d += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}, ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6}, ${p2.x} ${p2.y}`
  }
  return d
}
