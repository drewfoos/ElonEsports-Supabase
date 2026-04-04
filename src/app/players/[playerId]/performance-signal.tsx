'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import type { PlayerProfile } from '@/lib/actions/player-profile'

/**
 * Performance Signal — waveform-style bar chart.
 * Each tournament = a vertical bar. Taller = better placement percentile.
 * Color-coded by tier. Grouped by semester. No raw score dependency.
 * Responsive: viewBox matches container width so text stays readable.
 */

const ASPECT_MOBILE = 0.5
const ASPECT_DESKTOP = 0.36
const PAD_TOP = 16
const PAD_RIGHT = 16
const PAD_LEFT = 16
const PAD_BOTTOM = 36
const SEM_GAP = 18

type Bar = {
  result: PlayerProfile['tournamentResults'][number]
  x: number
  barH: number
  barW: number
  pct: number
  idx: number
}

type SemLabel = { name: string; x: number; w: number }

export function PerformanceSignal({
  results,
}: {
  results: PlayerProfile['tournamentResults']
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [hovIdx, setHovIdx] = useState<number | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry.contentRect.width))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const MAX_EVENTS = 25
  const allChrono = useMemo(() => [...results].reverse(), [results])
  const capped = allChrono.length > MAX_EVENTS
  const chrono = capped ? allChrono.slice(allChrono.length - MAX_EVENTS) : allChrono

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

  // Responsive dimensions — taller on mobile
  const W = width || 360
  const isMobile = W < 500
  const H = Math.round(W * (isMobile ? ASPECT_MOBILE : ASPECT_DESKTOP))
  const PLOT_W = W - PAD_LEFT - PAD_RIGHT
  const PLOT_H = H - PAD_TOP - PAD_BOTTOM
  const BASELINE_Y = PAD_TOP + PLOT_H
  const MAX_BAR_H = PLOT_H * 0.92
  const fontSize = isMobile ? 12 : 11

  const FIXED_BAR_W = W < 500 ? 10 : 12
  const FIXED_GAP = W < 500 ? 4 : 5

  const { bars, semLabels, avgPct } = useMemo(() => {
    const semCount = semesters.length
    const semGaps = Math.max(0, semCount - 1) * SEM_GAP
    const idealW =
      chrono.length * (FIXED_BAR_W + FIXED_GAP) - FIXED_GAP + semGaps

    let barW = FIXED_BAR_W
    let gap = FIXED_GAP
    if (idealW > PLOT_W) {
      const avail = PLOT_W - semGaps
      const unit = avail / chrono.length
      barW = Math.max(3, unit * 0.65)
      gap = unit - barW
    }

    const totalW =
      chrono.length * (barW + gap) - gap + Math.max(0, semCount - 1) * SEM_GAP
    let xCursor = PAD_LEFT + Math.max(0, (PLOT_W - totalW) / 2)

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

        barsOut.push({ result: r, x: xCursor, barH, barW, pct: clamped, idx: globalIdx })
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
    }
  }, [chrono, semesters, PLOT_W, FIXED_BAR_W, FIXED_GAP, MAX_BAR_H])

  if (chrono.length < 2) return null

  const hovered = hovIdx !== null ? bars[hovIdx] : null
  const avgY = BASELINE_Y - avgPct * MAX_BAR_H

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
          <h3 className="text-xs font-medium uppercase tracking-[0.2em] text-white/30">
            Performance Signal
          </h3>
          {capped && (
            <span className="text-[10px] text-white/20">
              Last {MAX_EVENTS} of {allChrono.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-white/20 sm:gap-3">
          <span className="flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#fbbf24]" /> 1st
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#34d399]" />
            <span className="sm:hidden">25%</span><span className="hidden sm:inline">Top 25%</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#60a5fa]" />
            <span className="sm:hidden">50%</span><span className="hidden sm:inline">Top 50%</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#f87171]/50" />
            <span className="sm:hidden">50%+</span><span className="hidden sm:inline">Below</span>
          </span>
        </div>
      </div>

      <div ref={containerRef} className="relative px-2 pb-3">
        {width > 0 && (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
            <defs>
              <filter id="sig-glow" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="sig-pip" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <pattern id="sig-scan" width="4" height="4" patternUnits="userSpaceOnUse">
                <rect width="4" height="1" fill="white" opacity="0.01" />
              </pattern>
            </defs>

            <rect x={PAD_LEFT} y={PAD_TOP} width={PLOT_W} height={PLOT_H} fill="url(#sig-scan)" />

            {/* Reference lines */}
            {[0.25, 0.5, 0.75].map((p) => {
              const y = BASELINE_Y - p * MAX_BAR_H
              return (
                <line
                  key={p}
                  x1={PAD_LEFT}
                  y1={y}
                  x2={W - PAD_RIGHT}
                  y2={y}
                  stroke="white"
                  strokeOpacity={p === 0.5 ? 0.04 : 0.02}
                  strokeDasharray="2 6"
                />
              )
            })}

            {/* Baseline */}
            <line x1={PAD_LEFT} y1={BASELINE_Y} x2={W - PAD_RIGHT} y2={BASELINE_Y} stroke="white" strokeOpacity={0.06} />

            {/* Average line */}
            <line
              x1={bars[0]?.x ?? PAD_LEFT}
              y1={avgY}
              x2={(bars[bars.length - 1]?.x ?? W - PAD_RIGHT) + FIXED_BAR_W}
              y2={avgY}
              stroke="white"
              strokeOpacity={0.08}
              strokeDasharray="4 4"
            />
            <text
              x={W - PAD_RIGHT}
              y={avgY - 4}
              textAnchor="end"
              fill="white"
              fillOpacity={0.15}
              fontSize={fontSize}
              letterSpacing="0.05em"
            >
              avg
            </text>

            {/* Semester dividers + labels */}
            {semLabels.map((s, i) => (
              <g key={i}>
                {i > 0 && (
                  <line
                    x1={s.x - SEM_GAP / 2}
                    y1={PAD_TOP + 8}
                    x2={s.x - SEM_GAP / 2}
                    y2={BASELINE_Y + 6}
                    stroke="white"
                    strokeOpacity={0.05}
                    strokeDasharray="2 4"
                  />
                )}
                <text
                  x={s.x + s.w / 2}
                  y={BASELINE_Y + 16}
                  textAnchor="middle"
                  fill="white"
                  fillOpacity={0.2}
                  fontSize={fontSize}
                  letterSpacing="0.05em"
                >
                  {abbreviateSemester(s.name, isMobile || semLabels.length > 3)}
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
                  <rect
                    x={b.x - 1}
                    y={y}
                    width={b.barW + 2}
                    height={b.barH}
                    rx={3}
                    fill={color}
                    fillOpacity={isH ? 0.12 : 0.03}
                  />
                  <rect
                    x={b.x}
                    y={y}
                    width={b.barW}
                    height={b.barH}
                    rx={2}
                    fill={color}
                    fillOpacity={isH ? 0.85 : 0.5}
                    className="cursor-pointer transition-all duration-100"
                    onMouseEnter={() => setHovIdx(b.idx)}
                    onMouseLeave={() => setHovIdx(null)}
                    onTouchStart={(e) => {
                      e.preventDefault()
                      setHovIdx(hovIdx === b.idx ? null : b.idx)
                    }}
                  />
                  <rect
                    x={b.x}
                    y={y}
                    width={b.barW}
                    height={Math.min(4, b.barH)}
                    rx={2}
                    fill={color}
                    fillOpacity={isH ? 1 : 0.7}
                  />
                  {b.result.placement === 1 && (
                    <circle
                      cx={b.x + b.barW / 2}
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
            {hovered && <SigTip b={hovered} W={W} BASELINE_Y={BASELINE_Y} fontSize={fontSize} />}

            {/* HUD corner brackets */}
            <Bracket x={PAD_LEFT + 2} y={PAD_TOP + 2} />
            <Bracket x={W - PAD_RIGHT - 2} y={PAD_TOP + 2} flipX />
            <Bracket x={PAD_LEFT + 2} y={BASELINE_Y - 2} flipY />
            <Bracket x={W - PAD_RIGHT - 2} y={BASELINE_Y - 2} flipX flipY />
          </svg>
        )}
      </div>
    </div>
  )
}

// ── Tooltip ───────────────────────────────────────────────────────────────

function SigTip({ b, W, BASELINE_Y, fontSize }: { b: Bar; W: number; BASELINE_Y: number; fontSize: number }) {
  const tw = W < 500 ? 130 : 150
  const th = 52
  let tx = b.x + b.barW + 8
  let ty = BASELINE_Y - b.barH - th - 4
  if (tx + tw > W - 16) tx = b.x - tw - 8
  if (ty < 16) ty = BASELINE_Y - b.barH + 8

  const pctLabel =
    b.result.placement === 1
      ? '1st place'
      : `Top ${((1 - b.pct + 0.005) * 100).toFixed(0)}%`

  const maxChars = W < 500 ? 16 : 20
  const name = b.result.tournament_name.length > maxChars
    ? b.result.tournament_name.slice(0, maxChars - 1) + '…'
    : b.result.tournament_name

  return (
    <g className="pointer-events-none">
      <rect x={tx} y={ty} width={tw} height={th} rx={6} fill="#0a0a0a" stroke="white" strokeOpacity={0.1} />
      <text x={tx + 8} y={ty + 15} fill="white" fillOpacity={0.9} fontSize={fontSize} fontWeight="600">
        {name}
      </text>
      <text x={tx + 8} y={ty + 30} fill="white" fillOpacity={0.4} fontSize={fontSize - 1} fontFamily="monospace">
        {ordinal(b.result.placement)} / {b.result.total_participants}, {pctLabel}
      </text>
      <text x={tx + 8} y={ty + 44} fill="white" fillOpacity={0.2} fontSize={fontSize - 2}>
        {fmtDate(b.result.tournament_date)} · {b.result.semester_name}
      </text>
    </g>
  )
}

// ── HUD bracket ───────────────────────────────────────────────────────────

function Bracket({ x, y, flipX, flipY }: { x: number; y: number; flipX?: boolean; flipY?: boolean }) {
  const sx = flipX ? -1 : 1
  const sy = flipY ? -1 : 1
  return (
    <g>
      <line x1={x} y1={y} x2={x + 10 * sx} y2={y} stroke="white" strokeOpacity={0.06} />
      <line x1={x} y1={y} x2={x} y2={y + 10 * sy} stroke="white" strokeOpacity={0.06} />
    </g>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function tierColor(pct: number, placement: number): string {
  if (placement === 1) return '#fbbf24'
  if (placement <= 3) return '#fb923c'
  if (pct >= 0.75) return '#34d399'
  if (pct >= 0.5) return '#22d3ee'
  if (pct >= 0.25) return '#60a5fa'
  return '#f87171'
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

/** "Spring 2025" → "SP25", "Fall 2024" → "FA24" */
function abbreviateSemester(name: string, shorten: boolean): string {
  if (!shorten) return name
  const match = name.match(/^(Spring|Fall|Summer)\s+(\d{4})$/i)
  if (!match) return name.length > 6 ? name.slice(0, 5) + '…' : name
  const prefix = match[1].slice(0, 2).toUpperCase()
  const year = match[2].slice(2)
  return `${prefix}${year}`
}
