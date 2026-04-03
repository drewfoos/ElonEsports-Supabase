'use client'

import { useState, useMemo } from 'react'
import type { PlayerProfile } from '@/lib/actions/player-profile'

/**
 * Performance Signal — waveform-style bar chart.
 * Each tournament = a vertical bar. Taller = better placement percentile.
 * Color-coded by tier. Grouped by semester. No raw score dependency.
 */

const W = 720
const H = 240
const PAD = { top: 16, right: 20, bottom: 44, left: 20 }
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom
const BASELINE_Y = PAD.top + PLOT_H
const MAX_BAR_H = PLOT_H * 0.92

const FIXED_BAR_W = 12
const FIXED_GAP = 5
const SEM_GAP = 22

type Bar = {
  result: PlayerProfile['tournamentResults'][number]
  x: number
  barH: number
  pct: number
  idx: number
}

type SemLabel = { name: string; x: number; w: number }

export function PerformanceSignal({
  results,
}: {
  results: PlayerProfile['tournamentResults']
}) {
  const [hovIdx, setHovIdx] = useState<number | null>(null)

  // Chronological order
  const chrono = useMemo(() => [...results].reverse(), [results])

  // Group by semester
  const semesters = useMemo(() => {
    const groups: { name: string; items: typeof chrono }[] = []
    let cur: (typeof groups)[0] | null = null
    for (const r of chrono) {
      if (!cur || cur.name !== r.semester_name) {
        cur = { name: r.semester_name, items: [] }
        groups.push(cur)
      }
      cur.items.push(r)
    }
    return groups
  }, [chrono])

  // Compute bar positions — centered in the chart
  const { bars, semLabels, avgPct } = useMemo(() => {
    const semCount = semesters.length
    const semGaps = Math.max(0, semCount - 1) * SEM_GAP
    const idealW =
      chrono.length * (FIXED_BAR_W + FIXED_GAP) - FIXED_GAP + semGaps

    // Shrink bars if they'd overflow
    let barW = FIXED_BAR_W
    let gap = FIXED_GAP
    if (idealW > PLOT_W) {
      const avail = PLOT_W - semGaps
      const unit = avail / chrono.length
      barW = Math.max(4, unit * 0.65)
      gap = unit - barW
    }

    const totalW =
      chrono.length * (barW + gap) - gap + Math.max(0, semCount - 1) * SEM_GAP
    let xCursor = PAD.left + Math.max(0, (PLOT_W - totalW) / 2)

    const barsOut: Bar[] = []
    const labels: SemLabel[] = []
    let pctSum = 0
    let globalIdx = 0

    for (let si = 0; si < semesters.length; si++) {
      if (si > 0) xCursor += SEM_GAP
      const semStartX = xCursor

      for (const r of semesters[si].items) {
        const pct =
          r.total_participants > 1
            ? 1 - (r.placement - 1) / (r.total_participants - 1)
            : 1
        const clamped = Math.max(0, Math.min(1, pct))
        const barH = Math.max(3, clamped * MAX_BAR_H)

        barsOut.push({ result: r, x: xCursor, barH, pct: clamped, idx: globalIdx })
        pctSum += clamped
        xCursor += barW + gap
        globalIdx++
      }

      const semEndX = xCursor - gap
      labels.push({
        name: semesters[si].name,
        x: semStartX,
        w: semEndX - semStartX,
      })
    }

    return {
      bars: barsOut,
      semLabels: labels,
      avgPct: chrono.length > 0 ? pctSum / chrono.length : 0,
      barW,
    }
  }, [chrono, semesters])

  if (chrono.length < 2) return null

  const hovered = hovIdx !== null ? bars[hovIdx] : null
  const avgY = BASELINE_Y - avgPct * MAX_BAR_H

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
          <h3 className="text-xs font-medium uppercase tracking-[0.2em] text-white/30">
            Performance Signal
          </h3>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-3 text-[10px] text-white/20">
          <span className="flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#fbbf24]" />
            1st
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#34d399]" />
            Top 25%
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#60a5fa]" />
            Top 50%
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#f87171]/50" />
            Below
          </span>
        </div>
      </div>

      <div className="relative px-2 pb-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ maxHeight: 240 }}
        >
          <defs>
            <filter id="sig-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur
                in="SourceGraphic"
                stdDeviation="3"
                result="blur"
              />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="sig-pip" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur
                in="SourceGraphic"
                stdDeviation="4"
                result="blur"
              />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <pattern
              id="sig-scan"
              width="4"
              height="4"
              patternUnits="userSpaceOnUse"
            >
              <rect width="4" height="1" fill="white" opacity="0.01" />
            </pattern>
          </defs>

          {/* Scan-line bg */}
          <rect
            x={PAD.left}
            y={PAD.top}
            width={PLOT_W}
            height={PLOT_H}
            fill="url(#sig-scan)"
          />

          {/* Horizontal reference lines at 25 / 50 / 75 percentile */}
          {[0.25, 0.5, 0.75].map((p) => {
            const y = BASELINE_Y - p * MAX_BAR_H
            return (
              <line
                key={p}
                x1={PAD.left}
                y1={y}
                x2={W - PAD.right}
                y2={y}
                stroke="white"
                strokeOpacity={p === 0.5 ? 0.04 : 0.02}
                strokeDasharray="2 6"
              />
            )
          })}

          {/* Baseline */}
          <line
            x1={PAD.left}
            y1={BASELINE_Y}
            x2={W - PAD.right}
            y2={BASELINE_Y}
            stroke="white"
            strokeOpacity={0.06}
          />

          {/* Average line */}
          <line
            x1={bars[0]?.x ?? PAD.left}
            y1={avgY}
            x2={(bars[bars.length - 1]?.x ?? W - PAD.right) + FIXED_BAR_W}
            y2={avgY}
            stroke="white"
            strokeOpacity={0.08}
            strokeDasharray="4 4"
          />
          <text
            x={W - PAD.right}
            y={avgY - 4}
            textAnchor="end"
            fill="white"
            fillOpacity={0.12}
            className="text-[8px] uppercase tracking-wider"
          >
            avg
          </text>

          {/* Semester dividers */}
          {semLabels.map((s, i) => (
            <g key={i}>
              {i > 0 && (
                <line
                  x1={s.x - SEM_GAP / 2}
                  y1={PAD.top + 8}
                  x2={s.x - SEM_GAP / 2}
                  y2={BASELINE_Y + 6}
                  stroke="white"
                  strokeOpacity={0.05}
                  strokeDasharray="2 4"
                />
              )}
              <text
                x={s.x + s.w / 2}
                y={BASELINE_Y + 20}
                textAnchor="middle"
                fill="white"
                fillOpacity={0.18}
                className="text-[10px] uppercase tracking-wider"
              >
                {s.name}
              </text>
            </g>
          ))}

          {/* Bars */}
          {bars.map((b) => {
            const isH = hovIdx === b.idx
            const color = tierColor(b.pct, b.result.placement)
            const y = BASELINE_Y - b.barH

            return (
              <g key={b.idx}>
                {/* Glow halo behind bar */}
                <rect
                  x={b.x - 1}
                  y={y}
                  width={FIXED_BAR_W + 2}
                  height={b.barH}
                  rx={3}
                  fill={color}
                  fillOpacity={isH ? 0.12 : 0.03}
                />

                {/* Main bar */}
                <rect
                  x={b.x}
                  y={y}
                  width={FIXED_BAR_W}
                  height={b.barH}
                  rx={2}
                  fill={color}
                  fillOpacity={isH ? 0.85 : 0.5}
                  className="cursor-pointer transition-all duration-100"
                  onMouseEnter={() => setHovIdx(b.idx)}
                  onMouseLeave={() => setHovIdx(null)}
                />

                {/* Bright cap at top of bar */}
                <rect
                  x={b.x}
                  y={y}
                  width={FIXED_BAR_W}
                  height={Math.min(4, b.barH)}
                  rx={2}
                  fill={color}
                  fillOpacity={isH ? 1 : 0.7}
                />

                {/* 1st-place pip */}
                {b.result.placement === 1 && (
                  <circle
                    cx={b.x + FIXED_BAR_W / 2}
                    cy={y - 7}
                    r={2.5}
                    fill="#fbbf24"
                    filter="url(#sig-pip)"
                  />
                )}
              </g>
            )
          })}

          {/* Hover tooltip */}
          {hovered && <SigTip b={hovered} />}

          {/* HUD corner brackets */}
          <Bracket x={PAD.left + 2} y={PAD.top + 2} />
          <Bracket x={W - PAD.right - 2} y={PAD.top + 2} flipX />
          <Bracket x={PAD.left + 2} y={BASELINE_Y - 2} flipY />
          <Bracket x={W - PAD.right - 2} y={BASELINE_Y - 2} flipX flipY />
        </svg>
      </div>
    </div>
  )
}

// ── Tooltip ───────────────────────────────────────────────────────────────

function SigTip({ b }: { b: Bar }) {
  const tw = 150
  const th = 58
  let tx = b.x + FIXED_BAR_W + 8
  let ty = BASELINE_Y - b.barH - th - 4
  if (tx + tw > W - PAD.right) tx = b.x - tw - 8
  if (ty < PAD.top) ty = BASELINE_Y - b.barH + 8

  const pctLabel =
    b.result.placement === 1
      ? '1st place'
      : `Top ${((1 - b.pct + 0.005) * 100).toFixed(0)}%`

  return (
    <g className="pointer-events-none">
      <rect
        x={tx}
        y={ty}
        width={tw}
        height={th}
        rx={6}
        fill="#0a0a0a"
        stroke="white"
        strokeOpacity={0.1}
      />
      <text
        x={tx + 10}
        y={ty + 16}
        fill="white"
        fillOpacity={0.9}
        className="text-[11px] font-semibold"
      >
        {b.result.tournament_name.length > 20
          ? b.result.tournament_name.slice(0, 19) + '…'
          : b.result.tournament_name}
      </text>
      <text
        x={tx + 10}
        y={ty + 32}
        fill="white"
        fillOpacity={0.4}
        className="text-[10px] font-mono"
      >
        {ordinal(b.result.placement)} / {b.result.total_participants}, {pctLabel}
      </text>
      <text
        x={tx + 10}
        y={ty + 48}
        fill="white"
        fillOpacity={0.2}
        className="text-[9px]"
      >
        {fmtDate(b.result.tournament_date)} · {b.result.semester_name}
      </text>
    </g>
  )
}

// ── HUD bracket ───────────────────────────────────────────────────────────

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
        x2={x + 10 * sx}
        y2={y}
        stroke="white"
        strokeOpacity={0.06}
      />
      <line
        x1={x}
        y1={y}
        x2={x}
        y2={y + 10 * sy}
        stroke="white"
        strokeOpacity={0.06}
      />
    </g>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function tierColor(pct: number, placement: number): string {
  if (placement === 1) return '#fbbf24' // gold
  if (placement <= 3) return '#fb923c' // orange podium
  if (pct >= 0.75) return '#34d399' // emerald top 25%
  if (pct >= 0.5) return '#22d3ee' // cyan top 50%
  if (pct >= 0.25) return '#60a5fa' // blue top 75%
  return '#f87171' // red bottom
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
